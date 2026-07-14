import { Request, Response } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../utils/supabase';
import { uploadPhoto } from '../utils/photoUpload';
import { generateJobNumber } from '../utils/jobNumber';
import { generateTokenNumber } from '../utils/tokenNumber';
import { v4 as uuidv4 } from 'uuid';
import { generateReceiptPdf } from '../utils/receipt.generator';
import { sendWhatsAppUpdate, getWhatsAppLogs } from '../utils/whatsapp';


const createRepairSchema = z.object({
  customerId: z.string().uuid('Invalid Customer ID'),
  brand: z.string().min(1, 'Brand is required'),
  model: z.string().min(1, 'Model is required'),
  imei: z.string().optional().nullable(),
  problem: z.string().min(5, 'Problem description must be at least 5 characters'),
  quality: z.enum(['good', 'fair', 'poor', 'damaged']),
  physicalDamage: z.string().optional().nullable(),
  estimate: z.number().nonnegative('Estimate must be positive'),
  advance: z.number().nonnegative('Advance must be positive'),
  deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Delivery date must be YYYY-MM-DD').optional().nullable(),
  staffId: z.string().uuid('Invalid Staff ID').optional().nullable(),
  notes: z.string().optional().nullable(),
  services: z.array(z.object({
    service_name: z.string().min(1),
    labor_cost: z.number().nonnegative()
  })).optional().default([]),
  lockCode: z.string().optional().nullable(),
  patternLock: z.string().optional().nullable(),
  accessoryAdapter: z.boolean().optional().default(false),
  accessoryKeyboardMouse: z.boolean().optional().default(false),
  accessoryOther: z.boolean().optional().default(false),
  serialNumber: z.string().optional().nullable(),
  warranty: z.string().optional().nullable(),
  sendWhatsapp: z.boolean().optional().default(false),
  sendEmail: z.boolean().optional().default(false),
  allowCashback: z.boolean().optional().default(false),
  expense: z.number().optional().default(0),
  kycDetails: z.string().optional().nullable(),
  jobNumber: z.string().optional().nullable()
}).refine((data) => data.advance <= data.estimate, {
  message: 'Advance cannot exceed estimate amount',
  path: ['advance']
});

const updateRepairSchema = z.object({
  brand: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  imei: z.string().optional().nullable(),
  problem: z.string().min(5).optional(),
  quality: z.enum(['good', 'fair', 'poor', 'damaged']).optional(),
  physicalDamage: z.string().optional().nullable(),
  estimate: z.number().nonnegative().optional(),
  advance: z.number().nonnegative().optional(),
  deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  staffId: z.string().uuid().optional().nullable(),
  notes: z.string().optional().nullable(),
  lockCode: z.string().optional().nullable(),
  patternLock: z.string().optional().nullable(),
  accessoryAdapter: z.boolean().optional(),
  accessoryKeyboardMouse: z.boolean().optional(),
  accessoryOther: z.boolean().optional(),
  serialNumber: z.string().optional().nullable(),
  warranty: z.string().optional().nullable(),
  sendWhatsapp: z.boolean().optional(),
  sendEmail: z.boolean().optional(),
  allowCashback: z.boolean().optional(),
  expense: z.number().optional(),
  kycDetails: z.string().optional().nullable(),
  services: z.array(z.object({
    service_name: z.string().min(1),
    labor_cost: z.number().nonnegative()
  })).optional()
});

