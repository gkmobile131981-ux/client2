import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
dotenv.config();

// Shared test data structure
export const testData = {
  ownerToken: '',
  staff1Token: '',
  staff2Token: '',
  ownerId: '',
  staff1Id: '',
  staff2Id: '',
  shopId: '',
  customers: [] as any[],
  devices: [] as any[],
  repairs: [] as any[]
};

// Mock Supabase to run fully in-memory
jest.mock('../src/utils/supabase', () => {
  const DB: Record<string, any[]> = {
    shops: [] as any[],
    users: [] as any[],
    customers: [] as any[],
    devices: [] as any[],
    repairs: [] as any[],
    repair_history: [] as any[],
    rate_cards: [] as any[],
    rate_card_services: [] as any[],
    repair_services: [] as any[]
  };

  class MockQueryBuilder {
    private table: string;
    private op: 'select' | 'insert' | 'update' | 'delete' = 'select';
    private insertData: any = null;
    private updatesData: any = null;
    private filters: ((item: any) => boolean)[] = [];
    private orderCol: string | null = null;
    private orderAsc = true;
    private limitCount: number | null = null;
    private doCount = false;
    private rangeFrom: number | null = null;
    private rangeTo: number | null = null;

    constructor(table: string) {
      this.table = table;
    }

    select(columns = '*', options?: { count?: string, head?: boolean }) {
      void columns;
      if (options && options.count) {
        this.doCount = true;
      }
      return this;
    }

    insert(recordOrRecords: any) {
      this.op = 'insert';
      this.insertData = recordOrRecords;
      return this;
    }

    update(updates: any) {
      this.op = 'update';
      this.updatesData = updates;
      return this;
    }

    delete() {
      this.op = 'delete';
      return this;
    }

    eq(column: string, value: any) {
      this.filters.push(item => item[column] === value);
      return this;
    }

    neq(column: string, value: any) {
      this.filters.push(item => item[column] !== value);
      return this;
    }

    gte(column: string, value: any) {
      this.filters.push(item => item[column] >= value);
      return this;
    }

    lte(column: string, value: any) {
      this.filters.push(item => item[column] <= value);
      return this;
    }

    in(column: string, values: any[]) {
      this.filters.push(item => values.includes(item[column]));
      return this;
    }

    ilike(column: string, value: string) {
      const term = value.replace(/%/g, '').toLowerCase();
      this.filters.push(item => {
        const val = item[column];
        return val && String(val).toLowerCase().includes(term);
      });
      return this;
    }

    or(filterStr: string) {
      const parts = filterStr.split(',');
      this.filters.push(item => {
        return parts.some(part => {
          const [col, op, val] = part.split('.');
          if (col && op && val) {
            const itemVal = item[col];
            const cleanVal = val.replace(/%/g, '').toLowerCase();
            return itemVal && String(itemVal).toLowerCase().includes(cleanVal);
          }
          return false;
        });
      });
      return this;
    }

    order(column: string, { ascending = true } = {}) {
      this.orderCol = column;
      this.orderAsc = ascending;
      return this;
    }

    limit(count: number) {
      this.limitCount = count;
      return this;
    }

    range(from: number, to: number) {
      this.rangeFrom = from;
      this.rangeTo = to;
      return this;
    }

    private execute() {
      if (this.op === 'insert') {
        const records = Array.isArray(this.insertData) ? this.insertData : [this.insertData];
        const inserted: any[] = [];
        for (const rec of records) {
          const newRec = {
            id: rec.id || uuidv4(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            is_active: rec.is_active === undefined ? true : rec.is_active,
            ...rec
          };
          
          if (this.table === 'repairs' && !newRec.job_number) {
            const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            const count = DB.repairs.filter(r => r.job_number && r.job_number.includes(todayStr)).length + 1;
            newRec.job_number = `GK-${todayStr}-${String(count).padStart(3, '0')}`;
          }

          DB[this.table].push(newRec);
          inserted.push(newRec);
        }
        return inserted;
      }

      if (this.op === 'update') {
        const matches = this.getFilteredData();
        for (const match of matches) {
          // Handle repair_history logging side effect if updating status on repairs
          if (this.table === 'repairs' && this.updatesData.status && match.status !== this.updatesData.status) {
            DB.repair_history.push({
              id: uuidv4(),
              repair_id: match.id,
              old_status: match.status,
              new_status: this.updatesData.status,
              old_value: match.status,
              new_value: this.updatesData.status,
              note: this.updatesData.notes || `Status changed to ${this.updatesData.status}`,
              changed_by: this.updatesData.updated_by || match.staff_id || 'system',
              created_at: new Date().toISOString()
            });
          }
          Object.assign(match, this.updatesData, { updated_at: new Date().toISOString() });
        }
        return matches;
      }

      if (this.op === 'delete') {
        const matches = this.getFilteredData();
        DB[this.table] = DB[this.table].filter((item: any) => !matches.includes(item));
        return matches;
      }

      return this.getFilteredData();
    }

    private getFilteredData() {
      let result = [...(DB[this.table] || [])];
      for (const f of this.filters) {
        result = result.filter(f);
      }
      if (this.orderCol) {
        result.sort((a, b) => {
          const valA = a[this.orderCol!];
          const valB = b[this.orderCol!];
          if (valA < valB) return this.orderAsc ? -1 : 1;
          if (valA > valB) return this.orderAsc ? 1 : -1;
          return 0;
        });
      }
      if (this.limitCount !== null) {
        result = result.slice(0, this.limitCount);
      }
      if (this.rangeFrom !== null && this.rangeTo !== null) {
        result = result.slice(this.rangeFrom, this.rangeTo + 1);
      }
      return result;
    }

    then(onfulfilled?: (value: any) => any, onrejected?: (reason: any) => any) {
      const data = this.execute();
      const count = this.doCount ? data.length : undefined;
      
      // Joins resolution
      if (this.table === 'users') {
        for (const user of data) {
          if (user.shop_id) {
            user.shop = DB.shops.find(s => s.id === user.shop_id) || null;
          }
        }
      }
      if (this.table === 'repairs') {
        for (const repair of data) {
          if (repair.device_id) {
            repair.device = DB.devices.find(d => d.id === repair.device_id) || null;
            if (repair.device && repair.device.customer_id) {
              repair.device.customer = DB.customers.find(c => c.id === repair.device.customer_id) || null;
              repair.customer = repair.device.customer;
            }
          }
          const staff = DB.users.find(u => u.id === repair.staff_id);
          repair.assigned_staff = staff ? { id: staff.id, name: staff.name, staff_id: staff.staff_id } : null;
          
          const history = DB.repair_history.filter(h => h.repair_id === repair.id);
          repair.history = history.map(h => {
            const changer = DB.users.find(u => u.id === h.changed_by);
            return {
              ...h,
              changed_by_user: changer ? { id: changer.id, name: changer.name, role: changer.role } : null
            };
          });
        }
      }

      const payload = {
        data,
        error: null,
        count
      };
      return Promise.resolve(payload).then(onfulfilled, onrejected);
    }

    single() {
      return {
        then: (onfulfilled?: (value: any) => any, onrejected?: (reason: any) => any) => {
          const data = this.execute();
          const item = data[0] || null;
          if (item && this.table === 'users' && item.shop_id) {
            item.shop = DB.shops.find(s => s.id === item.shop_id) || null;
          }
          if (item && this.table === 'repairs') {
            if (item.device_id) {
              item.device = DB.devices.find(d => d.id === item.device_id) || null;
              if (item.device && item.device.customer_id) {
                item.device.customer = DB.customers.find(c => c.id === item.device.customer_id) || null;
                item.customer = item.device.customer;
              }
            }
            const staff = DB.users.find(u => u.id === item.staff_id);
            item.assigned_staff = staff ? { id: staff.id, name: staff.name, staff_id: staff.staff_id } : null;
            
            const history = DB.repair_history.filter(h => h.repair_id === item.id);
            item.history = history.map(h => {
              const changer = DB.users.find(u => u.id === item.changed_by);
              return {
                ...h,
                changed_by_user: changer ? { id: changer.id, name: changer.name, role: changer.role } : null
              };
            });
          }
          const payload = {
            data: item,
            error: item ? null : { message: 'Not found' }
          };
          return Promise.resolve(payload).then(onfulfilled, onrejected);
        }
      };
    }
  }

  const mockAuth = {
    signInWithPassword: async (params: any) => {
      const email = params.email;
      const user = DB.users.find(u => u.email === email);
      if (!user) {
        return { data: { user: null, session: null }, error: { message: 'Invalid credentials' } };
      }
      const token = `token-${user.id}`;
      const session = { access_token: token, refresh_token: `refresh-${user.id}` };
      return { data: { user, session }, error: null };
    },
    signOut: async () => ({ error: null }),
    getUser: async (token: string) => {
      if (!token || !token.startsWith('token-')) {
        return { data: { user: null }, error: { message: 'Invalid token' } };
      }
      const userId = token.replace('token-', '');
      const user = DB.users.find(u => u.id === userId);
      if (!user) {
        return { data: { user: null }, error: { message: 'User not found' } };
      }
      return { data: { user: { id: user.id, email: user.email } }, error: null };
    },
    refreshSession: async ({ refresh_token }: any) => {
      if (!refresh_token || !refresh_token.startsWith('refresh-')) {
        return { data: { session: null }, error: { message: 'Invalid refresh token' } };
      }
      const userId = refresh_token.replace('refresh-', '');
      const session = { access_token: `token-${userId}`, refresh_token: `refresh-${userId}` };
      return { data: { session }, error: null };
    }
  };

  const mockAdminAuth = {
    createUser: async (params: any) => {
      const id = params.id || uuidv4();
      const email = params.email;
      const meta = params.user_metadata || {};
      
      const newUser = {
        id,
        email,
        name: meta.name || '',
        role: meta.role || 'staff',
        shop_id: meta.shop_id || null,
        staff_id: meta.staff_id || null,
        is_active: true,
        created_at: new Date().toISOString()
      };
      
      DB.users.push(newUser);
      
      return {
        data: {
          user: {
            id,
            email,
            user_metadata: meta
          }
        },
        error: null
      };
    },
    deleteUser: async (id: string) => {
      DB.users = DB.users.filter(u => u.id !== id);
      return { data: {}, error: null };
    },
    listUsers: async () => {
      const authUsers = DB.users.map(u => ({
        id: u.id,
        email: u.email,
        user_metadata: { name: u.name, role: u.role, shop_id: u.shop_id, staff_id: u.staff_id }
      }));
      return { data: { users: authUsers }, error: null };
    }
  };

  return {
    supabaseClient: {
      auth: mockAuth,
      from: (table: string) => new MockQueryBuilder(table)
    },
    supabaseAdmin: {
      auth: {
        admin: mockAdminAuth
      },
      from: (table: string) => new MockQueryBuilder(table),
      rpc: (fnName: string) => {
        if (fnName === 'generate_job_number') {
          const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
          const count = DB.repairs.filter(r => r.job_number && r.job_number.includes(todayStr)).length + 1;
          const num = `GK-${todayStr}-${String(count).padStart(3, '0')}`;
          return Promise.resolve({ data: num, error: null });
        }
        if (fnName === 'generate_token_number') {
          const count = DB.repairs.length + 1;
          const token = `C-${String(count).padStart(4, '0')}`;
          return Promise.resolve({ data: token, error: null });
        }
        if (fnName === 'get_monthly_revenue') {
          return Promise.resolve({ data: [{ month: '2026-06', revenue: 100, repairsCount: 5 }], error: null });
        }
        if (fnName === 'get_top_device_brands') {
          return Promise.resolve({ data: [{ brand: 'Apple', count: 3 }, { brand: 'Samsung', count: 2 }], error: null });
        }
        return Promise.resolve({ data: [], error: null });
      },
      storage: {
        from: () => ({
          upload: async () => ({ data: { path: 'test-photo.png' }, error: null }),
          remove: async () => ({ data: [], error: null }),
          getPublicUrl: () => ({ data: { publicUrl: 'https://stub.supabase.co/storage/v1/object/public/shop-logos/logo.png' } }),
          createSignedUrl: async () => ({ data: { signedUrl: 'https://stub.supabase.co/storage/v1/object/sign/photo.png' }, error: null })
        })
      }
    },
    DB
  };
});

import { supabaseClient, supabaseAdmin } from '../src/utils/supabase';
const { DB } = require('../src/utils/supabase') as any;

beforeAll(async () => {
  try {
    // 1. Clean up potential leftover test users to prevent unique constraint errors
    const emails = ['test-owner@gkrepair.com', 'test-staff1@gkrepair.com', 'test-staff2@gkrepair.com'];
    for (const email of emails) {
      const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
      const existing = listData?.users.find(u => u.email === email);
      if (existing) {
        await supabaseAdmin.auth.admin.deleteUser(existing.id);
      }
    }

    // 2. Create Owner auth user
    const { data: oAuth, error: oErr } = await supabaseAdmin.auth.admin.createUser({
      email: 'test-owner@gkrepair.com',
      password: 'ownerpassword',
      email_confirm: true,
      user_metadata: { name: 'Test Owner', role: 'owner' }
    });
    if (oErr || !oAuth.user) throw new Error(`Owner signup error: ${oErr?.message}`);
    testData.ownerId = oAuth.user.id;

    // 3. Create the Shop
    const { data: shop, error: shopErr } = await supabaseAdmin
      .from('shops')
      .insert({
        name: 'Test Setup Repair Shop',
        address: '123 Test Street',
        phone: '1112223333',
        owner_id: testData.ownerId
      })
      .select()
      .single();
    if (shopErr || !shop) throw new Error(`Shop insert error: ${shopErr?.message}`);
    testData.shopId = shop.id;

    // 4. Link owner to shop
    await supabaseAdmin
      .from('users')
      .update({ shop_id: testData.shopId })
      .eq('id', testData.ownerId);

    // 5. Create Staff 1
    const { data: s1Auth, error: s1Err } = await supabaseAdmin.auth.admin.createUser({
      email: 'test-staff1@gkrepair.com',
      password: 'staffpassword1',
      email_confirm: true,
      user_metadata: { name: 'Test Staff 1', role: 'staff', staff_id: 'GK001', shop_id: testData.shopId }
    });
    if (s1Err || !s1Auth.user) throw new Error(`Staff 1 signup error: ${s1Err?.message}`);
    testData.staff1Id = s1Auth.user.id;

    // 6. Create Staff 2
    const { data: s2Auth, error: s2Err } = await supabaseAdmin.auth.admin.createUser({
      email: 'test-staff2@gkrepair.com',
      password: 'staffpassword2',
      email_confirm: true,
      user_metadata: { name: 'Test Staff 2', role: 'staff', staff_id: 'GK002', shop_id: testData.shopId }
    });
    if (s2Err || !s2Auth.user) throw new Error(`Staff 2 signup error: ${s2Err?.message}`);
    testData.staff2Id = s2Auth.user.id;

    // 7. Login to acquire active session tokens
    const { data: oLog } = await supabaseClient.auth.signInWithPassword({ email: 'test-owner@gkrepair.com', password: 'ownerpassword' });
    testData.ownerToken = oLog.session?.access_token || '';

    const { data: s1Log } = await supabaseClient.auth.signInWithPassword({ email: 'test-staff1@gkrepair.com', password: 'staffpassword1' });
    testData.staff1Token = s1Log.session?.access_token || '';

    const { data: s2Log } = await supabaseClient.auth.signInWithPassword({ email: 'test-staff2@gkrepair.com', password: 'staffpassword2' });
    testData.staff2Token = s2Log.session?.access_token || '';

    // 8. Seed 3 Customers
    const customerSeed = [
      { name: 'Alice Customer', phone: '1234567890', address: 'Alice St', shop_id: testData.shopId },
      { name: 'Bob Customer', phone: '2345678901', address: 'Bob St', shop_id: testData.shopId },
      { name: 'Charlie Customer', phone: '3456789012', address: 'Charlie St', shop_id: testData.shopId }
    ];

    for (const c of customerSeed) {
      const { data: inserted, error } = await supabaseAdmin.from('customers').insert(c).select().single();
      if (error || !inserted) throw new Error(`Customer seed error: ${error?.message}`);
      testData.customers.push(inserted);
    }

    // 9. Seed 5 Devices
    const devicesSeed = [
      { customer_id: testData.customers[0].id, brand: 'Apple', model: 'iPhone 13', imei: '123456789012345', problem: 'Screen Cracked' },
      { customer_id: testData.customers[1].id, brand: 'Samsung', model: 'Galaxy S22', imei: '234567890123456', problem: 'Battery Drain' },
      { customer_id: testData.customers[2].id, brand: 'Google', model: 'Pixel 6', imei: '345678901234567', problem: 'Charging Port' },
      { customer_id: testData.customers[0].id, brand: 'OnePlus', model: '9 Pro', imei: '456789012345678', problem: 'Back Glass' },
      { customer_id: testData.customers[1].id, brand: 'Xiaomi', model: 'Mi 11', imei: '567890123456789', problem: 'Water Damage' }
    ];

    for (const d of devicesSeed) {
      const { data: inserted, error } = await supabaseAdmin.from('devices').insert(d).select().single();
      if (error || !inserted) throw new Error(`Device seed error: ${error?.message}`);
      testData.devices.push(inserted);
    }

    // 10. Seed 5 Repairs
    const repairsSeed = [
      { job_number: 'TEST-JOB-001', device_id: testData.devices[0].id, shop_id: testData.shopId, estimate: 150.00, advance: 50.00, status: 'pending', staff_id: testData.staff1Id, created_by: testData.ownerId },
      { job_number: 'TEST-JOB-002', device_id: testData.devices[1].id, shop_id: testData.shopId, estimate: 200.00, advance: 100.00, status: 'repairing', staff_id: testData.staff1Id, created_by: testData.ownerId },
      { job_number: 'TEST-JOB-003', device_id: testData.devices[2].id, shop_id: testData.shopId, estimate: 120.00, advance: 120.00, status: 'ready', staff_id: testData.staff2Id, created_by: testData.ownerId },
      { job_number: 'TEST-JOB-004', device_id: testData.devices[3].id, shop_id: testData.shopId, estimate: 300.00, advance: 0.00, status: 'pending', staff_id: testData.staff2Id, created_by: testData.ownerId },
      { job_number: 'TEST-JOB-005', device_id: testData.devices[4].id, shop_id: testData.shopId, estimate: 80.00, advance: 40.00, status: 'delivered', staff_id: testData.staff1Id, created_by: testData.ownerId }
    ];

    for (const r of repairsSeed) {
      const { data: inserted, error } = await supabaseAdmin.from('repairs').insert(r).select().single();
      if (error || !inserted) throw new Error(`Repair seed error: ${error?.message}`);
      testData.repairs.push(inserted);
    }
  } catch (err) {
    console.error('Setup seeding failed:', err);
    throw err;
  }
}, 30000);

afterAll(async () => {
  try {
    DB.shops = [];
    DB.users = [];
    DB.customers = [];
    DB.devices = [];
    DB.repairs = [];
    DB.repair_history = [];
  } catch (err) {
    console.error('Cleanup teardown failed:', err);
  }
});
