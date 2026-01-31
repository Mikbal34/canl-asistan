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
