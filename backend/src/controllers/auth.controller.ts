import { Request, Response } from 'express';
import { z } from 'zod';
import { supabaseClient, supabaseAdmin } from '../utils/supabase';
import { uploadPhoto } from '../utils/photoUpload';

// Validation Schemas
const registerOwnerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  shopName: z.string().trim().min(2, 'Shop name must be at least 2 characters'),
  shopAddress: z.string().trim().optional().nullable(),
  shopPhone: z.string().trim().optional().nullable(),
  shopType: z.string().default('Mobile Repair'),
  gstNumber: z.string().trim().optional().nullable(),
  communityUsername: z.string().trim().optional().nullable(),
  currencyCode: z.string().default('INR'),
  currencySymbol: z.string().default('₹')
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

// Helper to extract clean error message from Supabase or custom errors
function getErrorMessage(error: any, fallback: string): string {
  if (!error) return fallback;
  if (typeof error === 'string') return error;
  if (typeof error.message === 'string' && error.message.trim() !== '' && error.message !== '{}') {
    return error.message;
  }
  if (typeof error.error_description === 'string' && error.error_description.trim() !== '') {
    return error.error_description;
  }
  if (typeof error.error === 'string' && error.error.trim() !== '') {
    return error.error;
  }
  if (error.name === 'AuthRetryableFetchError' || error.status === 500) {
    return 'The authentication service encountered an issue. The email may already be registered, or there is a temporary database connection issue. Please try another email or log in.';
  }
  return error.name || fallback;
}

// Normalize text: trim and collapse internal whitespace so duplicate checks never false-positive on spacing
function normalizeText(value: string): string {
  return (value || '').trim().replace(/\s+/g, ' ');
}

// Normalize phone: strip all non-digit characters so formatting variants (+91 9976... vs +919976...) compare equally
function normalizePhone(value: string): string {
  return (value || '').replace(/[^\d]/g, '');
}

// Check whether an email is already registered in Supabase Auth (normalized to lowercase)
async function isEmailRegistered(email: string): Promise<boolean> {
  const target = (email || '').trim().toLowerCase();
  if (!target) return false;
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  if (error || !data) return false;
  return data.users.some(u => u.email && u.email.trim().toLowerCase() === target);
}

