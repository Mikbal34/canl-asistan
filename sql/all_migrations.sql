-- ==========================================
-- SaaS Sesli Asistan - Tüm Migration'lar
-- Oluşturulma: 2026-01-27T18:47:46.610Z
-- ==========================================


-- ==========================================
-- 001_add_tenants.sql
-- ==========================================

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


-- ==========================================
-- 002_add_beauty.sql
-- ==========================================

-- Migration 002: Güzellik sektörü tabloları
-- Beauty Services, Beauty Appointments

-- ==========================================
-- BEAUTY SERVICES TABLOSU
-- ==========================================
CREATE TABLE IF NOT EXISTS beauty_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Service Info
  name VARCHAR(255) NOT NULL,
  name_en VARCHAR(255),
  name_de VARCHAR(255),
  description TEXT,

  -- Category
  category VARCHAR(50) NOT NULL, -- 'hair', 'nails', 'skin', 'makeup', 'other'

  -- Duration & Pricing
  duration_minutes INTEGER DEFAULT 30,
  price DECIMAL(10,2),
  currency VARCHAR(3) DEFAULT 'TRY', -- 'TRY', 'EUR', 'USD'

  -- Display
  display_order INTEGER DEFAULT 0,
  icon VARCHAR(50),

  -- Status
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_beauty_services_tenant_id ON beauty_services(tenant_id);
CREATE INDEX idx_beauty_services_category ON beauty_services(category);
CREATE INDEX idx_beauty_services_active ON beauty_services(tenant_id, is_active);

-- ==========================================
-- BEAUTY APPOINTMENTS TABLOSU
-- ==========================================
CREATE TABLE IF NOT EXISTS beauty_appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  service_id UUID REFERENCES beauty_services(id) ON DELETE SET NULL,

  -- Appointment Details
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  duration_minutes INTEGER, -- Override service duration if needed

  -- Status
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'

  -- Optional Staff Assignment
  staff_name VARCHAR(100),

  -- Notes
  notes TEXT,
  cancellation_reason TEXT,

  -- Pricing (captured at booking time)
  price_at_booking DECIMAL(10,2),
  currency VARCHAR(3) DEFAULT 'TRY',

  -- Reminder
  reminder_sent BOOLEAN DEFAULT false,
  reminder_sent_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_beauty_appointments_tenant_id ON beauty_appointments(tenant_id);
CREATE INDEX idx_beauty_appointments_customer_id ON beauty_appointments(customer_id);
CREATE INDEX idx_beauty_appointments_date ON beauty_appointments(tenant_id, appointment_date);
CREATE INDEX idx_beauty_appointments_status ON beauty_appointments(tenant_id, status);
CREATE INDEX idx_beauty_appointments_upcoming ON beauty_appointments(tenant_id, appointment_date, appointment_time)
  WHERE status IN ('pending', 'confirmed');

-- ==========================================
-- STAFF MEMBERS TABLOSU (Opsiyonel)
-- ==========================================
CREATE TABLE IF NOT EXISTS staff_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Staff Info
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(255),

  -- Specialization
  specializations TEXT[], -- Array of service categories they can do

  -- Availability (JSON: {"monday": ["09:00-12:00", "14:00-18:00"], ...})
  working_hours JSONB DEFAULT '{}',

  -- Status
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_staff_members_tenant_id ON staff_members(tenant_id);

-- ==========================================
-- DEFAULT BEAUTY SERVICES (Template)
-- ==========================================

-- Not: Bu veriler her yeni tenant oluşturulduğunda kopyalanacak
-- Örnek hizmetler (tenant oluşturulduğunda eklenecek)
-- Burada sadece referans olarak bırakıyorum

