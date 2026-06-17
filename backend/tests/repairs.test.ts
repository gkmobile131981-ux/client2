import request from 'supertest';
import app from '../src/server';
import { testData } from './setup';
import { supabaseAdmin } from '../src/utils/supabase';

describe('Repair Order Operations API Endpoint Tests', () => {
  it('should create a repair order and generate a sequential job number matching format GK-YYYYMMDD-XXX', async () => {
    const res = await request(app)
      .post('/api/repairs')
      .set('Authorization', `Bearer ${testData.ownerToken}`)
      .send({
        customerId: testData.customers[0].id,
        brand: 'Apple',
        model: 'iPhone 14',
        problem: 'Shattered LCD',
        quality: 'damaged',
        estimate: 250,
        advance: 50,
        staffId: testData.staff1Id
      });

    expect(res.status).toBe(201);
    expect(res.body.repair).toHaveProperty('job_number');
    
    const jobNumber = res.body.repair.job_number;
    expect(jobNumber).toMatch(/^GK-\d{8}-\d{3}$/);
  });

  it('should record status change history details when status is updated by owner', async () => {
    const repairId = testData.repairs[0].id;
    
    const updateRes = await request(app)
      .put(`/api/repairs/${repairId}/status`)
      .set('Authorization', `Bearer ${testData.ownerToken}`)
      .send({
        status: 'repairing',
        notes: 'Tech verified replacement part in inventory'
      });

    expect(updateRes.status).toBe(200);

    // Fetch history records directly from database
    const { data: history, error } = await supabaseAdmin
      .from('repair_history')
      .select('*')
      .eq('repair_id', repairId)
      .order('created_at', { ascending: false });

    expect(error).toBeNull();
    expect(history && history.length).toBeGreaterThan(0);
    
    // Find the status change log entry
    const entry = history?.find(h => h.new_status === 'repairing');
    expect(entry).toBeDefined();
    expect(entry?.old_value).toBe('pending');
    expect(entry?.new_value).toBe('repairing');
  });

  it('should allow status update when accessed by assigned technician', async () => {
    // Repair 2 is assigned to Staff 1
    const repairId = testData.repairs[1].id;

    const res = await request(app)
      .put(`/api/repairs/${repairId}/status`)
      .set('Authorization', `Bearer ${testData.staff1Token}`)
      .send({
        status: 'ready',
        notes: 'Ready for handoff'
      });

    expect(res.status).toBe(200);
    expect(res.body.repair.status).toBe('ready');
  });

  it('should block status updates when accessed by unassigned technician', async () => {
    // Repair 2 is assigned to Staff 1. Staff 2 attempts status update.
    const repairId = testData.repairs[1].id;

    const res = await request(app)
      .put(`/api/repairs/${repairId}/status`)
      .set('Authorization', `Bearer ${testData.staff2Token}`)
      .send({
        status: 'delivered',
        notes: 'Unauthorized deliver request'
      });

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error');
  });

  it('should forbid staff assistants from accessing estimate general updates', async () => {
    const repairId = testData.repairs[0].id;

    // Put to PUT /:id (which triggers requireOwner and updateRepair)
    const res = await request(app)
      .put(`/api/repairs/${repairId}`)
      .set('Authorization', `Bearer ${testData.staff1Token}`)
      .send({
        estimate: 999.00
      });

    expect(res.status).toBe(403);
  });

  it('should filter listing so staff technicians can only view their assigned tickets', async () => {
    const res = await request(app)
      .get('/api/repairs')
      .set('Authorization', `Bearer ${testData.staff1Token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.repairs)).toBe(true);

    // Verify all repairs belong to staff1
    res.body.repairs.forEach((r: any) => {
      expect(r.staff_id).toBe(testData.staff1Id);
    });
  });
});
