-- Migration 004: VAPI Integration
-- VAPI Assistant IDs, Voice Config JSONB, Sync Log

-- ==========================================
-- HELPER FUNCTION (if not exists from previous migrations)
-- ==========================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- ==========================================
-- INDUSTRY_PRESETS: VAPI Config Columns (JSONB)
-- ==========================================

-- Her dil icin VAPI konfigurasyon alanlari ekle
ALTER TABLE industry_presets
  ADD COLUMN IF NOT EXISTS config_tr JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS config_en JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS config_de JSONB DEFAULT '{}';

-- Default tools alani (sektore ozel fonksiyonlar)
ALTER TABLE industry_presets
  ADD COLUMN IF NOT EXISTS default_tools JSONB DEFAULT '[]';

-- Description alanlari
ALTER TABLE industry_presets
  ADD COLUMN IF NOT EXISTS description_tr TEXT,
  ADD COLUMN IF NOT EXISTS description_en TEXT,
  ADD COLUMN IF NOT EXISTS description_de TEXT;

-- ==========================================
-- TENANTS: VAPI Assistant IDs
-- ==========================================

-- Her dil icin VAPI assistant ID alanlari ekle
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS vapi_assistant_id_tr VARCHAR(100),
  ADD COLUMN IF NOT EXISTS vapi_assistant_id_en VARCHAR(100),
  ADD COLUMN IF NOT EXISTS vapi_assistant_id_de VARCHAR(100),
  ADD COLUMN IF NOT EXISTS vapi_phone_number_id VARCHAR(100);