// Controllers
export async function registerOwner(req: Request, res: Response): Promise<void> {
  try {
    const data = registerOwnerSchema.parse(req.body);

    // Normalize the email up front so duplicate detection and auth creation are case/whitespace consistent
    const email = data.email.trim().toLowerCase();

    // Duplicate prevention: block ONLY exact duplicates (normalized), per business rules.
    // Email: case/whitespace-insensitive. Shop name: case-insensitive, whitespace-collapsed. Phone: digits-only.
    if (await isEmailRegistered(email)) {
      res.status(409).json({ error: 'This email is already registered. Please log in or use a different email address.' });
      return;
    }

    const { data: existingShops, error: existingShopsError } = await supabaseAdmin
      .from('shops')
      .select('name, phone');

    if (!existingShopsError && existingShops) {
      const targetName = normalizeText(data.shopName);
      const targetPhone = data.shopPhone ? normalizePhone(data.shopPhone) : '';

      const nameTaken = existingShops.some(s => s.name && normalizeText(s.name) === targetName);
      if (nameTaken) {
        res.status(409).json({ error: `A shop with the name "${data.shopName}" is already registered. Please use a different shop name.` });
        return;
      }

      if (targetPhone) {
        const phoneTaken = existingShops.some(s => s.phone && normalizePhone(s.phone) === targetPhone);
        if (phoneTaken) {
          res.status(409).json({ error: 'A shop with this phone number is already registered. Please use a different phone number.' });
          return;
        }
      }
    }

    let logoUrl: string | null = null;
    if (req.file) {
      try {
        logoUrl = await uploadPhoto(req.file as Express.Multer.File, 'shop-logos');
      } catch (uploadErr: any) {
        console.error('Failed to upload shop logo during registration:', uploadErr);
      }
    }

    // 1. Create auth user with supabaseAdmin (so we can auto-confirm their email)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: { name: data.name, role: 'owner' }
    });

    if (authError || !authData.user) {
      res.status(400).json({ error: getErrorMessage(authError, 'Failed to create auth user') });
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
        owner_id: userId,
        shop_type: data.shopType,
        gst_number: data.gstNumber || null,
        currency_symbol: data.currencySymbol,
        currency_code: data.currencyCode,
        logo_url: logoUrl
      })
      .select()
      .single();

    if (shopError || !shop) {
      // Cleanup: delete the auth user if shop creation fails to prevent orphan auth records
      if (logoUrl) {
        try {
          const path = logoUrl.split('/shop-logos/')[1];
          if (path) {
            await supabaseAdmin.storage.from('shop-logos').remove([path]);
          }
        } catch (e) {
          console.error('Failed to cleanup logo:', e);
        }
      }
      await supabaseAdmin.auth.admin.deleteUser(userId);
      res.status(400).json({ error: getErrorMessage(shopError, 'Failed to create shop') });
      return;
    }

    // 3. Update the user with the shop_id (the trigger automatically created the user record in public.users, but shop_id was null)
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .update({ 
        shop_id: shop.id,
        community_username: data.communityUsername || null
      })
      .eq('id', userId)
      .select()
      .single();

    if (userError || !user) {
      // Cleanup
      await supabaseAdmin.from('shops').delete().eq('id', shop.id);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      res.status(400).json({ error: getErrorMessage(userError, 'Failed to link user to shop') });
      return;
    }

    // 4. Log the user in to generate access/refresh tokens.
    // IMPORTANT: The account (auth user + shop) was already created above, so a failed sign-in here must NOT
    // leave a half-registered account that blocks retries with "already registered". Mirror the login flow's
    // Admin OTP bypass so Supabase rate limits (IP/email based 429s) cannot break signup, and clean up on failure.
    const sessionRes = await supabaseClient.auth.signInWithPassword({
      email,
      password: data.password
    });

    let sessionData = sessionRes.data;
    let sessionError = sessionRes.error;

    if (sessionError) {
      const errMsg = (sessionError.message || '').toLowerCase();
      const isRateLimit = sessionError.status === 429 ||
        errMsg.includes('rate limit') ||
        errMsg.includes('too many') ||
        errMsg.includes('over_email_send_rate_limit') ||
        errMsg.includes('retryable');

      if (isRateLimit) {
        try {
          console.log('[Auth System] Registration sign-in rate limit encountered. Executing Admin OTP session bypass...');
          const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
            type: 'magiclink',
            email
          });

          if (!linkError && linkData?.properties?.email_otp) {
            const { data: otpData, error: otpError } = await supabaseClient.auth.verifyOtp({
              email,
              token: linkData.properties.email_otp,
              type: 'magiclink'
            });

            if (!otpError && otpData.session && otpData.user) {
              sessionData = otpData as any;
              sessionError = null;
            }
          }
        } catch (bypassErr) {
          console.error('[Auth System] Registration rate limit bypass exception:', bypassErr);
        }
      }
    }

    if (sessionError || !sessionData?.session) {
      // Clean up the fully-created account so the user can retry registration cleanly
      if (logoUrl) {
        try {
          const path = logoUrl.split('/shop-logos/')[1];
          if (path) {
            await supabaseAdmin.storage.from('shop-logos').remove([path]);
          }
        } catch (e) {
          console.error('Failed to cleanup logo after registration sign-in failure:', e);
        }
      }
      await supabaseAdmin.from('shops').delete().eq('id', shop.id);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      res.status(400).json({ error: getErrorMessage(sessionError, 'Failed to sign in after registration. Please try logging in with your new credentials.') });
      return;
    }

    res.status(201).json({
      accessToken: sessionData.session.access_token,
      refreshToken: sessionData.session.refresh_token,
      user: {
        id: user.id,
        name: user.name,
        email,
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
    res.status(500).json({ error: 'Registration internal server error', message: getErrorMessage(err, 'Internal server error') });
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

    if (sessionError || !sessionData?.user || !sessionData?.session) {
      const message = sessionError?.status === 429
        ? 'Too many login attempts. Please wait a few minutes or use the "Forgot Password" option.'
        : getErrorMessage(sessionError, 'Invalid credentials');
      res.status(sessionError?.status === 429 ? 429 : 401).json({ error: message });
      return;
    }

    const userId = sessionData.user.id;

    // 2. Fetch profile from database, joining with shop
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('*, shop:shops!fk_users_shop(*)')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      res.status(403).json({ error: 'GK Repair profile not found for this user account' });
      return;
    }

    // 3. Block login if account is deactivated
    if (!profile.is_active) {
      await supabaseClient.auth.signOut();
      res.status(403).json({ error: 'Your account is deactivated. Please contact the store owner.' });
      return;
    }

    // 4. Register active session without blocking logins
    if (profile.role === 'owner') {
      try {
        const userAgent = (req.headers['user-agent'] || 'Unknown Device').slice(0, 150);
        const clientIp = (req.headers['x-forwarded-for'] as string || req.ip || 'Unknown IP').slice(0, 45);

        await supabaseAdmin
          .from('active_admin_sessions')
          .insert([{
            user_id: userId,
            shop_id: profile.shop_id,
            session_token: sessionData.session.access_token,
            device_info: userAgent,
            ip_address: clientIp,
            last_active_at: new Date().toISOString(),
            created_at: new Date().toISOString()
          }]);
      } catch (secErr) {
        console.error('Error logging active admin session:', secErr);
      }
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
        created_at: profile.created_at,
        home_address: profile.home_address,
        blood_group: profile.blood_group,
        dob: profile.dob,
        personal_phone: profile.personal_phone,
        aadhar_number: profile.aadhar_number,
        photo_url: profile.photo_url
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

    // 1. Query all existing staff_ids in the system to ensure global uniqueness and satisfy the table-wide UNIQUE constraint
    const { data: existingUsers, error: usersError } = await supabaseAdmin
      .from('users')
      .select('staff_id')
      .not('staff_id', 'is', null);

    if (usersError || !existingUsers) {
      res.status(500).json({ error: 'Failed to compute staff serial index' });
      return;
    }

    const takenIds = new Set(existingUsers.map(u => u.staff_id));
    let staff_id = '';
    for (let i = 1; i <= 999; i++) {
      const candidate = `GK${String(i).padStart(3, '0')}`;
      if (!takenIds.has(candidate)) {
        staff_id = candidate;
        break;
      }
    }

    if (!staff_id) {
      res.status(400).json({ error: 'Maximum staff limit reached in the system' });
      return;
    }

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
      res.status(400).json({ error: getErrorMessage(authError, 'Failed to create staff credentials') });
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
      res.status(401).json({ error: getErrorMessage(error, 'Invalid refresh token') });
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
      const token = authHeader.split(' ')[1];
      // Clean out session from active admin session tracking table
      await supabaseAdmin
        .from('active_admin_sessions')
        .delete()
        .eq('session_token', token);

      await supabaseClient.auth.signOut();
    }
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to logout session' });
  }
}

