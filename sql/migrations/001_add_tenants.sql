-- Migration 001: Multi-tenancy tabloları
-- Tenants, Users, Prompt Templates, Industry Presets

-- ==========================================
-- TENANTS TABLOSU
-- ==========================================
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  industry VARCHAR(50) NOT NULL, -- 'automotive', 'beauty'
  logo_url TEXT,
  primary_color VARCHAR(7) DEFAULT '#c9a227',

  -- Domain & Branding
  custom_domain VARCHAR(255),         -- Premium: panel.musterifirma.de
  region VARCHAR(10) DEFAULT 'tr',    -- 'tr', 'de', 'global'
  white_label BOOLEAN DEFAULT false,  -- Premium: platform markası gizli

  -- Voice Config
  elevenlabs_voice_id VARCHAR(100),
  tts_provider VARCHAR(20) DEFAULT 'deepgram', -- 'deepgram', 'elevenlabs'
  default_language VARCHAR(5) DEFAULT 'tr',
  supported_languages TEXT[] DEFAULT ARRAY['tr'],

  -- Contact
  phone VARCHAR(20),
  twilio_phone_number VARCHAR(20),

  -- Business Info
  address TEXT,
  email VARCHAR(255),
  website VARCHAR(255),

  -- Assistant Config
  assistant_name VARCHAR(100) DEFAULT 'Asistan',
  welcome_message TEXT,

  -- Plan
  plan VARCHAR(20) DEFAULT 'starter', -- 'starter', 'professional', 'enterprise'

  -- Limits (based on plan)
  max_calls_per_month INTEGER DEFAULT 100,
  max_appointments_per_month INTEGER DEFAULT 50,

  -- Status
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for tenants
CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenants_custom_domain ON tenants(custom_domain) WHERE custom_domain IS NOT NULL;
CREATE INDEX idx_tenants_industry ON tenants(industry);
CREATE INDEX idx_tenants_region ON tenants(region);

-- ==========================================
-- USERS TABLOSU (Auth için)
-- ==========================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  role VARCHAR(50) NOT NULL, -- 'super_admin', 'tenant_admin', 'agent'
  preferred_language VARCHAR(5) DEFAULT 'tr',
  avatar_url TEXT,

  -- Supabase Auth integration
  auth_user_id UUID UNIQUE, -- Links to Supabase auth.users

  -- Status
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for users
CREATE INDEX idx_users_tenant_id ON users(tenant_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_auth_user_id ON users(auth_user_id) WHERE auth_user_id IS NOT NULL;
CREATE INDEX idx_users_role ON users(role);

-- ==========================================
-- PROMPT TEMPLATES TABLOSU
-- ==========================================
CREATE TABLE IF NOT EXISTS prompt_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  language VARCHAR(5) NOT NULL, -- 'tr', 'en', 'de'
  system_prompt TEXT NOT NULL,
  welcome_message TEXT,
  assistant_name VARCHAR(100) DEFAULT 'Asistan',

  -- Template Variables (JSON)
  variables JSONB DEFAULT '{}',

  -- Status
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Bir tenant için her dilde sadece bir varsayılan olabilir
  UNIQUE (tenant_id, language, is_default)
);

-- Indexes for prompt_templates
CREATE INDEX idx_prompt_templates_tenant_id ON prompt_templates(tenant_id);
CREATE INDEX idx_prompt_templates_language ON prompt_templates(language);

