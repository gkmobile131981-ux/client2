import { Request, Response } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../utils/supabase';

const saveSubscriptionSchema = z.object({
  customer_id: z.string().optional().nullable(),
  customer_name: z.string().min(1, 'Customer name is required'),
  phone_number: z.string().min(3, 'Phone number is required'),
  shop_name: z.string().optional().nullable(),
  year: z.number().int().min(2000).max(2100),
  january: z.number().nonnegative().default(0),
  february: z.number().nonnegative().default(0),
  march: z.number().nonnegative().default(0),
  april: z.number().nonnegative().default(0),
  may: z.number().nonnegative().default(0),
  june: z.number().nonnegative().default(0),
  july: z.number().nonnegative().default(0),
  august: z.number().nonnegative().default(0),
  september: z.number().nonnegative().default(0),
  october: z.number().nonnegative().default(0),
  november: z.number().nonnegative().default(0),
  december: z.number().nonnegative().default(0),
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
          february: 0,
          march: 0,
          april: 0,
          may: 0,
          june: 0,
          july: 0,
          august: 0,
          september: 0,
          october: 0,
          november: 0,
          december: 0,
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

    if (data.phone_number) {
      existingQuery = existingQuery.eq('phone_number', data.phone_number);
    } else if (data.customer_id) {
      existingQuery = existingQuery.eq('customer_id', data.customer_id);
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
      february: data.february,
      march: data.march,
      april: data.april,
      may: data.may,
      june: data.june,
      july: data.july,
      august: data.august,
      september: data.september,
      october: data.october,
      november: data.november,
      december: data.december,
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
