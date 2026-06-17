const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  console.log('Testing connection to Supabase:', supabaseUrl);
  
  // 1. Check rate_cards table
  const { data: rateCards, error: rcError } = await supabase
    .from('rate_cards')
    .select('*')
    .limit(1);
  if (rcError) {
    console.error('❌ Error reading rate_cards:', rcError.message);
  } else {
    console.log('✅ Success: rate_cards table exists.');
  }

  // 2. Check rate_card_services table
  const { data: rcs, error: rcsError } = await supabase
    .from('rate_card_services')
    .select('*')
    .limit(1);
  if (rcsError) {
    console.error('❌ Error reading rate_card_services:', rcsError.message);
  } else {
    console.log('✅ Success: rate_card_services table exists.');
  }

  // 3. Check repair_services table
  const { data: rs, error: rsError } = await supabase
    .from('repair_services')
    .select('*')
    .limit(1);
  if (rsError) {
    console.error('❌ Error reading repair_services:', rsError.message);
  } else {
    console.log('✅ Success: repair_services table exists.');
  }

  // 4. Check repairs table for token_number
  const { data: repairs, error: repairsError } = await supabase
    .from('repairs')
    .select('token_number')
    .limit(1);
  if (repairsError) {
    console.error('❌ Error reading token_number from repairs:', repairsError.message);
  } else {
    console.log('✅ Success: token_number column exists in repairs.');
  }

  // 5. Test RPC call if a customer exists
  const { data: customers } = await supabase.from('customers').select('id').limit(1);
  if (customers && customers.length > 0) {
    const custId = customers[0].id;
    console.log(`Testing generate_token_number RPC for customer: ${custId}`);
    const { data: token, error: rpcError } = await supabase.rpc('generate_token_number', {
      p_customer_id: custId
    });
    if (rpcError) {
      console.error('❌ Error calling generate_token_number RPC:', rpcError.message);
    } else {
      console.log(`✅ Success: generate_token_number RPC works. Returned token: ${token}`);
    }
  } else {
    console.log('⚠️ No customers found to test RPC with.');
  }
}

checkSchema();
