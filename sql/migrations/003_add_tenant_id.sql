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
