import { Request, Response } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../utils/supabase';
import { uploadPhoto } from '../utils/photoUpload';

const SUPER_ADMIN_EMAILS = [
  'gkmobile131981@gmail.com',
  'admin@gkrepair.com',
  'test@gkrepair.com'
];

async function getShopIdToUse(user: any): Promise<string> {
  const isSuperAdmin = !!(user && (user.role === 'superadmin' || (user.email && SUPER_ADMIN_EMAILS.includes(user.email.toLowerCase().trim()))));
  if (isSuperAdmin) {
    return user.shop_id || 'bafff8e0-53cc-45cc-afa3-1c5862e8da21';
  }
  
  try {
    const { data: adminProfile } = await supabaseAdmin
      .from('users')
      .select('shop_id')
      .eq('id', '5aba93bc-6abf-4b99-8600-dff366a3a99d')
      .single();
    if (adminProfile?.shop_id) {
      return adminProfile.shop_id;
    }
  } catch (err) {
    // Ignore error
  }
  
  return 'bafff8e0-53cc-45cc-afa3-1c5862e8da21';
}

function checkSuperAdmin(user: any): boolean {
  return !!(user && (user.role === 'superadmin' || (user.email && SUPER_ADMIN_EMAILS.includes(user.email.toLowerCase().trim()))));
}

const createRateCardSchema = z.object({
  brand: z.string().min(1, 'Brand is required'),
  model: z.string().min(1, 'Model is required'),
});

const serviceItemSchema = z.object({
  service_name: z.string().min(1, 'Service name is required'),
  og_cost: z.number().nonnegative('Cost must be 0 or positive').optional().default(0),
  ditto_cost: z.number().nonnegative('Cost must be 0 or positive').optional().default(0),
  copy_cost: z.number().nonnegative('Cost must be 0 or positive').optional().default(0),
  sort_order: z.number().int().optional().default(0),
});

const upsertServicesSchema = z.object({
  services: z.array(serviceItemSchema),
});

// GET /api/ratecards — list all rate cards for the shop
export async function getRateCards(req: Request, res: Response): Promise<void> {
  const user = req.user;
  if (!user?.shop_id) {
    res.status(400).json({ error: 'User must be associated with a shop' });
    return;
  }

  try {
    const targetShopId = await getShopIdToUse(user);
    const { data, error } = await supabaseAdmin
      .from('rate_cards')
      .select(`
        *,
        services:rate_card_services(*)
      `)
      .eq('shop_id', targetShopId)
      .order('brand', { ascending: true })
      .order('model', { ascending: true });

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ rateCards: data || [] });
  } catch {
    res.status(500).json({ error: 'Failed to fetch rate cards' });
  }
}

// GET /api/ratecards/:id — get a single rate card with its services
export async function getRateCardById(req: Request, res: Response): Promise<void> {
  const user = req.user;
  const { id } = req.params;

  if (!user?.shop_id) {
    res.status(400).json({ error: 'User must be associated with a shop' });
    return;
  }

  try {
    const targetShopId = await getShopIdToUse(user);
    const { data, error } = await supabaseAdmin
      .from('rate_cards')
      .select(`*, services:rate_card_services(*)`)
      .eq('id', id)
      .eq('shop_id', targetShopId)
      .single();

    if (error || !data) {
      res.status(404).json({ error: 'Rate card not found' });
      return;
    }

    res.json({ rateCard: data });
  } catch {
    res.status(500).json({ error: 'Failed to fetch rate card' });
  }
}

// GET /api/ratecards/lookup?brand=Apple&model=iPhone+16 — find by brand+model (for NewRepair step 3)
export async function lookupRateCard(req: Request, res: Response): Promise<void> {
  const user = req.user;
  if (!user?.shop_id) {
    res.status(400).json({ error: 'User must be associated with a shop' });
    return;
  }

  const brand = (req.query.brand as string || '').trim();
  const model = (req.query.model as string || '').trim();

  if (!brand || !model) {
    res.json({ rateCard: null });
    return;
  }

  try {
    const targetShopId = await getShopIdToUse(user);
    const { data, error } = await supabaseAdmin
      .from('rate_cards')
      .select(`*, services:rate_card_services(*)`)
      .eq('shop_id', targetShopId)
      .ilike('brand', brand)
      .ilike('model', model)
      .maybeSingle();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ rateCard: data || null });
  } catch {
    res.status(500).json({ error: 'Failed to lookup rate card' });
  }
}

