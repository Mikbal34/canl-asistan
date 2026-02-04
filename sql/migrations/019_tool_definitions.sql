-- Migration 019: Tool Definitions in Database
-- Store tool definitions in DB instead of hardcoded in functions.js
-- Enables admin panel management of tools

-- =====================================================
-- TOOL DEFINITIONS TABLE
-- Master list of all available tools
-- =====================================================
CREATE TABLE IF NOT EXISTS tool_definitions (
  id VARCHAR(50) PRIMARY KEY,                    -- "get_business_info"
  name VARCHAR(100) NOT NULL,                    -- Display name
  description TEXT NOT NULL,
  parameters JSONB NOT NULL DEFAULT '{"type": "object", "properties": {}}',
  category VARCHAR(50) NOT NULL,                 -- core, automotive, beauty, addon
  industry VARCHAR(50),                          -- NULL = applies to all, or specific industry
  is_active BOOLEAN DEFAULT true,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_tool_definitions_category ON tool_definitions(category);
CREATE INDEX IF NOT EXISTS idx_tool_definitions_industry ON tool_definitions(industry);
CREATE INDEX IF NOT EXISTS idx_tool_definitions_active ON tool_definitions(is_active);

-- =====================================================
-- SEED DATA: CORE TOOLS (applies to all industries)
-- =====================================================
INSERT INTO tool_definitions (id, name, description, parameters, category, industry, display_order) VALUES
(
  'get_business_info',
  'İşletme Bilgisi',
  'İşletme bilgilerini getirir (adres, telefon, email, çalışma saatleri)',
  '{"type": "object", "properties": {}, "required": []}',
  'core',
  NULL,
  1
),
(
  'get_working_hours',
  'Çalışma Saatleri',
  'Çalışma saatlerini getirir. Belirli bir gün veya tüm hafta için sorgulanabilir.',
  '{"type": "object", "properties": {"day": {"type": "string", "description": "Gün (bugün, yarın, pazartesi, salı, vb.)"}}, "required": []}',
  'core',
  NULL,
  2
),
(
  'get_my_appointments',
  'Randevularım',
  'Arayan müşterinin aktif (bekleyen veya onaylanmış) randevularını listeler.',
  '{"type": "object", "properties": {"customer_phone": {"type": "string", "description": "Müşterinin telefon numarası"}}, "required": []}',
  'core',
  NULL,
  3
),
(
  'cancel_appointment',
  'Randevu İptal',
  'Müşterinin mevcut bir randevusunu iptal eder',
  '{"type": "object", "properties": {"appointment_id": {"type": "string", "description": "İptal edilecek randevunun ID''si"}, "appointment_type": {"type": "string", "enum": ["test_drive", "service", "beauty"], "description": "Randevu türü"}}, "required": ["appointment_id", "appointment_type"]}',
  'core',
  NULL,
  4
),
(
  'reschedule_appointment',
  'Randevu Değiştir',
  'Müşterinin mevcut bir randevusunun tarih ve saatini değiştirir',
  '{"type": "object", "properties": {"appointment_id": {"type": "string", "description": "Değiştirilecek randevunun ID''si"}, "appointment_type": {"type": "string", "enum": ["test_drive", "service", "beauty"], "description": "Randevu türü"}, "new_date": {"type": "string", "description": "Yeni randevu tarihi (YYYY-MM-DD)"}, "new_time": {"type": "string", "description": "Yeni randevu saati (HH:MM)"}}, "required": ["appointment_id", "appointment_type", "new_date", "new_time"]}',
  'core',
  NULL,
  5
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  parameters = EXCLUDED.parameters,
  category = EXCLUDED.category,
  industry = EXCLUDED.industry,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- =====================================================
-- SEED DATA: ADDON TOOLS (can be added to any industry)
-- =====================================================
INSERT INTO tool_definitions (id, name, description, parameters, category, industry, display_order) VALUES
(
  'get_active_promotions',
  'Kampanyalar',
  'Aktif kampanyaları ve indirimleri listeler',
  '{"type": "object", "properties": {}, "required": []}',
  'addon',
  NULL,
  10
),
(
  'get_loyalty_points',
  'Sadakat Puanı',
  'Müşterinin sadakat puanını ve üyelik seviyesini sorgular',
  '{"type": "object", "properties": {"customer_phone": {"type": "string", "description": "Müşteri telefon numarası"}}, "required": []}',
  'addon',
  NULL,
  11
),
(
  'apply_promo_code',
  'Promosyon Kodu',
  'Promosyon/indirim kodu uygular ve geçerliliğini kontrol eder',
  '{"type": "object", "properties": {"code": {"type": "string", "description": "İndirim kodu"}}, "required": ["code"]}',
  'addon',
  NULL,
  12
),
(
  'submit_complaint',
  'Geri Bildirim',
  'Şikayet, öneri veya geri bildirim kaydeder',
  '{"type": "object", "properties": {"message": {"type": "string", "description": "Şikayet veya öneri mesajı"}, "rating": {"type": "number", "description": "1-5 arası memnuniyet puanı"}, "feedback_type": {"type": "string", "enum": ["complaint", "suggestion", "praise", "general"], "description": "Geri bildirim türü"}}, "required": ["message"]}',
  'addon',
  NULL,
  13
),
(
  'get_customer_history',
  'Müşteri Geçmişi',
  'Müşterinin geçmiş randevularını ve hizmet geçmişini getirir',
  '{"type": "object", "properties": {"customer_phone": {"type": "string", "description": "Müşteri telefon numarası"}, "limit": {"type": "number", "description": "Kaç kayıt getirileceği (varsayılan 5)"}}, "required": []}',
  'addon',
  NULL,
  14
),
(
  'get_service_price',
  'Fiyat Bilgisi',
  'Araç veya hizmet fiyatını getirir',
  '{"type": "object", "properties": {"vehicle_name": {"type": "string", "description": "Araç marka/model adı"}, "service_type": {"type": "string", "description": "Hizmet türü"}, "service_name": {"type": "string", "description": "Hizmet adı"}}, "required": []}',
  'addon',
  NULL,
  15
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  parameters = EXCLUDED.parameters,
  category = EXCLUDED.category,
  industry = EXCLUDED.industry,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- =====================================================
-- SEED DATA: AUTOMOTIVE TOOLS
-- =====================================================
INSERT INTO tool_definitions (id, name, description, parameters, category, industry, display_order) VALUES
(
  'get_available_vehicles',
  'Araç Listesi',
  'Test sürüşü için müsait araçları listeler. Marka veya model filtresi uygulanabilir.',
  '{"type": "object", "properties": {"brand": {"type": "string", "description": "Araç markası (örn: Toyota, Honda, BMW)"}, "model": {"type": "string", "description": "Araç modeli (örn: Corolla, Civic, 320i)"}, "max_price": {"type": "number", "description": "Maksimum fiyat limiti (TL)"}}, "required": []}',
  'automotive',
  'automotive',
  20
),
(
  'get_available_time_slots_automotive',
  'Müsait Saatler (Otomotiv)',
  'Belirli bir tarih için müsait randevu saatlerini getirir',
  '{"type": "object", "properties": {"date": {"type": "string", "description": "Tarih (YYYY-MM-DD formatında)"}, "slot_type": {"type": "string", "enum": ["test_drive", "service"], "description": "Randevu türü: test_drive veya service"}}, "required": ["date", "slot_type"]}',
  'automotive',
  'automotive',
  21
),
(
  'create_test_drive_appointment',
  'Test Sürüşü Randevusu',
  'Yeni bir test sürüşü randevusu oluşturur',
  '{"type": "object", "properties": {"customer_name": {"type": "string", "description": "Müşterinin adı"}, "customer_phone": {"type": "string", "description": "Müşterinin telefon numarası"}, "vehicle_id": {"type": "string", "description": "Seçilen aracın ID''si"}, "appointment_date": {"type": "string", "description": "Randevu tarihi (YYYY-MM-DD)"}, "appointment_time": {"type": "string", "description": "Randevu saati (HH:MM)"}, "notes": {"type": "string", "description": "Ek notlar"}}, "required": ["customer_name", "vehicle_id", "appointment_date", "appointment_time"]}',
  'automotive',
  'automotive',
  22
),
(
  'create_service_appointment',
  'Servis Randevusu',
  'Yeni bir servis randevusu oluşturur',
  '{"type": "object", "properties": {"customer_name": {"type": "string", "description": "Müşterinin adı"}, "customer_phone": {"type": "string", "description": "Müşterinin telefon numarası"}, "vehicle_plate": {"type": "string", "description": "Araç plakası"}, "vehicle_brand": {"type": "string", "description": "Araç markası"}, "vehicle_model": {"type": "string", "description": "Araç modeli"}, "service_type": {"type": "string", "enum": ["bakim", "yag_degisimi", "lastik", "tamir", "diger"], "description": "Servis türü"}, "appointment_date": {"type": "string", "description": "Randevu tarihi (YYYY-MM-DD)"}, "appointment_time": {"type": "string", "description": "Randevu saati (HH:MM)"}, "notes": {"type": "string", "description": "Ek notlar veya şikayetler"}}, "required": ["customer_name", "vehicle_plate", "service_type", "appointment_date", "appointment_time"]}',
  'automotive',
  'automotive',
  23
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  parameters = EXCLUDED.parameters,
  category = EXCLUDED.category,
  industry = EXCLUDED.industry,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- =====================================================
-- SEED DATA: BEAUTY TOOLS
-- =====================================================
INSERT INTO tool_definitions (id, name, description, parameters, category, industry, display_order) VALUES
(
  'get_beauty_services',
  'Güzellik Hizmetleri',
  'Salondaki mevcut güzellik hizmetlerini listeler. Kategori filtresi uygulanabilir.',
  '{"type": "object", "properties": {"category": {"type": "string", "enum": ["nails", "skin", "makeup", "spa", "hair", "other"], "description": "Hizmet kategorisi"}}, "required": []}',
  'beauty',
  'beauty',
  30
),
(
  'get_available_time_slots_beauty',
  'Müsait Saatler (Güzellik)',
  'Belirli bir tarih için müsait randevu saatlerini getirir',
  '{"type": "object", "properties": {"date": {"type": "string", "description": "Tarih (YYYY-MM-DD formatında)"}}, "required": ["date"]}',
  'beauty',
  'beauty',
  31
),
(
  'create_beauty_appointment',
  'Güzellik Randevusu',
  'Yeni bir güzellik randevusu oluşturur',
  '{"type": "object", "properties": {"customer_name": {"type": "string", "description": "Müşterinin adı"}, "customer_phone": {"type": "string", "description": "Müşterinin telefon numarası"}, "service_id": {"type": "string", "description": "Seçilen hizmetin ID''si"}, "service_name": {"type": "string", "description": "Seçilen hizmetin adı (service_id yoksa bununla eşleştir)"}, "appointment_date": {"type": "string", "description": "Randevu tarihi (YYYY-MM-DD)"}, "appointment_time": {"type": "string", "description": "Randevu saati (HH:MM)"}, "notes": {"type": "string", "description": "Ek notlar veya özel istekler"}}, "required": ["customer_name", "appointment_date", "appointment_time"]}',
  'beauty',
  'beauty',
  32
),
(
  'get_available_staff',
  'Müsait Personel',
  'Belirli bir tarih için müsait personeli listeler',
  '{"type": "object", "properties": {"date": {"type": "string", "description": "Tarih (YYYY-MM-DD formatında)"}, "service_category": {"type": "string", "enum": ["hair", "nails", "skin", "makeup", "other"], "description": "Hizmet kategorisi (opsiyonel)"}}, "required": ["date"]}',
  'beauty',
  'beauty',
  33
),
(
  'book_with_staff',
  'Personelle Randevu',
  'Belirli bir personelle randevu oluşturur',
  '{"type": "object", "properties": {"customer_name": {"type": "string", "description": "Müşterinin adı"}, "customer_phone": {"type": "string", "description": "Müşterinin telefon numarası"}, "staff_name": {"type": "string", "description": "Personel adı"}, "service_name": {"type": "string", "description": "Hizmet adı"}, "appointment_date": {"type": "string", "description": "Randevu tarihi (YYYY-MM-DD)"}, "appointment_time": {"type": "string", "description": "Randevu saati (HH:MM)"}, "notes": {"type": "string", "description": "Ek notlar"}}, "required": ["customer_name", "staff_name", "service_name", "appointment_date", "appointment_time"]}',
  'beauty',
  'beauty',
  34
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  parameters = EXCLUDED.parameters,
  category = EXCLUDED.category,
  industry = EXCLUDED.industry,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- =====================================================
-- TRIGGER: Update updated_at on tool_definitions
-- =====================================================
CREATE OR REPLACE FUNCTION update_tool_definitions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_tool_definitions_updated_at ON tool_definitions;
CREATE TRIGGER update_tool_definitions_updated_at
  BEFORE UPDATE ON tool_definitions
  FOR EACH ROW EXECUTE FUNCTION update_tool_definitions_updated_at();

-- =====================================================
-- FUNCTION: Get tools for specific use cases
-- =====================================================
CREATE OR REPLACE FUNCTION get_tools_for_use_cases(p_use_case_ids TEXT[])
RETURNS JSONB AS $$
DECLARE
  v_tool_names TEXT[];
  v_result JSONB;
BEGIN
  -- Get all tool names from use cases
  SELECT ARRAY(
    SELECT DISTINCT unnest(uc.tools)
    FROM use_cases uc
    WHERE uc.id = ANY(p_use_case_ids)
  ) INTO v_tool_names;

  -- Get tool definitions
  SELECT jsonb_agg(
    jsonb_build_object(
      'type', 'function',
      'function', jsonb_build_object(
        'name', td.id,
        'description', td.description,
        'parameters', td.parameters
      )
    )
  )
  INTO v_result
  FROM tool_definitions td
  WHERE td.id = ANY(v_tool_names)
    AND td.is_active = true;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- COMMENTS for documentation
-- =====================================================
COMMENT ON TABLE tool_definitions IS 'Master list of all available VAPI tools/functions';
COMMENT ON COLUMN tool_definitions.id IS 'Unique tool identifier (function name)';
COMMENT ON COLUMN tool_definitions.parameters IS 'OpenAI function schema in JSON format';
COMMENT ON COLUMN tool_definitions.category IS 'core = all industries, industry-specific, or addon';
COMMENT ON COLUMN tool_definitions.industry IS 'NULL = applies to all, or specific industry code';