/*
Sample services to be created for new beauty tenants:

Hair:
- Kadın Saç Kesimi (Women's Haircut) - 45 min - 250 TRY
- Erkek Saç Kesimi (Men's Haircut) - 30 min - 100 TRY
- Saç Boyama (Hair Coloring) - 90 min - 500 TRY
- Röfle (Highlights) - 120 min - 600 TRY
- Saç Bakımı (Hair Treatment) - 60 min - 400 TRY
- Keratin Bakımı (Keratin Treatment) - 120 min - 1500 TRY
- Fön (Blow Dry) - 30 min - 150 TRY

Nails:
- Manikür (Manicure) - 45 min - 200 TRY
- Pedikür (Pedicure) - 60 min - 250 TRY
- Kalıcı Oje (Gel Polish) - 60 min - 300 TRY
- Protez Tırnak (Acrylic Nails) - 90 min - 500 TRY

Skin:
- Cilt Bakımı (Facial) - 60 min - 400 TRY
- Cilt Temizliği (Deep Cleansing) - 45 min - 300 TRY
- Anti-Aging Bakım - 75 min - 600 TRY

Makeup:
- Günlük Makyaj (Day Makeup) - 45 min - 300 TRY
- Gelin Makyajı (Bridal Makeup) - 90 min - 1500 TRY
- Özel Gün Makyajı (Special Occasion) - 60 min - 500 TRY

Other:
- Kaş Şekillendirme (Eyebrow Shaping) - 15 min - 100 TRY
- Kirpik Lifting - 60 min - 400 TRY
- İpek Kirpik - 90 min - 800 TRY
*/

-- ==========================================
-- RLS Policies
-- ==========================================

ALTER TABLE beauty_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE beauty_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_members ENABLE ROW LEVEL SECURITY;

-- Beauty Services: Tenant users can see their services
CREATE POLICY "Users can view their tenant services" ON beauty_services
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE auth_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM users WHERE auth_user_id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "Tenant admins can manage services" ON beauty_services
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE auth_user_id = auth.uid() AND role IN ('tenant_admin', 'super_admin'))
  );

-- Beauty Appointments: Tenant users can see their appointments
CREATE POLICY "Users can view their tenant appointments" ON beauty_appointments
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE auth_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM users WHERE auth_user_id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "Tenant users can manage appointments" ON beauty_appointments
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE auth_user_id = auth.uid())
  );

-- Staff Members: Tenant admins can manage staff
CREATE POLICY "Users can view their tenant staff" ON staff_members
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE auth_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM users WHERE auth_user_id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "Tenant admins can manage staff" ON staff_members
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE auth_user_id = auth.uid() AND role IN ('tenant_admin', 'super_admin'))
  );

-- ==========================================
-- TRIGGERS
-- ==========================================

CREATE TRIGGER update_beauty_services_updated_at
  BEFORE UPDATE ON beauty_services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_beauty_appointments_updated_at
  BEFORE UPDATE ON beauty_appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_staff_members_updated_at
  BEFORE UPDATE ON staff_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- HELPER FUNCTION: Create Default Services for New Beauty Tenant
-- ==========================================

CREATE OR REPLACE FUNCTION create_default_beauty_services(p_tenant_id UUID)
RETURNS void AS $$
BEGIN
  -- Hair services
  INSERT INTO beauty_services (tenant_id, name, name_en, name_de, category, duration_minutes, price, display_order) VALUES
  (p_tenant_id, 'Kadın Saç Kesimi', 'Women''s Haircut', 'Damen Haarschnitt', 'hair', 45, 250, 1),
  (p_tenant_id, 'Erkek Saç Kesimi', 'Men''s Haircut', 'Herren Haarschnitt', 'hair', 30, 100, 2),
  (p_tenant_id, 'Saç Boyama', 'Hair Coloring', 'Haarfärbung', 'hair', 90, 500, 3),
  (p_tenant_id, 'Röfle', 'Highlights', 'Strähnchen', 'hair', 120, 600, 4),
  (p_tenant_id, 'Saç Bakımı', 'Hair Treatment', 'Haarbehandlung', 'hair', 60, 400, 5),
  (p_tenant_id, 'Fön', 'Blow Dry', 'Föhnen', 'hair', 30, 150, 6);

  -- Nail services
  INSERT INTO beauty_services (tenant_id, name, name_en, name_de, category, duration_minutes, price, display_order) VALUES
  (p_tenant_id, 'Manikür', 'Manicure', 'Maniküre', 'nails', 45, 200, 10),
  (p_tenant_id, 'Pedikür', 'Pedicure', 'Pediküre', 'nails', 60, 250, 11),
  (p_tenant_id, 'Kalıcı Oje', 'Gel Polish', 'Gel-Lack', 'nails', 60, 300, 12);

  -- Skin services
  INSERT INTO beauty_services (tenant_id, name, name_en, name_de, category, duration_minutes, price, display_order) VALUES
  (p_tenant_id, 'Cilt Bakımı', 'Facial', 'Gesichtsbehandlung', 'skin', 60, 400, 20),
  (p_tenant_id, 'Cilt Temizliği', 'Deep Cleansing', 'Tiefenreinigung', 'skin', 45, 300, 21);

  -- Makeup services
  INSERT INTO beauty_services (tenant_id, name, name_en, name_de, category, duration_minutes, price, display_order) VALUES
  (p_tenant_id, 'Günlük Makyaj', 'Day Makeup', 'Tages-Make-up', 'makeup', 45, 300, 30),
  (p_tenant_id, 'Gelin Makyajı', 'Bridal Makeup', 'Braut-Make-up', 'makeup', 90, 1500, 31);

  -- Other services
  INSERT INTO beauty_services (tenant_id, name, name_en, name_de, category, duration_minutes, price, display_order) VALUES
  (p_tenant_id, 'Kaş Şekillendirme', 'Eyebrow Shaping', 'Augenbrauen-Styling', 'other', 15, 100, 40),
  (p_tenant_id, 'Kirpik Lifting', 'Lash Lift', 'Wimpernlifting', 'other', 60, 400, 41);
