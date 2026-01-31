/**
 * Super Admin Kullanıcısı Oluşturma Script'i
 *
 * Kullanım:
 *   node scripts/create-super-admin.js
 *
 * Gereksinimler:
 *   - .env dosyasında SUPABASE_SERVICE_ROLE_KEY tanımlı olmalı
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPER_ADMIN = {
  email: 'superadmin@example.com',
  password: 'SuperAdmin123!',
  name: 'Super Admin',
  role: 'super_admin',
};

async function createSuperAdmin() {
  // Service role key kontrolü
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY .env dosyasında tanımlı değil!');
    console.log('\nSupabase Dashboard > Project Settings > API > service_role key\'i kopyalayın');
    console.log('ve .env dosyasına ekleyin:\n');
    console.log('SUPABASE_SERVICE_ROLE_KEY=your-service-role-key\n');
    process.exit(1);
  }

  // Admin client (service role key ile)
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

  console.log('🚀 Super Admin oluşturuluyor...\n');

  try {
    // 1. Mevcut kullanıcıyı kontrol et
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, email, role')
      .eq('email', SUPER_ADMIN.email)
      .single();

    if (existingUser) {
      console.log('ℹ️  Kullanıcı zaten mevcut:');
      console.log(`   Email: ${existingUser.email}`);
      console.log(`   Role: ${existingUser.role}`);
      console.log('\n✅ İşlem tamamlandı (kullanıcı zaten var)');
      return;
    }

    // 2. Supabase Auth'da kullanıcı oluştur
    console.log('📧 Supabase Auth kullanıcısı oluşturuluyor...');
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: SUPER_ADMIN.email,
      password: SUPER_ADMIN.password,
      email_confirm: true,
    });

    if (authError) {
      // Kullanıcı zaten Auth'da varsa, ID'sini al
      if (authError.message.includes('already been registered')) {
        console.log('ℹ️  Auth kullanıcısı zaten mevcut, users tablosuna ekleniyor...');

        // Auth kullanıcısını bul
        const { data: { users } } = await supabase.auth.admin.listUsers();
        const authUser = users.find(u => u.email === SUPER_ADMIN.email);

        if (authUser) {
          // Users tablosuna ekle
          const { data: newUser, error: dbError } = await supabase
            .from('users')
            .insert({
              auth_user_id: authUser.id,
              email: SUPER_ADMIN.email,
              name: SUPER_ADMIN.name,
              role: SUPER_ADMIN.role,
              tenant_id: null,
              is_active: true,
            })
            .select()
            .single();

          if (dbError) throw dbError;

          console.log('\n✅ Super Admin başarıyla oluşturuldu!\n');
          console.log('📋 Giriş Bilgileri:');
          console.log(`   Email: ${SUPER_ADMIN.email}`);
          console.log(`   Şifre: ${SUPER_ADMIN.password}`);
          return;
        }
      }
      throw authError;
    }

    console.log(`   Auth User ID: ${authData.user.id}`);

    // 3. Users tablosuna ekle
    console.log('💾 Users tablosuna ekleniyor...');
    const { data: newUser, error: dbError } = await supabase
      .from('users')
      .insert({
        auth_user_id: authData.user.id,
        email: SUPER_ADMIN.email,
        name: SUPER_ADMIN.name,
        role: SUPER_ADMIN.role,
        tenant_id: null,
        is_active: true,
      })
      .select()
      .single();

    if (dbError) {
      // Rollback: Auth kullanıcısını sil
      await supabase.auth.admin.deleteUser(authData.user.id);
      throw dbError;
    }

    console.log(`   User ID: ${newUser.id}`);

    console.log('\n✅ Super Admin başarıyla oluşturuldu!\n');
    console.log('📋 Giriş Bilgileri:');
    console.log(`   Email: ${SUPER_ADMIN.email}`);
    console.log(`   Şifre: ${SUPER_ADMIN.password}`);
    console.log('\n⚠️  İlk girişten sonra şifreyi değiştirmeyi unutmayın!');

  } catch (error) {
    console.error('\n❌ Hata:', error.message);
    process.exit(1);
  }
}

createSuperAdmin();
