/**
 * Tenant Kullanıcı Şifrelerini Sıfırlama Script'i
 *
 * Kullanım:
 *   node scripts/reset-passwords.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const NEW_PASSWORD = 'Tenant123!';

async function resetPasswords() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY tanımlı değil!');
    process.exit(1);
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  console.log('🔍 Kullanıcılar listeleniyor...\n');

  try {
    // 1. Tüm kullanıcıları getir
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select(`
        id,
        email,
        name,
        role,
        tenant_id,
        auth_user_id,
        is_active,
        tenants:tenant_id (
          name,
          slug
        )
      `)
      .order('created_at', { ascending: true });

    if (usersError) throw usersError;

    if (!users || users.length === 0) {
      console.log('ℹ️  Sistemde kullanıcı bulunamadı.');
      return;
    }

    console.log('📋 Mevcut Kullanıcılar:\n');
    console.log('─'.repeat(80));

    for (const user of users) {
      const tenantName = user.tenants?.name || 'Tenant yok (Super Admin)';
      console.log(`Email: ${user.email}`);
      console.log(`İsim: ${user.name}`);
      console.log(`Rol: ${user.role}`);
      console.log(`Tenant: ${tenantName}`);
      console.log(`Aktif: ${user.is_active ? 'Evet' : 'Hayır'}`);
      console.log('─'.repeat(80));
    }

    console.log(`\nToplam ${users.length} kullanıcı bulundu.\n`);

    // 2. Şifreleri sıfırla
    console.log(`🔄 Şifreler "${NEW_PASSWORD}" olarak sıfırlanıyor...\n`);

    let successCount = 0;
    let failCount = 0;

    for (const user of users) {
      if (!user.auth_user_id) {
        console.log(`⚠️  ${user.email}: auth_user_id yok, atlanıyor`);
        failCount++;
        continue;
      }

      const { error } = await supabase.auth.admin.updateUserById(
        user.auth_user_id,
        { password: NEW_PASSWORD }
      );

      if (error) {
        console.log(`❌ ${user.email}: ${error.message}`);
        failCount++;
      } else {
        console.log(`✅ ${user.email}: Şifre sıfırlandı`);
        successCount++;
      }
    }

    console.log('\n' + '═'.repeat(80));
    console.log('📊 SONUÇ');
    console.log('═'.repeat(80));
    console.log(`✅ Başarılı: ${successCount}`);
    console.log(`❌ Başarısız: ${failCount}`);
    console.log('\n📋 Yeni Giriş Bilgileri:');
    console.log(`   Şifre: ${NEW_PASSWORD}`);
    console.log('\n⚠️  Kullanıcıların ilk girişte şifrelerini değiştirmelerini önerin!');

  } catch (error) {
    console.error('\n❌ Hata:', error.message);
    process.exit(1);
  }
}

resetPasswords();
