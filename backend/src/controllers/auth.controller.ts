import { Request, Response } from 'express';
import { z } from 'zod';
import { supabaseClient, supabaseAdmin } from '../utils/supabase';
import { uploadPhoto } from '../utils/photoUpload';

// Validation Schemas
const registerOwnerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  shopName: z.string().min(2, 'Shop name must be at least 2 characters'),
  shopAddress: z.string().optional(),
  shopPhone: z.string().optional()
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters')
});

const createStaffSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters')
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required')
});

// Controllers
export async function registerOwner(req: Request, res: Response): Promise<void> {
  try {
    const data = registerOwnerSchema.parse(req.body);

    // 1. Create auth user with supabaseAdmin (so we can auto-confirm their email)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { name: data.name, role: 'owner' }
    });

    if (authError || !authData.user) {
      res.status(400).json({ error: authError?.message || 'Failed to create auth user' });
      return;
    }

    const userId = authData.user.id;

    // 2. Create the Shop record (referencing the newly created user as owner)
    // Note: Due to RLS, we use supabaseAdmin here to bypass policies since the profile setup is in progress.
    const { data: shop, error: shopError } = await supabaseAdmin
      .from('shops')
      .insert({
        name: data.shopName,
        address: data.shopAddress || null,
        phone: data.shopPhone || null,
        owner_id: userId
      })
      .select()
      .single();

    if (shopError || !shop) {
      // Cleanup: delete the auth user if shop creation fails to prevent orphan auth records
      await supabaseAdmin.auth.admin.deleteUser(userId);
      res.status(400).json({ error: shopError?.message || 'Failed to create shop' });
      return;
    }

    // 3. Update the user with the shop_id (the trigger automatically created the user record in public.users, but shop_id was null)
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .update({ shop_id: shop.id })
      .eq('id', userId)
      .select()
      .single();

    if (userError || !user) {
      // Cleanup
      await supabaseAdmin.from('shops').delete().eq('id', shop.id);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      res.status(400).json({ error: userError?.message || 'Failed to link user to shop' });
      return;
    }

    // 4. Log the user in to generate access/refresh tokens
    const { data: sessionData, error: sessionError } = await supabaseClient.auth.signInWithPassword({
      email: data.email,
      password: data.password
    });

    if (sessionError || !sessionData.session) {
      res.status(400).json({ error: sessionError?.message || 'Failed to sign in after registration' });
      return;
    }

    res.status(201).json({
      accessToken: sessionData.session.access_token,
      refreshToken: sessionData.session.refresh_token,
      user: {
        id: user.id,
        name: user.name,
        email: data.email,
        role: user.role,
        staff_id: user.staff_id,
        shop_id: user.shop_id,
        is_active: user.is_active,
        created_at: user.created_at
      },
      shop
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Registration internal server error', message: (err as any).message });
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const data = loginSchema.parse(req.body);

    // 1. Authenticate with Supabase Auth
    const { data: sessionData, error: sessionError } = await supabaseClient.auth.signInWithPassword({
      email: data.email,
      password: data.password
    });

    if (sessionError || !sessionData.user || !sessionData.session) {
      res.status(401).json({ error: sessionError?.message || 'Invalid credentials' });
      return;
    }

    const userId = sessionData.user.id;

    // 2. Fetch profile from database, joining with shop
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('*, shop:shops(*)')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      res.status(403).json({ error: 'GK Repair profile not found for this user account' });
      return;
    }

    // 3. Block login if account is deactivated
    if (!profile.is_active) {
      // Invalidate the session on Supabase immediately
      await supabaseClient.auth.signOut();
      res.status(403).json({ error: 'Your account is deactivated. Please contact the store owner.' });
      return;
    }

    res.json({
      accessToken: sessionData.session.access_token,
      refreshToken: sessionData.session.refresh_token,
      user: {
        id: profile.id,
        name: profile.name,
        email: sessionData.user.email,
        role: profile.role,
        staff_id: profile.staff_id,
        shop_id: profile.shop_id,
        is_active: profile.is_active,
        created_at: profile.created_at
      },
      shop: profile.shop
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    res.status(500).json({ error: 'Login internal server error' });
  }
}

export async function createStaff(req: Request, res: Response): Promise<void> {
  const owner = req.user;
  if (!owner || !owner.shop_id) {
    res.status(400).json({ error: 'Owner must be linked to a shop to create staff' });
    return;
  }

  try {
    const data = createStaffSchema.parse(req.body);

    // 1. Query staff count for this shop to generate sequential GKxxx ID
    const { count, error: countError } = await supabaseAdmin
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('shop_id', owner.shop_id)
      .eq('role', 'staff');

    if (countError) {
      res.status(500).json({ error: 'Failed to compute staff serial index' });
      return;
    }

    const nextIndex = (count || 0) + 1;
    const staff_id = `GK${String(nextIndex).padStart(3, '0')}`; // GK001, GK002...

    // 2. Create the user in auth.users
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        name: data.name,
        role: 'staff',
        staff_id,
        shop_id: owner.shop_id
      }
    });

    if (authError || !authData.user) {
      res.status(400).json({ error: authError?.message || 'Failed to create staff credentials' });
      return;
    }

    // 3. Fetch the public user profile synced by database trigger
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (profileError || !profile) {
      res.status(500).json({ error: 'Staff credentials created, but profile failed to sync.' });
      return;
    }

    res.status(201).json({ staff: profile });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    res.status(500).json({ error: 'Failed to create staff member' });
  }
}

