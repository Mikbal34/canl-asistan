/**
 * Reset Script - Temiz Başlangıç
 *
 * Bu script:
 * 1. VAPI'deki TÜM asistanları siler
 * 2. Supabase'deki TÜM tenant'ları ve ilişkili verileri siler
 *
 * DİKKAT: Bu işlem GERİ ALINAMAZ!
 *
 * Kullanım: node scripts/reset-all.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const VAPI_API_KEY = process.env.VAPI_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// VAPI API helper
async function vapiRequest(method, endpoint, body = null) {
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${VAPI_API_KEY}`,
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`https://api.vapi.ai${endpoint}`, options);

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`VAPI Error: ${response.status} - ${error}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

// 1. VAPI Asistanlarını Listele ve Sil
async function deleteAllVapiAssistants() {
  console.log('\n📱 VAPI Asistanları Siliniyor...\n');

  try {
    // Tüm asistanları listele
    const assistants = await vapiRequest('GET', '/assistant');

    if (!assistants || assistants.length === 0) {
      console.log('   ✓ VAPI\'de asistan bulunamadı.');
      return 0;
    }

    console.log(`   Bulunan asistan sayısı: ${assistants.length}`);

    let deleted = 0;
    for (const assistant of assistants) {
      try {
        console.log(`   - Siliniyor: ${assistant.name || assistant.id}`);
        await vapiRequest('DELETE', `/assistant/${assistant.id}`);
        deleted++;
      } catch (err) {
        console.log(`   ✗ Silinemedi: ${assistant.id} - ${err.message}`);
      }
    }

    console.log(`\n   ✓ ${deleted}/${assistants.length} asistan silindi.`);
    return deleted;
  } catch (error) {
    console.error('   ✗ VAPI hatası:', error.message);
    return 0;
  }
}

// 2. Supabase Tenant'ları ve İlişkili Verileri Sil
async function deleteAllTenants() {
  console.log('\n🗄️  Supabase Tenant\'ları Siliniyor...\n');

  try {
    // Önce tenant'ları listele
    const { data: tenants, error: listError } = await supabase
      .from('tenants')
      .select('id, name, slug');

    if (listError) {
      console.error('   ✗ Tenant listesi alınamadı:', listError.message);
      return 0;
    }

    if (!tenants || tenants.length === 0) {
      console.log('   ✓ Tenant bulunamadı.');
      return 0;
    }

    console.log(`   Bulunan tenant sayısı: ${tenants.length}`);

    for (const tenant of tenants) {
      console.log(`\n   📁 ${tenant.name} (${tenant.slug}) siliniyor...`);

      // İlişkili tabloları sil (foreign key sırası önemli)
      const relatedTables = [
        'appointments',
        'customers',
        'call_logs',
        'feedback',
        'vehicles',
        'beauty_services',
        'staff',
        'promotions',
        'tenant_use_cases',
        'tenant_assistant_template',
        'onboarding_agent_sessions',
        'appointment_slots',
      ];

      for (const table of relatedTables) {
        try {
          const { error } = await supabase
            .from(table)
            .delete()
            .eq('tenant_id', tenant.id);

          if (!error) {
            console.log(`      ✓ ${table} temizlendi`);
          }
        } catch (e) {
          // Tablo yoksa veya hata varsa devam et
        }
      }

      // users tablosundan tenant kullanıcılarını sil
      try {
        const { error } = await supabase
          .from('users')
          .delete()
          .eq('tenant_id', tenant.id);

        if (!error) {
          console.log(`      ✓ users temizlendi`);
        }
      } catch (e) {}
    }

    // Son olarak tenant'ları sil
    const { error: deleteError } = await supabase
      .from('tenants')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Dummy condition to delete all

    if (deleteError) {
      console.error('   ✗ Tenant silme hatası:', deleteError.message);
      return 0;
    }

    console.log(`\n   ✓ ${tenants.length} tenant silindi.`);
    return tenants.length;
  } catch (error) {
    console.error('   ✗ Supabase hatası:', error.message);
    return 0;
  }
}

// 3. Auth kullanıcılarını sil (opsiyonel - admin hariç)
async function deleteAuthUsers() {
  console.log('\n🔐 Auth Kullanıcıları Kontrol Ediliyor...\n');

  try {
    // Admin kullanıcısını koru
    const { data: adminUser } = await supabase
      .from('users')
      .select('auth_id')
      .eq('role', 'super_admin')
      .single();

    const adminAuthId = adminUser?.auth_id;

    // users tablosundaki tüm kullanıcıları sil (admin hariç)
    if (adminAuthId) {
      const { data: usersToDelete } = await supabase
        .from('users')
        .select('id, email, auth_id')
        .neq('auth_id', adminAuthId);

      if (usersToDelete && usersToDelete.length > 0) {
        console.log(`   Silinecek kullanıcı sayısı: ${usersToDelete.length}`);

        // users tablosundan sil
        await supabase
          .from('users')
          .delete()
          .neq('auth_id', adminAuthId);

        console.log(`   ✓ ${usersToDelete.length} kullanıcı silindi (admin korundu).`);
      } else {
        console.log('   ✓ Silinecek kullanıcı yok (admin korundu).');
      }
    }
  } catch (error) {
    console.error('   ✗ Auth hatası:', error.message);
  }
}

// Ana fonksiyon
async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('🚨 RESET SCRIPT - TEMİZ BAŞLANGIÇ');
  console.log('='.repeat(60));
  console.log('\nBu script TÜM tenant\'ları ve VAPI asistanlarını silecek!');
  console.log('Super Admin kullanıcısı korunacak.\n');

  // Onay iste
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const answer = await new Promise((resolve) => {
    rl.question('Devam etmek istiyor musunuz? (evet/hayir): ', resolve);
  });
  rl.close();

  if (answer.toLowerCase() !== 'evet') {
    console.log('\n❌ İşlem iptal edildi.\n');
    process.exit(0);
  }

  console.log('\n🔄 İşlem başlıyor...');

  // 1. VAPI asistanlarını sil
  const vapiDeleted = await deleteAllVapiAssistants();

  // 2. Tenant'ları sil
  const tenantsDeleted = await deleteAllTenants();

  // 3. Auth kullanıcılarını temizle
  await deleteAuthUsers();

  // Özet
  console.log('\n' + '='.repeat(60));
  console.log('✅ RESET TAMAMLANDI');
  console.log('='.repeat(60));
  console.log(`\n   VAPI Asistanları: ${vapiDeleted} silindi`);
  console.log(`   Tenant'lar: ${tenantsDeleted} silindi`);
  console.log(`   Super Admin: Korundu`);
  console.log('\n   Artık temiz bir başlangıç yapabilirsiniz! 🚀\n');
}

main().catch(console.error);