-- Voice config override (null ise preset'ten alinir)
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS voice_config_override JSONB;

-- Index for VAPI assistant ID lookups
CREATE INDEX IF NOT EXISTS idx_tenants_vapi_assistant_tr ON tenants(vapi_assistant_id_tr) WHERE vapi_assistant_id_tr IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tenants_vapi_assistant_en ON tenants(vapi_assistant_id_en) WHERE vapi_assistant_id_en IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tenants_vapi_assistant_de ON tenants(vapi_assistant_id_de) WHERE vapi_assistant_id_de IS NOT NULL;

-- ==========================================
-- VAPI_SYNC_LOG: Sync Takibi
-- ==========================================

CREATE TABLE IF NOT EXISTS vapi_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  preset_id UUID REFERENCES industry_presets(id) ON DELETE SET NULL,

  -- Sync details
  action VARCHAR(50) NOT NULL,  -- 'create_assistant', 'update_assistant', 'delete_assistant', 'sync_preset'
  language VARCHAR(5),

  -- VAPI response
  vapi_assistant_id VARCHAR(100),
  vapi_response JSONB,

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- 'pending', 'success', 'failed'
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_vapi_sync_log_tenant_id ON vapi_sync_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vapi_sync_log_status ON vapi_sync_log(status);
CREATE INDEX IF NOT EXISTS idx_vapi_sync_log_created_at ON vapi_sync_log(created_at DESC);

-- ==========================================
-- UPDATE INDUSTRY PRESETS WITH VAPI CONFIG
-- ==========================================

-- Automotive preset config_tr
UPDATE industry_presets
SET
  config_tr = '{
    "voice_provider": "elevenlabs",
    "voice_id": "EXAVITQu4vr4xnSDxMaL",
    "voice_speed": 1.0,
    "model": "gpt-4o-mini",
    "temperature": 0.7,
    "max_tokens": 500,
    "system_prompt": "Sen {FIRMA_ADI} otomotiv firmasinin profesyonel sesli asistanisin. Adin \"{ASISTAN_ADI}\".\n\nBugunun tarihi: {TARIH}\nSu anki saat: {SAAT}\n\n## Gorevlerin:\n1. **Test Surusu Randevusu**: Musterilerin arac test surusu randevusu almasina yardimci ol\n2. **Servis Randevusu**: Mevcut musterilerin arac servis randevusu almasina yardimci ol\n\n## Konusma Kurallari:\n- Kisa ve net cumleler kur (telefon gorusmesi oldugunu unutma)\n- Samimi ama profesyonel ol\n- Her zaman musterinin adini sor ve konusma boyunca kullan\n- Bir seferde sadece bir bilgi iste\n- Onay almadan randevu olusturma\n\n## Onemli:\n- Tarih formati: gun ay (orn: 15 Ocak)\n- Saat formati: 09:00, 10:00 gibi\n- Her zaman randevuyu onaylamadan once ozet ver",
    "first_message": "Merhaba, ben {ASISTAN_ADI}, {FIRMA_ADI}''nin sesli asistani. Size nasil yardimci olabilirim? Test surusu veya servis randevusu icin buradayim."
  }'::jsonb,
  config_en = '{
    "voice_provider": "elevenlabs",
    "voice_id": "21m00Tcm4TlvDq8ikWAM",
    "voice_speed": 1.0,
    "model": "gpt-4o-mini",
    "temperature": 0.7,
    "max_tokens": 500,
    "system_prompt": "You are a professional voice assistant for {FIRMA_ADI} automotive company. Your name is \"{ASISTAN_ADI}\".\n\nToday''s date: {TARIH}\nCurrent time: {SAAT}\n\n## Your Tasks:\n1. **Test Drive Appointment**: Help customers book test drive appointments\n2. **Service Appointment**: Help existing customers book vehicle service appointments\n\n## Conversation Rules:\n- Use short and clear sentences (remember this is a phone call)\n- Be friendly but professional\n- Always ask for the customer''s name and use it throughout\n- Ask for only one piece of information at a time\n- Never create an appointment without confirmation",
    "first_message": "Hello, I am {ASISTAN_ADI}, the voice assistant for {FIRMA_ADI}. How can I help you today? I am here for test drive or service appointments."
  }'::jsonb,
  config_de = '{
    "voice_provider": "elevenlabs",
    "voice_id": "29vD33N1CtxCmqQRPOHJ",
    "voice_speed": 1.0,
    "model": "gpt-4o-mini",
    "temperature": 0.7,
    "max_tokens": 500,
    "system_prompt": "Sie sind ein professioneller Sprachassistent fur {FIRMA_ADI} Automobilunternehmen. Ihr Name ist \"{ASISTAN_ADI}\".\n\nHeutiges Datum: {TARIH}\nAktuelle Uhrzeit: {SAAT}\n\n## Ihre Aufgaben:\n1. **Probefahrt-Termin**: Helfen Sie Kunden, Probefahrt-Termine zu buchen\n2. **Service-Termin**: Helfen Sie bestehenden Kunden, Service-Termine zu buchen\n\n## Gesprachsregeln:\n- Verwenden Sie kurze und klare Satze\n- Seien Sie freundlich aber professionell\n- Erstellen Sie niemals einen Termin ohne Bestatigung",
    "first_message": "Hallo, ich bin {ASISTAN_ADI}, der Sprachassistent von {FIRMA_ADI}. Wie kann ich Ihnen heute helfen?"
  }'::jsonb,
  default_tools = '[
    {"name": "get_available_vehicles", "description": "Musait araclari listele"},
    {"name": "get_available_time_slots", "description": "Musait randevu saatlerini getir"},
    {"name": "create_test_drive_appointment", "description": "Test surusu randevusu olustur"},
    {"name": "create_service_appointment", "description": "Servis randevusu olustur"},
    {"name": "get_customer_appointments", "description": "Musteri randevularini getir"},
    {"name": "cancel_appointment", "description": "Randevu iptal et"},
    {"name": "reschedule_appointment", "description": "Randevu tarihini degistir"}
  ]'::jsonb,
  description_tr = 'Otomotiv bayileri icin test surusu ve servis randevusu yonetimi',
  description_en = 'Test drive and service appointment management for automotive dealers',
  description_de = 'Probefahrt- und Serviceterminverwaltung fur Autohauser'
