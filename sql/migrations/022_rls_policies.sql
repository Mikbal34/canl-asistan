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
-- 18. PROMPT_TEMPLATES TABLOSU
-- =============================================
ALTER TABLE prompt_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prompt_templates_tenant_isolation" ON prompt_templates
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "prompt_templates_super_admin_all" ON prompt_templates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_user_id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- =============================================
-- 19. USE_CASES TABLOSU (Global - tenant_id yok)
-- Super admin sadece düzenleyebilir
-- =============================================
ALTER TABLE use_cases ENABLE ROW LEVEL SECURITY;

-- Herkes okuyabilir (public data)
CREATE POLICY "use_cases_public_read" ON use_cases
  FOR SELECT USING (true);

-- Sadece super admin yazabilir
CREATE POLICY "use_cases_super_admin_write" ON use_cases
  FOR INSERT USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_user_id = auth.uid()
      AND role = 'super_admin'
    )
  );

CREATE POLICY "use_cases_super_admin_update" ON use_cases
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_user_id = auth.uid()
      AND role = 'super_admin'
    )
  );

CREATE POLICY "use_cases_super_admin_delete" ON use_cases
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_user_id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- =============================================
-- 20. TENANT_USE_CASES TABLOSU
-- =============================================
ALTER TABLE tenant_use_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_use_cases_tenant_isolation" ON tenant_use_cases
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "tenant_use_cases_super_admin_all" ON tenant_use_cases
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_user_id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- =============================================
-- 21. ASSISTANT_TEMPLATES TABLOSU (Global - tenant_id yok)
-- =============================================
ALTER TABLE assistant_templates ENABLE ROW LEVEL SECURITY;

-- Herkes okuyabilir (public data)
CREATE POLICY "assistant_templates_public_read" ON assistant_templates
  FOR SELECT USING (true);

-- Sadece super admin yazabilir
CREATE POLICY "assistant_templates_super_admin_write" ON assistant_templates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_user_id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- =============================================
-- 22. TENANT_ASSISTANT_TEMPLATE TABLOSU
-- =============================================
ALTER TABLE tenant_assistant_template ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_assistant_template_tenant_isolation" ON tenant_assistant_template
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "tenant_assistant_template_super_admin_all" ON tenant_assistant_template
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_user_id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- =============================================
-- 23. INDUSTRY_PRESETS TABLOSU (Global - tenant_id yok)
-- =============================================
ALTER TABLE industry_presets ENABLE ROW LEVEL SECURITY;

-- Herkes okuyabilir (public data)
CREATE POLICY "industry_presets_public_read" ON industry_presets
  FOR SELECT USING (true);

-- Sadece super admin yazabilir
CREATE POLICY "industry_presets_super_admin_write" ON industry_presets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_user_id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- =============================================
-- 24. VOICE_PRESETS TABLOSU (Global - tenant_id yok)
-- =============================================
ALTER TABLE voice_presets ENABLE ROW LEVEL SECURITY;

-- Herkes okuyabilir (public data)
CREATE POLICY "voice_presets_public_read" ON voice_presets
  FOR SELECT USING (true);

-- Sadece super admin yazabilir
CREATE POLICY "voice_presets_super_admin_write" ON voice_presets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_user_id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- =============================================
-- 25. TOOL_DEFINITIONS TABLOSU (Global - tenant_id yok)
-- =============================================
ALTER TABLE tool_definitions ENABLE ROW LEVEL SECURITY;

-- Herkes okuyabilir (public data)
CREATE POLICY "tool_definitions_public_read" ON tool_definitions
  FOR SELECT USING (true);

-- Sadece super admin yazabilir
CREATE POLICY "tool_definitions_super_admin_write" ON tool_definitions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_user_id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- =============================================
-- 26. VAPI_SYNC_LOG TABLOSU
-- =============================================
ALTER TABLE vapi_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vapi_sync_log_tenant_isolation" ON vapi_sync_log
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "vapi_sync_log_super_admin_all" ON vapi_sync_log
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_user_id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- =============================================
-- 27. TENANT_WEBHOOKS TABLOSU
-- =============================================
ALTER TABLE tenant_webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_webhooks_tenant_isolation" ON tenant_webhooks
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "tenant_webhooks_super_admin_all" ON tenant_webhooks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_user_id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- =============================================
-- 28. WEBHOOK_LOGS TABLOSU
-- =============================================
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "webhook_logs_tenant_isolation" ON webhook_logs
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "webhook_logs_super_admin_all" ON webhook_logs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_user_id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- =============================================
-- 29. LOYALTY_SETTINGS TABLOSU
-- =============================================
ALTER TABLE loyalty_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "loyalty_settings_tenant_isolation" ON loyalty_settings
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "loyalty_settings_super_admin_all" ON loyalty_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_user_id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- =============================================
-- 30. LOYALTY_TRANSACTIONS TABLOSU
-- =============================================
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;

-- loyalty_transactions loyalty_id ile bağlı, tenant_id yok
-- loyalty_points üzerinden tenant izolasyonu
CREATE POLICY "loyalty_transactions_isolation" ON loyalty_transactions
  FOR ALL USING (
    loyalty_id IN (
      SELECT lp.id FROM loyalty_points lp
      JOIN users u ON u.tenant_id = lp.tenant_id
      WHERE u.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "loyalty_transactions_super_admin_all" ON loyalty_transactions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_user_id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- =============================================
-- 31. PROMOTION_CODE_USAGE TABLOSU
-- =============================================
ALTER TABLE promotion_code_usage ENABLE ROW LEVEL SECURITY;

-- promotion_code_usage promotion_code_id ile bağlı
CREATE POLICY "promotion_code_usage_isolation" ON promotion_code_usage
  FOR ALL USING (
    promotion_code_id IN (
      SELECT pc.id FROM promotion_codes pc
      JOIN users u ON u.tenant_id = pc.tenant_id
      WHERE u.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "promotion_code_usage_super_admin_all" ON promotion_code_usage
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_user_id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- =============================================
-- 32. ONBOARDING_AGENT_SESSIONS TABLOSU
-- =============================================
ALTER TABLE onboarding_agent_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "onboarding_sessions_tenant_isolation" ON onboarding_agent_sessions
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "onboarding_sessions_super_admin_all" ON onboarding_agent_sessions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_user_id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- =============================================
-- EK INDEX'LER
-- =============================================
CREATE INDEX IF NOT EXISTS idx_prompt_templates_tenant_id ON prompt_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_use_cases_tenant_id ON tenant_use_cases(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_assistant_template_tenant_id ON tenant_assistant_template(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vapi_sync_log_tenant_id ON vapi_sync_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_webhooks_tenant_id ON tenant_webhooks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_tenant_id ON webhook_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_settings_tenant_id ON loyalty_settings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_agent_sessions_tenant_id ON onboarding_agent_sessions(tenant_id);

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
--   'loyalty_points', 'feedback', 'prompt_templates', 'use_cases',
--   'tenant_use_cases', 'assistant_templates', 'tenant_assistant_template',
--   'industry_presets', 'voice_presets', 'tool_definitions', 'vapi_sync_log',
--   'tenant_webhooks', 'webhook_logs', 'loyalty_settings', 'loyalty_transactions',
--   'promotion_code_usage', 'onboarding_agent_sessions'
-- );
-- Tüm tablolarda rowsecurity = true olmalı
