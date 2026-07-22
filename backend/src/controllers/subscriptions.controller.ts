import { Request, Response } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../utils/supabase';
import { sendSubscriptionWhatsAppBill } from '../utils/whatsapp';

const saveSubscriptionSchema = z.object({
  customer_id: z.string().optional().nullable(),
  customer_name: z.string().min(1, 'Customer name is required'),
  phone_number: z.string().min(3, 'Phone number is required'),
  shop_name: z.string().optional().nullable(),
  year: z.number().int().min(2000).max(2100),
  january: z.number().nonnegative().default(0),
  january_paid_at: z.string().optional().nullable(),
  february: z.number().nonnegative().default(0),
  february_paid_at: z.string().optional().nullable(),
  march: z.number().nonnegative().default(0),
  march_paid_at: z.string().optional().nullable(),
  april: z.number().nonnegative().default(0),
  april_paid_at: z.string().optional().nullable(),
  may: z.number().nonnegative().default(0),
  may_paid_at: z.string().optional().nullable(),
  june: z.number().nonnegative().default(0),
  june_paid_at: z.string().optional().nullable(),
  july: z.number().nonnegative().default(0),
  july_paid_at: z.string().optional().nullable(),
  august: z.number().nonnegative().default(0),
  august_paid_at: z.string().optional().nullable(),
  september: z.number().nonnegative().default(0),
  september_paid_at: z.string().optional().nullable(),
  october: z.number().nonnegative().default(0),
  october_paid_at: z.string().optional().nullable(),
  november: z.number().nonnegative().default(0),
  november_paid_at: z.string().optional().nullable(),
  december: z.number().nonnegative().default(0),
  december_paid_at: z.string().optional().nullable(),
  notes: z.string().optional().nullable()
});

/**
 * Search customers or subscription records by name or phone
 */
