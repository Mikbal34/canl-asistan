-- Migration 021: Schema Fixes
-- Kritik şema sorunlarını düzeltir:
-- 1. Double booking constraint eksikliği
-- 2. Orphan appointment riski (soft delete)
-- 3. Eksik index'ler
-- 4. selected_template_id redundancy temizliği

-- =====================================================
-- STEP 1: Double Booking Constraint
-- Aynı tenant'ta aynı tarih ve saate birden fazla randevu engellemesi
-- =====================================================

-- Not: staff_id olmadığı durumda basit bir constraint yeterli
-- staff_id eklenirse constraint güncellenmeli
ALTER TABLE beauty_appointments
ADD CONSTRAINT no_double_booking
UNIQUE (tenant_id, appointment_date, appointment_time);

-- Eğer staff bazlı double booking kontrolü istenirse:
-- CREATE UNIQUE INDEX idx_no_double_booking_staff
--   ON beauty_appointments(tenant_id, appointment_date, appointment_time, staff_name)
--   WHERE staff_name IS NOT NULL AND status NOT IN ('cancelled', 'no_show');

-- =====================================================
-- STEP 2: Soft Delete için deleted_at Kolonları
-- SET NULL yerine soft delete yaklaşımı
-- =====================================================

-- beauty_services için soft delete
ALTER TABLE beauty_services
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN beauty_services.deleted_at IS
  'Soft delete timestamp. NULL = active, NOT NULL = deleted. Randevular hizmet silinse bile korunur.';

-- customers için soft delete (zaten silinmiş müşteri verisi kaybedilmesin)
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN customers.deleted_at IS
  'Soft delete timestamp. NULL = active, NOT NULL = deleted. Randevular müşteri silinse bile korunur.';

-- staff_members için soft delete
ALTER TABLE staff_members
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN staff_members.deleted_at IS
  'Soft delete timestamp. NULL = active, NOT NULL = deleted.';

-- =====================================================
-- STEP 3: Soft Delete Helper Functions
-- =====================================================

