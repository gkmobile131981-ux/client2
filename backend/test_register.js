const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testRegister() {
  const email = 'test_reg_owner@test.com';
  const password = 'password123';
  
  // 1. Create auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: 'Test Gokul', role: 'owner' }
  });
  
  if (authError) {
    console.error('Auth error:', authError);
    return;
  }
  
  console.log('Auth user created:', authData.user.id);
  const userId = authData.user.id;
  
  // 2. Create shop record
  const { data: shop, error: shopError } = await supabase
    .from('shops')
    .insert({
      name: 'gk moblies',
      address: 'no5, murugan street, mpm.',
      phone: '9976992105',
      owner_id: userId,
      shop_type: 'Mobile Repair',
      gst_number: null,
      currency_symbol: '₹',
      currency_code: 'INR',
      logo_url: null
    })
    .select()
    .single();
    
  if (shopError) {
    console.error('Shop error:', shopError);
    // Cleanup auth user
    await supabase.auth.admin.deleteUser(userId);
    return;
  }
  
  console.log('Shop created:', shop.id);
  
  // 3. Update public.users
  const { data: user, error: userError } = await supabase
    .from('users')
    .update({ 
      shop_id: shop.id,
      community_username: 'GK mob'
    })
    .eq('id', userId)
    .select()
    .single();
    
  if (userError) {
    console.error('User error:', userError);
    // Cleanup
    await supabase.from('shops').delete().eq('id', shop.id);
    await supabase.auth.admin.deleteUser(userId);
    return;
  }
  
  console.log('Success! Linked user to shop:', user.id);
}

testRegister();
