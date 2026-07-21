const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  try {
    // Get the repair ID for GK-20260716-004 (large KYC details)
    const { data: repair } = await supabase
      .from('repairs')
      .select('id, shop_id, staff_id')
      .eq('job_number', 'GK-20260716-004')
      .single();

    if (!repair) {
      console.log('GK-20260716-004 not found in DB.');
      return;
    }

    console.log(`Found repair order ID: ${repair.id}`);

    // Mock Express request and response
    const req = {
      params: { id: repair.id },
      user: {
        id: repair.staff_id || '5aba93bc-6abf-4b99-8600-dff366a3a99d',
        shop_id: repair.shop_id,
        role: 'owner'
      }
    };

    const res = {
      status: function(code) {
        console.log('res.status called with:', code);
        return this;
      },
      json: function(data) {
        console.log('res.json called successfully!');
        const jsonStr = JSON.stringify(data);
        console.log(`Output JSON string length: ${jsonStr.length}`);
        
        try {
          JSON.parse(jsonStr);
          console.log('✅ Serialized output parses back successfully.');
        } catch (e) {
          console.error('❌ Serialized output failed to parse:', e.message);
        }
      }
    };

    // Require getRepairById controller
    const { getRepairById } = require('./src/controllers/repairs.controller');
    await getRepairById(req, res);

  } catch (err) {
    console.error('Test run failed:', err);
  }
}

run();
