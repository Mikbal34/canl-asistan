-- =============================================
-- RLS (Row Level Security) POLİTİKALARI
-- Multi-tenant veritabanı güvenliği için
-- =============================================
-- NOT: Bu migration'ı çalıştırmadan önce mevcut verilerinizi yedekleyin
-- Bu politikalar auth.uid() ile users tablosunu bağlayarak tenant izolasyonu sağlar

-- =============================================
-- 1. USERS TABLOSU
-- =============================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Kullanıcı kendi kaydını görebilir
CREATE POLICY "users_select_own" ON users
  FOR SELECT USING (auth_user_id = auth.uid());

-- Kullanıcı kendi kaydını güncelleyebilir (sadece belirli alanlar - uygulama seviyesinde kontrol)
CREATE POLICY "users_update_own" ON users
  FOR UPDATE USING (auth_user_id = auth.uid());

-- Super admin tüm kullanıcıları görebilir ve yönetebilir
CREATE POLICY "users_super_admin_all" ON users
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_user_id = auth.uid()
      AND u.role = 'super_admin'
    )
  );

-- Tenant admin kendi tenant kullanıcılarını görebilir
CREATE POLICY "users_tenant_admin_select" ON users
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM users
      WHERE auth_user_id = auth.uid()
      AND role IN ('tenant_admin', 'super_admin')
    )
  );

-- =============================================
-- 2. TENANTS TABLOSU
-- =============================================
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- Kullanıcı sadece kendi tenant'ını görebilir
CREATE POLICY "tenants_own_tenant" ON tenants
  FOR SELECT USING (
    id IN (
      SELECT tenant_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

-- Super admin tüm tenant'ları görebilir ve yönetebilir
CREATE POLICY "tenants_super_admin_all" ON tenants
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_user_id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- Tenant admin kendi tenant'ını güncelleyebilir
CREATE POLICY "tenants_tenant_admin_update" ON tenants
  FOR UPDATE USING (
    id IN (
      SELECT tenant_id FROM users
      WHERE auth_user_id = auth.uid()
      AND role = 'tenant_admin'
    )
  );

-- =============================================
-- 3. CUSTOMERS TABLOSU
-- =============================================
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customers_tenant_isolation" ON customers
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

-- Super admin tüm müşterilere erişebilir
CREATE POLICY "customers_super_admin_all" ON customers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_user_id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- =============================================
-- 4. APPOINTMENT_SLOTS TABLOSU
-- =============================================
ALTER TABLE appointment_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "slots_tenant_isolation" ON appointment_slots
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "slots_super_admin_all" ON appointment_slots
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_user_id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- =============================================
-- 5. TEST_DRIVE_APPOINTMENTS TABLOSU
-- =============================================
ALTER TABLE test_drive_appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "test_drive_tenant_isolation" ON test_drive_appointments
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "test_drive_super_admin_all" ON test_drive_appointments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_user_id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- =============================================
-- 6. SERVICE_APPOINTMENTS TABLOSU
-- =============================================
ALTER TABLE service_appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_apt_tenant_isolation" ON service_appointments
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "service_apt_super_admin_all" ON service_appointments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_user_id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- =============================================
-- 7. BEAUTY_APPOINTMENTS TABLOSU
-- =============================================
ALTER TABLE beauty_appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "beauty_apt_tenant_isolation" ON beauty_appointments
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "beauty_apt_super_admin_all" ON beauty_appointments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_user_id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- =============================================
-- 8. VEHICLES TABLOSU
-- =============================================
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vehicles_tenant_isolation" ON vehicles
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "vehicles_super_admin_all" ON vehicles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_user_id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- =============================================
-- 9. BEAUTY_SERVICES TABLOSU
-- =============================================
ALTER TABLE beauty_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "beauty_services_tenant_isolation" ON beauty_services
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "beauty_services_super_admin_all" ON beauty_services
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_user_id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- =============================================
-- 10. CALL_LOGS TABLOSU
-- =============================================
ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "call_logs_tenant_isolation" ON call_logs
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "call_logs_super_admin_all" ON call_logs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_user_id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- =============================================
-- 11. STAFF_MEMBERS TABLOSU
-- =============================================
ALTER TABLE staff_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_tenant_isolation" ON staff_members
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "staff_super_admin_all" ON staff_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_user_id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- =============================================
-- 12. WORKING_HOURS TABLOSU
-- =============================================
ALTER TABLE working_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "working_hours_tenant_isolation" ON working_hours
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "working_hours_super_admin_all" ON working_hours
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_user_id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- =============================================
-- 13. SPECIAL_DAYS TABLOSU
-- =============================================
ALTER TABLE special_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "special_days_tenant_isolation" ON special_days
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "special_days_super_admin_all" ON special_days
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_user_id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- =============================================
-- 14. CAMPAIGNS TABLOSU
-- =============================================
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campaigns_tenant_isolation" ON campaigns
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "campaigns_super_admin_all" ON campaigns
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_user_id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- =============================================
-- 15. PROMOTION_CODES TABLOSU
-- =============================================
ALTER TABLE promotion_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "promotion_codes_tenant_isolation" ON promotion_codes
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "promotion_codes_super_admin_all" ON promotion_codes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_user_id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- =============================================
-- 16. LOYALTY_POINTS TABLOSU
-- =============================================
ALTER TABLE loyalty_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "loyalty_points_tenant_isolation" ON loyalty_points
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "loyalty_points_super_admin_all" ON loyalty_points
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_user_id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- =============================================
-- 17. FEEDBACK TABLOSU
-- =============================================
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feedback_tenant_isolation" ON feedback
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "feedback_super_admin_all" ON feedback
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_user_id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- =============================================
-- PERFORMANS İÇİN INDEX'LER
-- =============================================
-- users tablosunda auth_user_id için index (RLS sorguları için kritik)
CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON users(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Diğer tablolar için tenant_id index'leri
CREATE INDEX IF NOT EXISTS idx_customers_tenant_id ON customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_appointment_slots_tenant_id ON appointment_slots(tenant_id);
CREATE INDEX IF NOT EXISTS idx_test_drive_appointments_tenant_id ON test_drive_appointments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_service_appointments_tenant_id ON service_appointments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_beauty_appointments_tenant_id ON beauty_appointments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_tenant_id ON vehicles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_beauty_services_tenant_id ON beauty_services(tenant_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_tenant_id ON call_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_staff_members_tenant_id ON staff_members(tenant_id);
CREATE INDEX IF NOT EXISTS idx_working_hours_tenant_id ON working_hours(tenant_id);
CREATE INDEX IF NOT EXISTS idx_special_days_tenant_id ON special_days(tenant_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_tenant_id ON campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_promotion_codes_tenant_id ON promotion_codes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_points_tenant_id ON loyalty_points(tenant_id);
CREATE INDEX IF NOT EXISTS idx_feedback_tenant_id ON feedback(tenant_id);

-- =============================================
-- DOĞRULAMA SORGUSU
-- Migration sonrası çalıştırın
-- =============================================
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- AND tablename IN (
--   'users', 'tenants', 'customers', 'appointment_slots',
--   'test_drive_appointments', 'service_appointments', 'beauty_appointments',
--   'vehicles', 'beauty_services', 'call_logs', 'staff_members',
--   'working_hours', 'special_days', 'campaigns', 'promotion_codes',
--   'loyalty_points', 'feedback'
-- );
-- Tüm tablolarda rowsecurity = true olmalı