END;
$$ LANGUAGE plpgsql;


-- ==========================================
-- 003_add_tenant_id.sql
-- ==========================================

-- Migration 003: Mevcut tablolara tenant_id ekle
-- customers, vehicles, test_drive_appointments, service_appointments, call_logs, available_slots

-- ==========================================
-- CUSTOMERS TABLOSUNA TENANT_ID EKLE
-- ==========================================

-- Sütun ekle
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- Index ekle
CREATE INDEX IF NOT EXISTS idx_customers_tenant_id ON customers(tenant_id);

-- Phone unique constraint'i tenant-scoped yap
-- Önce mevcut constraint'i kaldır
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_phone_key;

-- Yeni composite unique constraint ekle (phone + tenant_id)
ALTER TABLE customers
  ADD CONSTRAINT customers_phone_tenant_unique UNIQUE (phone, tenant_id);

-- ==========================================
-- VEHICLES TABLOSUNA TENANT_ID EKLE
-- ==========================================

-- Sütun ekle
ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- Index ekle
CREATE INDEX IF NOT EXISTS idx_vehicles_tenant_id ON vehicles(tenant_id);

-- ==========================================
-- TEST_DRIVE_APPOINTMENTS TABLOSUNA TENANT_ID EKLE
-- ==========================================

-- Sütun ekle
ALTER TABLE test_drive_appointments
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- Index ekle
CREATE INDEX IF NOT EXISTS idx_test_drive_appointments_tenant_id ON test_drive_appointments(tenant_id);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_test_drive_tenant_date
  ON test_drive_appointments(tenant_id, appointment_date);

-- ==========================================
-- SERVICE_APPOINTMENTS TABLOSUNA TENANT_ID EKLE
-- ==========================================

-- Sütun ekle
ALTER TABLE service_appointments
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- Index ekle
CREATE INDEX IF NOT EXISTS idx_service_appointments_tenant_id ON service_appointments(tenant_id);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_service_tenant_date
  ON service_appointments(tenant_id, appointment_date);

-- ==========================================
-- CALL_LOGS TABLOSUNA TENANT_ID EKLE
-- ==========================================

-- Sütun ekle
ALTER TABLE call_logs
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- Index ekle
CREATE INDEX IF NOT EXISTS idx_call_logs_tenant_id ON call_logs(tenant_id);

-- Composite index for date-based queries
CREATE INDEX IF NOT EXISTS idx_call_logs_tenant_date
  ON call_logs(tenant_id, created_at DESC);

-- ==========================================
-- AVAILABLE_SLOTS TABLOSUNA TENANT_ID EKLE
-- ==========================================

-- Sütun ekle
ALTER TABLE available_slots
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- Index ekle
CREATE INDEX IF NOT EXISTS idx_available_slots_tenant_id ON available_slots(tenant_id);

-- Composite index for slot queries
CREATE INDEX IF NOT EXISTS idx_slots_tenant_date_type
  ON available_slots(tenant_id, slot_date, slot_type, is_available);

-- ==========================================
-- RLS Policies for Existing Tables
-- ==========================================

-- Enable RLS
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_drive_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE available_slots ENABLE ROW LEVEL SECURITY;

-- Customers
CREATE POLICY "Users can view their tenant customers" ON customers
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE auth_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM users WHERE auth_user_id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "Tenant users can manage customers" ON customers
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE auth_user_id = auth.uid())
  );

