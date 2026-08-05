import { Request, Response } from 'express';
import { randomBytes } from 'crypto';
import { supabaseAdmin } from '../utils/supabase';

// Generate a secure temporary password (alphanumeric, guaranteed at least one digit and one uppercase letter).
// Passwords cannot be recovered in plain text because Supabase Auth stores them as one-way bcrypt hashes,
// so the secure alternative is generating a fresh temporary password the admin can share with the owner.
function generateTemporaryPassword(length = 10): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = randomBytes(length);
  let pwd = '';
  for (let i = 0; i < length; i++) pwd += chars[bytes[i] % chars.length];
  if (!/\d/.test(pwd)) pwd = pwd.slice(0, -1) + '2';
  if (!/[A-Z]/.test(pwd)) pwd = pwd.slice(0, -1) + 'Z';
  return pwd;
}

export async function resetShopOwnerPassword(req: Request, res: Response): Promise<void> {
  const { id } = req.params; // Shop ID

  try {
    // 1. Fetch the shop to identify the owner_id
    const { data: shop, error: shopError } = await supabaseAdmin
      .from('shops')
      .select('owner_id')
      .eq('id', id)
      .single();

    if (shopError || !shop) {
      res.status(404).json({ error: 'Shop not found' });
      return;
    }

    // 2. Set a fresh temporary password on the owner's auth account via the Admin SDK
    const temporaryPassword = generateTemporaryPassword();
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(shop.owner_id, {
      password: temporaryPassword
    });

    if (updateError) {
      res.status(400).json({ error: updateError.message || 'Failed to reset password' });
      return;
    }

    res.json({
      message: 'Password reset successfully. Share the temporary password with the shop owner.',
      temporaryPassword
    });
  } catch (err) {
    console.error('Reset shop owner password error:', err);
    res.status(500).json({ error: 'Failed to reset shop owner password' });
  }
}

export async function getSuperAdminDashboard(_req: Request, res: Response): Promise<void> {
  try {
    // 1. Fetch all shops with their owner profile (excluding the non-existent email column on public.users)
    const { data: shops, error: shopsError } = await supabaseAdmin
      .from('shops')
      .select(`
        *,
        owner:users!shops_owner_id_fkey(id, name, is_active, created_at)
      `);

    if (shopsError) {
      res.status(400).json({ error: shopsError.message });
      return;
    }

    // 2. Fetch auth users to map emails
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers();
    const emailMap: Record<string, string> = {};
    if (!authError && authData && authData.users) {
      for (const u of authData.users) {
        if (u.email) {
          emailMap[u.id] = u.email;
        }
      }
    }

    // 3. Fetch global platform stats
    const { count: totalShops, error: countShopsErr } = await supabaseAdmin
      .from('shops')
      .select('*', { count: 'exact', head: true });

    const { count: totalRepairs, error: countRepairsErr } = await supabaseAdmin
      .from('repairs')
      .select('*', { count: 'exact', head: true });

    const { count: totalUsers, error: countUsersErr } = await supabaseAdmin
      .from('users')
      .select('*', { count: 'exact', head: true });

    if (countShopsErr || countRepairsErr || countUsersErr) {
      res.status(400).json({ error: 'Failed to compute platform statistics' });
      return;
    }

    // 4. For each shop, get total repairs count and map owner email
    const shopsWithStats = await Promise.all(
      (shops || []).map(async (shop) => {
        const { count: repairsCount } = await supabaseAdmin
          .from('repairs')
          .select('*', { count: 'exact', head: true })
          .eq('shop_id', shop.id);

        const owner = shop.owner ? {
          ...shop.owner,
          email: emailMap[shop.owner.id] || ''
        } : null;

        return {
          ...shop,
          owner,
          repairsCount: repairsCount || 0
        };
      })
    );

    res.json({
      stats: {
        totalShops: totalShops || 0,
        totalRepairs: totalRepairs || 0,
        totalUsers: totalUsers || 0
      },
      shops: shopsWithStats
    });
  } catch (err) {
    console.error('Superadmin dashboard error:', err);
    res.status(500).json({ error: 'Failed to fetch superadmin dashboard data' });
  }
}

