-- Migration 017: Assistant Templates System
-- Sektör bazlı asistan şablonları ve tenant atama sistemi

-- =====================================================
-- ASSISTANT TEMPLATES TABLE
-- Hazır asistan şablon tanımları
-- =====================================================
CREATE TABLE IF NOT EXISTS assistant_templates (
  id VARCHAR(50) PRIMARY KEY,
  name_tr VARCHAR(150) NOT NULL,
  name_en VARCHAR(150),
  description_tr TEXT,
  description_en TEXT,
  industry VARCHAR(50) NOT NULL,
  tier VARCHAR(20) DEFAULT 'standard' CHECK (tier IN ('basic', 'standard', 'premium')),
  included_use_cases TEXT[] NOT NULL DEFAULT '{}',
  icon VARCHAR(50),
  display_order INT DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_assistant_templates_industry ON assistant_templates(industry);
CREATE INDEX IF NOT EXISTS idx_assistant_templates_tier ON assistant_templates(tier);
CREATE INDEX IF NOT EXISTS idx_assistant_templates_active ON assistant_templates(is_active);

-- =====================================================
-- TENANT ASSISTANT TEMPLATE TABLE
-- Tenant şablon seçimi ve özelleştirmesi
-- =====================================================
CREATE TABLE IF NOT EXISTS tenant_assistant_template (
  tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  template_id VARCHAR(50) REFERENCES assistant_templates(id) ON DELETE SET NULL,
  added_use_cases TEXT[] DEFAULT '{}',
  removed_use_cases TEXT[] DEFAULT '{}',
  selected_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- ADD COLUMN TO TENANTS TABLE
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'selected_template_id'
  ) THEN
    ALTER TABLE tenants ADD COLUMN selected_template_id VARCHAR(50);
  END IF;
END $$;

-- =====================================================
-- SEED DATA: OTOMOTIV TEMPLATES
-- =====================================================
INSERT INTO assistant_templates (id, name_tr, name_en, description_tr, description_en, industry, tier, included_use_cases, icon, display_order, is_featured) VALUES
(
  'automotive_basic',
  'Temel Randevu Asistanı',
  'Basic Appointment Assistant',
  'İşletme bilgileri ve temel randevu yönetimi. Küçük ölçekli galeriler için ideal.',
  'Business info and basic appointment management. Ideal for small-scale galleries.',
  'automotive',
  'basic',
  ARRAY['business_info', 'appointments_core'],
  'Car',
  1,
  false
),
(
  'automotive_standard',
  'Test Sürüşü Asistanı',
  'Test Drive Assistant',
  'Test sürüşü randevusu ve fiyat bilgisi. Standart bayiler için.',
  'Test drive appointments and pricing info. For standard dealerships.',
  'automotive',
  'standard',
  ARRAY['business_info', 'appointments_core', 'test_drive', 'pricing'],
  'Car',
  2,
  true
),
(
  'automotive_premium',
  'Tam Paket Otomotiv',
  'Full Automotive Package',
  'Test sürüşü, servis randevusu, kampanyalar ve geri bildirim. Büyük bayiler için.',
  'Test drives, service appointments, promotions and feedback. For large dealerships.',
  'automotive',
  'premium',
  ARRAY['business_info', 'appointments_core', 'test_drive', 'service_appointment', 'pricing', 'promotions', 'feedback'],
  'Car',
  3,
  false
)
ON CONFLICT (id) DO UPDATE SET
  name_tr = EXCLUDED.name_tr,
  name_en = EXCLUDED.name_en,
  description_tr = EXCLUDED.description_tr,
  description_en = EXCLUDED.description_en,
  tier = EXCLUDED.tier,
  included_use_cases = EXCLUDED.included_use_cases,
  icon = EXCLUDED.icon,
  display_order = EXCLUDED.display_order,
  is_featured = EXCLUDED.is_featured,
  updated_at = NOW();

-- =====================================================
-- SEED DATA: GÜZELLIK TEMPLATES
-- =====================================================
INSERT INTO assistant_templates (id, name_tr, name_en, description_tr, description_en, industry, tier, included_use_cases, icon, display_order, is_featured) VALUES
(
  'beauty_basic',
  'Randevu Asistanı',
  'Appointment Assistant',
  'İşletme bilgileri ve güzellik hizmeti randevusu. Küçük salonlar için.',
  'Business info and beauty service appointments. For small salons.',
  'beauty',
  'basic',
  ARRAY['business_info', 'appointments_core', 'beauty_services'],
  'Scissors',
  1,
  false
),
(
  'beauty_standard',
  'Profesyonel Asistan',
  'Professional Assistant',
  'Personel seçimi ve fiyat bilgisi dahil. Orta ölçekli salonlar için.',
  'Includes staff selection and pricing info. For medium-sized salons.',
  'beauty',
  'standard',
  ARRAY['business_info', 'appointments_core', 'beauty_services', 'staff_selection', 'pricing'],
  'Scissors',
  2,
  true
),
(
  'beauty_premium',
  'VIP Asistan',
  'VIP Assistant',
  'Sadakat programı, kampanyalar ve geri bildirim. Premium salonlar için.',
  'Loyalty program, promotions and feedback. For premium salons.',
  'beauty',
  'premium',
  ARRAY['business_info', 'appointments_core', 'beauty_services', 'staff_selection', 'pricing', 'loyalty', 'promotions', 'feedback', 'customer_history'],
  'Scissors',
  3,
  false
)
ON CONFLICT (id) DO UPDATE SET
  name_tr = EXCLUDED.name_tr,
  name_en = EXCLUDED.name_en,
  description_tr = EXCLUDED.description_tr,
  description_en = EXCLUDED.description_en,
  tier = EXCLUDED.tier,
  included_use_cases = EXCLUDED.included_use_cases,
  icon = EXCLUDED.icon,
  display_order = EXCLUDED.display_order,
  is_featured = EXCLUDED.is_featured,
  updated_at = NOW();

-- =====================================================
-- FUNCTION: Get effective use cases for a tenant
-- Şablon + eklenen - çıkarılan = final liste
-- =====================================================
CREATE OR REPLACE FUNCTION get_tenant_effective_use_cases(p_tenant_id UUID)
RETURNS TEXT[] AS $$
DECLARE
  v_template_use_cases TEXT[];
  v_added TEXT[];
  v_removed TEXT[];
  v_result TEXT[];
BEGIN
  -- Get template use cases and customizations
  SELECT
    COALESCE(t.included_use_cases, ARRAY[]::TEXT[]),
    COALESCE(tat.added_use_cases, ARRAY[]::TEXT[]),
    COALESCE(tat.removed_use_cases, ARRAY[]::TEXT[])
  INTO v_template_use_cases, v_added, v_removed
  FROM tenant_assistant_template tat
  LEFT JOIN assistant_templates t ON t.id = tat.template_id
  WHERE tat.tenant_id = p_tenant_id;

  -- If no template assigned, return empty array
  IF v_template_use_cases IS NULL THEN
    RETURN ARRAY[]::TEXT[];
  END IF;

  -- Calculate: (template use cases + added) - removed
  v_result := (v_template_use_cases || v_added);

  -- Remove the removed use cases
  SELECT ARRAY(
    SELECT unnest(v_result)
    EXCEPT
    SELECT unnest(v_removed)
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCTION: Assign template to tenant
-- =====================================================
CREATE OR REPLACE FUNCTION assign_template_to_tenant(
  p_tenant_id UUID,
  p_template_id VARCHAR(50)
)
RETURNS void AS $$
BEGIN
  -- Insert or update tenant_assistant_template
  INSERT INTO tenant_assistant_template (tenant_id, template_id, added_use_cases, removed_use_cases, selected_at, updated_at)
  VALUES (p_tenant_id, p_template_id, ARRAY[]::TEXT[], ARRAY[]::TEXT[], NOW(), NOW())
  ON CONFLICT (tenant_id) DO UPDATE SET
    template_id = p_template_id,
    added_use_cases = ARRAY[]::TEXT[],
    removed_use_cases = ARRAY[]::TEXT[],
    selected_at = NOW(),
    updated_at = NOW();

  -- Update tenants table
  UPDATE tenants SET selected_template_id = p_template_id WHERE id = p_tenant_id;

  -- Sync use cases: Clear existing and add template use cases
  DELETE FROM tenant_use_cases WHERE tenant_id = p_tenant_id;

  INSERT INTO tenant_use_cases (tenant_id, use_case_id, enabled)
  SELECT p_tenant_id, unnest(included_use_cases), true
  FROM assistant_templates
  WHERE id = p_template_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGER: Update updated_at on tenant_assistant_template
-- =====================================================
CREATE OR REPLACE FUNCTION update_tenant_template_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_tenant_assistant_template_updated_at ON tenant_assistant_template;
CREATE TRIGGER update_tenant_assistant_template_updated_at
  BEFORE UPDATE ON tenant_assistant_template
  FOR EACH ROW EXECUTE FUNCTION update_tenant_template_updated_at();

-- =====================================================
-- COMMENTS for documentation
-- =====================================================
COMMENT ON TABLE assistant_templates IS 'Hazır asistan şablonları - sektör bazlı paketler';
COMMENT ON TABLE tenant_assistant_template IS 'Tenant şablon seçimi ve özelleştirmeleri';
COMMENT ON COLUMN assistant_templates.tier IS 'Şablon seviyesi: basic, standard, premium';
COMMENT ON COLUMN assistant_templates.included_use_cases IS 'Bu şablona dahil use case ID listesi';
COMMENT ON COLUMN tenant_assistant_template.added_use_cases IS 'Tenant tarafından eklenen ekstra use case''ler';
COMMENT ON COLUMN tenant_assistant_template.removed_use_cases IS 'Tenant tarafından çıkarılan use case''ler';