/**
 * List all active admin sessions for the shop owner (Max 6 limit tracking)
 */
export async function getAdminSessions(req: Request, res: Response): Promise<void> {
  const user = req.user;
  if (!user || user.role !== 'owner') {
    res.status(403).json({ error: 'Owner access required' });
    return;
  }

  const currentToken = req.headers.authorization?.split(' ')[1];

  try {
    // Delete stale sessions older than 24h
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    await supabaseAdmin
      .from('active_admin_sessions')
      .delete()
      .eq('user_id', user.id)
      .lt('last_active_at', cutoff);

    const { data: sessions, error } = await supabaseAdmin
      .from('active_admin_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('last_active_at', { ascending: false });

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    const formattedSessions = (sessions || []).map(s => ({
      ...s,
      isCurrentSession: s.session_token === currentToken
    }));

    res.json({
      sessions: formattedSessions,
      activeCount: formattedSessions.length,
      maxAllowed: 6
    });
  } catch (err: any) {
    console.error('Error fetching admin sessions:', err);
    res.status(500).json({ error: 'Failed to fetch admin sessions' });
  }
}

/**
 * Revoke an active admin session or all other sessions
 */
export async function revokeAdminSession(req: Request, res: Response): Promise<void> {
  const user = req.user;
  if (!user || user.role !== 'owner') {
    res.status(403).json({ error: 'Owner access required' });
    return;
  }

  const { sessionId, revokeAllOthers } = req.body;
  const currentToken = req.headers.authorization?.split(' ')[1];

  try {
    if (revokeAllOthers) {
      const { error } = await supabaseAdmin
        .from('active_admin_sessions')
        .delete()
        .eq('user_id', user.id)
        .neq('session_token', currentToken || '');

      if (error) throw error;
      res.json({ message: 'All other active admin sessions have been revoked successfully.' });
      return;
    }

    if (sessionId) {
      const { error } = await supabaseAdmin
        .from('active_admin_sessions')
        .delete()
        .eq('id', sessionId)
        .eq('user_id', user.id);

      if (error) throw error;
      res.json({ message: 'Session revoked successfully.' });
      return;
    }

    res.status(400).json({ error: 'Session ID or revokeAllOthers required' });
  } catch (err: any) {
    console.error('Error revoking admin session:', err);
    res.status(500).json({ error: 'Failed to revoke admin session' });
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
      .select('*, shop:shops!fk_users_shop(*)')
      .eq('id', user.id)
      .single();

    if (error || !profile) {
      res.status(404).json({ error: 'User profile not found' });
      return;
    }

    res.json({ 
      profile: {
        ...profile,
        email: user.email
      } 
    });
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

// Owner Exclusive: Permanently delete a staff member (auth user + profile)
export async function deleteStaff(req: Request, res: Response): Promise<void> {
  const owner = req.user;
  const { id } = req.params;

  if (!owner || !owner.shop_id) {
    res.status(400).json({ error: 'Owner must be linked to a shop' });
    return;
  }

  try {
    // 1. Verify the target is a staff member of this owner's shop
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

    // 2. Block deletion while the staff member has active (unfinished) repairs
    const { data: activeRepairs, error: activeError } = await supabaseAdmin
      .from('repairs')
      .select('id')
      .eq('staff_id', id)
      .not('status', 'in', '(delivered,cancelled)')
      .limit(1);

    if (activeError) throw activeError;

    if (activeRepairs && activeRepairs.length > 0) {
      res.status(400).json({
        error: 'Cannot delete staff with active repair orders. Reassign or complete their pending repairs first.'
      });
      return;
    }

    // 3. Delete the auth user. The public.users row is removed via ON DELETE CASCADE,
    //    and repairs/history staff_id references are set to NULL by their foreign keys.
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (authError) {
      res.status(400).json({ error: getErrorMessage(authError, 'Failed to delete staff credentials') });
      return;
    }

    res.json({ message: 'Staff member deleted successfully', deletedId: id });
  } catch (err) {
    console.error('Failed to delete staff:', err);
    res.status(500).json({ error: 'Failed to delete staff member' });
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
      res.status(400).json({ error: getErrorMessage(authError, 'Failed to update credentials') });
      return;
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .update({ name })
      .eq('id', userId)
      .select('*, shop:shops!fk_users_shop(*)')
      .single();

    if (profileError || !profile) {
      res.status(400).json({ error: getErrorMessage(profileError, 'Failed to update profile name') });
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

export async function updateOwnerIdCard(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const schema = z.object({
    homeAddress: z.string().optional().nullable(),
    bloodGroup: z.string().optional().nullable(),
    dob: z.string().optional().nullable(),
    personalPhone: z.string().optional().nullable(),
    aadharNumber: z.string().optional().nullable()
  });

  try {
    const data = schema.parse(req.body);

    let photoUrl: string | null = null;
    if (req.file) {
      try {
        photoUrl = await uploadPhoto(req.file as Express.Multer.File, 'owner-photos');
      } catch (uploadErr: any) {
        console.error('Owner photo upload failed:', uploadErr);
        res.status(400).json({ error: uploadErr.message || 'Failed to upload photo' });
        return;
      }
    }

    // Prepare update payload
    const updatePayload: any = {
      home_address: data.homeAddress || null,
      blood_group: data.bloodGroup || null,
      dob: data.dob || null,
      personal_phone: data.personalPhone || null,
      aadhar_number: data.aadharNumber || null
    };

    if (photoUrl) {
      updatePayload.photo_url = photoUrl;
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .update(updatePayload)
      .eq('id', userId)
      .select('*, shop:shops!fk_users_shop(*)')
      .single();

    if (profileError || !profile) {
      if (photoUrl) {
        try {
          const path = photoUrl.split('/owner-photos/')[1];
          if (path) {
            await supabaseAdmin.storage.from('owner-photos').remove([path]);
          }
        } catch (e) {
          console.error('Failed to cleanup owner photo:', e);
        }
      }
      res.status(400).json({ error: getErrorMessage(profileError, 'Failed to update owner ID details') });
      return;
    }

    res.json({
      message: 'Owner ID card details updated successfully',
      profile
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    console.error('Failed to update owner ID card details:', err);
    res.status(500).json({ error: 'Internal server error' });
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
      res.status(400).json({ error: getErrorMessage(updateError, 'Failed to update password') });
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
      res.status(400).json({ error: getErrorMessage(resetError, 'Failed to reset password') });
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
      res.status(400).json({ error: getErrorMessage(updateError, 'Failed to update shop') });
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