export async function toggleShopStatus(req: Request, res: Response): Promise<void> {
  const { id } = req.params; // Shop ID

  try {
    // 1. Fetch the shop to identify the owner_id
    const { data: shop, error: shopError } = await supabaseAdmin
      .from('shops')
      .select('owner_id')
      .eq('id', id)
      .single();

    if (shopError || !shop) {
      res.status(404).json({ error: 'Shop not found' });
      return;
    }

    // 2. Get owner profile
    const { data: owner, error: ownerError } = await supabaseAdmin
      .from('users')
      .select('is_active')
      .eq('id', shop.owner_id)
      .single();

    if (ownerError || !owner) {
      res.status(404).json({ error: 'Shop owner profile not found' });
      return;
    }

    const newStatus = !owner.is_active;

    // 3. Update the owner record
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ is_active: newStatus })
      .eq('id', shop.owner_id);

    if (updateError) {
      res.status(400).json({ error: updateError.message });
      return;
    }

    // 4. Update status for all other users under this shop as well
    await supabaseAdmin
      .from('users')
      .update({ is_active: newStatus })
      .eq('shop_id', id);

    res.json({
      message: `Shop owner account ${newStatus ? 'activated' : 'deactivated'} successfully`,
      is_active: newStatus
    });
  } catch (err) {
    console.error('Toggle shop status error:', err);
    res.status(500).json({ error: 'Failed to toggle shop status' });
  }
}

export async function getStorageMetricsHandler(_req: Request, res: Response): Promise<void> {
  try {
    const bucketList = [
      'device-photos',
      'customer-photos',
      'shop-logos',
      'delivery-photos',
      'rate-card-images',
      'carousel-images',
      'owner-photos'
    ];

    const bucketMetrics: Array<{
      name: string;
      fileCount: number;
      totalSizeBytes: number;
      totalSizeMB: string;
      files: Array<{ name: string; size: number; created_at: string; url: string }>;
    }> = [];

    let totalGlobalBytes = 0;
    let totalGlobalFiles = 0;

    for (const bucketName of bucketList) {
      try {
        const { data: files, error } = await supabaseAdmin.storage
          .from(bucketName)
          .list('', { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });

        if (error || !files) {
          bucketMetrics.push({
            name: bucketName,
            fileCount: 0,
            totalSizeBytes: 0,
            totalSizeMB: '0.00',
            files: []
          });
          continue;
        }

        const validFiles = files.filter(f => f.name && !f.name.startsWith('.emptyFolderPlaceholder'));
        
        let bucketBytes = 0;
        const mappedFiles = validFiles.map(f => {
          const fileSize = f.metadata?.size || 0;
          bucketBytes += fileSize;
          const { data: pubData } = supabaseAdmin.storage.from(bucketName).getPublicUrl(f.name);
          return {
            name: f.name,
            size: fileSize,
            created_at: f.created_at || new Date().toISOString(),
            url: pubData.publicUrl
          };
        });

        totalGlobalBytes += bucketBytes;
        totalGlobalFiles += validFiles.length;

        bucketMetrics.push({
          name: bucketName,
          fileCount: validFiles.length,
          totalSizeBytes: bucketBytes,
          totalSizeMB: (bucketBytes / (1024 * 1024)).toFixed(2),
          files: mappedFiles
        });
      } catch (err) {
        console.error(`Error querying bucket ${bucketName}:`, err);
        bucketMetrics.push({
          name: bucketName,
          fileCount: 0,
          totalSizeBytes: 0,
          totalSizeMB: '0.00',
          files: []
        });
      }
    }

    const totalGlobalMB = (totalGlobalBytes / (1024 * 1024)).toFixed(2);
    const quotaLimitMB = 1024;
    const usagePercent = ((totalGlobalBytes / (1024 * 1024 * 1024)) * 100).toFixed(1);

    res.json({
      summary: {
        totalFiles: totalGlobalFiles,
        totalSizeBytes: totalGlobalBytes,
        totalSizeMB: totalGlobalMB,
        quotaLimitMB,
        usagePercent,
        status: 'Healthy'
      },
      buckets: bucketMetrics
    });
  } catch (err) {
    console.error('Storage metrics error:', err);
    res.status(500).json({ error: 'Failed to retrieve Supabase storage metrics' });
  }
}

export async function deleteStorageFileHandler(req: Request, res: Response): Promise<void> {
  const { bucket, file } = req.query;
  if (!bucket || !file) {
    res.status(400).json({ error: 'Bucket and file parameters are required' });
    return;
  }

  try {
    const { error } = await supabaseAdmin.storage
      .from(bucket as string)
      .remove([file as string]);

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ message: `File ${file} deleted successfully from ${bucket}` });
  } catch (err) {
    console.error('Delete storage file error:', err);
    res.status(500).json({ error: 'Failed to delete file from storage' });
  }
}
