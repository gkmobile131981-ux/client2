const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectDatabase() {
  console.log('Connecting to Supabase:', supabaseUrl);

  // 1. List Users in auth.users
  console.log('\n--- Auth Users ---');
  const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();
  if (authError) {
    console.error('Error listing auth users:', authError.message);
  } else {
    users.forEach(u => {
      console.log(`ID: ${u.id} | Email: ${u.email} | Role: ${u.user_metadata?.role || u.raw_user_meta_data?.role} | Name: ${u.user_metadata?.name || u.raw_user_meta_data?.name}`);
    });
  }

  // 2. List Users in public.users
  console.log('\n--- Public Users ---');
  const { data: pubUsers, error: pubError } = await supabase.from('users').select('*');
  if (pubError) {
    console.error('Error reading public.users:', pubError.message);
  } else {
    pubUsers.forEach(u => {
      console.log(`ID: ${u.id} | Name: ${u.name} | Role: ${u.role} | Shop ID: ${u.shop_id} | Is Active: ${u.is_active}`);
    });
  }

  // 3. Row counts for other tables
  const tables = [
    'shops',
    'customers',
    'devices',
    'repairs',
    'repair_history',
    'carousel_slides',
    'rate_cards',
    'rate_card_services',
    'repair_services'
  ];

  console.log('\n--- Table Counts ---');
  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.error(`Error counting ${table}:`, error.message);
    } else {
      console.log(`Table: ${table} | Count: ${count}`);
    }
  }
}

inspectDatabase();
