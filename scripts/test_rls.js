/**
 * RLS Test Script
 * Migration sonrası RLS'in çalıştığını doğrular
 */

const { createClient } = require('@supabase/supabase-js');
const config = require('../src/config/env');

async function testRLS() {
  console.log('=== RLS TEST ===\n');

  // Admin client (RLS bypass)
  const supabaseAdmin = createClient(config.supabase.url, config.supabase.serviceRoleKey);

  // Anon client (RLS aktif)
  const supabaseAnon = createClient(config.supabase.url, config.supabase.anonKey);

  // 1. Admin client ile tenant sayısı
  console.log('1. Admin Client Test (serviceRoleKey)...');
  const { data: adminTenants, error: adminErr } = await supabaseAdmin
    .from('tenants')
    .select('id, name')
    .limit(5);

  if (adminErr) {
    console.log('   ❌ Admin query hatası:', adminErr.message);
  } else {
    console.log('   ✅ Admin query başarılı, ' + (adminTenants?.length || 0) + ' tenant bulundu');
    if (adminTenants && adminTenants.length > 0) {
      adminTenants.forEach(t => console.log('      - ' + t.name));
    }
  }

  // 2. Anon client ile veri çekme (RLS nedeniyle boş dönmeli)
  console.log('\n2. Anon Client Test (anonKey, auth yok)...');
  const { data: anonTenants, error: anonErr } = await supabaseAnon
    .from('tenants')
    .select('id, name')
    .limit(5);

  if (anonErr) {
    console.log('   ✅ Anon query engellendi:', anonErr.message);
  } else if (!anonTenants || anonTenants.length === 0) {
    console.log('   ✅ Anon query boş döndü (RLS çalışıyor!)');
  } else {
    console.log('   ⚠️  Anon query ' + anonTenants.length + ' kayıt döndürdü');
    console.log('      RLS politikası kontrol edilmeli');
  }

  // 3. Customers tablosu test
  console.log('\n3. Customers Tablosu Test...');
  const { data: adminCustomers, error: custAdminErr } = await supabaseAdmin
    .from('customers')
    .select('id, name, tenant_id')
    .limit(3);
  const { data: anonCustomers, error: custAnonErr } = await supabaseAnon
    .from('customers')
    .select('id')
    .limit(3);

  console.log('   Admin: ' + (adminCustomers?.length || 0) + ' kayıt' + (custAdminErr ? ' (hata: ' + custAdminErr.message + ')' : ''));
  console.log('   Anon: ' + (anonCustomers?.length || 0) + ' kayıt' + (custAnonErr ? ' (hata: ' + custAnonErr.message + ')' : ''));

  if ((adminCustomers?.length || 0) > 0 && (anonCustomers?.length || 0) === 0) {
    console.log('   ✅ RLS çalışıyor');
  } else if ((adminCustomers?.length || 0) === 0) {
    console.log('   ℹ️  Henüz customer verisi yok');
  }

  // 4. Call logs test
  console.log('\n4. Call Logs Tablosu Test...');
  const { data: adminLogs, error: logAdminErr } = await supabaseAdmin
    .from('call_logs')
    .select('id, tenant_id')
    .limit(3);
  const { data: anonLogs, error: logAnonErr } = await supabaseAnon
    .from('call_logs')
    .select('id')
    .limit(3);

  console.log('   Admin: ' + (adminLogs?.length || 0) + ' kayıt' + (logAdminErr ? ' (hata: ' + logAdminErr.message + ')' : ''));
  console.log('   Anon: ' + (anonLogs?.length || 0) + ' kayıt' + (logAnonErr ? ' (hata: ' + logAnonErr.message + ')' : ''));

  // 5. Users tablosu test
  console.log('\n5. Users Tablosu Test...');
  const { data: adminUsers, error: userAdminErr } = await supabaseAdmin
    .from('users')
    .select('id, email, role')
    .limit(3);
  const { data: anonUsers, error: userAnonErr } = await supabaseAnon
    .from('users')
    .select('id')
    .limit(3);

  console.log('   Admin: ' + (adminUsers?.length || 0) + ' kayıt' + (userAdminErr ? ' (hata: ' + userAdminErr.message + ')' : ''));
  console.log('   Anon: ' + (anonUsers?.length || 0) + ' kayıt' + (userAnonErr ? ' (hata: ' + userAnonErr.message + ')' : ''));

  if ((adminUsers?.length || 0) > 0 && (anonUsers?.length || 0) === 0) {
    console.log('   ✅ RLS çalışıyor');
  }

  // 6. Vehicles tablosu test
  console.log('\n6. Vehicles Tablosu Test...');
  const { data: adminVehicles } = await supabaseAdmin
    .from('vehicles')
    .select('id')
    .limit(1);
  const { data: anonVehicles } = await supabaseAnon
    .from('vehicles')
    .select('id')
    .limit(1);

  console.log('   Admin: ' + (adminVehicles?.length || 0) + ' kayıt');
  console.log('   Anon: ' + (anonVehicles?.length || 0) + ' kayıt');

  // Sonuç
  console.log('\n=== SONUÇ ===');
  const adminWorks = (adminTenants?.length || 0) > 0 || (adminCustomers?.length || 0) > 0 || (adminUsers?.length || 0) > 0;
  const rlsWorks = (anonTenants?.length || 0) === 0 && (anonCustomers?.length || 0) === 0 && (anonUsers?.length || 0) === 0;

  if (adminWorks && rlsWorks) {
    console.log('✅ RLS düzgün çalışıyor!');
    console.log('   - Admin client veri alabiliyor');
    console.log('   - Anon client (auth olmadan) veri alamıyor');
  } else if (!adminWorks) {
    console.log('⚠️  Veritabanında veri yok veya bağlantı sorunu');
  } else {
    console.log('⚠️  RLS politikaları kontrol edilmeli');
  }

  console.log('\n=== TEST TAMAMLANDI ===');
}

testRLS().catch(e => {
  console.error('Test hatası:', e.message);
  process.exit(1);
});
