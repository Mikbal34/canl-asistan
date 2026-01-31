/**
 * Supabase Migration via REST API
 * Service Role Key ile SQL çalıştırma
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Supabase config
const SUPABASE_URL = 'https://xbpfqerqpogtoqtlerah.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhicGZxZXJxcG9ndG9xdGxlcmFoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQ2ODE2OSwiZXhwIjoyMDg0MDQ0MTY5fQ.NhJIGS_R2s1Op3hlNdwJjxWcH_RadfXMraa0PvPdEp8';

// Migration dosyaları
const MIGRATION_FILES = [
  '001_add_tenants.sql',
  '002_add_beauty.sql',
  '003_add_tenant_id.sql',
];

async function executeSQL(sql) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`);

    const postData = JSON.stringify({ query: sql });

    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ success: true, data });
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// Supabase JS client ile dene
async function tryWithSupabaseClient() {
  const { createClient } = require('@supabase/supabase-js');

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  });

  console.log('\n📡 Supabase bağlantısı test ediliyor...');

  // Basit bir sorgu dene
  const { data, error } = await supabase.from('tenants').select('count').limit(1);

  const errMsg = error?.message?.toLowerCase() || '';
  if (error && (error.code === '42P01' || errMsg.includes('could not find') || errMsg.includes('not found') || errMsg.includes('does not exist'))) {
    console.log('ℹ️  tenants tablosu henüz yok - migration gerekli');
    return { connected: true, needsMigration: true };
  } else if (error) {
    console.log('❌ Bağlantı hatası:', error.message);
    return { connected: false, error };
  } else {
    console.log('✅ Bağlantı başarılı, tenants tablosu mevcut');
    return { connected: true, needsMigration: false, data };
  }
}

async function main() {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║         SUPABASE MİGRATİON (REST API)                      ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  try {
    const result = await tryWithSupabaseClient();

    if (!result.connected) {
      console.log('\n❌ Supabase\'e bağlanılamadı');
      console.log('\n💡 Çözüm: SQL\'leri manuel olarak çalıştırın:');
      console.log('1. https://supabase.com/dashboard açın');
      console.log('2. Projenizi seçin');
      console.log('3. SQL Editor\'e gidin');
      console.log('4. sql/migrations/ klasöründeki dosyaları sırayla çalıştırın');
      return;
    }

    if (!result.needsMigration) {
      console.log('\n✅ Tablolar zaten mevcut!');

      // Tenant sayısını kontrol et
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

      const { count } = await supabase.from('tenants').select('*', { count: 'exact', head: true });
      console.log(`👥 Mevcut tenant sayısı: ${count || 0}`);

      const { count: presetCount } = await supabase.from('industry_presets').select('*', { count: 'exact', head: true });
      console.log(`🏭 Industry preset sayısı: ${presetCount || 0}`);

      return;
    }

    // Migration gerekli - kullanıcıya bilgi ver
    console.log('\n⚠️  Migration gerekli!');
    console.log('\nSupabase REST API üzerinden DDL (CREATE TABLE) çalıştırılamıyor.');
    console.log('SQL\'leri manuel çalıştırmanız gerekiyor.\n');

    // Birleştirilmiş SQL dosyası oluştur
    console.log('📄 Birleştirilmiş SQL dosyası oluşturuluyor...');

    let combinedSQL = `-- ==========================================
-- SaaS Sesli Asistan - Tüm Migration'lar
-- Oluşturulma: ${new Date().toISOString()}
-- ==========================================

`;

    for (const file of MIGRATION_FILES) {
      const filepath = path.join(__dirname, '..', 'sql', 'migrations', file);
      if (fs.existsSync(filepath)) {
        const sql = fs.readFileSync(filepath, 'utf8');
        combinedSQL += `\n-- ==========================================\n`;
        combinedSQL += `-- ${file}\n`;
        combinedSQL += `-- ==========================================\n\n`;
        combinedSQL += sql + '\n';
      }
    }

    const outputPath = path.join(__dirname, '..', 'sql', 'all_migrations.sql');
    fs.writeFileSync(outputPath, combinedSQL);

    console.log(`✅ Dosya oluşturuldu: sql/all_migrations.sql`);
    console.log(`\n📋 Şimdi şunu yapın:`);
    console.log('1. https://supabase.com/dashboard/project/xbpfqerqpogtoqtlerah/sql açın');
    console.log('2. sql/all_migrations.sql dosyasının içeriğini kopyalayın');
    console.log('3. SQL Editor\'e yapıştırın ve "Run" butonuna tıklayın');

  } catch (err) {
    console.error('❌ Hata:', err.message);
  }
}

main();
