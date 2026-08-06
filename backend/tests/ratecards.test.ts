import request from 'supertest';
import app from '../src/server';
import { testData } from './setup';
import { supabaseAdmin, supabaseClient } from '../src/utils/supabase';

describe('Rate Card shop-scoping consistency', () => {
  let superAdminToken: string;

  beforeAll(async () => {
    // A superadmin who belongs to the same shop as the seeded owner. This mirrors
    // the real app: writes go through a superadmin, reads through the shop owner.
    const { data: adminAuth } = await supabaseAdmin.auth.admin.createUser({
      email: 'rc-superadmin@gkrepair.com',
      password: 'rcpassword',
      email_confirm: true,
      user_metadata: { name: 'RC Super Admin', role: 'superadmin', shop_id: testData.shopId },
    });
    if (!adminAuth?.user) throw new Error('Failed to create superadmin for rate card tests');
    await supabaseAdmin
      .from('users')
      .update({ shop_id: testData.shopId })
      .eq('id', adminAuth.user.id);

    const { data: login } = await supabaseClient.auth.signInWithPassword({
      email: 'rc-superadmin@gkrepair.com',
      password: 'rcpassword',
    });
    superAdminToken = login.session?.access_token || '';
    if (!superAdminToken) throw new Error('Failed to sign in superadmin for rate card tests');
  });

  it('shows a rate card right after it is created (same shop for write and read)', async () => {
    const createRes = await request(app)
      .post('/api/ratecards')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ brand: 'APPLE', model: 'iPhone 15 Pro' });

    expect(createRes.status).toBe(201);
    const created = createRes.body.rateCard;
    expect(created).toBeTruthy();
    expect(created.shop_id).toBe(testData.shopId);

    const listRes = await request(app)
      .get('/api/ratecards')
      .set('Authorization', `Bearer ${testData.ownerToken}`);

    expect(listRes.status).toBe(200);
    const ids = (listRes.body.rateCards || []).map((c: any) => c.id);
    expect(ids).toContain(created.id);
  });

  it('does not leak rate cards belonging to other shops into the shop list', async () => {
    const { data: otherShop } = await supabaseAdmin
      .from('shops')
      .insert({ name: 'Other Shop', address: 'Other St', phone: '9998887776', owner_id: testData.ownerId })
      .select()
      .single();
    expect(otherShop).toBeTruthy();

    const { data: otherCard } = await supabaseAdmin
      .from('rate_cards')
      .insert({ shop_id: otherShop.id, brand: 'SAMSUNG', model: 'Galaxy S25', model_image_url: null })
      .select()
      .single();
    expect(otherCard).toBeTruthy();

    const listRes = await request(app)
      .get('/api/ratecards')
      .set('Authorization', `Bearer ${testData.ownerToken}`);

    expect(listRes.status).toBe(200);
    const ids = (listRes.body.rateCards || []).map((c: any) => c.id);
    expect(ids).not.toContain(otherCard.id);
  });

  it('persists and returns saved services for a rate card (whole-list replace within the card)', async () => {
    const createRes = await request(app)
      .post('/api/ratecards')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ brand: 'APPLE', model: 'iPhone 16' });
    expect(createRes.status).toBe(201);
    const cardId = createRes.body.rateCard.id;

    const svcRes = await request(app)
      .post(`/api/ratecards/${cardId}/services`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        services: [
          { service_name: 'Display Replacement', og_cost: 1200, ditto_cost: 1000, copy_cost: 800 },
          { service_name: 'Battery Replacement', og_cost: 500, ditto_cost: 400, copy_cost: 350 },
        ],
      });
    expect(svcRes.status).toBe(200);

    // The in-memory supabase mock does not emulate the nested `services:` join, so
    // assert against the service rows directly (the real delete + insert flow).
    const { data: serviceRows } = await supabaseAdmin
      .from('rate_card_services')
      .select('*')
      .eq('rate_card_id', cardId);

    expect(serviceRows || []).toHaveLength(2);
    const names = (serviceRows || []).map((s: any) => s.service_name);
    expect(names).toEqual(expect.arrayContaining(['Display Replacement', 'Battery Replacement']));
  });

  it('removes a deleted rate card from the shop list', async () => {
    const createRes = await request(app)
      .post('/api/ratecards')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ brand: 'GOOGLE', model: 'Pixel 9' });
    expect(createRes.status).toBe(201);
    const cardId = createRes.body.rateCard.id;

    const delRes = await request(app)
      .delete(`/api/ratecards/${cardId}`)
      .set('Authorization', `Bearer ${superAdminToken}`);
    expect(delRes.status).toBe(200);

    const listRes = await request(app)
      .get('/api/ratecards')
      .set('Authorization', `Bearer ${testData.ownerToken}`);
    const ids = (listRes.body.rateCards || []).map((c: any) => c.id);
    expect(ids).not.toContain(cardId);
  });

  it('still rejects writes from non-super-admin users', async () => {
    const res = await request(app)
      .post('/api/ratecards')
      .set('Authorization', `Bearer ${testData.ownerToken}`)
      .send({ brand: 'ONEPLUS', model: '12R' });

    expect(res.status).toBe(403);
  });
});
