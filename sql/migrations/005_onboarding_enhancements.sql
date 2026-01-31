-- Migration 005: Onboarding Enhancements
-- Tenant onboarding status, working hours, custom fields, webhooks

-- ==========================================
-- TENANTS: Onboarding Status & Features
-- ==========================================

-- Onboarding durumu takibi
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS onboarding_status VARCHAR(20)
  DEFAULT 'pending';
-- Possible values: pending, company_info, vehicles, voice, testing, active

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- Feature flags sistemi (tenant bazli ozellik acma/kapama)
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS enabled_features JSONB DEFAULT '{}';
-- Example: {"lead_source_tracking": true, "feedback_forms": true, "webhook_integration": false}

-- Onboarding status constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_onboarding_status'
  ) THEN
    ALTER TABLE tenants ADD CONSTRAINT check_onboarding_status
      CHECK (onboarding_status IN ('pending', 'company_info', 'vehicles', 'voice', 'testing', 'active'));
  END IF;
END $$;

-- Index for onboarding status queries
CREATE INDEX IF NOT EXISTS idx_tenants_onboarding_status ON tenants(onboarding_status);

-- ==========================================
-- WORKING_HOURS: Tenant Calisma Saatleri
-- ==========================================

CREATE TABLE IF NOT EXISTS working_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Gun bilgisi (0=Pazar, 1=Pazartesi, ..., 6=Cumartesi)
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),

  -- Calisma saatleri
  open_time TIME,
  close_time TIME,

  -- Acik/kapali durumu
  is_open BOOLEAN DEFAULT true,

  -- Break time (ogle arasi vb)
  break_start TIME,
  break_end TIME,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Her gun icin sadece bir kayit
  UNIQUE(tenant_id, day_of_week)
);

-- Index for working hours queries
CREATE INDEX IF NOT EXISTS idx_working_hours_tenant_id ON working_hours(tenant_id);
CREATE INDEX IF NOT EXISTS idx_working_hours_day ON working_hours(tenant_id, day_of_week);

-- Trigger for updated_at
CREATE TRIGGER update_working_hours_updated_at
  BEFORE UPDATE ON working_hours
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS for working_hours
ALTER TABLE working_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view their working hours" ON working_hours
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE auth_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM users WHERE auth_user_id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "Tenant admins can manage working hours" ON working_hours
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE auth_user_id = auth.uid() AND role IN ('tenant_admin', 'super_admin'))
    OR EXISTS (SELECT 1 FROM users WHERE auth_user_id = auth.uid() AND role = 'super_admin')
  );

-- ==========================================
-- CUSTOM_FIELDS: Flexible Data for Appointments
-- ==========================================

-- Test drive appointments icin custom fields
ALTER TABLE test_drive_appointments ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}';
-- Example: {"lead_source": "Google Ads", "campaign_id": "summer2024", "sales_rep": "Ahmet"}

-- Service appointments icin custom fields
ALTER TABLE service_appointments ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}';

-- Customers icin custom fields
ALTER TABLE customers ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}';
-- Example: {"vip_customer": true, "preferred_contact": "whatsapp", "notes": "Premium customer"}

-- ==========================================
-- TENANT_WEBHOOKS: CRM/ERP Entegrasyonu
-- ==========================================

CREATE TABLE IF NOT EXISTS tenant_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Webhook bilgileri
  name VARCHAR(100) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  -- Event types: appointment.created, appointment.updated, appointment.cancelled,
  --              customer.created, call.completed, test_drive.created, service.created

  webhook_url TEXT NOT NULL,

  -- Authentication
  auth_type VARCHAR(20) DEFAULT 'none', -- none, api_key, bearer, basic
  auth_value TEXT, -- API key veya token

  -- Headers (JSONB)
  custom_headers JSONB DEFAULT '{}',

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Retry settings
  max_retries INTEGER DEFAULT 3,
  retry_delay_seconds INTEGER DEFAULT 60,

  -- Statistics
  last_triggered_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_error TEXT,
  total_calls INTEGER DEFAULT 0,
  total_failures INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for webhook queries
CREATE INDEX IF NOT EXISTS idx_tenant_webhooks_tenant_id ON tenant_webhooks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_webhooks_event_type ON tenant_webhooks(event_type);
CREATE INDEX IF NOT EXISTS idx_tenant_webhooks_active ON tenant_webhooks(tenant_id, is_active) WHERE is_active = true;