WHERE industry = 'automotive';

-- Beauty preset config_tr
UPDATE industry_presets
SET
  config_tr = '{
    "voice_provider": "elevenlabs",
    "voice_id": "EXAVITQu4vr4xnSDxMaL",
    "voice_speed": 1.0,
    "model": "gpt-4o-mini",
    "temperature": 0.7,
    "max_tokens": 500,
    "system_prompt": "Sen {FIRMA_ADI} guzellik salonunun sesli asistanisin. Adin \"{ASISTAN_ADI}\".\n\nBugunun tarihi: {TARIH}\nSu anki saat: {SAAT}\n\n## Gorevlerin:\n1. **Randevu Olusturma**: Sac kesimi, boya, manikur, pedikur, cilt bakimi gibi hizmetler icin randevu al\n2. **Musait Saatleri Bildirme**: Istenen tarih icin musait saatleri soyle\n3. **Randevu Iptali/Degisikligi**: Mevcut randevulari iptal et veya tarih/saat degistir\n\n## Konusma Kurallari:\n- Samimi ve sicak ol, musteriye deger verildigini hissettir\n- Kisa ve net cumleler kullan\n- Musterinin adini sor ve konusma boyunca kullan\n- Bir seferde sadece bir bilgi iste\n- Randevu onayi almadan kayit olusturma",
    "first_message": "Merhaba, ben {ASISTAN_ADI}, {FIRMA_ADI}''nin sesli asistani. Size nasil yardimci olabilirim? Randevu almak veya mevcut randevunuz hakkinda bilgi almak icin buradayim."
  }'::jsonb,
  config_en = '{
    "voice_provider": "elevenlabs",
    "voice_id": "21m00Tcm4TlvDq8ikWAM",
    "voice_speed": 1.0,
    "model": "gpt-4o-mini",
    "temperature": 0.7,
    "max_tokens": 500,
    "system_prompt": "You are a voice assistant for {FIRMA_ADI} beauty salon. Your name is \"{ASISTAN_ADI}\".\n\nToday''s date: {TARIH}\nCurrent time: {SAAT}\n\n## Your Tasks:\n1. **Create Appointments**: Book appointments for haircuts, coloring, manicure, pedicure, skin care, etc.\n2. **Share Available Times**: Tell available times for the requested date\n3. **Cancel/Reschedule**: Cancel or reschedule existing appointments\n\n## Conversation Rules:\n- Be warm and friendly, make the customer feel valued\n- Use short and clear sentences\n- Ask for the customer''s name and use it throughout\n- Never create an appointment without confirmation",
    "first_message": "Hello, I am {ASISTAN_ADI}, the voice assistant for {FIRMA_ADI}. How can I help you today?"
  }'::jsonb,
  config_de = '{
    "voice_provider": "elevenlabs",
    "voice_id": "29vD33N1CtxCmqQRPOHJ",
    "voice_speed": 1.0,
    "model": "gpt-4o-mini",
    "temperature": 0.7,
    "max_tokens": 500,
    "system_prompt": "Sie sind ein Sprachassistent fur {FIRMA_ADI} Schonheitssalon. Ihr Name ist \"{ASISTAN_ADI}\".\n\nHeutiges Datum: {TARIH}\nAktuelle Uhrzeit: {SAAT}\n\n## Ihre Aufgaben:\n1. **Termine erstellen**: Termine fur Haarschnitt, Farbung, Manikure usw. buchen\n2. **Verfugbare Zeiten mitteilen**: Verfugbare Zeiten nennen\n3. **Stornieren/Umbuchen**: Bestehende Termine stornieren oder umbuchen",
    "first_message": "Hallo, ich bin {ASISTAN_ADI}, der Sprachassistent von {FIRMA_ADI}. Wie kann ich Ihnen heute helfen?"
  }'::jsonb,
  default_tools = '[
    {"name": "get_beauty_services", "description": "Mevcut hizmetleri listele"},
    {"name": "get_available_time_slots", "description": "Musait randevu saatlerini getir"},
    {"name": "create_beauty_appointment", "description": "Guzellik randevusu olustur"},
    {"name": "get_customer_appointments", "description": "Musteri randevularini getir"},
    {"name": "cancel_appointment", "description": "Randevu iptal et"},
    {"name": "reschedule_appointment", "description": "Randevu tarihini degistir"}
  ]'::jsonb,
  description_tr = 'Guzellik salonlari ve kuaforler icin randevu yonetimi',
  description_en = 'Appointment management for beauty salons and hair stylists',
  description_de = 'Terminverwaltung fur Schonheitssalons und Friseure'