-- Vehicles
CREATE POLICY "Users can view their tenant vehicles" ON vehicles
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE auth_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM users WHERE auth_user_id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "Tenant admins can manage vehicles" ON vehicles
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE auth_user_id = auth.uid() AND role IN ('tenant_admin', 'super_admin'))
  );

-- Test Drive Appointments
CREATE POLICY "Users can view their tenant test drives" ON test_drive_appointments
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE auth_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM users WHERE auth_user_id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "Tenant users can manage test drives" ON test_drive_appointments
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE auth_user_id = auth.uid())
  );

-- Service Appointments
CREATE POLICY "Users can view their tenant services" ON service_appointments
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE auth_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM users WHERE auth_user_id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "Tenant users can manage services" ON service_appointments
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE auth_user_id = auth.uid())
  );

-- Call Logs
CREATE POLICY "Users can view their tenant call logs" ON call_logs
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE auth_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM users WHERE auth_user_id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "Tenant users can create call logs" ON call_logs
  FOR INSERT WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM users WHERE auth_user_id = auth.uid())
  );

-- Available Slots
CREATE POLICY "Users can view their tenant slots" ON available_slots
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE auth_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM users WHERE auth_user_id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "Tenant users can manage slots" ON available_slots
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE auth_user_id = auth.uid())
  );

-- ==========================================
-- HELPER FUNCTION: Generate Slots for Tenant
-- ==========================================

CREATE OR REPLACE FUNCTION generate_tenant_slots(
  p_tenant_id UUID,
  p_days_ahead INTEGER DEFAULT 30,
  p_slot_types TEXT[] DEFAULT ARRAY['test_drive', 'service', 'beauty']
)
RETURNS void AS $$
DECLARE
  d DATE;
  t TIME;
  slot_type TEXT;
BEGIN
  -- Generate slots for the next N days
  FOR d IN SELECT generate_series(CURRENT_DATE, CURRENT_DATE + p_days_ahead, '1 day'::interval)::date LOOP
    -- 09:00 - 18:00 arası her saat için
    FOR t IN SELECT generate_series('09:00'::time, '18:00'::time, '1 hour'::interval)::time LOOP
      FOREACH slot_type IN ARRAY p_slot_types LOOP
        INSERT INTO available_slots (tenant_id, slot_date, slot_time, slot_type, is_available)
        VALUES (p_tenant_id, d, t, slot_type, true)
        ON CONFLICT DO NOTHING;
      END LOOP;
    END LOOP;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- SAMPLE TENANT FOR TESTING
-- ==========================================

-- Test tenant oluştur (development ortamı için)
DO $$
DECLARE
  v_tenant_id UUID;
BEGIN
  -- Prestige Auto (Otomotiv) tenant'ı oluştur
  INSERT INTO tenants (
    name, slug, industry, region, default_language, supported_languages,
    assistant_name, phone, plan, primary_color
  ) VALUES (
    'Prestige Auto', 'prestige-auto', 'automotive', 'tr', 'tr', ARRAY['tr', 'en'],
    'Ayşe', '+905551234567', 'professional', '#1a365d'
  )
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO v_tenant_id;

  -- Eğer tenant oluşturulduysa, slotları ve araçları ekle
  IF v_tenant_id IS NOT NULL THEN
    -- Slotları oluştur
    PERFORM generate_tenant_slots(v_tenant_id, 14, ARRAY['test_drive', 'service']);

    -- Mevcut araçları bu tenant'a bağla
    UPDATE vehicles SET tenant_id = v_tenant_id WHERE tenant_id IS NULL;

    -- Mevcut müşterileri bu tenant'a bağla
    UPDATE customers SET tenant_id = v_tenant_id WHERE tenant_id IS NULL;

    -- Mevcut randevuları bu tenant'a bağla
    UPDATE test_drive_appointments SET tenant_id = v_tenant_id WHERE tenant_id IS NULL;
    UPDATE service_appointments SET tenant_id = v_tenant_id WHERE tenant_id IS NULL;

    -- Mevcut arama kayıtlarını bu tenant'a bağla
    UPDATE call_logs SET tenant_id = v_tenant_id WHERE tenant_id IS NULL;

    RAISE NOTICE 'Prestige Auto tenant created with ID: %', v_tenant_id;
  END IF;

  -- Güzel Saçlar (Güzellik) tenant'ı oluştur
  INSERT INTO tenants (
    name, slug, industry, region, default_language, supported_languages,
    assistant_name, phone, plan, primary_color
  ) VALUES (
    'Güzel Saçlar Kuaför', 'guzel-saclar', 'beauty', 'tr', 'tr', ARRAY['tr'],
    'Elif', '+905559876543', 'starter', '#9f7aea'
  )
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO v_tenant_id;

  -- Eğer tenant oluşturulduysa, hizmetleri ve slotları ekle
  IF v_tenant_id IS NOT NULL THEN
    -- Default güzellik hizmetlerini oluştur
    PERFORM create_default_beauty_services(v_tenant_id);

    -- Slotları oluştur
    PERFORM generate_tenant_slots(v_tenant_id, 14, ARRAY['beauty']);

    RAISE NOTICE 'Güzel Saçlar tenant created with ID: %', v_tenant_id;
  END IF;
