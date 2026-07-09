import { Request, Response } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../utils/supabase';
import { uploadPhoto } from '../utils/photoUpload';

const createCustomerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().min(5, 'Phone number must be at least 5 characters'),
  address: z.string().optional()
});

const updateCustomerSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().min(5).optional(),
  address: z.string().optional()
});

export async function getCustomers(req: Request, res: Response): Promise<void> {
  const user = req.user;
  if (!user || !user.shop_id) {
    res.status(400).json({ error: 'User must be associated with a shop' });
    return;
  }

  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const search = (req.query.search as string) || '';
  
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  try {
    // 1. Build query to filter active customers of the shop matching search string
    let query = supabaseAdmin
      .from('customers')
      .select('*', { count: 'exact' })
      .eq('shop_id', user.shop_id)
      .eq('is_active', true);

    if (search) {
      // Postgres search on name or phone
      query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    const { data: customers, count, error } = await query
      .order('name', { ascending: true })
      .range(from, to);

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    // Load repair metrics (total repairs & last repair date) for each customer
    const customersWithStats = await Promise.all(
      (customers || []).map(async (cust) => {
        // Fetch all device IDs belonging to this customer
        const { data: devices } = await supabaseAdmin
          .from('devices')
          .select('id')
          .eq('customer_id', cust.id);
        
        const deviceIds = (devices || []).map(d => d.id);
        let repairCount = 0;
        let lastRepairDate: string | null = null;

        if (deviceIds.length > 0) {
          const { data: repairsData } = await supabaseAdmin
            .from('repairs')
            .select('created_at')
            .eq('shop_id', user.shop_id)
            .in('device_id', deviceIds);

          repairCount = repairsData?.length || 0;
          lastRepairDate = repairsData && repairsData.length > 0
            ? repairsData.reduce((latest, r) => (r.created_at > latest ? r.created_at : latest), repairsData[0].created_at)
            : null;
        }

        return {
          ...cust,
          repairsCount: repairCount,
          lastRepairDate
        };
      })
    );

    res.json({
      customers: customersWithStats,
      pagination: {
        page,
        limit,
        total: count || 0,
        pages: Math.ceil((count || 0) / limit)
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch customer list' });
  }
}

export async function getCustomerById(req: Request, res: Response): Promise<void> {
  const user = req.user;
  const { id } = req.params;

  if (!user || !user.shop_id) {
    res.status(400).json({ error: 'User must be associated with a shop' });
    return;
  }

  try {
    // Load customer profile details
    const { data: customer, error } = await supabaseAdmin
      .from('customers')
      .select('*')
      .eq('id', id)
      .eq('shop_id', user.shop_id)
      .eq('is_active', true)
      .single();

    if (error || !customer) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }

    // Load all device records registered for this customer
    const { data: devices } = await supabaseAdmin
      .from('devices')
      .select('*')
      .eq('customer_id', customer.id);

    // Load repair orders linked to those devices
    const deviceIds = (devices || []).map(d => d.id);
    let repairs: any[] = [];
    
    if (deviceIds.length > 0) {
      const { data: repairsData } = await supabaseAdmin
        .from('repairs')
        .select('*')
        .in('device_id', deviceIds)
        .order('created_at', { ascending: false });
      repairs = repairsData || [];
    }

    res.json({
      customer,
      devices: devices || [],
      repairs
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch customer profile details' });
  }
}

export async function createCustomer(req: Request, res: Response): Promise<void> {
  const user = req.user;
  if (!user || !user.shop_id) {
    res.status(400).json({ error: 'User must be associated with a shop' });
    return;
  }

  try {
    const validatedData = createCustomerSchema.parse(req.body);
    let photoUrl: string | null = null;

    // Handle file upload if present
    if (req.file) {
      photoUrl = await uploadPhoto(req.file, 'customer-photos');
    }

    // Check if phone number already exists inside the shop
    const { data: existing } = await supabaseAdmin
      .from('customers')
      .select('id')
      .eq('phone', validatedData.phone)
      .eq('shop_id', user.shop_id)
      .eq('is_active', true)
      .maybeSingle();

    if (existing) {
      res.status(409).json({ error: 'A customer with this phone number already exists in your shop' });
      return;
    }

    const { data: customer, error } = await supabaseAdmin
      .from('customers')
      .insert({
        shop_id: user.shop_id,
        name: validatedData.name,
        phone: validatedData.phone,
        address: validatedData.address || null,
        photo_url: photoUrl,
        is_active: true
      })
      .select()
      .single();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.status(201).json({ message: 'Customer registered successfully', customer });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to register customer' });
  }
}

export async function updateCustomer(req: Request, res: Response): Promise<void> {
  const user = req.user;
  const { id } = req.params;

  if (!user || !user.shop_id) {
    res.status(400).json({ error: 'User must be associated with a shop' });
    return;
  }

  try {
    const validatedData = updateCustomerSchema.parse(req.body);
    let photoUrl: string | undefined;

    if (req.file) {
      photoUrl = await uploadPhoto(req.file, 'customer-photos');
    }

    // Verify ownership
    const { data: existing, error: verifyError } = await supabaseAdmin
      .from('customers')
      .select('id')
      .eq('id', id)
      .eq('shop_id', user.shop_id)
      .eq('is_active', true)
      .single();

    if (verifyError || !existing) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }

    const updatePayload: Record<string, any> = {
      ...validatedData
    };
    if (photoUrl !== undefined) {
      updatePayload.photo_url = photoUrl;
    }

    const { data: customer, error } = await supabaseAdmin
      .from('customers')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ message: 'Customer updated successfully', customer });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    res.status(500).json({ error: 'Failed to update customer profile' });
  }
}

export async function deleteCustomer(req: Request, res: Response): Promise<void> {
  const user = req.user;
  const { id } = req.params;

  if (!user || !user.shop_id) {
    res.status(400).json({ error: 'User must be associated with a shop' });
    return;
  }

  try {
    // Verify ownership
    const { data: existing, error: verifyError } = await supabaseAdmin
      .from('customers')
      .select('id')
      .eq('id', id)
      .eq('shop_id', user.shop_id)
      .eq('is_active', true)
      .single();

    if (verifyError || !existing) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }

    // Soft delete: set is_active to false
    const { error } = await supabaseAdmin
      .from('customers')
      .update({ is_active: false })
      .eq('id', id);

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ message: 'Customer profile soft deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete customer profile' });
  }
}
