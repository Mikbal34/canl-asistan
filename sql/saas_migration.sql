-- ==========================================
-- SaaS Migration - Tek Seferde Çalıştır
-- Mevcut tablolar korunarak yeni tablolar eklenir
-- ==========================================

-- 1. TENANTS (Firmalar)
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  industry VARCHAR(50) NOT NULL, -- 'automotive', 'beauty'
  logo_url TEXT,
  primary_color VARCHAR(7) DEFAULT '#c9a227',
  custom_domain VARCHAR(255),
  region VARCHAR(10) DEFAULT 'tr',
  white_label BOOLEAN DEFAULT false,
  elevenlabs_voice_id VARCHAR(100),
  tts_provider VARCHAR(20) DEFAULT 'deepgram',
  default_language VARCHAR(5) DEFAULT 'tr',
  supported_languages TEXT[] DEFAULT ARRAY['tr'],
  phone VARCHAR(20),
  twilio_phone_number VARCHAR(20),
  address TEXT,
  email VARCHAR(255),
  website VARCHAR(255),
  assistant_name VARCHAR(100) DEFAULT 'Asistan',
  welcome_message TEXT,
  plan VARCHAR(20) DEFAULT 'starter',
  max_calls_per_month INTEGER DEFAULT 100,
  max_appointments_per_month INTEGER DEFAULT 50,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. USERS (Kullanıcılar)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  role VARCHAR(50) NOT NULL, -- 'super_admin', 'tenant_admin', 'agent'
  preferred_language VARCHAR(5) DEFAULT 'tr',
  avatar_url TEXT,
  auth_user_id UUID UNIQUE,
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. PROMPT TEMPLATES
CREATE TABLE IF NOT EXISTS prompt_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  language VARCHAR(5) NOT NULL,
  system_prompt TEXT NOT NULL,
  welcome_message TEXT,
  assistant_name VARCHAR(100) DEFAULT 'Asistan',
  variables JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. INDUSTRY PRESETS
CREATE TABLE IF NOT EXISTS industry_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  industry VARCHAR(50) UNIQUE NOT NULL,
  name_tr VARCHAR(255),
  name_en VARCHAR(255),
  name_de VARCHAR(255),
  default_prompt_tr TEXT,
  default_prompt_en TEXT,
  default_prompt_de TEXT,
  default_welcome_tr TEXT,
  default_welcome_en TEXT,
  default_welcome_de TEXT,
  default_assistant_name_tr VARCHAR(100) DEFAULT 'Asistan',
  default_assistant_name_en VARCHAR(100) DEFAULT 'Assistant',
  default_assistant_name_de VARCHAR(100) DEFAULT 'Assistent',
  default_functions JSONB DEFAULT '[]',
  icon VARCHAR(50),
  color VARCHAR(7) DEFAULT '#c9a227',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. BEAUTY SERVICES
CREATE TABLE IF NOT EXISTS beauty_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  name_en VARCHAR(255),
  name_de VARCHAR(255),
  description TEXT,
  category VARCHAR(50) NOT NULL, -- 'hair', 'nails', 'skin', 'makeup', 'other'
  duration_minutes INTEGER DEFAULT 30,
  price DECIMAL(10,2),
  currency VARCHAR(3) DEFAULT 'TRY',
  display_order INTEGER DEFAULT 0,
  icon VARCHAR(50),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. BEAUTY APPOINTMENTS
CREATE TABLE IF NOT EXISTS beauty_appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  service_id UUID REFERENCES beauty_services(id) ON DELETE SET NULL,
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  duration_minutes INTEGER,
  status VARCHAR(20) DEFAULT 'pending',
  staff_name VARCHAR(100),
  notes TEXT,
  cancellation_reason TEXT,
  price_at_booking DECIMAL(10,2),
  currency VARCHAR(3) DEFAULT 'TRY',
  reminder_sent BOOLEAN DEFAULT false,
  reminder_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. STAFF MEMBERS
CREATE TABLE IF NOT EXISTS staff_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(255),
  specializations TEXT[],
  working_hours JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- MEVCUT TABLOLARA TENANT_ID EKLE
-- ==========================================

-- Customers
ALTER TABLE customers ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- Vehicles
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- Test Drive Appointments
ALTER TABLE test_drive_appointments ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- Service Appointments
ALTER TABLE service_appointments ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- Call Logs
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- Available Slots
ALTER TABLE available_slots ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- ==========================================
-- INDEXLER
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_industry ON tenants(industry);
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_beauty_services_tenant_id ON beauty_services(tenant_id);
CREATE INDEX IF NOT EXISTS idx_beauty_appointments_tenant_id ON beauty_appointments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customers_tenant_id ON customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_tenant_id ON vehicles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_test_drive_appointments_tenant_id ON test_drive_appointments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_service_appointments_tenant_id ON service_appointments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_tenant_id ON call_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_available_slots_tenant_id ON available_slots(tenant_id);