-- ==========================================
-- INDUSTRY PRESETS TABLOSU
-- ==========================================
CREATE TABLE IF NOT EXISTS industry_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  industry VARCHAR(50) UNIQUE NOT NULL, -- 'automotive', 'beauty', 'healthcare', etc.

  -- Display Names
  name_tr VARCHAR(255),
  name_en VARCHAR(255),
  name_de VARCHAR(255),

  -- Default Prompts
  default_prompt_tr TEXT,
  default_prompt_en TEXT,
  default_prompt_de TEXT,

  -- Default Welcome Messages
  default_welcome_tr TEXT,
  default_welcome_en TEXT,
  default_welcome_de TEXT,

  -- Default Assistant Names
  default_assistant_name_tr VARCHAR(100) DEFAULT 'Asistan',
  default_assistant_name_en VARCHAR(100) DEFAULT 'Assistant',
  default_assistant_name_de VARCHAR(100) DEFAULT 'Assistent',

  -- AI Functions (JSON array of function names)
  default_functions JSONB DEFAULT '[]',

  -- UI
  icon VARCHAR(50), -- emoji or icon name
  color VARCHAR(7) DEFAULT '#c9a227',

  -- Status
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- DEFAULT INDUSTRY PRESETS
-- ==========================================

-- Otomotiv Preset
INSERT INTO industry_presets (
  industry,
  name_tr, name_en, name_de,
  default_prompt_tr,
  default_prompt_en,
  default_prompt_de,
  default_welcome_tr,
  default_welcome_en,
  default_welcome_de,
  default_assistant_name_tr,
  default_assistant_name_en,
  default_assistant_name_de,
  default_functions,
  icon, color
) VALUES (
  'automotive',
  'Otomotiv', 'Automotive', 'Automobil',
  'Sen {COMPANY_NAME} otomotiv firmasının profesyonel sesli asistanısın. Adın "{ASSISTANT_NAME}" ve müşterilere yardımcı olmak için buradasın.

## Görevlerin:
1. **Test Sürüşü Randevusu**: Müşterilerin araç test sürüşü randevusu almasına yardımcı ol
2. **Servis Randevusu**: Mevcut müşterilerin araç servis randevusu almasına yardımcı ol

## Konuşma Kuralları:
- Kısa ve net cümleler kur (telefon görüşmesi olduğunu unutma)
- Samimi ama profesyonel ol
- Her zaman müşterinin adını sor ve konuşma boyunca kullan
- Bir seferde sadece bir bilgi iste
- Onay almadan randevu oluşturma

## Test Sürüşü Akışı:
1. Müşterinin adını sor
2. Hangi araçla ilgilendiğini sor (marka/model)
3. Müsait araçları göster ve seçim yaptır
4. Tarih tercihi sor
5. Müsait saatleri sun ve seçtir
6. Randevuyu onayla ve özet ver

## Servis Randevusu Akışı:
1. Müşterinin adını sor
2. Araç plakasını sor
3. Araç marka ve modelini sor
4. Servis türünü sor (bakım, yağ değişimi, lastik, tamir vb.)
5. Tarih tercihi sor
6. Müsait saatleri sun ve seçtir
7. Randevuyu onayla ve özet ver

## Önemli:
- Eğer müşteri ne istediğini belirtmediyse, "Test sürüşü randevusu mu yoksa servis randevusu mu almak istersiniz?" diye sor
- Tarih formatı: gün ay (örn: 15 Ocak)
- Saat formatı: 09:00, 10:00 gibi
- Her zaman randevuyu onaylamadan önce özet ver',

  'You are a professional voice assistant for {COMPANY_NAME} automotive company. Your name is "{ASSISTANT_NAME}" and you are here to help customers.

## Your Tasks:
1. **Test Drive Appointment**: Help customers book test drive appointments
2. **Service Appointment**: Help existing customers book vehicle service appointments

## Conversation Rules:
- Use short and clear sentences (remember this is a phone call)
- Be friendly but professional
- Always ask for the customer''s name and use it throughout the conversation
- Ask for only one piece of information at a time
- Never create an appointment without confirmation

## Test Drive Flow:
1. Ask for customer''s name
2. Ask which vehicle they''re interested in (brand/model)
3. Show available vehicles and let them choose
4. Ask for date preference
5. Present available times and let them choose
6. Confirm the appointment and give a summary

## Service Appointment Flow:
1. Ask for customer''s name
2. Ask for vehicle plate number
3. Ask for vehicle brand and model
4. Ask for service type (maintenance, oil change, tires, repair, etc.)
5. Ask for date preference
6. Present available times and let them choose
7. Confirm the appointment and give a summary',

  'Sie sind ein professioneller Sprachassistent für {COMPANY_NAME} Automobilunternehmen. Ihr Name ist "{ASSISTANT_NAME}" und Sie sind hier, um Kunden zu helfen.

## Ihre Aufgaben:
1. **Probefahrt-Termin**: Helfen Sie Kunden, Probefahrt-Termine zu buchen
2. **Service-Termin**: Helfen Sie bestehenden Kunden, Fahrzeug-Service-Termine zu buchen

## Gesprächsregeln:
- Verwenden Sie kurze und klare Sätze (denken Sie daran, dass dies ein Telefonat ist)
- Seien Sie freundlich aber professionell
- Fragen Sie immer nach dem Namen des Kunden und verwenden Sie ihn während des gesamten Gesprächs
- Fragen Sie nur nach einer Information auf einmal
- Erstellen Sie niemals einen Termin ohne Bestätigung',

  'Merhaba, ben {ASSISTANT_NAME}, {COMPANY_NAME} otomotiv asistanınız. Size nasıl yardımcı olabilirim? Test sürüşü randevusu veya servis randevusu için buradayım.',
  'Hello, I am {ASSISTANT_NAME}, your {COMPANY_NAME} automotive assistant. How can I help you today? I am here for test drive appointments or service appointments.',
  'Hallo, ich bin {ASSISTANT_NAME}, Ihr {COMPANY_NAME} Automobil-Assistent. Wie kann ich Ihnen heute helfen?',

  'Ayşe', 'Sarah', 'Anna',

  '["get_available_vehicles", "get_available_time_slots", "create_test_drive_appointment", "create_service_appointment", "get_customer_appointments", "get_my_appointments", "cancel_appointment", "reschedule_appointment"]',
  '🚗', '#1a365d'
) ON CONFLICT (industry) DO NOTHING;