export async function refresh(req: Request, res: Response): Promise<void> {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);

    const { data, error } = await supabaseClient.auth.refreshSession({
      refresh_token: refreshToken
    });

    if (error || !data.session) {
      res.status(401).json({ error: error?.message || 'Invalid refresh token' });
      return;
    }

    res.json({
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    res.status(500).json({ error: 'Refresh session failed' });
  }
}

export async function logout(req: Request, res: Response): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      // Local clean out call
      await supabaseClient.auth.signOut();
    }
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to logout session' });
  }
}

export async function getMe(req: Request, res: Response): Promise<void> {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: 'Authentication credentials not found' });
    return;
  }

  try {
    const { data: profile, error } = await supabaseAdmin
      .from('users')
      .select('*, shop:shops(*)')
      .eq('id', user.id)
      .single();

    if (error || !profile) {
      res.status(404).json({ error: 'User profile not found' });
      return;
    }

    res.json({ profile });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch identity profile' });
  }
}

// Owner Exclusive: get all staff members in owner's shop
export async function getStaff(req: Request, res: Response): Promise<void> {
  const owner = req.user;
  if (!owner || !owner.shop_id) {
    res.status(400).json({ error: 'Owner must be linked to a shop' });
    return;
  }

  try {
    const { data: staff, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('shop_id', owner.shop_id)
      .eq('role', 'staff')
      .order('created_at', { ascending: true });

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ staff });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch staff members' });
  }
}

// Owner Exclusive: Toggle active state of staff member
export async function toggleStaffStatus(req: Request, res: Response): Promise<void> {
  const owner = req.user;
  const { id } = req.params;

  if (!owner || !owner.shop_id) {
    res.status(400).json({ error: 'Owner must be linked to a shop' });
    return;
  }

  try {
    // 1. Fetch staff member first to verify they are in the same shop
    const { data: staff, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', id)
      .eq('shop_id', owner.shop_id)
      .eq('role', 'staff')
      .single();

    if (fetchError || !staff) {
      res.status(404).json({ error: 'Staff member not found in your shop' });
      return;
    }

    // 2. Toggle active state
    const newStatus = !staff.is_active;

    const { data: updatedStaff, error: updateError } = await supabaseAdmin
      .from('users')
      .update({ is_active: newStatus })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      res.status(400).json({ error: updateError.message });
      return;
    }

    res.json({ message: `Staff status changed to ${newStatus ? 'active' : 'inactive'}`, staff: updatedStaff });
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle staff status' });
  }
}

export async function updateProfile(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const schema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Invalid email address')
  });

  try {
    const { name, email } = schema.parse(req.body);

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      {
        email,
        user_metadata: { name }
      }
    );

    if (authError || !authData.user) {
      res.status(400).json({ error: authError?.message || 'Failed to update credentials' });
      return;
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .update({ name })
      .eq('id', userId)
      .select('*, shop:shops(*)')
      .single();

    if (profileError || !profile) {
      res.status(400).json({ error: profileError?.message || 'Failed to update profile name' });
      return;
    }

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: profile.id,
        name: profile.name,
        email: authData.user.email,
        role: profile.role,
        staff_id: profile.staff_id,
        shop_id: profile.shop_id,
        is_active: profile.is_active,
        created_at: profile.created_at
      },
      shop: profile.shop
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    res.status(500).json({ error: 'Failed to update profile' });
  }
}

