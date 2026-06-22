import { Request, Response } from 'express';
import { supabaseAdmin } from '../utils/supabase';

export async function getSuperAdminDashboard(_req: Request, res: Response): Promise<void> {
  try {
    // 1. Fetch all shops with their owner profile
    const { data: shops, error: shopsError } = await supabaseAdmin
      .from('shops')
      .select(`
        *,
        owner:users!shops_owner_id_fkey(id, name, email, is_active, created_at)
      `);

    if (shopsError) {
      res.status(400).json({ error: shopsError.message });
      return;
    }

    // 2. Fetch global platform stats
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

    // 3. For each shop, get total repairs count
    const shopsWithStats = await Promise.all(
      (shops || []).map(async (shop) => {
        const { count: repairsCount } = await supabaseAdmin
          .from('repairs')
          .select('*', { count: 'exact', head: true })
          .eq('shop_id', shop.id);

        return {
          ...shop,
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
      message: `Shop owner account has been ${newStatus ? 'activated' : 'deactivated'} successfully`, 
      success: true 
    });
  } catch (err) {
    console.error('Toggle shop status error:', err);
    res.status(500).json({ error: 'Failed to toggle shop status' });
  }
}