END $$;

-- ==========================================
-- VIEWS for Dashboard Statistics
-- ==========================================

-- Tenant Dashboard Stats View
CREATE OR REPLACE VIEW tenant_dashboard_stats AS
SELECT
  t.id as tenant_id,
  t.name as tenant_name,
  t.industry,

  -- Appointment counts
  (SELECT COUNT(*) FROM test_drive_appointments tda WHERE tda.tenant_id = t.id AND tda.status = 'pending') as pending_test_drives,
  (SELECT COUNT(*) FROM service_appointments sa WHERE sa.tenant_id = t.id AND sa.status = 'pending') as pending_services,
  (SELECT COUNT(*) FROM beauty_appointments ba WHERE ba.tenant_id = t.id AND ba.status = 'pending') as pending_beauty,

  -- Today's appointments
  (SELECT COUNT(*) FROM test_drive_appointments tda WHERE tda.tenant_id = t.id AND tda.appointment_date = CURRENT_DATE) as today_test_drives,
  (SELECT COUNT(*) FROM service_appointments sa WHERE sa.tenant_id = t.id AND sa.appointment_date = CURRENT_DATE) as today_services,
  (SELECT COUNT(*) FROM beauty_appointments ba WHERE ba.tenant_id = t.id AND ba.appointment_date = CURRENT_DATE) as today_beauty,

  -- Customer count
  (SELECT COUNT(*) FROM customers c WHERE c.tenant_id = t.id) as total_customers,

  -- This month's calls
  (SELECT COUNT(*) FROM call_logs cl WHERE cl.tenant_id = t.id AND DATE_TRUNC('month', cl.created_at) = DATE_TRUNC('month', CURRENT_DATE)) as calls_this_month

FROM tenants t
WHERE t.is_active = true;


-- ==========================================
-- 013_use_cases.sql
-- ==========================================
-- Migration 013: Use Case Based Tool System
-- Modüler use case bazlı tool sistemi için tablolar