export async function changePassword(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id;
  const userEmail = req.user?.email;
  if (!userId || !userEmail) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const schema = z.object({
    currentPassword: z.string().min(6),
    newPassword: z.string().min(6, 'Password must be at least 6 characters')
  });

  try {
    const { currentPassword, newPassword } = schema.parse(req.body);

    const { error: signInError } = await supabaseClient.auth.signInWithPassword({
      email: userEmail,
      password: currentPassword
    });

    if (signInError) {
      res.status(400).json({ error: 'Incorrect current password' });
      return;
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password: newPassword }
    );

    if (updateError) {
      res.status(400).json({ error: updateError.message });
      return;
    }

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    res.status(500).json({ error: 'Failed to change password' });
  }
}

export async function resetStaffPassword(req: Request, res: Response): Promise<void> {
  const owner = req.user;
  if (!owner || owner.role !== 'owner' || !owner.shop_id) {
    res.status(403).json({ error: 'Forbidden: Owner access only' });
    return;
  }

  const schema = z.object({
    staffId: z.string().uuid('Invalid staff user ID')
  });

  try {
    const { staffId } = schema.parse(req.body);

    const { data: staff, error: staffError } = await supabaseAdmin
      .from('users')
      .select('id, role, shop_id')
      .eq('id', staffId)
      .eq('shop_id', owner.shop_id)
      .eq('role', 'staff')
      .single();

    if (staffError || !staff) {
      res.status(404).json({ error: 'Staff member not found in your shop' });
      return;
    }

    const { data: authUser, error: authUserError } = await supabaseAdmin.auth.admin.getUserById(staffId);
    if (authUserError || !authUser.user || !authUser.user.email) {
      res.status(404).json({ error: 'Staff authentication record not found' });
      return;
    }

    const { error: resetError } = await supabaseClient.auth.resetPasswordForEmail(authUser.user.email, {
      redirectTo: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password`
    });

    if (resetError) {
      res.status(400).json({ error: resetError.message });
      return;
    }

    res.json({ message: 'Staff password reset recovery email sent successfully' });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    res.status(500).json({ error: 'Failed to send reset link' });
  }
}

export async function updateShop(req: Request, res: Response): Promise<void> {
  const owner = req.user;
  if (!owner || owner.role !== 'owner' || !owner.shop_id) {
    res.status(403).json({ error: 'Forbidden: Owner access only' });
    return;
  }

  const schema = z.object({
    name: z.string().min(2, 'Shop name must be at least 2 characters'),
    address: z.string().optional().nullable(),
    phone: z.string().optional().nullable()
  });

  try {
    const data = schema.parse(req.body);

    const { data: shop, error: shopError } = await supabaseAdmin
      .from('shops')
      .select('*')
      .eq('id', owner.shop_id)
      .single();

    if (shopError || !shop) {
      res.status(404).json({ error: 'Shop not found' });
      return;
    }

    let logoUrl = shop.logo_url;

    if (req.body.removeLogo === 'true') {
      logoUrl = null;
      if (shop.logo_url) {
        try {
          const oldPath = shop.logo_url.split('/shop-logos/')[1];
          if (oldPath) {
            await supabaseAdmin.storage.from('shop-logos').remove([oldPath]);
          }
        } catch (storageErr) {
          console.error('Failed to delete shop logo:', storageErr);
        }
      }
    } else if (req.file) {
      logoUrl = await uploadPhoto(req.file as Express.Multer.File, 'shop-logos');

      if (shop.logo_url) {
        try {
          const oldPath = shop.logo_url.split('/shop-logos/')[1];
          if (oldPath) {
            await supabaseAdmin.storage.from('shop-logos').remove([oldPath]);
          }
        } catch (storageErr) {
          console.error('Failed to delete old shop logo:', storageErr);
        }
      }
    }

    const { data: updatedShop, error: updateError } = await supabaseAdmin
      .from('shops')
      .update({
        name: data.name,
        address: data.address || null,
        phone: data.phone || null,
        logo_url: logoUrl
      })
      .eq('id', owner.shop_id)
      .select()
      .single();

    if (updateError || !updatedShop) {
      res.status(400).json({ error: updateError?.message || 'Failed to update shop' });
      return;
    }

    res.json({ message: 'Shop details updated successfully', shop: updatedShop });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    console.error('Update shop error:', err);
    res.status(500).json({ error: 'Failed to update shop profile' });
  }
}