-- Trigger for updated_at
CREATE TRIGGER update_tenant_webhooks_updated_at
  BEFORE UPDATE ON tenant_webhooks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS for tenant_webhooks
ALTER TABLE tenant_webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant admins can manage webhooks" ON tenant_webhooks
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE auth_user_id = auth.uid() AND role IN ('tenant_admin', 'super_admin'))
    OR EXISTS (SELECT 1 FROM users WHERE auth_user_id = auth.uid() AND role = 'super_admin')
  );

-- ==========================================
-- WEBHOOK_LOGS: Webhook Cagri Takibi
-- ==========================================

CREATE TABLE IF NOT EXISTS webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES tenant_webhooks(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Request details
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,

  -- Response details
  response_status INTEGER,
  response_body TEXT,

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, success, failed, retrying
  attempt_count INTEGER DEFAULT 1,
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Index for webhook logs
CREATE INDEX IF NOT EXISTS idx_webhook_logs_webhook_id ON webhook_logs(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_tenant_id ON webhook_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_status ON webhook_logs(status);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_at ON webhook_logs(created_at DESC);

-- RLS for webhook_logs
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant admins can view webhook logs" ON webhook_logs
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE auth_user_id = auth.uid() AND role IN ('tenant_admin', 'super_admin'))
    OR EXISTS (SELECT 1 FROM users WHERE auth_user_id = auth.uid() AND role = 'super_admin')
  );

-- ==========================================
-- HELPER FUNCTIONS
-- ==========================================

-- Varsayilan calisma saatlerini olustur (Pazartesi-Cumartesi 09:00-18:00)
CREATE OR REPLACE FUNCTION create_default_working_hours(p_tenant_id UUID)
RETURNS void AS $$
BEGIN
  -- Pazartesi - Cuma (1-5): 09:00 - 18:00
  INSERT INTO working_hours (tenant_id, day_of_week, open_time, close_time, is_open)
  SELECT p_tenant_id, day, '09:00'::TIME, '18:00'::TIME, true
  FROM generate_series(1, 5) AS day
  ON CONFLICT (tenant_id, day_of_week) DO NOTHING;

  -- Cumartesi (6): 10:00 - 16:00
  INSERT INTO working_hours (tenant_id, day_of_week, open_time, close_time, is_open)
  VALUES (p_tenant_id, 6, '10:00'::TIME, '16:00'::TIME, true)
  ON CONFLICT (tenant_id, day_of_week) DO NOTHING;

  -- Pazar (0): Kapali
  INSERT INTO working_hours (tenant_id, day_of_week, open_time, close_time, is_open)
  VALUES (p_tenant_id, 0, NULL, NULL, false)
  ON CONFLICT (tenant_id, day_of_week) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Tenant calisma saatlerini getir