export async function getAllRepairs(req: Request, res: Response): Promise<void> {
  const user = req.user;
  if (!user || !user.shop_id) {
    res.status(400).json({ error: 'User must be associated with a shop' });
    return;
  }

  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const search = (req.query.search as string) || '';
  const status = (req.query.status as string) || '';
  const staffId = (req.query.staffId as string) || '';
  const dateStart = (req.query.dateStart as string) || '';
  const dateEnd = (req.query.dateEnd as string) || '';

  const from = (page - 1) * limit;
  const to = from + limit - 1;

  try {
    // 1. Setup baseline query filtering by shop
    let query = supabaseAdmin
      .from('repairs')
      .select(`
        *,
        device:devices(*, customer:customers(*)),
        assigned_staff:users!repairs_staff_id_fkey(id, name, staff_id)
      `, { count: 'exact' })
      .eq('shop_id', user.shop_id);

    // 2. Access guard: Staff only sees assigned tickets
    if (user.role === 'staff') {
      query = query.eq('staff_id', user.id);
    } else if (staffId) {
      // Owner filtering by specific staff
      query = query.eq('staff_id', staffId);
    }

    // 3. Apply filters
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (dateStart) {
      query = query.gte('created_at', dateStart);
    }
    
    if (dateEnd) {
      query = query.lte('created_at', dateEnd);
    }

    // Apply database-level search filtering
    if (search) {
      const searchByPhone = req.query.searchByPhone === 'true';
      const searchByIMEI = req.query.searchByIMEI === 'true';

      let customerIds: string[] = [];
      let orConditions: string[] = [];

      if (searchByPhone && searchByIMEI) {
        // Search by phone OR IMEI
        const { data: customers } = await supabaseAdmin
          .from('customers')
          .select('id')
          .eq('shop_id', user.shop_id)
          .ilike('phone', `%${search}%`);
        customerIds = customers?.map(c => c.id) || [];
        
        orConditions.push(`imei.ilike.%${search}%`);
        if (customerIds.length > 0) {
          orConditions.push(`customer_id.in.(${customerIds.join(',')})`);
        }
      } else if (searchByPhone) {
        // Search ONLY by phone
        const { data: customers } = await supabaseAdmin
          .from('customers')
          .select('id')
          .eq('shop_id', user.shop_id)
          .ilike('phone', `%${search}%`);
        customerIds = customers?.map(c => c.id) || [];
        
        if (customerIds.length > 0) {
          orConditions.push(`customer_id.in.(${customerIds.join(',')})`);
        } else {
          // Force no match since phone filter didn't match any customer
          orConditions.push(`customer_id.eq.00000000-0000-0000-0000-000000000000`);
        }
      } else if (searchByIMEI) {
        // Search ONLY by IMEI
        orConditions.push(`imei.ilike.%${search}%`);
      } else {
        // Default search: job_number, customer name, brand, model, serial_number
        const { data: customers } = await supabaseAdmin
          .from('customers')
          .select('id')
          .eq('shop_id', user.shop_id)
          .ilike('name', `%${search}%`);
        customerIds = customers?.map(c => c.id) || [];

        orConditions.push(`brand.ilike.%${search}%`);
        orConditions.push(`model.ilike.%${search}%`);
        orConditions.push(`serial_number.ilike.%${search}%`);
        if (customerIds.length > 0) {
          orConditions.push(`customer_id.in.(${customerIds.join(',')})`);
        }
      }

      let matchedDeviceIds: string[] = [];
      if (orConditions.length > 0) {
        const { data: devices } = await supabaseAdmin
          .from('devices')
          .select('id')
          .or(orConditions.join(','));
        matchedDeviceIds = devices?.map(d => d.id) || [];
      }

      if (searchByPhone || searchByIMEI) {
        if (matchedDeviceIds.length > 0) {
          query = query.in('device_id', matchedDeviceIds);
        } else {
          query = query.eq('id', '00000000-0000-0000-0000-000000000000');
        }
      } else {
        if (matchedDeviceIds.length > 0) {
          query = query.or(`job_number.ilike.%${search}%,device_id.in.(${matchedDeviceIds.join(',')})`);
        } else {
          query = query.ilike('job_number', `%${search}%`);
        }
      }
    }

    const { data: repairs, count, error } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({
      repairs: repairs || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        pages: Math.ceil((count || 0) / limit)
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch repairs log' });
  }
}

export async function getRepairById(req: Request, res: Response): Promise<void> {
  const user = req.user;
  const { id } = req.params;

  if (!user || !user.shop_id) {
    res.status(400).json({ error: 'User must be associated with a shop' });
    return;
  }

  try {
    const { data: dbRepair, error } = await supabaseAdmin
      .from('repairs')
      .select(`
        *,
        device:devices(*, customer:customers(*)),
        assigned_staff:users!repairs_staff_id_fkey(id, name, staff_id),
        history:repair_history(*, changed_by_user:users(id, name, role)),
        services:repair_services(*)
      `)
      .eq('id', id)
      .eq('shop_id', user.shop_id)
      .single();

    if (error || !dbRepair) {
      res.status(404).json({ error: 'Repair order not found' });
      return;
    }

    // Access control check
    if (user.role === 'staff' && dbRepair.staff_id !== user.id) {
      res.status(403).json({ error: 'Forbidden: You are not assigned to this repair order' });
      return;
    }

    const repair = {
      ...dbRepair,
      customer: (dbRepair as any).device?.customer || null
    };
    if (repair.device) {
      delete (repair.device as any).customer;
    }

    res.json({ repair });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch repair details' });
  }
}

export async function createRepair(req: Request, res: Response): Promise<void> {
  const user = req.user;
  if (!user || !user.shop_id) {
    res.status(400).json({ error: 'User must be associated with a shop' });
    return;
  }

  try {
    // 1. Parse manual fields because they are sent via multipart/form-data as strings
    const rawBody = {
      customerId: req.body.customerId,
      brand: req.body.brand,
      model: req.body.model,
      imei: req.body.imei,
      problem: req.body.problem,
      quality: req.body.quality,
      physicalDamage: req.body.physicalDamage,
      estimate: parseFloat(req.body.estimate || '0'),
      advance: parseFloat(req.body.advance || '0'),
      deliveryDate: req.body.deliveryDate || null,
      staffId: req.body.staffId || null,
      notes: req.body.notes || null,
      services: req.body.services ? JSON.parse(req.body.services) : [],
      
      // new fields
      lockCode: req.body.lockCode || null,
      patternLock: req.body.patternLock || null,
      accessoryAdapter: req.body.accessoryAdapter === 'true',
      accessoryKeyboardMouse: req.body.accessoryKeyboardMouse === 'true',
      accessoryOther: req.body.accessoryOther === 'true',
      serialNumber: req.body.serialNumber || null,
      warranty: req.body.warranty || null,
      sendWhatsapp: req.body.sendWhatsapp === 'true',
      sendEmail: req.body.sendEmail === 'true',
      allowCashback: req.body.allowCashback === 'true',
      expense: parseFloat(req.body.expense || '0'),
      kycDetails: req.body.kycDetails || null,
      jobNumber: req.body.jobNumber || null
    };

    const validatedData = createRepairSchema.parse(rawBody);

    // 2. Upload hardware images if present
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    let frontPhotoUrl: string | null = null;
    let backPhotoUrl: string | null = null;

    if (files) {
      if (files['frontPhoto'] && files['frontPhoto'][0]) {
        frontPhotoUrl = await uploadPhoto(files['frontPhoto'][0], 'device-photos');
      }
      if (files['backPhoto'] && files['backPhoto'][0]) {
        backPhotoUrl = await uploadPhoto(files['backPhoto'][0], 'device-photos');
      }
    }

    // 3. Create the hardware Device entry
    const deviceId = uuidv4();
    const { data: device, error: deviceError } = await supabaseAdmin
      .from('devices')
      .insert({
        id: deviceId,
        customer_id: validatedData.customerId,
        brand: validatedData.brand,
        model: validatedData.model,
        imei: validatedData.imei || null,
        problem: validatedData.problem,
        quality: validatedData.quality,
        physical_damage: validatedData.physicalDamage || null,
        front_photo_url: frontPhotoUrl,
        back_photo_url: backPhotoUrl,
        lock_code: validatedData.lockCode,
        pattern_lock: validatedData.patternLock,
        accessory_adapter: validatedData.accessoryAdapter,
        accessory_keyboard_mouse: validatedData.accessoryKeyboardMouse,
        accessory_other: validatedData.accessoryOther,
        serial_number: validatedData.serialNumber,
        warranty: validatedData.warranty
      })
      .select()
      .single();

    if (deviceError || !device) {
      res.status(400).json({ error: deviceError?.message || 'Failed to register device' });
      return;
    }

    // 4. Generate unique sequential job number atomically
    let job_number = validatedData.jobNumber;
    if (job_number) {
      // Check if this job number is already used for this shop
      const { data: existingRepair } = await supabaseAdmin
        .from('repairs')
        .select('id')
        .eq('shop_id', user.shop_id)
        .eq('job_number', job_number)
        .maybeSingle();

      if (existingRepair) {
        job_number = await generateJobNumber(user.shop_id);
      }
    } else {
      job_number = await generateJobNumber(user.shop_id);
    }

    // 4b. Generate per-customer token number (C-0001 style)
    const token_number = await generateTokenNumber(validatedData.customerId);

    // 5. Create the repair order
    const repairId = uuidv4();
    const { data: repair, error: repairError } = await supabaseAdmin
      .from('repairs')
      .insert({
        id: repairId,
        job_number,
        token_number,
        device_id: deviceId,
        shop_id: user.shop_id,
        estimate: validatedData.estimate,
        advance: validatedData.advance,
        status: 'pending',
        delivery_date: validatedData.deliveryDate || null,
        staff_id: validatedData.staffId || null,
        created_by: user.id,
        updated_by: user.id,
        notes: validatedData.notes || null,
        send_whatsapp: validatedData.sendWhatsapp,
        send_email: validatedData.sendEmail,
        allow_cashback: validatedData.allowCashback,
        expense: validatedData.expense,
        kyc_details: validatedData.kycDetails
      })
      .select()
      .single();

    if (repairError || !repair) {
      // Cleanup device on failure
      await supabaseAdmin.from('devices').delete().eq('id', deviceId);
      res.status(400).json({ error: repairError?.message || 'Failed to create repair order' });
      return;
    }

    // 6. Insert initial status history log
    await supabaseAdmin.from('repair_history').insert({
      repair_id: repairId,
      changed_by: user.id,
      old_status: 'pending',
      new_status: 'pending',
      note: 'Repair order initialized'
    });

    // 7. Insert service line items if provided
    if (validatedData.services && validatedData.services.length > 0) {
      const servicePayload = validatedData.services.map((svc) => ({
        repair_id: repairId,
        service_name: svc.service_name,
        labor_cost: svc.labor_cost
      }));
      await supabaseAdmin.from('repair_services').insert(servicePayload);
    }

    // Trigger WhatsApp notification automatically after creating a repair order when customer data is present.
    (async () => {
      try {
        const { data: fullRepair } = await supabaseAdmin
          .from('repairs')
          .select('*, device:devices(*, customer:customers(*)), shop:shops(*)')
          .eq('id', repairId)
          .single();
        if (fullRepair) {
          await sendWhatsAppUpdate(fullRepair, 'pending', 'Repair order initialized');
        }
      } catch (e) {
        console.error('[WhatsApp Trigger] Error in createRepair notification:', e);
      }
    })();

    res.status(201).json({ message: 'Repair order created successfully', repair });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to create repair order' });
  }
}

export async function updateRepairStatus(req: Request, res: Response): Promise<void> {
  const user = req.user;
  const { id } = req.params;

  const statusSchema = z.object({
    status: z.enum(['pending', 'repairing', 'ready', 'delivered', 'cancelled']),
    notes: z.string().optional().nullable()
  });

  if (!user || !user.shop_id) {
    res.status(400).json({ error: 'User must be associated with a shop' });
    return;
  }

  try {
    const { status, notes } = statusSchema.parse(req.body);

    // Fetch existing repair
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('repairs')
      .select('*')
      .eq('id', id)
      .eq('shop_id', user.shop_id)
      .single();

    if (fetchError || !existing) {
      res.status(404).json({ error: 'Repair order not found' });
      return;
    }

    // Staff access check
    if (user.role === 'staff' && existing.staff_id !== user.id) {
      res.status(403).json({ error: 'Forbidden: You are not assigned to this repair order' });
      return;
    }

    // Update the repair status & notes
    const updatePayload: any = {
      status,
      notes: notes || existing.notes,
      updated_by: user.id,
      updated_at: new Date().toISOString()
    };

    if (status === 'delivered') {
      updatePayload.advance = existing.estimate;
    }

    const { data: repair, error: updateError } = await supabaseAdmin
      .from('repairs')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      res.status(400).json({ error: updateError.message });
      return;
    }

    // Trigger WhatsApp notification if send_whatsapp is true on the existing repair order and status has changed
    if (existing.send_whatsapp && existing.status !== status) {
      (async () => {
        try {
          const { data: fullRepair } = await supabaseAdmin
            .from('repairs')
            .select('*, device:devices(*, customer:customers(*)), shop:shops(*)')
            .eq('id', id)
            .single();
          if (fullRepair) {
            await sendWhatsAppUpdate(fullRepair, status, notes);
          }
        } catch (e) {
          console.error('[WhatsApp Trigger] Error in updateRepairStatus notification:', e);
        }
      })();
    }

    // History is auto logged by db trigger `tr_log_repair_status_change`
    // However, if we want to log the specific notes parameter supplied by status change, 
    // the trigger captures the NEW.notes field automatically! So we are good.
    res.json({ message: 'Repair status updated successfully', repair });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    res.status(500).json({ error: 'Failed to update repair status' });
  }
}

export async function updateRepair(req: Request, res: Response): Promise<void> {
  const user = req.user;
  const { id } = req.params;

  if (!user || !user.shop_id) {
    res.status(400).json({ error: 'User must be associated with a shop' });
    return;
  }

  if (user.role === 'staff' && (req.body.estimate !== undefined || req.body.advance !== undefined || req.body.expense !== undefined)) {
    res.status(403).json({ error: 'Forbidden: Staff members are not permitted to modify financial details' });
    return;
  }

  try {
    const rawBody = {
      brand: req.body.brand,
      model: req.body.model,
      imei: req.body.imei,
      problem: req.body.problem,
      quality: req.body.quality,
      physicalDamage: req.body.physicalDamage,
      estimate: req.body.estimate ? parseFloat(req.body.estimate) : undefined,
      advance: req.body.advance ? parseFloat(req.body.advance) : undefined,
      deliveryDate: req.body.deliveryDate || null,
      staffId: req.body.staffId || null,
      notes: req.body.notes || null,
      lockCode: req.body.lockCode || null,
      patternLock: req.body.patternLock || null,
      accessoryAdapter: req.body.accessoryAdapter === 'true' || req.body.accessoryAdapter === true,
      accessoryKeyboardMouse: req.body.accessoryKeyboardMouse === 'true' || req.body.accessoryKeyboardMouse === true,
      accessoryOther: req.body.accessoryOther === 'true' || req.body.accessoryOther === true,
      serialNumber: req.body.serialNumber || null,
      warranty: req.body.warranty || null,
      sendWhatsapp: req.body.sendWhatsapp === 'true' || req.body.sendWhatsapp === true,
      sendEmail: req.body.sendEmail === 'true' || req.body.sendEmail === true,
      allowCashback: req.body.allowCashback === 'true' || req.body.allowCashback === true,
      expense: req.body.expense ? parseFloat(req.body.expense) : undefined,
      kycDetails: req.body.kycDetails || null,
      services: req.body.services ? (typeof req.body.services === 'string' ? JSON.parse(req.body.services) : req.body.services) : undefined
    };

    const validatedData = updateRepairSchema.parse(rawBody);

    // Fetch existing repair to validate state & ownership
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('repairs')
      .select('*')
      .eq('id', id)
      .eq('shop_id', user.shop_id)
      .single();

    if (fetchError || !existing) {
      res.status(404).json({ error: 'Repair order not found' });
      return;
    }

    if (existing.status === 'delivered') {
      res.status(400).json({ error: 'Cannot modify a delivered repair order' });
      return;
    }

    // Upload hardware images if present in update files
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    let frontPhotoUrl: string | undefined;
    let backPhotoUrl: string | undefined;

    if (files) {
      if (files['frontPhoto'] && files['frontPhoto'][0]) {
        frontPhotoUrl = await uploadPhoto(files['frontPhoto'][0], 'device-photos');
      }
      if (files['backPhoto'] && files['backPhoto'][0]) {
        backPhotoUrl = await uploadPhoto(files['backPhoto'][0], 'device-photos');
      }
    }

    // 1. Update hardware Device attributes
    const deviceUpdatePayload: Record<string, any> = {
      brand: validatedData.brand,
      model: validatedData.model,
      imei: validatedData.imei,
      problem: validatedData.problem,
      quality: validatedData.quality,
      physical_damage: validatedData.physicalDamage,
      lock_code: validatedData.lockCode,
      pattern_lock: validatedData.patternLock,
      accessory_adapter: validatedData.accessoryAdapter,
      accessory_keyboard_mouse: validatedData.accessoryKeyboardMouse,
      accessory_other: validatedData.accessoryOther,
      serial_number: validatedData.serialNumber,
      warranty: validatedData.warranty
    };
    if (frontPhotoUrl !== undefined) deviceUpdatePayload.front_photo_url = frontPhotoUrl;
    if (backPhotoUrl !== undefined) deviceUpdatePayload.back_photo_url = backPhotoUrl;

    const { error: deviceError } = await supabaseAdmin
      .from('devices')
      .update(deviceUpdatePayload)
      .eq('id', existing.device_id);

    if (deviceError) {
      res.status(400).json({ error: 'Failed to update device characteristics' });
      return;
    }

    // 2. Update Repair details
    const { data: repair, error: repairError } = await supabaseAdmin
      .from('repairs')
      .update({
        estimate: validatedData.estimate,
        advance: validatedData.advance,
        delivery_date: validatedData.deliveryDate,
        staff_id: validatedData.staffId,
        notes: validatedData.notes,
        send_whatsapp: validatedData.sendWhatsapp,
        send_email: validatedData.sendEmail,
        allow_cashback: validatedData.allowCashback,
        expense: validatedData.expense,
        kyc_details: validatedData.kycDetails,
        updated_by: user.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (repairError) {
      res.status(400).json({ error: repairError.message });
      return;
    }

    // 3. Update Services if provided
    if (validatedData.services) {
      // Delete existing services linked to this repair
      await supabaseAdmin.from('repair_services').delete().eq('repair_id', id);

      if (validatedData.services.length > 0) {
        const servicePayload = validatedData.services.map((svc) => ({
          repair_id: id,
          service_name: svc.service_name,
          labor_cost: svc.labor_cost
        }));
        await supabaseAdmin.from('repair_services').insert(servicePayload);
      }
    }

    res.json({ message: 'Repair order modified successfully', repair });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    console.error('Failed to modify repair order:', err);
    res.status(500).json({ error: 'Failed to modify repair order' });
  }
}

export async function deleteRepair(req: Request, res: Response): Promise<void> {
  const user = req.user;
  const { id } = req.params;

  if (!user || !user.shop_id) {
    res.status(400).json({ error: 'User must be associated with a shop' });
    return;
  }

  if (user.role !== 'owner') {
    res.status(403).json({ error: 'Forbidden: Only owners are permitted to cancel tickets' });
    return;
  }

  try {
    // Soft cancel: sets status = 'cancelled'
    const { data: repair, error } = await supabaseAdmin
      .from('repairs')
      .update({
        status: 'cancelled',
        notes: 'Ticket cancelled by shop owner',
        updated_by: user.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('shop_id', user.shop_id)
      .select()
      .single();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ message: 'Repair order cancelled successfully', repair });
  } catch (err) {
    res.status(500).json({ error: 'Failed to cancel repair order' });
  }
}

function parseBase64DataUrl(dataUrl: string): { buffer: Buffer; mimetype: string; ext: string } {
  const matches = dataUrl.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.*)$/);
  if (!matches) {
    throw new Error('Invalid base64 data URL format');
  }
  const mimetype = matches[1];
  const base64Data = matches[2];
  const buffer = Buffer.from(base64Data, 'base64');
  let ext = '.png';
  if (mimetype.includes('jpeg') || mimetype.includes('jpg')) {
    ext = '.jpg';
  } else if (mimetype.includes('webp')) {
    ext = '.webp';
  }
  return { buffer, mimetype, ext };
}

export async function deliverRepair(req: Request, res: Response): Promise<void> {
  const user = req.user;
  const { id } = req.params;

  if (!user || !user.shop_id) {
    res.status(400).json({ error: 'User must be associated with a shop' });
    return;
  }

  const deliverRepairSchema = z.object({
    receiverName: z.string().min(1, 'Receiver name is required'),
    receiverPhone: z.string().min(1, 'Receiver phone is required'),
    receivedBy: z.enum(['staff', 'customer']),
    notes: z.string().optional().nullable(),
    receiverPhotoUrl: z.string().optional().nullable(),
    signatureDataUrl: z.string().optional().nullable(),
    deliveryDate: z.string().optional().nullable(),
    deliveryTime: z.string().optional().nullable()
  });

  try {
    const validated = deliverRepairSchema.parse(req.body);

    // 1. Fetch existing repair to validate state
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('repairs')
      .select('*')
      .eq('id', id)
      .eq('shop_id', user.shop_id)
      .single();

    if (fetchError || !existing) {
      res.status(404).json({ error: 'Repair order not found' });
      return;
    }

    if (existing.status !== 'ready') {
      res.status(400).json({ error: 'Repair must be in "ready" state before delivery' });
      return;
    }

    // 2. Upload signature to Supabase Storage if present
    let signatureUrl = null;
    if (validated.signatureDataUrl) {
      const parsedSig = parseBase64DataUrl(validated.signatureDataUrl);
      const fakeSigFile = {
        fieldname: 'signature',
        originalname: `signature_${id}${parsedSig.ext}`,
        encoding: '7bit',
        mimetype: parsedSig.mimetype,
        size: parsedSig.buffer.length,
        buffer: parsedSig.buffer,
        destination: '',
        filename: '',
        path: ''
      } as Express.Multer.File;
      signatureUrl = await uploadPhoto(fakeSigFile, 'delivery-photos');
    }

    // 3. Upload receiver photo if present as base64
    let receiverPhotoUrl = validated.receiverPhotoUrl || null;
    if (validated.receiverPhotoUrl && validated.receiverPhotoUrl.startsWith('data:image/')) {
      const parsedPhoto = parseBase64DataUrl(validated.receiverPhotoUrl);
      const fakePhotoFile = {
        fieldname: 'receiverPhoto',
        originalname: `receiver_${id}${parsedPhoto.ext}`,
        encoding: '7bit',
        mimetype: parsedPhoto.mimetype,
        size: parsedPhoto.buffer.length,
        buffer: parsedPhoto.buffer,
        destination: '',
        filename: '',
        path: ''
      } as Express.Multer.File;
      receiverPhotoUrl = await uploadPhoto(fakePhotoFile, 'delivery-photos');
    }

    // Parse custom delivery date and time if provided
    let deliveredAt = new Date().toISOString();
    if (validated.deliveryDate) {
      const timeStr = validated.deliveryTime || '00:00';
      // Create local date string and parse to ISO
      deliveredAt = new Date(`${validated.deliveryDate}T${timeStr}`).toISOString();
    }

    // 4. Update the repair order status
    const deliverySummary = `Received by ${validated.receivedBy}. Notes: ${validated.notes || 'No notes'}`;

    const { data: dbRepair, error: updateError } = await supabaseAdmin
      .from('repairs')
      .update({
        status: 'delivered',
        receiver_name: validated.receiverName,
        receiver_phone: validated.receiverPhone,
        receiver_photo_url: receiverPhotoUrl,
        signature_url: signatureUrl,
        delivered_at: deliveredAt,
        notes: validated.notes || existing.notes,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
        advance: existing.estimate
      })
      .eq('id', id)
      .select(`
        *,
        device:devices(*, customer:customers(*)),
        assigned_staff:users!repairs_staff_id_fkey(id, name, staff_id),
        history:repair_history(*, changed_by_user:users(id, name, role))
      `)
      .single();

    if (updateError || !dbRepair) {
      res.status(400).json({ error: updateError?.message || 'Failed to update repair order' });
      return;
    }

    // 5. Update history logs to set the operator who delivered it
    await supabaseAdmin
      .from('repair_history')
      .update({ 
        changed_by: user.id,
        note: deliverySummary 
      })
      .eq('repair_id', id)
      .eq('new_status', 'delivered');

    const repair = {
      ...dbRepair,
      customer: (dbRepair as any).device?.customer || null
    };
    if (repair.device) {
      delete (repair.device as any).customer;
    }

    // Trigger WhatsApp notification if send_whatsapp is true on the existing repair order
    if (existing.send_whatsapp) {
      (async () => {
        try {
          const { data: fullRepair } = await supabaseAdmin
            .from('repairs')
            .select('*, device:devices(*, customer:customers(*)), shop:shops(*)')
            .eq('id', id)
            .single();
          if (fullRepair) {
            await sendWhatsAppUpdate(fullRepair, 'delivered', validated.notes);
          }
        } catch (e) {
          console.error('[WhatsApp Trigger] Error in deliverRepair notification:', e);
        }
      })();
    }

    res.json({ message: 'Repair order delivered successfully', repair });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to complete delivery process' });
  }
}

export async function getRepairReceipt(req: Request, res: Response): Promise<void> {
  const user = req.user;
  const { id } = req.params;

  if (!user || !user.shop_id) {
    res.status(400).json({ error: 'User must be associated with a shop' });
    return;
  }

  try {
    // 1. Fetch repair with device and customer
    const { data: dbRepair, error: fetchError } = await supabaseAdmin
      .from('repairs')
      .select(`
        *,
        device:devices(*, customer:customers(*))
      `)
      .eq('id', id)
      .eq('shop_id', user.shop_id)
      .single();

    if (fetchError || !dbRepair) {
      res.status(404).json({ error: 'Repair order not found' });
      return;
    }

    const repair = {
      ...dbRepair,
      customer: (dbRepair as any).device?.customer || null
    };
    if (repair.device) {
      delete (repair.device as any).customer;
    }

    // Access control: staff can only download their own assigned job receipt
    if (user.role === 'staff' && repair.staff_id !== user.id) {
      res.status(403).json({ error: 'Forbidden: You are not assigned to this repair order' });
      return;
    }

    // 2. Fetch Shop details
    const { data: shop, error: shopError } = await supabaseAdmin
      .from('shops')
      .select('*')
      .eq('id', repair.shop_id)
      .single();

    if (shopError || !shop) {
      res.status(404).json({ error: 'Shop information not found' });
      return;
    }

    // 3. Construct receipt data payload
    const receiptData = {
      repair: {
        id: repair.id,
        job_number: repair.job_number,
        estimate: Number(repair.estimate),
        advance: Number(repair.advance),
        balance: Number(repair.estimate) - Number(repair.advance),
        status: repair.status,
        delivery_date: repair.delivery_date,
        notes: repair.notes,
        created_at: repair.created_at,
        delivered_at: repair.delivered_at,
        receiver_name: repair.receiver_name,
        receiver_phone: repair.receiver_phone,
        receiver_photo_url: repair.receiver_photo_url,
        signature_url: repair.signature_url,
        staff_id: repair.staff_id,
        device: {
          brand: repair.device.brand,
          model: repair.device.model,
          imei: repair.device.imei,
          problem: repair.device.problem
        },
        customer: {
          name: repair.customer.name,
          phone: repair.customer.phone,
          address: repair.customer.address
        }
      },
      shop: {
        name: shop.name,
        logo_url: shop.logo_url,
        address: shop.address,
        phone: shop.phone
      }
    };

    // 4. Generate the PDF
    const pdfBytes = await generateReceiptPdf(receiptData);

    const filename = `${repair.job_number}-receipt.pdf`;
    const disposition = req.query.download === 'true' ? 'attachment' : 'inline';

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `${disposition}; filename="${filename}"`);
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate receipt PDF' });
  }
}