export async function searchSubscriptions(req: Request, res: Response): Promise<void> {
  const search = (req.query.search as string || '').trim();
  const user = (req as any).user;

  if (!user || !user.shop_id) {
    res.status(400).json({ error: 'User must be associated with a shop' });
    return;
  }

  try {
    // 1. Search in customers table
    let customerQuery = supabaseAdmin
      .from('customers')
      .select('id, name, phone, address')
      .eq('shop_id', user.shop_id)
      .eq('is_active', true);

    if (search) {
      customerQuery = customerQuery.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    const { data: customers, error: custErr } = await customerQuery.limit(15);

    if (custErr) {
      res.status(400).json({ error: custErr.message });
      return;
    }

    // 2. Fetch associated shop name for current shop
    const { data: shop } = await supabaseAdmin
      .from('shops')
      .select('name')
      .eq('id', user.shop_id)
      .single();

    const shopName = shop?.name || '';

    // Map customer search results
    const results = (customers || []).map(c => ({
      customer_id: c.id,
      customer_name: c.name,
      phone_number: c.phone,
      shop_name: c.address || shopName
    }));

    res.status(200).json({ data: results });
  } catch (err: any) {
    console.error('Error searching subscriptions:', err);
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
}

/**
 * Get subscription record by phone number or customer_id for a given year
 */
export async function getSubscriptionRecord(req: Request, res: Response): Promise<void> {
  const user = (req as any).user;
  if (!user || !user.shop_id) {
    res.status(400).json({ error: 'User must be associated with a shop' });
    return;
  }

  const phone = (req.query.phone as string || '').trim();
  const customerId = (req.query.customer_id as string || '').trim();
  const year = parseInt(req.query.year as string) || new Date().getFullYear();

  if (!phone && !customerId) {
    res.status(400).json({ error: 'Either phone number or customer_id is required' });
    return;
  }

  try {
    let query = supabaseAdmin
      .from('monthly_subscriptions')
      .select('*')
      .eq('shop_id', user.shop_id)
      .eq('year', year);

    if (phone) {
      query = query.eq('phone_number', phone);
    } else if (customerId) {
      query = query.eq('customer_id', customerId);
    }

    const { data: records, error } = await query.limit(1);

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    if (records && records.length > 0) {
      res.status(200).json({ data: records[0] });
    } else {
      // Return empty template structure
      res.status(200).json({
        data: {
          customer_id: customerId || null,
          customer_name: '',
          phone_number: phone,
          shop_name: '',
          year: year,
          january: 0,
          january_paid_at: null,
          february: 0,
          february_paid_at: null,
          march: 0,
          march_paid_at: null,
          april: 0,
          april_paid_at: null,
          may: 0,
          may_paid_at: null,
          june: 0,
          june_paid_at: null,
          july: 0,
          july_paid_at: null,
          august: 0,
          august_paid_at: null,
          september: 0,
          september_paid_at: null,
          october: 0,
          october_paid_at: null,
          november: 0,
          november_paid_at: null,
          december: 0,
          december_paid_at: null,
          total_received: 0,
          notes: ''
        }
      });
    }
  } catch (err: any) {
    console.error('Error fetching subscription record:', err);
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
}

/**
 * Save / Update subscription record for a customer & year
 */
export async function saveSubscriptionRecord(req: Request, res: Response): Promise<void> {
  const user = (req as any).user;
  if (!user || !user.shop_id) {
    res.status(400).json({ error: 'User must be associated with a shop' });
    return;
  }

  const validation = saveSubscriptionSchema.safeParse(req.body);
  if (!validation.success) {
    res.status(400).json({ error: validation.error.errors[0].message });
    return;
  }

  const data = validation.data;

  // Auto-calculate total received
  const totalReceived = 
    data.january +
    data.february +
    data.march +
    data.april +
    data.may +
    data.june +
    data.july +
    data.august +
    data.september +
    data.october +
    data.november +
    data.december;

  try {
    // Check if record exists for this shop, phone_number/customer_id and year
    let existingQuery = supabaseAdmin
      .from('monthly_subscriptions')
      .select('id')
      .eq('shop_id', user.shop_id)
      .eq('year', data.year);

    if (data.customer_id && data.customer_id.trim() !== '') {
      existingQuery = existingQuery.eq('customer_id', data.customer_id);
    } else if (data.phone_number) {
      existingQuery = existingQuery.eq('phone_number', data.phone_number);
    }

    const { data: existing } = await existingQuery.limit(1);

    const payload = {
      shop_id: user.shop_id,
      customer_id: data.customer_id || null,
      customer_name: data.customer_name,
      phone_number: data.phone_number,
      shop_name: data.shop_name || '',
      year: data.year,
      january: data.january,
      january_paid_at: data.january_paid_at || null,
      february: data.february,
      february_paid_at: data.february_paid_at || null,
      march: data.march,
      march_paid_at: data.march_paid_at || null,
      april: data.april,
      april_paid_at: data.april_paid_at || null,
      may: data.may,
      may_paid_at: data.may_paid_at || null,
      june: data.june,
      june_paid_at: data.june_paid_at || null,
      july: data.july,
      july_paid_at: data.july_paid_at || null,
      august: data.august,
      august_paid_at: data.august_paid_at || null,
      september: data.september,
      september_paid_at: data.september_paid_at || null,
      october: data.october,
      october_paid_at: data.october_paid_at || null,
      november: data.november,
      november_paid_at: data.november_paid_at || null,
      december: data.december,
      december_paid_at: data.december_paid_at || null,
      total_received: totalReceived,
      notes: data.notes || '',
      updated_at: new Date().toISOString()
    };

    let result;
    if (existing && existing.length > 0) {
      // Update existing record
      const { data: updated, error } = await supabaseAdmin
        .from('monthly_subscriptions')
        .update(payload)
        .eq('id', existing[0].id)
        .select('*')
        .single();

      if (error) throw error;
      result = updated;
    } else {
      // Insert new record
      const { data: inserted, error } = await supabaseAdmin
        .from('monthly_subscriptions')
        .insert([{ ...payload, created_at: new Date().toISOString() }])
        .select('*')
        .single();

      if (error) throw error;
      result = inserted;
    }

    res.status(200).json({
      message: 'Monthly subscription record saved successfully',
      data: result
    });
  } catch (err: any) {
    console.error('Error saving subscription record:', err);
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
}

/**
 * Get summary of all subscription records for a given year
 */
export async function getSubscriptionSummary(req: Request, res: Response): Promise<void> {
  const user = (req as any).user;
  if (!user || !user.shop_id) {
    res.status(400).json({ error: 'User must be associated with a shop' });
    return;
  }

  const year = parseInt(req.query.year as string) || new Date().getFullYear();

  try {
    const { data: records, error } = await supabaseAdmin
      .from('monthly_subscriptions')
      .select('*')
      .eq('shop_id', user.shop_id)
      .eq('year', year);

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.status(200).json({ data: records || [] });
  } catch (err: any) {
    console.error('Error fetching subscription summary:', err);
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
}

/**
 * Send subscription payment bill notification via WhatsApp
 */
export async function sendSubscriptionBill(req: Request, res: Response): Promise<void> {
  const user = (req as any).user;
  if (!user || !user.shop_id) {
    res.status(400).json({ error: 'User must be associated with a shop' });
    return;
  }

  const { data: shop } = await supabaseAdmin
    .from('shops')
    .select('name')
    .eq('id', user.shop_id)
    .single();

  const shopName = shop?.name || 'GK Repair Shop';

  const { id, customer_name, phone_number, shop_name, year, month_name, amount, total_received, notes } = req.body;

  if (!customer_name || !phone_number || !month_name || amount === undefined) {
    res.status(400).json({ error: 'Missing required parameters to send WhatsApp bill' });
    return;
  }

  try {
    const result = await sendSubscriptionWhatsAppBill({
      id,
      customer_name,
      phone_number,
      shop_name,
      year: parseInt(year) || new Date().getFullYear(),
      month_name,
      amount: parseFloat(amount) || 0,
      total_received: parseFloat(total_received) || 0,
      notes
    }, shopName);

    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json({ error: result.error });
    }
  } catch (err: any) {
    console.error('Error sending WhatsApp bill:', err);
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
}

const createMemberSchema = z.object({
  member_name: z.string().min(1, 'Member name is required'),
  phone_number: z.string().min(3, 'Phone number is required'),
  shop_name: z.string().min(1, 'Shop name is required'),
  address: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  subscription_start_date: z.string().optional().nullable()
});

/**
 * List all registered subscription members & shops
 */
export async function listSubscriptionMembers(req: Request, res: Response): Promise<void> {
  const user = (req as any).user;
  if (!user || !user.shop_id) {
    res.status(400).json({ error: 'User must be associated with a shop' });
    return;
  }

  const search = (req.query.search as string || '').trim();
  const year = parseInt(req.query.year as string) || new Date().getFullYear();

  try {
    let query = supabaseAdmin
      .from('subscription_members')
      .select('*')
      .eq('shop_id', user.shop_id)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (search) {
      query = query.or(`member_name.ilike.%${search}%,phone_number.ilike.%${search}%,shop_name.ilike.%${search}%`);
    }

    const { data: members, error } = await query;
    
    // Fetch subscription totals for the selected year for each member
    const { data: subRecords } = await supabaseAdmin
      .from('monthly_subscriptions')
      .select('phone_number, shop_name, total_received')
      .eq('shop_id', user.shop_id)
      .eq('year', year);

    const totalsMap: Record<string, number> = {};
    if (subRecords) {
      subRecords.forEach(r => {
        if (r.phone_number) {
          totalsMap[r.phone_number] = (totalsMap[r.phone_number] || 0) + Number(r.total_received || 0);
        }
      });
    }

    if (error || !members) {
      // Fallback to customers table if subscription_members table isn't populated yet
      let customerQuery = supabaseAdmin
        .from('customers')
        .select('id, name, phone, address, created_at')
        .eq('shop_id', user.shop_id)
        .eq('is_active', true);

      if (search) {
        customerQuery = customerQuery.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
      }

      const { data: custs } = await customerQuery.limit(50);
      const fallback = (custs || []).map(c => ({
        id: c.id,
        member_name: c.name,
        phone_number: c.phone,
        shop_name: c.address || 'Member Shop',
        address: c.address || '',
        subscription_start_date: c.created_at ? c.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
        is_active: true,
        year_total_received: totalsMap[c.phone] || 0
      }));

      res.status(200).json({ data: fallback });
      return;
    }

    const enrichedMembers = (members || []).map(m => ({
      ...m,
      year_total_received: totalsMap[m.phone_number] || 0
    }));

    res.status(200).json({ data: enrichedMembers });
  } catch (err: any) {
    console.error('Error listing subscription members:', err);
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
}

/**
 * Register a new member & shop (Admin Only)
 */
export async function createSubscriptionMember(req: Request, res: Response): Promise<void> {
  const user = (req as any).user;
  if (!user || !user.shop_id) {
    res.status(400).json({ error: 'User must be associated with a shop' });
    return;
  }

  // Admin / Owner Role Check
  if (user.role !== 'owner') {
    res.status(403).json({ error: 'Access Denied: Only shop admins/owners can register new subscription members.' });
    return;
  }

  const val = createMemberSchema.safeParse(req.body);
  if (!val.success) {
    res.status(400).json({ error: val.error.errors[0].message });
    return;
  }

  const { member_name, phone_number, shop_name, address, notes, subscription_start_date } = val.data;

  try {
    const payload = {
      shop_id: user.shop_id,
      member_name,
      phone_number,
      shop_name,
      address: address || '',
      notes: notes || '',
      subscription_start_date: subscription_start_date || new Date().toISOString().slice(0, 10),
      is_active: true
    };

    const { data: member, error } = await supabaseAdmin
      .from('subscription_members')
      .insert([payload])
      .select('*')
      .single();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    // Also sync to customers table so member is globally searchable
    try {
      const { data: existingCust } = await supabaseAdmin
        .from('customers')
        .select('id')
        .eq('shop_id', user.shop_id)
        .eq('phone', phone_number)
        .limit(1);

      if (!existingCust || existingCust.length === 0) {
        await supabaseAdmin.from('customers').insert([{
          shop_id: user.shop_id,
          name: member_name,
          phone: phone_number,
          address: shop_name,
          is_active: true
        }]);
      }
    } catch {
      // Non-critical background sync catch
    }

    res.status(201).json({ message: 'Member & Shop registered successfully', data: member });
  } catch (err: any) {
    console.error('Error creating subscription member:', err);
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
}

/**
 * Update member & shop details (Admin Only)
 */
export async function updateSubscriptionMember(req: Request, res: Response): Promise<void> {
  const user = (req as any).user;
  if (!user || !user.shop_id) {
    res.status(400).json({ error: 'User must be associated with a shop' });
    return;
  }

  if (user.role !== 'owner') {
    res.status(403).json({ error: 'Access Denied: Only shop admins/owners can update member details.' });
    return;
  }

  const { id } = req.params;
  const { member_name, phone_number, shop_name, address, notes, subscription_start_date, is_active } = req.body;

  try {
    const updatePayload: any = { updated_at: new Date().toISOString() };
    if (member_name !== undefined) updatePayload.member_name = member_name;
    if (phone_number !== undefined) updatePayload.phone_number = phone_number;
    if (shop_name !== undefined) updatePayload.shop_name = shop_name;
    if (address !== undefined) updatePayload.address = address;
    if (notes !== undefined) updatePayload.notes = notes;
    if (subscription_start_date !== undefined) updatePayload.subscription_start_date = subscription_start_date;
    if (is_active !== undefined) updatePayload.is_active = is_active;

    const { data: updated, error } = await supabaseAdmin
      .from('subscription_members')
      .update(updatePayload)
      .eq('id', id)
      .eq('shop_id', user.shop_id)
      .select('*')
      .single();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.status(200).json({ message: 'Member updated successfully', data: updated });
  } catch (err: any) {
    console.error('Error updating subscription member:', err);
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
}

/**
 * Delete member & shop record (Admin Only)
 */
export async function deleteSubscriptionMember(req: Request, res: Response): Promise<void> {
  const user = (req as any).user;
  if (!user || !user.shop_id) {
    res.status(400).json({ error: 'User must be associated with a shop' });
    return;
  }

  if (user.role !== 'owner') {
    res.status(403).json({ error: 'Access Denied: Only shop admins/owners can delete member records.' });
    return;
  }

  const { id } = req.params;

  try {
    const { error } = await supabaseAdmin
      .from('subscription_members')
      .delete()
      .eq('id', id)
      .eq('shop_id', user.shop_id);

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.status(200).json({ message: 'Member deleted successfully' });
  } catch (err: any) {
    console.error('Error deleting subscription member:', err);
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
}

/**
 * Get complete shop details & multi-year payment audit history
 */
export async function getShopSubscriptionHistory(req: Request, res: Response): Promise<void> {
  const user = (req as any).user;
  if (!user || !user.shop_id) {
    res.status(400).json({ error: 'User must be associated with a shop' });
    return;
  }

  const phone = (req.query.phone as string || '').trim();
  const shopName = (req.query.shop_name as string || '').trim();
  const memberId = (req.query.member_id as string || '').trim();

  try {
    // 1. Fetch Member Registration Info
    let memberInfo = null;
    if (memberId) {
      const { data } = await supabaseAdmin
        .from('subscription_members')
        .select('*')
        .eq('id', memberId)
        .single();
      memberInfo = data;
    }

    if (!memberInfo && phone) {
      const { data } = await supabaseAdmin
        .from('subscription_members')
        .select('*')
        .eq('shop_id', user.shop_id)
        .eq('phone_number', phone)
        .limit(1);
      if (data && data.length > 0) memberInfo = data[0];
    }

    // 2. Fetch all annual monthly_subscriptions records for this phone/shop
    let subQuery = supabaseAdmin
      .from('monthly_subscriptions')
      .select('*')
      .eq('shop_id', user.shop_id);

    if (phone) {
      subQuery = subQuery.eq('phone_number', phone);
    } else if (shopName) {
      subQuery = subQuery.ilike('shop_name', `%${shopName}%`);
    }

    const { data: records, error } = await subQuery.order('year', { ascending: false });

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    // Calculate total lifetime subscription paid
    const lifetimeTotal = (records || []).reduce((acc, r) => acc + Number(r.total_received || 0), 0);

    res.status(200).json({
      member: memberInfo || {
        member_name: records && records[0] ? records[0].customer_name : 'Shop Member',
        phone_number: phone,
        shop_name: shopName || (records && records[0] ? records[0].shop_name : ''),
        subscription_start_date: records && records[0] ? records[0].created_at?.slice(0, 10) : null
      },
      records: records || [],
      lifetime_total_received: lifetimeTotal
    });
  } catch (err: any) {
    console.error('Error fetching shop subscription history:', err);
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
}
