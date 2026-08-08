import { Request, Response } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../utils/supabase';
import { uploadPhoto } from '../utils/photoUpload';

const SUPER_ADMIN_EMAILS = [
  'gkmobile131981@gmail.com',
  'admin@gkrepair.com',
  'test@gkrepair.com'
];

const DEFAULT_SHOP_ID = 'bafff8e0-53cc-45cc-afa3-1c5862e8da21';

// Super Admin shop id, resolved once and cached briefly so every list/lookup
// does not re-query the users table. The TTL ensures newly created super admins
// are picked up without a restart.
let cachedSuperAdminShopId: string | null = null;
let cachedAtMs = 0;
const SUPER_ADMIN_SHOP_CACHE_TTL_MS = 5 * 60 * 1000;

// Rate-card data is authored by the Super Admin and must be visible to every
// shop (and every staff member) under the account. Writes only ever pass through
// a super admin, so they target the super admin's own shop; reads from any other
// role resolve to the SAME shop, keeping write/read scoping consistent while
// letting shop owners see the master price list.
async function resolveShopIdToUse(user: any): Promise<string> {
  if (!user) return DEFAULT_SHOP_ID;

  const isSuperAdmin =
    user.role === 'superadmin' ||
    (!!user.email && SUPER_ADMIN_EMAILS.includes(user.email.toLowerCase().trim()));

  if (isSuperAdmin) {
    return user.shop_id || DEFAULT_SHOP_ID;
  }

  if (cachedSuperAdminShopId && Date.now() - cachedAtMs < SUPER_ADMIN_SHOP_CACHE_TTL_MS) {
    return cachedSuperAdminShopId;
  }

  const { data: superAdminProfile } = await supabaseAdmin
    .from('users')
    .select('id, email, shop_id')
    .or(`role.eq.superadmin,email.in.(${SUPER_ADMIN_EMAILS.join(',')})`)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  const resolved = superAdminProfile?.shop_id || DEFAULT_SHOP_ID;
  cachedSuperAdminShopId = resolved;
  cachedAtMs = Date.now();
  return resolved;
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
    const targetShopId = await resolveShopIdToUse(user);
    const { data, error } = await supabaseAdmin
      .from('rate_cards')
      .select(`
        *,
        services:rate_card_services(*)
      `)
      .eq('shop_id', targetShopId)
      .order('brand', { ascending: true })
      .order('model', { ascending: true })
      .order('sort_order', { ascending: true, referencedTable: 'rate_card_services' });

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
    const targetShopId = await resolveShopIdToUse(user);
    const { data, error } = await supabaseAdmin
      .from('rate_cards')
      .select(`*, services:rate_card_services(*)`)
      .eq('id', id)
      .eq('shop_id', targetShopId)
      .order('sort_order', { ascending: true, referencedTable: 'rate_card_services' })
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

function normalizeSubModels(modelStr: string, brandStr?: string): string[] {
  if (!modelStr) return [];
  let m = modelStr.trim().toUpperCase();
  if (brandStr) {
    const b = brandStr.trim().toUpperCase();
    if (m.startsWith(b + ' ')) {
      m = m.substring(b.length + 1).trim();
    }
  }
  return m
    .split('/')
    .map((s) => {
      let sub = s.trim();
      if (brandStr) {
        const b = brandStr.trim().toUpperCase();
        if (sub.startsWith(b + ' ')) {
          sub = sub.substring(b.length + 1).trim();
        }
      }
      return sub;
    })
    .filter(Boolean);
}

function findBestMatchingRateCard<T extends { brand: string; model: string }>(
  cards: T[],
  brand: string,
  model: string
): T | null {
  if (!brand.trim() || !model.trim()) return null;
  const brandUpper = brand.trim().toUpperCase();
  const modelUpper = model.trim().toUpperCase();

  const brandCards = cards.filter((rc) => rc.brand.trim().toUpperCase() === brandUpper);
  if (brandCards.length === 0) return null;

  const exactCard = brandCards.find((rc) => rc.model.trim().toUpperCase() === modelUpper);
  if (exactCard) return exactCard;

  const inputTokens = normalizeSubModels(model, brand);
  let bestCard: T | null = null;
  let maxScore = 0;

  for (const card of brandCards) {
    const cardTokens = normalizeSubModels(card.model, brand);
    let matchCount = 0;

    for (const it of inputTokens) {
      if (cardTokens.includes(it)) {
        matchCount++;
      }
    }

    if (matchCount > maxScore) {
      maxScore = matchCount;
      bestCard = card;
    }
  }

  if (bestCard && maxScore > 0) {
    return bestCard;
  }

  for (const card of brandCards) {
    const cardNorm = normalizeSubModels(card.model, brand).join(' ');
    for (const it of inputTokens) {
      if (it.length >= 2 && cardNorm.includes(it)) {
        return card;
      }
    }
  }

  return null;
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
    const targetShopId = await resolveShopIdToUse(user);
    const { data: cards, error } = await supabaseAdmin
      .from('rate_cards')
      .select(`*, services:rate_card_services(*)`)
      .eq('shop_id', targetShopId)
      .ilike('brand', brand)
      .order('sort_order', { ascending: true, referencedTable: 'rate_card_services' });

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    const matchedCard = findBestMatchingRateCard(cards || [], brand, model);
    res.json({ rateCard: matchedCard || null });
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
        shop_id: await resolveShopIdToUse(user),
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
      .eq('shop_id', await resolveShopIdToUse(user))
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
      .eq('shop_id', await resolveShopIdToUse(user));

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
    const targetShopId = await resolveShopIdToUse(user);
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
      .order('sort_order', { ascending: true, referencedTable: 'rate_card_services' })
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
