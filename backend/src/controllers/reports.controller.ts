import { Request, Response } from 'express';
import { supabaseAdmin } from '../utils/supabase';

export async function getDashboardData(req: Request, res: Response): Promise<void> {
  const user = req.user;
  if (!user || !user.shop_id) {
    res.status(400).json({ error: 'User must be associated with a shop' });
    return;
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const isoToday = startOfToday.toISOString();

  try {
    const isStaff = user.role === 'staff';

    // 1. Fetch Today Stats (New, Delivered, Revenue, Pending Pickup)
    let newRepairsQuery = supabaseAdmin
      .from('repairs')
      .select('id', { count: 'exact', head: true })
      .eq('shop_id', user.shop_id)
      .gte('created_at', isoToday);

    let deliveredQuery = supabaseAdmin
      .from('repairs')
      .select('id', { count: 'exact', head: true })
      .eq('shop_id', user.shop_id)
      .eq('status', 'delivered')
      .gte('updated_at', isoToday);

    let revenueQuery = supabaseAdmin
      .from('repairs')
      .select('estimate, advance')
      .eq('shop_id', user.shop_id)
      .gte('created_at', isoToday);

    let pendingDeliveriesQuery = supabaseAdmin
      .from('repairs')
      .select('id', { count: 'exact', head: true })
      .eq('shop_id', user.shop_id)
      .eq('status', 'ready');

    let outstandingQuery = supabaseAdmin
      .from('repairs')
      .select('estimate, advance')
      .eq('shop_id', user.shop_id)
      .neq('status', 'delivered')
      .neq('status', 'cancelled');

    // Scoping for staff members
    if (isStaff) {
      newRepairsQuery = newRepairsQuery.eq('staff_id', user.id);
      deliveredQuery = deliveredQuery.eq('staff_id', user.id);
      revenueQuery = revenueQuery.eq('staff_id', user.id);
      pendingDeliveriesQuery = pendingDeliveriesQuery.eq('staff_id', user.id);
      outstandingQuery = outstandingQuery.eq('staff_id', user.id);
    }

    const [newCountRes, deliveredCountRes, revRes, pendingCountRes, outstandingRes] = await Promise.all([
      newRepairsQuery,
      deliveredQuery,
      revenueQuery,
      pendingDeliveriesQuery,
      outstandingQuery
    ]);

    // Compute revenue collected (sum of advances collected today)
    const revenueCollected = (revRes.data || []).reduce((sum, r) => sum + parseFloat(r.advance as any || 0), 0);

    // Compute total outstanding balance
    const totalOutstandingBalance = (outstandingRes.data || []).reduce((sum, r) => {
      const est = parseFloat(r.estimate as any || 0);
      const adv = parseFloat(r.advance as any || 0);
      return sum + (est - adv);
    }, 0);

    const todayStats = {
      newRepairs: newCountRes.count || 0,
      delivered: deliveredCountRes.count || 0,
      revenueCollected,
      pendingDeliveries: pendingCountRes.count || 0,
      totalOutstandingBalance
    };

    // 2. Fetch Repairs Grouped by Status
    let statusQuery = supabaseAdmin
      .from('repairs')
      .select('status')
      .eq('shop_id', user.shop_id);

    if (isStaff) {
      statusQuery = statusQuery.eq('staff_id', user.id);
    }

    const { data: statusData } = await statusQuery;
    
    const repairsByStatus = {
      pending: 0,
      repairing: 0,
      ready: 0,
      delivered: 0,
      cancelled: 0
    };

    (statusData || []).forEach((r) => {
      const s = r.status as keyof typeof repairsByStatus;
      if (repairsByStatus[s] !== undefined) {
        repairsByStatus[s]++;
      }
    });

    // 3. Fetch Recent 5 repairs
    let recentQuery = supabaseAdmin
      .from('repairs')
      .select(`
        *,
        device:devices(*, customer:customers(*)),
        assigned_staff:users!repairs_staff_id_fkey(id, name, staff_id)
      `)
      .eq('shop_id', user.shop_id);

    if (isStaff) {
      recentQuery = recentQuery.eq('staff_id', user.id);
    }

    const { data: recentRepairs, error: recentError } = await recentQuery
      .order('created_at', { ascending: false })
      .limit(5);

    if (recentError) {
      res.status(400).json({ error: recentError.message });
      return;
    }

    // 4. Invoke Supabase RPC monthly revenue
    const { data: monthlyRevenue, error: rpcRevError } = await supabaseAdmin.rpc('get_monthly_revenue', {
      p_shop_id: user.shop_id,
      p_staff_id: isStaff ? user.id : null
    });

    if (rpcRevError) {
      res.status(400).json({ error: rpcRevError.message });
      return;
    }

    // 5. Invoke Supabase RPC top device brands
    const { data: topDeviceBrands, error: rpcBrandError } = await supabaseAdmin.rpc('get_top_device_brands', {
      p_shop_id: user.shop_id,
      p_staff_id: isStaff ? user.id : null
    });

    if (rpcBrandError) {
      res.status(400).json({ error: rpcBrandError.message });
      return;
    }

    res.json({
      todayStats,
      repairsByStatus,
      recentRepairs: recentRepairs || [],
      monthlyRevenue: monthlyRevenue || [],
      topDeviceBrands: topDeviceBrands || []
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch dashboard metrics' });
  }
}

export async function getRepairsReport(req: Request, res: Response): Promise<void> {
  const user = req.user;
  if (!user || !user.shop_id) {
    res.status(400).json({ error: 'User must be associated with a shop' });
    return;
  }

  const fromDate = req.query.from as string;
  const toDate = req.query.to as string;
  const status = req.query.status as string;
  const staffId = req.query.staffId as string;

  try {
    let query = supabaseAdmin
      .from('repairs')
      .select(`
        *,
        device:devices(*, customer:customers(*)),
        assigned_staff:users!repairs_staff_id_fkey(id, name, staff_id)
      `)
      .eq('shop_id', user.shop_id);

    // Apply role limits (Staff only sees their own repairs)
    if (user.role === 'staff') {
      query = query.eq('staff_id', user.id);
    } else if (staffId) {
      query = query.eq('staff_id', staffId);
    }

    if (fromDate) query = query.gte('created_at', fromDate);
    if (toDate) query = query.lte('created_at', toDate);
    if (status && status !== 'all') query = query.eq('status', status);

    const { data: repairs, error } = await query.order('created_at', { ascending: false });

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ repairs: repairs || [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate repairs summary' });
  }
}

export async function getStaffPerformanceReport(req: Request, res: Response): Promise<void> {
  const user = req.user;
  if (!user || !user.shop_id) {
    res.status(400).json({ error: 'User must be associated with a shop' });
    return;
  }

  if (user.role !== 'owner') {
    res.status(403).json({ error: 'Forbidden: Owner access only' });
    return;
  }

  const fromDate = req.query.from as string;
  const toDate = req.query.to as string;

  if (!fromDate || !toDate) {
    res.status(400).json({ error: 'Parameters from and to dates are required' });
    return;
  }

  try {
    const { data: performance, error } = await supabaseAdmin.rpc('get_staff_performance', {
      p_shop_id: user.shop_id,
      p_from: fromDate,
      p_to: toDate
    });

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ performance: performance || [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load staff performance report' });
  }
}

export async function getAgingReport(req: Request, res: Response): Promise<void> {
  const user = req.user;
  if (!user || !user.shop_id) {
    res.status(400).json({ error: 'User must be associated with a shop' });
    return;
  }

  try {
    // Fetch pending or repairing repair tickets
    const { data: repairs, error } = await supabaseAdmin
      .from('repairs')
      .select(`
        *,
        device:devices(*, customer:customers(*)),
        assigned_staff:users!repairs_staff_id_fkey(id, name, staff_id)
      `)
      .eq('shop_id', user.shop_id)
      .in('status', ['pending', 'repairing'])
      .order('created_at', { ascending: true });

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    // Compute age in days in JS
    const agingRepairs = (repairs || []).map((r) => {
      const createdTime = new Date(r.created_at).getTime();
      const diffTime = Math.abs(Date.now() - createdTime);
      const daysOpen = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      return {
        ...r,
        daysOpen
      };
    });

    res.json({ agingRepairs });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate aging logs' });
  }
}

export async function getAuditLogs(req: Request, res: Response): Promise<void> {
  const user = req.user;
  if (!user || !user.shop_id) {
    res.status(400).json({ error: 'User must be associated with a shop' });
    return;
  }

  if (user.role !== 'owner') {
    res.status(403).json({ error: 'Forbidden: Owner access only' });
    return;
  }

  const fromDate = req.query.from as string;
  const toDate = req.query.to as string;
  const staffId = req.query.staffId as string;
  const page = parseInt(req.query.page as string || '1');
  const limit = parseInt(req.query.limit as string || '20');
  const offset = (page - 1) * limit;

  try {
    let query = supabaseAdmin
      .from('repair_history')
      .select(`
        *,
        repair:repairs!inner(id, job_number, shop_id, device:devices(id, brand, model)),
        changer:users(id, name, role)
      `, { count: 'exact' })
      .eq('repair.shop_id', user.shop_id);

    if (fromDate) query = query.gte('created_at', fromDate);
    if (toDate) query = query.lte('created_at', toDate);
    if (staffId) query = query.eq('changed_by', staffId);

    const { data: logs, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({
      logs: logs || [],
      page,
      limit,
      totalCount: count || 0,
      hasMore: (logs || []).length === limit
    });
  } catch (err) {
    console.error('Audit logs error:', err);
    res.status(500).json({ error: 'Failed to retrieve system audit logs' });
  }
}
