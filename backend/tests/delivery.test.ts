import request from 'supertest';
import app from '../src/server';
import { testData } from './setup';
import { supabaseAdmin } from '../src/utils/supabase';

describe('Repair Handoff Delivery Operations API Endpoint Tests', () => {
  const validDeliveryPayload = {
    receiverName: 'Jack Customer',
    receiverPhone: '9876543210',
    receivedBy: 'customer',
    notes: 'Unit tested signature handoff',
    receiverPhotoUrl: 'https://stub.supabase.co/storage/v1/object/sign/photo.png',
    // Minimal valid 1x1 black pixel PNG data URL
    signatureDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkQP8DAAIBAQEP+7oAAAAASUVORK5CYII='
  };

  it('should deliver repair successfully if its current status is ready', async () => {
    // Repair 3 was seeded with status = 'ready'
    const repairId = testData.repairs[2].id;

    const res = await request(app)
      .post(`/api/repairs/${repairId}/deliver`)
      .set('Authorization', `Bearer ${testData.ownerToken}`)
      .send(validDeliveryPayload);

    expect(res.status).toBe(200);
    expect(res.body.repair.status).toBe('delivered');
    expect(res.body.repair.receiver_name).toBe('Jack Customer');

    // Verify trigger logged status history
    const { data: history } = await supabaseAdmin
      .from('repair_history')
      .select('*')
      .eq('repair_id', repairId)
      .eq('new_status', 'delivered');

    expect(history && history.length).toBeGreaterThan(0);
  });

  it('should reject delivery and return 400 if current status is pending', async () => {
    // Repair 1 was seeded with status = 'pending'
    const repairId = testData.repairs[0].id;

    const res = await request(app)
      .post(`/api/repairs/${repairId}/deliver`)
      .set('Authorization', `Bearer ${testData.ownerToken}`)
      .send(validDeliveryPayload);

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('should return the receipt PDF as application/pdf stream', async () => {
    // Repair 3 (now delivered) receipt document check
    const repairId = testData.repairs[2].id;

    const res = await request(app)
      .get(`/api/repairs/${repairId}/receipt`)
      .set('Authorization', `Bearer ${testData.ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(Buffer.isBuffer(res.body)).toBe(true);
  });
});