-- =====================================================
-- USE CASES TABLE
-- Her bir use case'in tanımı, tool'ları ve prompt bölümü
-- =====================================================
CREATE TABLE IF NOT EXISTS use_cases (
  id VARCHAR(50) PRIMARY KEY,
  name_tr VARCHAR(100) NOT NULL,
  name_en VARCHAR(100),
  description_tr TEXT,
  description_en TEXT,
  category VARCHAR(50) NOT NULL CHECK (category IN ('core', 'automotive', 'beauty', 'addon')),
  tools JSONB NOT NULL DEFAULT '[]',  -- Tool isimleri array ["get_business_info", "get_working_hours"]
  prompt_section_tr TEXT,  -- Bu use case için Türkçe prompt bölümü
  prompt_section_en TEXT,  -- Bu use case için İngilizce prompt bölümü
  is_default BOOLEAN DEFAULT false,  -- Otomatik seçili mi
  display_order INT DEFAULT 0,  -- Sıralama
  icon VARCHAR(50),  -- Lucide icon adı
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- TENANT USE CASES TABLE
-- Tenant ile use case ilişkisi (many-to-many)
-- =====================================================
CREATE TABLE IF NOT EXISTS tenant_use_cases (
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  use_case_id VARCHAR(50) REFERENCES use_cases(id) ON DELETE CASCADE,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (tenant_id, use_case_id)
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_tenant_use_cases_tenant ON tenant_use_cases(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_use_cases_use_case ON tenant_use_cases(use_case_id);
CREATE INDEX IF NOT EXISTS idx_use_cases_category ON use_cases(category);

-- =====================================================
-- SEED DATA: CORE USE CASES (Herkes için)
-- =====================================================
INSERT INTO use_cases (id, name_tr, name_en, description_tr, description_en, category, tools, prompt_section_tr, prompt_section_en, is_default, display_order, icon) VALUES
(
  'business_info',
  'İşletme Bilgileri',
  'Business Information',
  'İşletme hakkında temel bilgiler (adres, telefon, email)',
  'Basic business information (address, phone, email)',
  'core',
  '["get_business_info", "get_working_hours"]',
  '## İşletme Bilgileri
- Müşteri işletme bilgisi sorduğunda doğru bilgileri paylaş
- Çalışma saatlerini net şekilde belirt
- Adres tarifi yaparken açık ve anlaşılır ol',
  '## Business Information
- Share accurate information when customer asks about business
- Clearly state working hours
- Give clear directions when describing address',
  true,
  1,
  'Building2'
),
(
  'appointments_core',
  'Temel Randevu Yönetimi',
  'Core Appointment Management',
  'Randevu listeleme, iptal ve değiştirme',
  'List, cancel and reschedule appointments',
  'core',
  '["get_available_time_slots", "get_my_appointments", "cancel_appointment", "reschedule_appointment"]',
  '## Randevu Yönetimi
1. Müşterinin mevcut randevularını sorgula
2. İptal veya değişiklik için onay al
3. Yeni tarih/saat seçerken müsaitlik kontrol et',
  '## Appointment Management
1. Query customer''s existing appointments
2. Get confirmation for cancellation or changes
3. Check availability when selecting new date/time',
  true,
  2,
  'Calendar'
)
ON CONFLICT (id) DO UPDATE SET
  name_tr = EXCLUDED.name_tr,
  name_en = EXCLUDED.name_en,
  description_tr = EXCLUDED.description_tr,
  description_en = EXCLUDED.description_en,
  tools = EXCLUDED.tools,
  prompt_section_tr = EXCLUDED.prompt_section_tr,
  prompt_section_en = EXCLUDED.prompt_section_en,
  is_default = EXCLUDED.is_default,
  display_order = EXCLUDED.display_order,
  icon = EXCLUDED.icon,
  updated_at = NOW();

-- =====================================================
-- SEED DATA: AUTOMOTIVE USE CASES
-- =====================================================
INSERT INTO use_cases (id, name_tr, name_en, description_tr, description_en, category, tools, prompt_section_tr, prompt_section_en, is_default, display_order, icon) VALUES
(
  'test_drive',
  'Test Sürüşü Randevusu',
  'Test Drive Appointment',
  'Araç test sürüşü randevusu oluşturma',
  'Create vehicle test drive appointments',
  'automotive',
  '["get_available_vehicles", "create_test_drive_appointment"]',
  '## Test Sürüşü Randevusu
1. Müşterinin ilgilendiği aracı sor (marka/model/bütçe)
2. Müsait araçları listele
3. Uygun tarih ve saat belirle
4. Randevu detaylarını özetle ve onayla',
  '## Test Drive Appointment
1. Ask which vehicle customer is interested in (brand/model/budget)
2. List available vehicles
3. Determine suitable date and time
4. Summarize and confirm appointment details',
  true,
  10,
  'Car'
),
(
  'service_appointment',
  'Servis Randevusu',
  'Service Appointment',
  'Araç servis randevusu oluşturma',
  'Create vehicle service appointments',
  'automotive',
  '["create_service_appointment", "get_service_price"]',
  '## Servis Randevusu
1. Araç bilgilerini al (plaka, marka, model)
2. Servis türünü belirle (bakım, yağ değişimi, lastik, tamir)
3. Uygun tarih ve saat seç
4. Varsa yaklaşık fiyat bilgisi ver',
  '## Service Appointment
1. Get vehicle information (plate, brand, model)
2. Determine service type (maintenance, oil change, tire, repair)
3. Select suitable date and time
4. Provide approximate price if available',
  true,
  11,
  'Wrench'
)
ON CONFLICT (id) DO UPDATE SET
  name_tr = EXCLUDED.name_tr,
  name_en = EXCLUDED.name_en,
  description_tr = EXCLUDED.description_tr,
  description_en = EXCLUDED.description_en,
  tools = EXCLUDED.tools,
  prompt_section_tr = EXCLUDED.prompt_section_tr,
  prompt_section_en = EXCLUDED.prompt_section_en,
  is_default = EXCLUDED.is_default,
  display_order = EXCLUDED.display_order,
  icon = EXCLUDED.icon,
  updated_at = NOW();

-- =====================================================
-- SEED DATA: BEAUTY USE CASES
-- =====================================================
INSERT INTO use_cases (id, name_tr, name_en, description_tr, description_en, category, tools, prompt_section_tr, prompt_section_en, is_default, display_order, icon) VALUES
(
  'beauty_services',
  'Güzellik Hizmetleri',
  'Beauty Services',
  'Güzellik salonu hizmetleri ve randevu',
  'Beauty salon services and appointments',
  'beauty',
  '["get_beauty_services", "create_beauty_appointment"]',
  '## Güzellik Randevusu
1. İstenen hizmeti öğren (saç, tırnak, cilt, makyaj)
2. Hizmet detaylarını ve süresini belirt
3. Müsait saatleri sun
4. Randevu detaylarını onayla',
  '## Beauty Appointment
1. Learn the requested service (hair, nails, skin, makeup)
2. Specify service details and duration
3. Present available times
4. Confirm appointment details',
  true,
  20,
  'Scissors'
),
(
  'staff_selection',
  'Personel Seçimi',
  'Staff Selection',
  'Müşterinin tercih ettiği personelle randevu',
  'Appointment with customer''s preferred staff',
  'beauty',
  '["get_available_staff", "book_with_staff"]',
  '## Personel Seçimi
1. Müşterinin personel tercihi olup olmadığını sor
2. Müsait personelleri listele
3. Seçilen personelin müsait saatlerini sun
4. Personel adıyla birlikte randevu oluştur',
  '## Staff Selection
1. Ask if customer has staff preference
2. List available staff
3. Present available times for selected staff
4. Create appointment with staff name',
  false,
  21,
  'Users'
)
ON CONFLICT (id) DO UPDATE SET
  name_tr = EXCLUDED.name_tr,
  name_en = EXCLUDED.name_en,
  description_tr = EXCLUDED.description_tr,
  description_en = EXCLUDED.description_en,
  tools = EXCLUDED.tools,
  prompt_section_tr = EXCLUDED.prompt_section_tr,
  prompt_section_en = EXCLUDED.prompt_section_en,
  is_default = EXCLUDED.is_default,
  display_order = EXCLUDED.display_order,
  icon = EXCLUDED.icon,
  updated_at = NOW();

-- =====================================================
-- SEED DATA: ADDON USE CASES (Tüm industry'ler için)
-- =====================================================
INSERT INTO use_cases (id, name_tr, name_en, description_tr, description_en, category, tools, prompt_section_tr, prompt_section_en, is_default, display_order, icon) VALUES
(
  'promotions',
  'Kampanyalar',
  'Promotions',
  'Aktif kampanyalar ve promosyon kodları',
  'Active campaigns and promo codes',
  'addon',
  '["get_active_promotions", "apply_promo_code"]',
  '## Kampanyalar
- Aktif kampanyaları müşteriye bildir
- Promosyon kodu sorulduğunda geçerliliği kontrol et
- İndirim detaylarını açıkça belirt',
  '## Promotions
- Inform customer about active campaigns
- Check validity when promo code is asked
- Clearly state discount details',
  false,
  30,
  'Tag'
),
(
  'loyalty',
  'Sadakat Programı',
  'Loyalty Program',
  'Müşteri sadakat puanı ve üyelik seviyesi',
  'Customer loyalty points and membership level',
  'addon',
  '["get_loyalty_points"]',
  '## Sadakat Programı
- Müşterinin puan bakiyesini sorgula
- Üyelik seviyesini ve avantajlarını açıkla
- Puan kazanma yollarını anlat',
  '## Loyalty Program
- Query customer''s point balance
- Explain membership level and benefits
- Describe ways to earn points',
  false,
  31,
  'Award'
),
(
  'feedback',
  'Geri Bildirim',
  'Feedback',
  'Şikayet, öneri ve müşteri memnuniyeti',
  'Complaints, suggestions and customer satisfaction',
  'addon',
  '["submit_complaint"]',
  '## Geri Bildirim
- Müşteri şikayetlerini dikkatle dinle
- Empati göster ve özür dile
- Geri bildirimi kaydet ve takip edileceğini belirt',
  '## Feedback
- Listen carefully to customer complaints
- Show empathy and apologize
- Record feedback and mention it will be followed up',
  false,
  32,
  'MessageSquare'
),
(
  'customer_history',
  'Müşteri Geçmişi',
  'Customer History',
  'Müşterinin geçmiş randevuları ve hizmetleri',
  'Customer''s past appointments and services',
  'addon',
  '["get_customer_history"]',
  '## Müşteri Geçmişi
- Müşterinin önceki randevularını listele
- Geçmiş hizmetleri hatırlat
- Kişiselleştirilmiş öneriler sun',
  '## Customer History
- List customer''s previous appointments
- Remind past services
- Offer personalized suggestions',
  false,
  33,
  'History'
),
(
  'pricing',
  'Fiyat Sorgulama',
  'Pricing',
  'Hizmet ve ürün fiyat bilgisi',
  'Service and product pricing information',
  'addon',
  '["get_service_price"]',
  '## Fiyat Bilgisi
- Fiyatları net şekilde belirt
- Varsa fiyat aralığı ver
- Ek maliyetleri açıkla',
  '## Pricing Information
- Clearly state prices
- Give price range if applicable
- Explain additional costs',
  true,
  34,
  'DollarSign'
)
ON CONFLICT (id) DO UPDATE SET
  name_tr = EXCLUDED.name_tr,
  name_en = EXCLUDED.name_en,
  description_tr = EXCLUDED.description_tr,
  description_en = EXCLUDED.description_en,
  tools = EXCLUDED.tools,
  prompt_section_tr = EXCLUDED.prompt_section_tr,
  prompt_section_en = EXCLUDED.prompt_section_en,
  is_default = EXCLUDED.is_default,
  display_order = EXCLUDED.display_order,
  icon = EXCLUDED.icon,
  updated_at = NOW();

-- =====================================================
-- FUNCTION: Get default use cases for an industry
-- =====================================================
CREATE OR REPLACE FUNCTION get_default_use_cases_for_industry(p_industry VARCHAR)
RETURNS TABLE(use_case_id VARCHAR(50)) AS $$
BEGIN
  RETURN QUERY
  SELECT id FROM use_cases
  WHERE is_default = true
  AND (
    category = 'core'
    OR category = p_industry
    OR (category = 'addon' AND is_default = true)
  )
  ORDER BY display_order;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCTION: Setup default use cases for a new tenant
-- =====================================================
CREATE OR REPLACE FUNCTION setup_tenant_default_use_cases(p_tenant_id UUID, p_industry VARCHAR)
RETURNS void AS $$
BEGIN
  INSERT INTO tenant_use_cases (tenant_id, use_case_id, enabled)
  SELECT p_tenant_id, uc.id, true
  FROM use_cases uc
  WHERE uc.is_default = true
  AND (
    uc.category = 'core'
    OR uc.category = p_industry
    OR (uc.category = 'addon' AND uc.is_default = true)
  )
  ON CONFLICT (tenant_id, use_case_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGER: Auto-setup use cases when tenant is created
-- =====================================================
CREATE OR REPLACE FUNCTION trigger_setup_tenant_use_cases()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM setup_tenant_default_use_cases(NEW.id, NEW.industry);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS on_tenant_created_setup_use_cases ON tenants;
CREATE TRIGGER on_tenant_created_setup_use_cases
AFTER INSERT ON tenants
FOR EACH ROW
EXECUTE FUNCTION trigger_setup_tenant_use_cases();

-- =====================================================
-- Add comments for documentation
-- =====================================================
COMMENT ON TABLE use_cases IS 'Modüler use case tanımları - her use case kendi tool setine ve prompt bölümüne sahip';
COMMENT ON TABLE tenant_use_cases IS 'Tenant-UseCase many-to-many ilişkisi - tenant''ın aktif use case''leri';
COMMENT ON COLUMN use_cases.tools IS 'Bu use case''e ait tool isimleri JSON array olarak';
COMMENT ON COLUMN use_cases.prompt_section_tr IS 'Bu use case için sistem prompt''a eklenecek Türkçe bölüm';
COMMENT ON COLUMN use_cases.category IS 'core: herkes için, automotive/beauty: industry-specific, addon: opsiyonel eklentiler';