WHERE industry = 'beauty';

-- ==========================================
-- HELPER FUNCTION: Get Tenant VAPI Config
-- ==========================================

CREATE OR REPLACE FUNCTION get_tenant_vapi_config(
  p_tenant_id UUID,
  p_language VARCHAR(5) DEFAULT 'tr'
)
RETURNS JSONB AS $$
DECLARE
  v_tenant RECORD;
  v_preset RECORD;
  v_config JSONB;
  v_config_column TEXT;
BEGIN
  -- Tenant bilgilerini al
  SELECT * INTO v_tenant FROM tenants WHERE id = p_tenant_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Preset bilgilerini al
  SELECT * INTO v_preset FROM industry_presets WHERE industry = v_tenant.industry;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Dile gore config kolonunu sec
  v_config_column := 'config_' || p_language;

  -- Base config'i al (preset'ten)
  EXECUTE format('SELECT %I FROM industry_presets WHERE industry = $1', v_config_column)
    INTO v_config
    USING v_tenant.industry;

  -- Tenant override varsa merge et
  IF v_tenant.voice_config_override IS NOT NULL THEN
    v_config := v_config || v_tenant.voice_config_override;
  END IF;

  -- Placeholder'lari degistir
  v_config := jsonb_set(v_config, '{system_prompt}',
    to_jsonb(
      replace(
        replace(
          replace(v_config->>'system_prompt', '{FIRMA_ADI}', v_tenant.name),
          '{ASISTAN_ADI}', COALESCE(v_tenant.assistant_name, 'Asistan')
        ),
        '{TELEFON}', COALESCE(v_tenant.phone, '')
      )
    )
  );

  v_config := jsonb_set(v_config, '{first_message}',
    to_jsonb(
      replace(
        replace(v_config->>'first_message', '{FIRMA_ADI}', v_tenant.name),
        '{ASISTAN_ADI}', COALESCE(v_tenant.assistant_name, 'Asistan')
      )
    )
  );

  RETURN v_config;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- HELPER FUNCTION: Get Tenant by VAPI Assistant ID
-- ==========================================

CREATE OR REPLACE FUNCTION get_tenant_by_vapi_assistant(
  p_assistant_id VARCHAR(100)
)
RETURNS UUID AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  SELECT id INTO v_tenant_id
  FROM tenants
  WHERE vapi_assistant_id_tr = p_assistant_id
     OR vapi_assistant_id_en = p_assistant_id
     OR vapi_assistant_id_de = p_assistant_id
  LIMIT 1;

  RETURN v_tenant_id;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- RLS for vapi_sync_log
-- ==========================================

ALTER TABLE vapi_sync_log ENABLE ROW LEVEL SECURITY;

-- Super admins can see all logs
CREATE POLICY "Super admins can view all sync logs" ON vapi_sync_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE auth_user_id = auth.uid() AND role = 'super_admin')
  );

-- Tenant admins can see their tenant's logs
CREATE POLICY "Tenant admins can view their sync logs" ON vapi_sync_log
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE auth_user_id = auth.uid() AND role IN ('tenant_admin', 'super_admin'))
  );

-- ==========================================
-- TRIGGER for vapi_sync_log
-- ==========================================

CREATE TRIGGER update_vapi_sync_log_updated_at
  BEFORE UPDATE ON vapi_sync_log
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
