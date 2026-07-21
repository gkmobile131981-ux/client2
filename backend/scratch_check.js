const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
  console.log('Querying repairs to inspect kyc_details JSON integrity...');
  try {
    const { data: repairs, error } = await supabase
      .from('repairs')
      .select('id, job_number, kyc_details, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('DB query error:', error.message);
      return;
    }

    console.log(`Retrieved ${repairs.length} recent repairs:`);
    for (const r of repairs) {
      const kyc = r.kyc_details;
      if (!kyc) {
        console.log(`- Job ${r.job_number}: kyc_details is NULL`);
        continue;
      }

      console.log(`- Job ${r.job_number}: kyc_details length = ${kyc.length}`);
      
      // Try parsing JSON
      try {
        JSON.parse(kyc);
        console.log(`  └ ✅ Parsed as valid JSON.`);
      } catch (e) {
        console.log(`  └ ❌ JSON Parse Error: ${e.message}`);
        // Log a preview of the end of the string
        console.log(`  └ Preview of end: "...${kyc.slice(-100)}"`);
      }
    }
  } catch (err) {
    console.error('Execution error:', err);
  }
}

inspect();
