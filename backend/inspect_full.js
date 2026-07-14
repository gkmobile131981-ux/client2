const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  // Get all users from auth
  const { data: { users: authUsers }, error: authError } = await supabase.auth.admin.listUsers();
  if (authError) {
    console.error('Error reading auth.users:', authError);
    return;
  }

  // Get all public users
  const { data: pubUsers, error: pubError } = await supabase.from('users').select('*');
  if (pubError) {
    console.error('Error reading public.users:', pubError);
    return;
  }

  // Get all shops
  const { data: shops, error: shopsError } = await supabase.from('shops').select('*');
  if (shopsError) {
    console.error('Error reading shops:', shopsError);
    return;
  }

  console.log('=== SHOPS ===');
  for (const shop of shops) {
    const ownerAuth = authUsers.find(u => u.id === shop.owner_id);
    const ownerEmail = ownerAuth ? ownerAuth.email : 'Unknown';
    console.log(`Shop: "${shop.name}" (ID: ${shop.id}) | Owner: ${ownerEmail} (${shop.owner_id})`);
  }

  console.log('\n=== USERS NOT LINKED TO ANY SHOP ===');
  for (const user of pubUsers) {
    if (!user.shop_id) {
      const authUser = authUsers.find(u => u.id === user.id);
      const email = authUser ? authUser.email : 'Unknown';
      console.log(`User: "${user.name}" | Email: ${email} | Role: ${user.role} | ID: ${user.id}`);
    }
  }

  console.log('\n=== CUSTOMERS PER SHOP ===');
  const { data: customers } = await supabase.from('customers').select('id, name, shop_id');
  const shopCustomerCounts = {};
  for (const cust of customers || []) {
    shopCustomerCounts[cust.shop_id] = (shopCustomerCounts[cust.shop_id] || 0) + 1;
  }
  for (const shop of shops) {
    console.log(`Shop: "${shop.name}" | Customers Count: ${shopCustomerCounts[shop.id] || 0}`);
  }
}

run();