-- Hizmet silme fonksiyonu (soft delete)
CREATE OR REPLACE FUNCTION soft_delete_beauty_service(p_service_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE beauty_services
  SET deleted_at = NOW(),
      is_active = false,
      updated_at = NOW()
  WHERE id = p_service_id AND deleted_at IS NULL;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Müşteri silme fonksiyonu (soft delete)
CREATE OR REPLACE FUNCTION soft_delete_customer(p_customer_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE customers
  SET deleted_at = NOW(),
      updated_at = NOW()
  WHERE id = p_customer_id AND deleted_at IS NULL;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Staff silme fonksiyonu (soft delete)
CREATE OR REPLACE FUNCTION soft_delete_staff_member(p_staff_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE staff_members
  SET deleted_at = NOW(),
      is_active = false,
      updated_at = NOW()
  WHERE id = p_staff_id AND deleted_at IS NULL;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- STEP 4: Aktif kayıtlar için View'ler
-- Soft delete'li kayıtları filtrelemek için
-- =====================================================

CREATE OR REPLACE VIEW active_beauty_services AS
SELECT * FROM beauty_services
WHERE deleted_at IS NULL AND is_active = true;

CREATE OR REPLACE VIEW active_customers AS
SELECT * FROM customers
WHERE deleted_at IS NULL;

CREATE OR REPLACE VIEW active_staff_members AS
SELECT * FROM staff_members
WHERE deleted_at IS NULL AND is_active = true;

COMMENT ON VIEW active_beauty_services IS 'Sadece aktif (silinmemiş) hizmetler';
COMMENT ON VIEW active_customers IS 'Sadece aktif (silinmemiş) müşteriler';
COMMENT ON VIEW active_staff_members IS 'Sadece aktif (silinmemiş) personel';

-- =====================================================
-- STEP 5: Eksik Index'ler
-- Performans için gerekli composite index'ler
-- =====================================================

-- Randevu sorguları için optimize edilmiş index
-- Örnek: Belirli bir günün randevularını status'a göre listele
CREATE INDEX IF NOT EXISTS idx_beauty_apt_tenant_date_status
  ON beauty_appointments(tenant_id, appointment_date, status);

-- Staff sorguları için index
CREATE INDEX IF NOT EXISTS idx_staff_tenant_active
  ON staff_members(tenant_id, is_active)
  WHERE deleted_at IS NULL;

-- Soft delete sorguları için partial index'ler
CREATE INDEX IF NOT EXISTS idx_beauty_services_active_only
  ON beauty_services(tenant_id, category)
  WHERE deleted_at IS NULL AND is_active = true;

CREATE INDEX IF NOT EXISTS idx_customers_active_only
  ON customers(tenant_id)
  WHERE deleted_at IS NULL;

-- =====================================================
-- STEP 6: selected_template_id Sütununu Kaldır
-- Migration 020'de deprecated olarak işaretlendi
-- Artık tamamen kaldırıyoruz
-- =====================================================

-- Helper function'ı güncelle (fallback'i kaldır)
CREATE OR REPLACE FUNCTION get_tenant_template_id(p_tenant_id UUID)
RETURNS VARCHAR(50) AS $$
DECLARE
  v_template_id VARCHAR(50);
BEGIN
  -- tenant_assistant_template tek kaynak (single source of truth)
  SELECT template_id INTO v_template_id
  FROM tenant_assistant_template
  WHERE tenant_id = p_tenant_id;

  RETURN v_template_id;
END;
$$ LANGUAGE plpgsql;

-- Önce bağımlı view'ı kaldır
DROP VIEW IF EXISTS tenant_template_view;

-- Sütunu kaldır
ALTER TABLE tenants DROP COLUMN IF EXISTS selected_template_id;

-- View'ı yeniden oluştur (selected_template_id olmadan)
CREATE OR REPLACE VIEW tenant_template_view AS
SELECT
  t.id,
  t.name,
  t.slug,
  t.industry,
  t.region,
  t.default_language,
  t.supported_languages,
  t.assistant_name,
  t.phone,
  t.email,
  t.plan,
  t.is_active,
  t.created_at,
  t.updated_at,
  t.twilio_phone_number,
  t.vapi_assistant_id_tr,
  t.vapi_assistant_id_en,
  t.vapi_assistant_id_de,
  t.vapi_phone_number_id,
  t.primary_color,
  t.logo_url,
  t.tts_provider,
  t.elevenlabs_voice_id,
  t.voice_config_override,
  tat.template_id AS effective_template_id,
  tat.added_use_cases,
  tat.removed_use_cases,
  tat.selected_at AS template_selected_at
FROM tenants t
LEFT JOIN tenant_assistant_template tat ON tat.tenant_id = t.id;

-- =====================================================
-- STEP 7: Randevu Çakışma Kontrolü Fonksiyonu
-- Double booking kontrolü için yardımcı fonksiyon
-- =====================================================

CREATE OR REPLACE FUNCTION check_appointment_availability(
  p_tenant_id UUID,
  p_appointment_date DATE,
  p_appointment_time TIME,
  p_duration_minutes INTEGER DEFAULT 30,
  p_exclude_appointment_id UUID DEFAULT NULL
)
RETURNS TABLE (
  is_available BOOLEAN,
  conflicting_appointment_id UUID,
  conflict_reason TEXT
) AS $$
DECLARE
  v_conflict_id UUID;
  v_end_time TIME;
BEGIN
  v_end_time := p_appointment_time + (p_duration_minutes || ' minutes')::INTERVAL;

  -- Aynı saatte randevu var mı kontrol et
  SELECT id INTO v_conflict_id
  FROM beauty_appointments
  WHERE tenant_id = p_tenant_id
    AND appointment_date = p_appointment_date
    AND status NOT IN ('cancelled', 'no_show')
    AND (p_exclude_appointment_id IS NULL OR id != p_exclude_appointment_id)
    AND (
      -- Yeni randevu mevcut randevuyla çakışıyor mu?
      (appointment_time <= p_appointment_time AND
       appointment_time + (COALESCE(duration_minutes, 30) || ' minutes')::INTERVAL > p_appointment_time)
      OR
      -- Mevcut randevu yeni randevunun içinde mi?
      (appointment_time >= p_appointment_time AND appointment_time < v_end_time)
    )
  LIMIT 1;

  IF v_conflict_id IS NOT NULL THEN
    RETURN QUERY SELECT false, v_conflict_id, 'Bu zaman diliminde başka bir randevu mevcut';
  ELSE
    RETURN QUERY SELECT true, NULL::UUID, NULL::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_appointment_availability IS
  'Belirtilen tarih/saat için randevu uygunluğunu kontrol eder. Duration bazlı çakışma kontrolü yapar.';

-- =====================================================
-- STEP 8: Randevu İstatistikleri View
-- Admin dashboard için faydalı
-- =====================================================

CREATE OR REPLACE VIEW appointment_stats AS
SELECT
  tenant_id,
  appointment_date,
  COUNT(*) AS total_appointments,
  COUNT(*) FILTER (WHERE status = 'completed') AS completed,
  COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled,
  COUNT(*) FILTER (WHERE status = 'no_show') AS no_show,
  COUNT(*) FILTER (WHERE status IN ('pending', 'confirmed')) AS upcoming
FROM beauty_appointments
GROUP BY tenant_id, appointment_date;

COMMENT ON VIEW appointment_stats IS 'Günlük randevu istatistikleri';

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON CONSTRAINT no_double_booking ON beauty_appointments IS
  'Aynı tenant''ta aynı tarih ve saate birden fazla randevu engeller';

COMMENT ON FUNCTION soft_delete_beauty_service IS 'Hizmeti soft delete ile siler (deleted_at set eder)';
COMMENT ON FUNCTION soft_delete_customer IS 'Müşteriyi soft delete ile siler (deleted_at set eder)';
COMMENT ON FUNCTION soft_delete_staff_member IS 'Personeli soft delete ile siler (deleted_at set eder)';
COMMENT ON VIEW tenant_template_view IS 'Unified view of tenant with template info - selected_template_id kaldırıldı';