CREATE OR REPLACE FUNCTION get_tenant_working_hours(p_tenant_id UUID)
RETURNS TABLE (
  day_of_week INTEGER,
  day_name VARCHAR(20),
  open_time TIME,
  close_time TIME,
  is_open BOOLEAN,
  break_start TIME,
  break_end TIME
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    wh.day_of_week,
    CASE wh.day_of_week
      WHEN 0 THEN 'Pazar'
      WHEN 1 THEN 'Pazartesi'
      WHEN 2 THEN 'Sali'
      WHEN 3 THEN 'Carsamba'
      WHEN 4 THEN 'Persembe'
      WHEN 5 THEN 'Cuma'
      WHEN 6 THEN 'Cumartesi'
    END::VARCHAR(20) as day_name,
    wh.open_time,
    wh.close_time,
    wh.is_open,
    wh.break_start,
    wh.break_end
  FROM working_hours wh
  WHERE wh.tenant_id = p_tenant_id
  ORDER BY
    CASE WHEN wh.day_of_week = 0 THEN 7 ELSE wh.day_of_week END;
END;
$$ LANGUAGE plpgsql;

-- Belirli bir gun icin musait saatleri getir
CREATE OR REPLACE FUNCTION get_available_hours_for_day(
  p_tenant_id UUID,
  p_date DATE,
  p_slot_duration_minutes INTEGER DEFAULT 60
)
RETURNS TABLE (
  slot_time TIME,
  is_available BOOLEAN
) AS $$
DECLARE
  v_day_of_week INTEGER;
  v_working_hours RECORD;
  v_current_time TIME;
BEGIN
  -- Gunun haftanin hangi gunu oldugunu bul
  v_day_of_week := EXTRACT(DOW FROM p_date);

  -- Calisma saatlerini al
  SELECT * INTO v_working_hours
  FROM working_hours
  WHERE tenant_id = p_tenant_id AND day_of_week = v_day_of_week;

  -- Kapali gun ise bos dondur
  IF NOT FOUND OR NOT v_working_hours.is_open THEN
    RETURN;
  END IF;

  -- Slot'lari olustur
  v_current_time := v_working_hours.open_time;

  WHILE v_current_time < v_working_hours.close_time LOOP
    -- Break time kontrolu
    IF v_working_hours.break_start IS NOT NULL AND
       v_current_time >= v_working_hours.break_start AND
       v_current_time < v_working_hours.break_end THEN
      v_current_time := v_working_hours.break_end;
      CONTINUE;
    END IF;

    slot_time := v_current_time;
    is_available := true;
    RETURN NEXT;

    v_current_time := v_current_time + (p_slot_duration_minutes || ' minutes')::INTERVAL;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Onboarding tamamlandiginda tenant'i aktifle
CREATE OR REPLACE FUNCTION complete_tenant_onboarding(p_tenant_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE tenants
  SET
    onboarding_status = 'active',
    onboarding_completed_at = NOW(),
    is_active = true
  WHERE id = p_tenant_id;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- VOICE PRESETS: Ses Secenekleri
-- ==========================================

CREATE TABLE IF NOT EXISTS voice_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Voice bilgileri
  name VARCHAR(100) NOT NULL,
  provider VARCHAR(50) NOT NULL DEFAULT 'elevenlabs', -- elevenlabs, openai, azure
  voice_id VARCHAR(100) NOT NULL,

  -- Display bilgileri
  display_name_tr VARCHAR(100),
  display_name_en VARCHAR(100),
  display_name_de VARCHAR(100),
  description_tr TEXT,
  description_en TEXT,
  description_de TEXT,

  -- Kategorilendirme
  gender VARCHAR(20), -- male, female, neutral
  style VARCHAR(50), -- professional, friendly, energetic, calm
  language VARCHAR(10), -- tr, en, de, multi

  -- Preview URL
  preview_url TEXT,

  -- Sorting & visibility
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_voice_presets_active ON voice_presets(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_voice_presets_language ON voice_presets(language);

-- Trigger
CREATE TRIGGER update_voice_presets_updated_at
  BEFORE UPDATE ON voice_presets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Varsayilan ses presetleri
INSERT INTO voice_presets (name, provider, voice_id, display_name_tr, display_name_en, gender, style, language, sort_order)
VALUES
  ('Ayse', 'elevenlabs', 'EXAVITQu4vr4xnSDxMaL', 'Ayse (Samimi)', 'Ayse (Friendly)', 'female', 'friendly', 'tr', 1),
  ('Elif', 'elevenlabs', '21m00Tcm4TlvDq8ikWAM', 'Elif (Profesyonel)', 'Elif (Professional)', 'female', 'professional', 'tr', 2),
  ('Zeynep', 'elevenlabs', 'ThT5KcBeYPX3keUQqHPh', 'Zeynep (Enerjik)', 'Zeynep (Energetic)', 'female', 'energetic', 'tr', 3),
  ('Rachel', 'elevenlabs', '21m00Tcm4TlvDq8ikWAM', 'Rachel (English)', 'Rachel (English)', 'female', 'professional', 'en', 4),
  ('Anna', 'elevenlabs', '29vD33N1CtxCmqQRPOHJ', 'Anna (Deutsch)', 'Anna (German)', 'female', 'professional', 'de', 5)
ON CONFLICT DO NOTHING;

-- ==========================================
-- GRANT PERMISSIONS (for service role)
-- ==========================================

-- Grant access to new tables
GRANT ALL ON working_hours TO service_role;
GRANT ALL ON tenant_webhooks TO service_role;
GRANT ALL ON webhook_logs TO service_role;
GRANT ALL ON voice_presets TO service_role;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION create_default_working_hours(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION get_tenant_working_hours(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION get_available_hours_for_day(UUID, DATE, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION complete_tenant_onboarding(UUID) TO service_role;