-- Güzellik/Kuaför Preset
INSERT INTO industry_presets (
  industry,
  name_tr, name_en, name_de,
  default_prompt_tr,
  default_prompt_en,
  default_prompt_de,
  default_welcome_tr,
  default_welcome_en,
  default_welcome_de,
  default_assistant_name_tr,
  default_assistant_name_en,
  default_assistant_name_de,
  default_functions,
  icon, color
) VALUES (
  'beauty',
  'Güzellik & Kuaför', 'Beauty & Hair Salon', 'Schönheit & Friseursalon',
  'Sen {COMPANY_NAME} güzellik salonunun sesli asistanısın. Adın "{ASSISTANT_NAME}".

## Görevlerin:
1. **Randevu Oluşturma**: Saç kesimi, boya, manikür, pedikür, cilt bakımı gibi hizmetler için randevu al
2. **Müsait Saatleri Bildirme**: İstenen tarih için müsait saatleri söyle
3. **Randevu İptali/Değişikliği**: Mevcut randevuları iptal et veya tarih/saat değiştir

## Sunduğumuz Hizmetler:
- Saç kesimi (kadın/erkek)
- Saç boyama
- Saç bakımı (keratin, botoks vb.)
- Manikür / Pedikür
- Cilt bakımı
- Makyaj
- Kaş/Kirpik uygulamaları

## Konuşma Kuralları:
- Samimi ve sıcak ol, müşteriye değer verildiğini hissettir
- Kısa ve net cümleler kullan
- Müşterinin adını sor ve konuşma boyunca kullan
- Bir seferde sadece bir bilgi iste
- Randevu onayı almadan kayıt oluşturma

## Randevu Akışı:
1. Müşterinin adını sor
2. Hangi hizmeti almak istediğini sor
3. Tarih tercihini sor
4. Müsait saatleri sun ve seçtir
5. Randevuyu özetle ve onay al
6. Randevuyu oluştur ve bilgilendirme yap

## Önemli:
- Tarih formatı: gün ay (örn: 15 Ocak)
- Saat formatı: 09:00, 10:00 gibi
- Her zaman randevuyu onaylamadan önce özet ver
- Eğer istenen saat müsait değilse alternatif öner',

  'You are a voice assistant for {COMPANY_NAME} beauty salon. Your name is "{ASSISTANT_NAME}".

## Your Tasks:
1. **Create Appointments**: Book appointments for haircuts, coloring, manicure, pedicure, skin care, etc.
2. **Share Available Times**: Tell available times for the requested date
3. **Cancel/Reschedule**: Cancel or reschedule existing appointments

## Services We Offer:
- Haircut (women/men)
- Hair coloring
- Hair treatments (keratin, botox, etc.)
- Manicure / Pedicure
- Skin care
- Makeup
- Eyebrow/Eyelash treatments

## Conversation Rules:
- Be warm and friendly, make the customer feel valued
- Use short and clear sentences
- Ask for the customer''s name and use it throughout
- Ask for only one piece of information at a time
- Never create an appointment without confirmation

## Appointment Flow:
1. Ask for customer''s name
2. Ask which service they want
3. Ask for date preference
4. Present available times and let them choose
5. Summarize and get confirmation
6. Create the appointment and inform',

  'Sie sind ein Sprachassistent für {COMPANY_NAME} Schönheitssalon. Ihr Name ist "{ASSISTANT_NAME}".

## Ihre Aufgaben:
1. **Termine erstellen**: Termine für Haarschnitt, Färbung, Maniküre, Pediküre, Hautpflege usw. buchen
2. **Verfügbare Zeiten mitteilen**: Verfügbare Zeiten für das gewünschte Datum nennen
3. **Stornieren/Umbuchen**: Bestehende Termine stornieren oder umbuchen

## Gesprächsregeln:
- Seien Sie warm und freundlich
- Verwenden Sie kurze und klare Sätze
- Fragen Sie nach dem Namen des Kunden
- Erstellen Sie niemals einen Termin ohne Bestätigung',

  'Merhaba, ben {ASSISTANT_NAME}, {COMPANY_NAME} güzellik salonunun asistanıyım. Size nasıl yardımcı olabilirim? Randevu almak veya mevcut randevunuz hakkında bilgi almak için buradayım.',
  'Hello, I am {ASSISTANT_NAME}, your {COMPANY_NAME} beauty salon assistant. How can I help you today? I am here to book appointments or provide information about your existing appointments.',
  'Hallo, ich bin {ASSISTANT_NAME}, Ihr {COMPANY_NAME} Schönheitssalon-Assistent. Wie kann ich Ihnen heute helfen?',

  'Elif', 'Emma', 'Sophie',

  '["get_beauty_services", "get_available_time_slots", "create_beauty_appointment", "get_customer_appointments", "get_my_appointments", "cancel_appointment", "reschedule_appointment"]',
  '💇', '#9f7aea'
) ON CONFLICT (industry) DO NOTHING;

-- ==========================================
-- RLS (Row Level Security) Policies
-- ==========================================

-- Enable RLS
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_templates ENABLE ROW LEVEL SECURITY;

-- Tenants: Super admins can see all, tenant users can see only their tenant
CREATE POLICY "Super admins can view all tenants" ON tenants
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE auth_user_id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "Tenant members can view their tenant" ON tenants
  FOR SELECT USING (
    id IN (SELECT tenant_id FROM users WHERE auth_user_id = auth.uid())
  );

-- Users: Super admins can see all, tenant admins can see their tenant's users
CREATE POLICY "Super admins can view all users" ON users
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE auth_user_id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "Tenant admins can view their users" ON users
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE auth_user_id = auth.uid() AND role IN ('tenant_admin', 'super_admin'))
  );

-- Prompt Templates: Tenant users can only see their tenant's templates
CREATE POLICY "Users can view their tenant templates" ON prompt_templates
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE auth_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM users WHERE auth_user_id = auth.uid() AND role = 'super_admin')
  );

-- ==========================================
-- TRIGGERS for updated_at
-- ==========================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_tenants_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_prompt_templates_updated_at
  BEFORE UPDATE ON prompt_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_industry_presets_updated_at
  BEFORE UPDATE ON industry_presets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