// POST /api/ratecards — create a new rate card (Super Admin only)
export async function createRateCard(req: Request, res: Response): Promise<void> {
  const user = req.user;
  if (!user?.shop_id) {
    res.status(400).json({ error: 'User must be associated with a shop' });
    return;
  }
  if (!checkSuperAdmin(user)) {
    res.status(403).json({ error: 'Only Super Admins can manage rate cards' });
    return;
  }

  try {
    const validated = createRateCardSchema.parse(req.body);

    // Upload device image if provided
    let modelImageUrl: string | null = null;
    if (req.file) {
      modelImageUrl = await uploadPhoto(req.file, 'rate-card-images');
    }

    const { data, error } = await supabaseAdmin
      .from('rate_cards')
      .insert({
        shop_id: user.shop_id,
        brand: validated.brand,
        model: validated.model,
        model_image_url: modelImageUrl,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        res.status(409).json({ error: 'A rate card for this brand and model already exists' });
        return;
      }
      res.status(400).json({ error: error.message });
      return;
    }

    res.status(201).json({ message: 'Rate card created successfully', rateCard: data });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    res.status(500).json({ error: 'Failed to create rate card' });
  }
}

// PUT /api/ratecards/:id — update rate card brand/model/image (Super Admin only)
export async function updateRateCard(req: Request, res: Response): Promise<void> {
  const user = req.user;
  const { id } = req.params;

  if (!user?.shop_id) {
    res.status(400).json({ error: 'User must be associated with a shop' });
    return;
  }
  if (!checkSuperAdmin(user)) {
    res.status(403).json({ error: 'Only Super Admins can manage rate cards' });
    return;
  }

  try {
    const validated = createRateCardSchema.partial().parse(req.body);

    let modelImageUrl: string | undefined;
    if (req.file) {
      modelImageUrl = await uploadPhoto(req.file, 'rate-card-images');
    }

    const updatePayload: Record<string, any> = {
      ...validated,
      updated_at: new Date().toISOString(),
    };
    if (modelImageUrl) updatePayload.model_image_url = modelImageUrl;

    const { data, error } = await supabaseAdmin
      .from('rate_cards')
      .update(updatePayload)
      .eq('id', id)
      .eq('shop_id', user.shop_id)
      .select()
      .single();

    if (error || !data) {
      res.status(404).json({ error: 'Rate card not found' });
      return;
    }

    res.json({ message: 'Rate card updated successfully', rateCard: data });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    res.status(500).json({ error: 'Failed to update rate card' });
  }
}

// DELETE /api/ratecards/:id — delete a rate card and all its services (Super Admin only)
export async function deleteRateCard(req: Request, res: Response): Promise<void> {
  const user = req.user;
  const { id } = req.params;

  if (!user?.shop_id) {
    res.status(400).json({ error: 'User must be associated with a shop' });
    return;
  }
  if (!checkSuperAdmin(user)) {
    res.status(403).json({ error: 'Only Super Admins can delete rate cards' });
    return;
  }

  try {
    const { error } = await supabaseAdmin
      .from('rate_cards')
      .delete()
      .eq('id', id)
      .eq('shop_id', user.shop_id);

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ message: 'Rate card deleted successfully' });
  } catch {
    res.status(500).json({ error: 'Failed to delete rate card' });
  }
}

// POST /api/ratecards/:id/services — bulk upsert all services for a rate card (Super Admin only)
export async function upsertRateCardServices(req: Request, res: Response): Promise<void> {
  const user = req.user;
  const { id } = req.params;

  if (!user?.shop_id) {
    res.status(400).json({ error: 'User must be associated with a shop' });
    return;
  }
  if (!checkSuperAdmin(user)) {
    res.status(403).json({ error: 'Only Super Admins can manage rate card services' });
    return;
  }

  try {
    const { services } = upsertServicesSchema.parse(req.body);

    // Verify rate card belongs to Super Admin's shop
    const targetShopId = await getShopIdToUse(user);
    const { data: existing, error: verifyError } = await supabaseAdmin
      .from('rate_cards')
      .select('id')
      .eq('id', id)
      .eq('shop_id', targetShopId)
      .single();

    if (verifyError || !existing) {
      res.status(404).json({ error: 'Rate card not found' });
      return;
    }

    // Delete existing services, then insert fresh set
    await supabaseAdmin.from('rate_card_services').delete().eq('rate_card_id', id);

    if (services.length > 0) {
      const insertPayload = services.map((svc, idx) => ({
        rate_card_id: id,
        service_name: svc.service_name,
        og_cost: svc.og_cost ?? 0,
        ditto_cost: svc.ditto_cost ?? 0,
        copy_cost: svc.copy_cost ?? 0,
        sort_order: svc.sort_order ?? idx,
      }));

      const { error: insertError } = await supabaseAdmin
        .from('rate_card_services')
        .insert(insertPayload);

      if (insertError) {
        res.status(400).json({ error: insertError.message });
        return;
      }
    }

    // Return the updated rate card with services
    const { data: updated } = await supabaseAdmin
      .from('rate_cards')
      .select(`*, services:rate_card_services(*)`)
      .eq('id', id)
      .single();

    res.json({ message: 'Services saved successfully', rateCard: updated });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    res.status(500).json({ error: 'Failed to save rate card services' });
  }
}
