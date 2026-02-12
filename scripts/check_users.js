const { createClient } = require('@supabase/supabase-js');
const config = require('../src/config/env');

const supabaseAdmin = createClient(config.supabase.url, config.supabase.serviceRoleKey);

async function check() {
  // Users tablosu
  const { data: users, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .limit(5);
  
  console.log('=== USERS TABLOSU ===');
  console.log(JSON.stringify(users, null, 2));
  
  // Tenant bilgisi
  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('*')
    .eq('name', 'denemeoto')
    .single();
  
  console.log('\n=== TENANT (denemeoto) ===');
  console.log(JSON.stringify(tenant, null, 2));
}

check().catch(console.error);
