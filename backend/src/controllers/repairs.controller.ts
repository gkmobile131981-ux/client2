import { Request, Response } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../utils/supabase';
import { uploadPhoto } from '../utils/photoUpload';
import { generateJobNumber } from '../utils/jobNumber';
import { v4 as uuidv4 } from 'uuid';
import { generateReceiptPdf } from '../utils/receipt.generator';


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
  notes: z.string().optional().nullable()
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
  notes: z.string().optional().nullable()
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

    const { data: repairs, count, error } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    // 4. Client-side search matching job number or customer name
    let filteredRepairs = repairs || [];
    if (search) {
      const lowerSearch = search.toLowerCase();
      filteredRepairs = filteredRepairs.filter((r: any) => {
        const matchesJob = r.job_number.toLowerCase().includes(lowerSearch);
        const matchesCustomer = r.device?.customer?.name?.toLowerCase().includes(lowerSearch);
        return matchesJob || matchesCustomer;
      });
    }

    res.json({
      repairs: filteredRepairs,
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
    const { data: repair, error } = await supabaseAdmin
      .from('repairs')
      .select(`
        *,
        device:devices(*),
        customer:customers(*),
        assigned_staff:users!repairs_staff_id_fkey(id, name, staff_id),
        history:repair_history(*, changed_by_user:users(id, name, role))
      `)
      .eq('id', id)
      .eq('shop_id', user.shop_id)
      .single();

    if (error || !repair) {
      res.status(404).json({ error: 'Repair order not found' });
      return;
    }

    // Access control check
    if (user.role === 'staff' && repair.staff_id !== user.id) {
      res.status(403).json({ error: 'Forbidden: You are not assigned to this repair order' });
      return;
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
      notes: req.body.notes || null
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
        back_photo_url: backPhotoUrl
      })
      .select()
      .single();

    if (deviceError || !device) {
      res.status(400).json({ error: deviceError?.message || 'Failed to register device' });
      return;
    }

    // 4. Generate unique sequential job number atomically
    const job_number = await generateJobNumber(user.shop_id);

    // 5. Create the repair order
    const repairId = uuidv4();
    const { data: repair, error: repairError } = await supabaseAdmin
      .from('repairs')
      .insert({
        id: repairId,
        job_number,
        device_id: deviceId,
        shop_id: user.shop_id,
        estimate: validatedData.estimate,
        advance: validatedData.advance,
        status: 'pending',
        delivery_date: validatedData.deliveryDate || null,
        staff_id: validatedData.staffId || null,
        created_by: user.id,
        updated_by: user.id,
        notes: validatedData.notes || null
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
    const { data: repair, error: updateError } = await supabaseAdmin
      .from('repairs')
      .update({
        status,
        notes: notes || existing.notes,
        updated_by: user.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      res.status(400).json({ error: updateError.message });
      return;
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

  if (user.role !== 'owner') {
    res.status(403).json({ error: 'Forbidden: Only owners are permitted to perform full modifications' });
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
      notes: req.body.notes || null
    };

    const validatedData = updateRepairSchema.parse(rawBody);

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

    // 1. Update hardware Device attributes
    const { error: deviceError } = await supabaseAdmin
      .from('devices')
      .update({
        brand: validatedData.brand,
        model: validatedData.model,
        imei: validatedData.imei,
        problem: validatedData.problem,
        quality: validatedData.quality,
        physical_damage: validatedData.physicalDamage
      })
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

    res.json({ message: 'Repair order modified successfully', repair });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
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
    signatureDataUrl: z.string().min(1, 'Signature is required')
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

    // 2. Upload signature to Supabase Storage
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
    const signatureUrl = await uploadPhoto(fakeSigFile, 'delivery-photos');

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

    // 4. Update the repair order status
    const deliverySummary = `Received by ${validated.receivedBy}. Notes: ${validated.notes || 'No notes'}`;

    const { data: repair, error: updateError } = await supabaseAdmin
      .from('repairs')
      .update({
        status: 'delivered',
        receiver_name: validated.receiverName,
        receiver_phone: validated.receiverPhone,
        receiver_photo_url: receiverPhotoUrl,
        signature_url: signatureUrl,
        delivered_at: new Date().toISOString(),
        notes: validated.notes || existing.notes,
        updated_by: user.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select(`
        *,
        device:devices(*),
        customer:customers(*),
        assigned_staff:users!repairs_staff_id_fkey(id, name, staff_id),
        history:repair_history(*, changed_by_user:users(id, name, role))
      `)
      .single();

    if (updateError || !repair) {
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
    const { data: repair, error: fetchError } = await supabaseAdmin
      .from('repairs')
      .select(`
        *,
        device:devices(*),
        customer:customers(*)
      `)
      .eq('id', id)
      .eq('shop_id', user.shop_id)
      .single();

    if (fetchError || !repair) {
      res.status(404).json({ error: 'Repair order not found' });
      return;
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

