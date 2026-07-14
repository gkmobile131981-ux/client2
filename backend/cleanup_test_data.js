const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const PRESERVED_USER_IDS = [
  '5aba93bc-6abf-4b99-8600-dff366a3a99d', // gkmobile131981@gmail.com (Gokul Krishnan)
  '495f68cb-e7b8-4d56-8e66-0d8c9bd42ae6'  // test@gkrepair.com (Test Superadmin)
];

const PRESERVED_SHOP_ID = 'bafff8e0-53cc-45cc-afa3-1c5862e8da21'; // GK Mobile Repair

async function cleanup() {
  console.log('Starting database cleanup...');
  console.log('Preserving Users:', PRESERVED_USER_IDS);
  console.log('Preserving Shop ID:', PRESERVED_SHOP_ID);

  try {
    // 1. Delete all customers (cascades to devices, repairs, history, repair services)
    console.log('\nDeleting all customers (and cascaded devices/repairs)...');
    const { error: customerError } = await supabase
      .from('customers')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
    if (customerError) {
      console.error('Error deleting customers:', customerError.message);
    } else {
      console.log('✅ Successfully deleted all customers.');
    }

    // 2. Delete all rate cards (cascades to rate card services)
    console.log('\nDeleting all rate cards...');
    const { error: rateCardError } = await supabase
      .from('rate_cards')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
    if (rateCardError) {
      console.error('Error deleting rate cards:', rateCardError.message);
    } else {
      console.log('✅ Successfully deleted all rate cards.');
    }

    // 3. Unlink users from shops to prevent RESTRICT constraint violations
    console.log('\nUnlinking users from shops to be deleted...');
    const { error: unlinkError } = await supabase
      .from('users')
      .update({ shop_id: null })
      .not('id', 'in', `(${PRESERVED_USER_IDS.map(id => `"${id}"`).join(',')})`);
    if (unlinkError) {
      console.error('Error unlinking users:', unlinkError.message);
    } else {
      console.log('✅ Successfully unlinked users.');
    }

    // 4. Delete other shops
    console.log('\nDeleting other shops...');
    const { error: shopError } = await supabase
      .from('shops')
      .delete()
      .neq('id', PRESERVED_SHOP_ID);
    if (shopError) {
      console.error('Error deleting shops:', shopError.message);
    } else {
      console.log('✅ Successfully deleted other shops.');
    }

    // 5. List and delete other auth users
    console.log('\nListing auth users for deletion...');
    const { data: { users }, error: authListError } = await supabase.auth.admin.listUsers();
    if (authListError) {
      console.error('Error listing auth users:', authListError.message);
      return;
    }

    console.log(`Found ${users.length} total users.`);
    for (const user of users) {
      if (PRESERVED_USER_IDS.includes(user.id)) {
        console.log(`Keeping user: ${user.email} (${user.id})`);
      } else {
        console.log(`Deleting user: ${user.email} (${user.id})...`);
        const { error: deleteUserError } = await supabase.auth.admin.deleteUser(user.id);
        if (deleteUserError) {
          console.error(`❌ Error deleting user ${user.email}:`, deleteUserError.message);
        } else {
          console.log(`✅ Successfully deleted user ${user.email}.`);
        }
      }
    }

    console.log('\nCleanup completed!');
  } catch (err) {
    console.error('Unexpected error during cleanup:', err);
  }
}

cleanup();
