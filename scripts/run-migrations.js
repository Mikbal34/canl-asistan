/**
 * Migration Runner Script
 * Supabase PostgreSQL'e doğrudan bağlanıp migration'ları çalıştırır
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// .env dosyasını yükle
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Database bağlantı seçenekleri
const DB_CONFIGS = [
  {
    name: 'Direct Connection',
    host: 'db.xbpfqerqpogtoqtlerah.supabase.co',
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: process.env.SUPABASE_DB_PASSWORD || 'Muhammetaa11-*koc',
    ssl: { rejectUnauthorized: false }
  },
  {
    name: 'Pooler Session Mode (EU Central)',
    host: 'aws-0-eu-central-1.pooler.supabase.com',
    port: 5432,
    database: 'postgres',
    user: 'postgres.xbpfqerqpogtoqtlerah',
    password: process.env.SUPABASE_DB_PASSWORD || 'Muhammetaa11-*koc',
    ssl: { rejectUnauthorized: false }
  },
  {
    name: 'Pooler Session Mode (US East)',
    host: 'aws-0-us-east-1.pooler.supabase.com',
    port: 5432,
    database: 'postgres',
    user: 'postgres.xbpfqerqpogtoqtlerah',
    password: process.env.SUPABASE_DB_PASSWORD || 'Muhammetaa11-*koc',
    ssl: { rejectUnauthorized: false }
  },
  {
    name: 'Pooler Session Mode (US West)',
    host: 'aws-0-us-west-1.pooler.supabase.com',
    port: 5432,
    database: 'postgres',
    user: 'postgres.xbpfqerqpogtoqtlerah',
    password: process.env.SUPABASE_DB_PASSWORD || 'Muhammetaa11-*koc',
    ssl: { rejectUnauthorized: false }
  }
];

let DB_CONFIG = DB_CONFIGS[0];

// Migration dosyaları sırasıyla
const MIGRATION_FILES = [
  '001_add_tenants.sql',
  '002_add_beauty.sql',
  '003_add_tenant_id.sql',
];

async function runMigration(client, filename) {
  const filepath = path.join(__dirname, '..', 'sql', 'migrations', filename);

  if (!fs.existsSync(filepath)) {
    console.error(`❌ Dosya bulunamadı: ${filepath}`);
    return false;
  }

  console.log(`\n📄 Çalıştırılıyor: ${filename}`);
  console.log('─'.repeat(50));

  const sql = fs.readFileSync(filepath, 'utf8');

  try {
    await client.query(sql);
    console.log(`✅ ${filename} başarıyla çalıştırıldı`);
    return true;
  } catch (err) {
    // Bazı hatalar normal olabilir (örn: tablo zaten var)
    if (err.message.includes('already exists')) {
      console.log(`⚠️  ${filename}: Bazı objeler zaten mevcut (devam ediliyor)`);
      return true;
    }
    console.error(`❌ ${filename} hatası:`, err.message);
    return false;
  }
}

async function tryConnect() {
  for (const config of DB_CONFIGS) {
    console.log(`\n🔄 Deneniyor: ${config.name}`);
    console.log(`   Host: ${config.host}:${config.port}`);

    const client = new Client({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      ssl: config.ssl,
      connectionTimeoutMillis: 10000
    });

    try {
      await client.connect();
      console.log(`✅ ${config.name} ile bağlantı başarılı!`);
      DB_CONFIG = config;
      return client;
    } catch (err) {
      console.log(`❌ ${config.name} başarısız: ${err.message}`);
      try { await client.end(); } catch (e) {}
    }
  }
  return null;
}

async function main() {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║         SUPABASE MİGRATİON RUNNER v2.0                     ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('\n📡 Bağlantı denemeleri başlıyor...');

  const client = await tryConnect();

  if (!client) {
    console.error('\n❌ Hiçbir bağlantı yöntemi çalışmadı!');
    console.log('\n💡 Çözüm önerileri:');
    console.log('1. Supabase Dashboard > Settings > Database > Connection string');
    console.log('2. "Direct connection" string\'ini kopyalayın');
    console.log('3. Host, port ve password değerlerini kontrol edin');
    process.exit(1);
  }

  try {
    console.log('\n✅ PostgreSQL bağlantısı başarılı\n');

    let successCount = 0;
    let failCount = 0;

    for (const file of MIGRATION_FILES) {
      const success = await runMigration(client, file);
      if (success) {
        successCount++;
      } else {
        failCount++;
      }
    }

    console.log('\n' + '═'.repeat(50));
    console.log(`📊 Sonuç: ${successCount} başarılı, ${failCount} başarısız`);

    // Oluşturulan tabloları kontrol et
    console.log('\n📋 Oluşturulan tablolar:');
    const result = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    result.rows.forEach(row => {
      console.log(`   • ${row.table_name}`);
    });

    // Tenant sayısını kontrol et
    try {
      const tenantCount = await client.query('SELECT COUNT(*) FROM tenants');
      console.log(`\n👥 Tenant sayısı: ${tenantCount.rows[0].count}`);
    } catch (e) {
      // Tablo yoksa hata verir, sorun değil
    }

    // Industry preset sayısını kontrol et
    try {
      const presetCount = await client.query('SELECT COUNT(*) FROM industry_presets');
      console.log(`🏭 Industry preset sayısı: ${presetCount.rows[0].count}`);
    } catch (e) {}

  } catch (err) {
    console.error('❌ Migration hatası:', err.message);
    process.exit(1);
  } finally {
    if (client) {
      await client.end();
      console.log('\n🔌 Bağlantı kapatıldı');
    }
  }
}

main().catch(console.error);