export async function getWhatsAppLogsHandler(req: Request, res: Response): Promise<void> {
  const user = req.user;
  if (!user || !user.shop_id) {
    res.status(400).json({ error: 'User must be associated with a shop' });
    return;
  }
  
  if (user.role !== 'owner') {
    res.status(403).json({ error: 'Forbidden: Owner profile privilege required to view WhatsApp logs.' });
    return;
  }

  try {
    const logs = getWhatsAppLogs();
    const { data: shop } = await supabaseAdmin
      .from('shops')
      .select('name')
      .eq('id', user.shop_id)
      .single();
      
    const shopName = shop?.name || '';
    const filteredLogs = logs.filter(log => log.shopName === shopName);
    res.json({ logs: filteredLogs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to retrieve WhatsApp logs' });
  }
}

export async function triggerWhatsAppNotification(req: Request, res: Response): Promise<void> {
  const user = req.user;
  const { id } = req.params;

  if (!user || !user.shop_id) {
    res.status(400).json({ error: 'User must be associated with a shop' });
    return;
  }

  try {
    const { data: fullRepair, error: fetchError } = await supabaseAdmin
      .from('repairs')
      .select('*, device:devices(*, customer:customers(*)), shop:shops(*), history:repair_history(*)')
      .eq('id', id)
      .eq('shop_id', user.shop_id)
      .single();

    if (fetchError || !fullRepair) {
      res.status(404).json({ error: 'Repair order not found' });
      return;
    }

    let progressNote = fullRepair.notes;
    if (fullRepair.history && Array.isArray(fullRepair.history) && fullRepair.history.length > 0) {
      const matchingLogs = fullRepair.history
        .filter((h: any) => h.new_status === fullRepair.status && h.note && h.note !== 'Status updated')
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      if (matchingLogs.length > 0) {
        progressNote = matchingLogs[0].note;
      }
    }

    const result = await sendWhatsAppUpdate(fullRepair, fullRepair.status, progressNote);
    if (!result.success) {
      res.status(500).json({ error: result.error || 'Failed to send WhatsApp message' });
      return;
    }

    res.json({ 
      message: 'WhatsApp notification triggered successfully', 
      success: true,
      isSandbox: result.isSandbox,
      whatsappUrl: result.whatsappUrl
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to trigger WhatsApp notification' });
  }
}

// GET /api/repairs/next-job-number — get next sequential job number for the shop
export async function getNextJobNumber(req: Request, res: Response): Promise<void> {
  const user = req.user;
  if (!user || !user.shop_id) {
    res.status(400).json({ error: 'User must be associated with a shop' });
    return;
  }

  try {
    const { data: jobNum, error } = await supabaseAdmin.rpc('generate_job_number', {
      p_shop_id: user.shop_id
    });

    if (error) throw error;

    res.json({ nextJobNumber: jobNum });
  } catch (err: any) {
    console.error('Failed to generate next job number:', err);
    res.status(500).json({ error: err.message || 'Failed to generate billing number' });
  }
}


