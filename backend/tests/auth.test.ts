import request from 'supertest';
import app from '../src/server';
import { testData } from './setup';
import { supabaseAdmin } from '../src/utils/supabase';

describe('Authentication & RBAC API Endpoint Tests', () => {
  let createdOwnerId: string | null = null;
  let createdShopId: string | null = null;
  let createdStaffEmail = '';
  let createdStaffId = '';

  afterAll(async () => {
    // Teardown any accounts created during these specific auth tests
    if (createdShopId) {
      await supabaseAdmin.from('shops').delete().eq('id', createdShopId);
    }
    if (createdOwnerId) {
      await supabaseAdmin.auth.admin.deleteUser(createdOwnerId);
    }
    if (createdStaffId) {
      await supabaseAdmin.auth.admin.deleteUser(createdStaffId);
    }
  });

  it('should register a new owner, login, get profile, and verify role', async () => {
    const uniqueEmail = `owner-${Date.now()}@gkrepair.com`;
    
    // 1. Register Owner
    const regRes = await request(app)
      .post('/api/auth/register-owner')
      .send({
        name: 'Jane Owner',
        email: uniqueEmail,
        password: 'ownerpassword123',
        shopName: 'Jane Repair Center',
        shopAddress: '456 Main St',
        shopPhone: '1234567890'
      });
    
    console.log('REGISTRATION FAILED WITH BODY:', regRes.body);
    expect(regRes.status).toBe(201);
    expect(regRes.body).toHaveProperty('accessToken');
    expect(regRes.body).toHaveProperty('refreshToken');
    expect(regRes.body.user.role).toBe('owner');
    
    createdOwnerId = regRes.body.user.id;
    createdShopId = regRes.body.shop.id;

    // 2. Login as newly registered owner
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: uniqueEmail,
        password: 'ownerpassword123'
      });
    
    expect(loginRes.status).toBe(200);
    expect(loginRes.body).toHaveProperty('accessToken');
    const token = loginRes.body.accessToken;

    // 3. Call getMe to verify profile details
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    
    expect(meRes.status).toBe(200);
    expect(meRes.body.profile.name).toBe('Jane Owner');
    expect(meRes.body.profile.role).toBe('owner');
  });

  it('should allow owner to create a staff member, login as staff, and verify details', async () => {
    createdStaffEmail = `staff-${Date.now()}@gkrepair.com`;

    // 1. Create Staff (Owner-Only)
    const createRes = await request(app)
      .post('/api/auth/create-staff')
      .set('Authorization', `Bearer ${testData.ownerToken}`)
      .send({
        name: 'Sam Staff',
        email: createdStaffEmail,
        password: 'staffpassword123'
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.staff.role).toBe('staff');
    expect(createRes.body.staff.staff_id).toMatch(/^GK\d{3}$/); // GK001, etc.
    createdStaffId = createRes.body.staff.id;

    // 2. Login as Staff
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: createdStaffEmail,
        password: 'staffpassword123'
      });

    expect(loginRes.status).toBe(200);
    const staffToken = loginRes.body.accessToken;

    // 3. Request identity and check restricted staff attributes
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${staffToken}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.profile.name).toBe('Sam Staff');
    expect(meRes.body.profile.role).toBe('staff');
  });

  it('should reject access to owner-only endpoints for staff members', async () => {
    // 1. Fetch staff directory as Staff (expected 403)
    const staffListRes = await request(app)
      .get('/api/auth/staff')
      .set('Authorization', `Bearer ${testData.staff1Token}`);

    expect(staffListRes.status).toBe(403);
    expect(staffListRes.body).toHaveProperty('error');

    // 2. Attempt to toggle staff status as Staff (expected 403)
    const toggleRes = await request(app)
      .put(`/api/auth/staff/${testData.staff2Id}`)
      .set('Authorization', `Bearer ${testData.staff1Token}`);

    expect(toggleRes.status).toBe(403);
  });

  it('should block API requests with invalid or missing bearer tokens', async () => {
    // 1. Missing Token (401)
    const missingRes = await request(app)
      .get('/api/auth/me');

    expect(missingRes.status).toBe(401);

    // 2. Invalid Token (401)
    const invalidRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer dummyinvalidjwttoken');

    expect(invalidRes.status).toBe(401);
  });
});