-- ==========================================
-- VARSAYILAN SEKTÖR PRESETLERI
-- ==========================================

-- Otomotiv
INSERT INTO industry_presets (industry, name_tr, name_en, default_prompt_tr, default_functions, icon, color)
VALUES (
  'automotive',
  'Otomotiv',
  'Automotive',
  'Sen {COMPANY_NAME} otomotiv firmasının sesli asistanısın. Adın {ASSISTANT_NAME}. Test sürüşü ve servis randevusu alabilirsin.',
  '["get_available_vehicles", "create_test_drive_appointment", "create_service_appointment"]',
  '🚗',
  '#1a365d'
) ON CONFLICT (industry) DO NOTHING;

-- Güzellik
INSERT INTO industry_presets (industry, name_tr, name_en, default_prompt_tr, default_functions, icon, color)
VALUES (
  'beauty',
  'Güzellik & Kuaför',
  'Beauty & Hair Salon',
  'Sen {COMPANY_NAME} güzellik salonunun sesli asistanısın. Adın {ASSISTANT_NAME}. Saç, manikür, cilt bakımı randevusu alabilirsin.',
  '["get_beauty_services", "create_beauty_appointment", "get_available_time_slots"]',
  '💇',
  '#9f7aea'
) ON CONFLICT (industry) DO NOTHING;

-- ==========================================
-- TEST TENANT'LARI OLUŞTUR
-- ==========================================

-- Prestige Auto (mevcut veriler için)
INSERT INTO tenants (name, slug, industry, default_language, assistant_name, plan, primary_color)
VALUES ('Prestige Auto', 'prestige-auto', 'automotive', 'tr', 'Ayşe', 'professional', '#1a365d')
ON CONFLICT (slug) DO NOTHING;

-- Güzel Saçlar Kuaför (test için)
INSERT INTO tenants (name, slug, industry, default_language, assistant_name, plan, primary_color)
VALUES ('Güzel Saçlar Kuaför', 'guzel-saclar', 'beauty', 'tr', 'Elif', 'starter', '#9f7aea')
ON CONFLICT (slug) DO NOTHING;

-- ==========================================
-- MEVCUT VERİLERİ PRESTIGE AUTO'YA BAĞLA
-- ==========================================

UPDATE customers SET tenant_id = (SELECT id FROM tenants WHERE slug = 'prestige-auto') WHERE tenant_id IS NULL;
UPDATE vehicles SET tenant_id = (SELECT id FROM tenants WHERE slug = 'prestige-auto') WHERE tenant_id IS NULL;
UPDATE test_drive_appointments SET tenant_id = (SELECT id FROM tenants WHERE slug = 'prestige-auto') WHERE tenant_id IS NULL;
UPDATE service_appointments SET tenant_id = (SELECT id FROM tenants WHERE slug = 'prestige-auto') WHERE tenant_id IS NULL;
UPDATE call_logs SET tenant_id = (SELECT id FROM tenants WHERE slug = 'prestige-auto') WHERE tenant_id IS NULL;
UPDATE available_slots SET tenant_id = (SELECT id FROM tenants WHERE slug = 'prestige-auto') WHERE tenant_id IS NULL;

-- ==========================================
-- GÜZEL SAÇLAR İÇİN ÖRNEK HİZMETLER
-- ==========================================

INSERT INTO beauty_services (tenant_id, name, name_en, category, duration_minutes, price, display_order)
SELECT
  (SELECT id FROM tenants WHERE slug = 'guzel-saclar'),
  name, name_en, category, duration, price, ord
FROM (VALUES
  ('Kadın Saç Kesimi', 'Women''s Haircut', 'hair', 45, 250, 1),
  ('Erkek Saç Kesimi', 'Men''s Haircut', 'hair', 30, 100, 2),
  ('Saç Boyama', 'Hair Coloring', 'hair', 90, 500, 3),
  ('Manikür', 'Manicure', 'nails', 45, 200, 10),
  ('Pedikür', 'Pedicure', 'nails', 60, 250, 11),
  ('Cilt Bakımı', 'Facial', 'skin', 60, 400, 20)
) AS t(name, name_en, category, duration, price, ord)
WHERE EXISTS (SELECT 1 FROM tenants WHERE slug = 'guzel-saclar')
ON CONFLICT DO NOTHING;

-- ==========================================
-- BİTTİ!
-- ==========================================
SELECT 'Migration tamamlandı!' as status;
SELECT COUNT(*) as tenant_sayisi FROM tenants;
SELECT COUNT(*) as preset_sayisi FROM industry_presets;
