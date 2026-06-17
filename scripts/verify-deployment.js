/**
 * Post-Deployment Verification Script for GK Repair System
 * 
 * Runs end-to-end integration checks against a live or local API instance.
 * No external dependencies required. Execute with:
 *   node scripts/verify-deployment.js <api_url>
 */

const dns = require('dns');

// Force Node to use ipv4 first (fixes potential localhost resolution issues on some machines)
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  bold: '\x1b[1m'
};

const baseUrl = process.argv[2] || 'http://localhost:5000';
console.log(`${colors.cyan}${colors.bold}=== GK Repair System: Verification Script ===${colors.reset}`);
console.log(`Targeting API: ${colors.yellow}${baseUrl}${colors.reset}\n`);

// Helper to construct a dummy 1x1 PNG Blob
function createDummyPngBlob(filename) {
  const base64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const bin = Buffer.from(base64, 'base64');
  return new Blob([bin], { type: 'image/png' });
}

async function run() {
  let passed = true;
  
  const uniqueId = Date.now();
  const ownerEmail = `owner-${uniqueId}@testverify.com`;
  const staffEmail = `staff-${uniqueId}@testverify.com`;
  
  let ownerToken = '';
  let staffToken = '';
  let ownerShopId = '';
  let customerId = '';
  let repairId = '';
  let staffUserId = '';

  const testSteps = [
    {
      name: 'Owner Registration',
      fn: async () => {
        const res = await fetch(`${baseUrl}/api/auth/register-owner`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Verification Owner',
            email: ownerEmail,
            password: 'ownerpassword123',
            shopName: `Verify Shop ${uniqueId}`,
            shopAddress: '123 Verify Road',
            shopPhone: '5551234567'
          })
        });
        
        const body = await res.json();
        if (res.status !== 201) throw new Error(`Status ${res.status}: ${JSON.stringify(body)}`);
        if (!body.accessToken || !body.shop?.id) throw new Error('Response missing access token or shop ID');
        
        ownerToken = body.accessToken;
        ownerShopId = body.shop.id;
        return `Registered owner and created shop: ${body.shop.name} (${body.shop.id})`;
      }
    },
    {
      name: 'Owner Profile Access (/api/auth/me)',
      fn: async () => {
        const res = await fetch(`${baseUrl}/api/auth/me`, {
          headers: { 'Authorization': `Bearer ${ownerToken}` }
        });
        const body = await res.json();
        if (res.status !== 200) throw new Error(`Status ${res.status}: ${JSON.stringify(body)}`);
        if (body.user.role !== 'owner') throw new Error(`Expected role owner, got ${body.user.role}`);
        return 'Successfully authenticated owner token';
      }
    },
    {
      name: 'Staff Creation by Owner',
      fn: async () => {
        const res = await fetch(`${baseUrl}/api/auth/create-staff`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${ownerToken}`
          },
          body: JSON.stringify({
            name: 'Verification Staff',
            email: staffEmail,
            password: 'staffpassword123'
          })
        });
        
        const body = await res.json();
        if (res.status !== 201) throw new Error(`Status ${res.status}: ${JSON.stringify(body)}`);
        if (!body.user.id || !body.user.staff_id) throw new Error('Staff creation missing ID or staff_id');
        
        staffUserId = body.user.id;
        return `Staff created successfully: ${body.user.name} (${body.user.staff_id})`;
      }
    },
    {
      name: 'Staff Login',
      fn: async () => {
        const res = await fetch(`${baseUrl}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: staffEmail,
            password: 'staffpassword123'
          })
        });
        
        const body = await res.json();
        if (res.status !== 200) throw new Error(`Status ${res.status}: ${JSON.stringify(body)}`);
        if (!body.accessToken) throw new Error('Login missing access token');
        
        staffToken = body.accessToken;
        return 'Staff logged in and obtained bearer token';
      }
    },
    {
      name: 'Create Customer (multipart/form-data with photo upload)',
      fn: async () => {
        const formData = new FormData();
        formData.append('name', 'John Verify');
        formData.append('phone', `555-${uniqueId % 10000000}`);
        formData.append('address', '789 Customer Lane');
        
        const blob = createDummyPngBlob('customer.png');
        formData.append('photo', blob, 'customer.png');

        const res = await fetch(`${baseUrl}/api/customers`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${ownerToken}` },
          body: formData
        });
        
        const body = await res.json();
        if (res.status !== 201) throw new Error(`Status ${res.status}: ${JSON.stringify(body)}`);
        if (!body.customer?.id) throw new Error('Response missing customer ID');
        
        customerId = body.customer.id;
        return `Customer registered successfully with photo: ${body.customer.name} (ID: ${customerId})`;
      }
    },
    {
      name: 'Create Repair Order (with device photos)',
      fn: async () => {
        const formData = new FormData();
        formData.append('customerId', customerId);
        formData.append('brand', 'Google');
        formData.append('model', 'Pixel 8 Pro');
        formData.append('imei', '990000862471854');
        formData.append('problem', 'Broken OLED glass and green vertical line');
        formData.append('quality', 'damaged');
        formData.append('estimate', '350');
        formData.append('advance', '100');
        formData.append('staffId', staffUserId);
        
        const frontBlob = createDummyPngBlob('front.png');
        const backBlob = createDummyPngBlob('back.png');
        formData.append('frontPhoto', frontBlob, 'front.png');
        formData.append('backPhoto', backBlob, 'back.png');

        const res = await fetch(`${baseUrl}/api/repairs`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${ownerToken}` },
          body: formData
        });

        const body = await res.json();
        if (res.status !== 201) throw new Error(`Status ${res.status}: ${JSON.stringify(body)}`);
        if (!body.repair?.id || !body.repair?.job_number) throw new Error('Response missing repair record');

        repairId = body.repair.id;
        return `Repair initialized with job number: ${body.repair.job_number} (ID: ${repairId})`;
      }
    },
    {
      name: 'Verify Status Update & Audit History Logs',
      fn: async () => {
        // Update status as assigned staff
        const statusRes = await fetch(`${baseUrl}/api/repairs/${repairId}/status`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${staffToken}`
          },
          body: JSON.stringify({
            status: 'repairing',
            notes: 'Technician opened device and began micro-soldering ports'
          })
        });

        const statusBody = await statusRes.json();
        if (statusRes.status !== 200) throw new Error(`Status update failed: ${JSON.stringify(statusBody)}`);

        // Fetch detail log to verify history
        const detailRes = await fetch(`${baseUrl}/api/repairs/${repairId}`, {
          headers: { 'Authorization': `Bearer ${ownerToken}` }
        });
        const detailBody = await detailRes.json();
        
        if (detailRes.status !== 200) throw new Error(`Failed to fetch details: ${JSON.stringify(detailBody)}`);
        
        const history = detailBody.repair.history;
        if (!history || history.length === 0) throw new Error('No status change logs registered');
        
        const changeLog = history.find(h => h.new_status === 'repairing');
        if (!changeLog) throw new Error('Status transition history log for "repairing" missing');
        
        return `Status transitioned successfully and history recorded: ${changeLog.note}`;
      }
    },
    {
      name: 'PDF Receipt Generator (vector renders)',
      fn: async () => {
        // First transition to ready so receipt can render Delivered fields or check status
        // Transition to ready
        await fetch(`${baseUrl}/api/repairs/${repairId}/status`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${staffToken}`
          },
          body: JSON.stringify({ status: 'ready', notes: 'Completed fix' })
        });

        const res = await fetch(`${baseUrl}/api/repairs/${repairId}/receipt`, {
          headers: { 'Authorization': `Bearer ${ownerToken}` }
        });

        if (res.status !== 200) {
          const text = await res.text();
          throw new Error(`Receipt fetch returned ${res.status}: ${text}`);
        }

        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/pdf')) {
          throw new Error(`Expected application/pdf content-type, got ${contentType}`);
        }

        const buffer = await res.arrayBuffer();
        if (buffer.byteLength < 1000) {
          throw new Error(`PDF data size too small (${buffer.byteLength} bytes)`);
        }

        return `PDF receipt generated and downloaded successfully: ${buffer.byteLength} bytes`;
      }
    },
    {
      name: 'Dashboard Charts Aggregations',
      fn: async () => {
        const res = await fetch(`${baseUrl}/api/dashboard`, {
          headers: { 'Authorization': `Bearer ${ownerToken}` }
        });

        const body = await res.json();
        if (res.status !== 200) throw new Error(`Dashboard returned status ${res.status}`);
        
        const stats = body.todayStats;
        if (stats.newRepairs === undefined || stats.delivered === undefined) {
          throw new Error('Dashboard todayStats parameters missing');
        }

        if (!Array.isArray(body.monthlyRevenue) || !Array.isArray(body.topDeviceBrands)) {
          throw new Error('Recharts aggregations data missing');
        }

        return `Dashboard loaded. Today's Repairs: ${stats.newRepairs}, Top Brand: ${body.topDeviceBrands[0]?.brand || 'None'}`;
      }
    },
    {
      name: 'Security Guard: Block unauthorized token access',
      fn: async () => {
        const res = await fetch(`${baseUrl}/api/dashboard`, {
          headers: { 'Authorization': `Bearer invalid-token` }
        });

        if (res.status !== 401) {
          throw new Error(`Expected 401 Unauthorized for invalid token, got ${res.status}`);
        }
        return 'Blocked access successfully';
      }
    },
    {
      name: 'Security Guard: RLS shop boundaries & RBAC roles',
      fn: async () => {
        // Create Shop B
        const bRegRes = await fetch(`${baseUrl}/api/auth/register-owner`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Shop B Owner',
            email: `shop-b-${uniqueId}@testverify.com`,
            password: 'ownerpassword123',
            shopName: `Verify Shop B ${uniqueId}`,
            shopAddress: '456 Alternate Way',
            shopPhone: '5559876543'
          })
        });

        const bBody = await bRegRes.json();
        if (bRegRes.status !== 201) throw new Error('Failed to register Shop B Owner');
        
        const shopBToken = bBody.accessToken;

        // Try to fetch Shop A's repair order as Shop B Owner
        const res = await fetch(`${baseUrl}/api/repairs/${repairId}`, {
          headers: { 'Authorization': `Bearer ${shopBToken}` }
        });

        if (res.status !== 404) {
          throw new Error(`Security Breach! Shop B Owner fetched Shop A repair with status: ${res.status}`);
        }

        // Try to update Shop A estimate as Staff of Shop A (technicians cannot change financials)
        const staffUpdateRes = await fetch(`${baseUrl}/api/repairs/${repairId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${staffToken}`
          },
          body: JSON.stringify({
            estimate: 1000 // attempt to modify financial estimate
          })
        });

        if (staffUpdateRes.status !== 403) {
          throw new Error(`Security Breach! Staff updated estimate values with status: ${staffUpdateRes.status}`);
        }

        return 'RLS policies and RBAC roles block unauthorized access successfully';
      }
    }
  ];

  for (let i = 0; i < testSteps.length; i++) {
    const step = testSteps[i];
    console.log(`[Step ${i + 1}/${testSteps.length}] Checking: ${step.name}...`);
    try {
      const message = await step.fn();
      console.log(`  ${colors.green}✓ PASS${colors.reset}: ${message}\n`);
    } catch (err) {
      console.error(`  ${colors.red}✗ FAIL${colors.reset}: ${err.message}\n`);
      passed = false;
      break;
    }
  }

  console.log('--------------------------------------------------');
  if (passed) {
    console.log(`${colors.green}${colors.bold}=== VERIFICATION STATUS: SUCCESS ===${colors.reset}`);
    console.log('All operational flows, RLS guards, and receipts passed verification.');
    process.exit(0);
  } else {
    console.log(`${colors.red}${colors.bold}=== VERIFICATION STATUS: FAILED ===${colors.reset}`);
    console.log('One or more checks failed. Please check log details.');
    process.exit(1);
  }
}

run();
