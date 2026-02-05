-- =============================================
-- RLS Recursion Fix
-- users tablosundaki infinite recursion sorununu çözer
-- =============================================

-- Önce mevcut users politikalarını kaldır
DROP POLICY IF EXISTS "users_select_own" ON users;
DROP POLICY IF EXISTS "users_update_own" ON users;
DROP POLICY IF EXISTS "users_super_admin_all" ON users;
DROP POLICY IF EXISTS "users_tenant_admin_select" ON users;

-- Helper function: Kullanıcının super_admin olup olmadığını kontrol et
-- SECURITY DEFINER ile çalışır, RLS'i atlar
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role
  FROM users
  WHERE auth_user_id = auth.uid()
  LIMIT 1;

  RETURN COALESCE(v_role = 'super_admin', false);
END;
$$;

-- Helper function: Kullanıcının tenant_id'sini al
CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  SELECT tenant_id INTO v_tenant_id
  FROM users
  WHERE auth_user_id = auth.uid()
  LIMIT 1;

  RETURN v_tenant_id;
END;
$$;

-- =============================================
-- USERS TABLOSU - Yeni Politikalar (Recursion-free)
-- =============================================

-- Kullanıcı kendi kaydını görebilir (basit, recursion yok)
CREATE POLICY "users_select_own" ON users
  FOR SELECT USING (auth_user_id = auth.uid());

-- Kullanıcı kendi kaydını güncelleyebilir
CREATE POLICY "users_update_own" ON users
  FOR UPDATE USING (auth_user_id = auth.uid());

-- Super admin tüm kullanıcıları görebilir ve yönetebilir
CREATE POLICY "users_super_admin_all" ON users
  FOR ALL USING (public.is_super_admin());

-- Tenant admin kendi tenant kullanıcılarını görebilir
CREATE POLICY "users_tenant_admin_select" ON users
  FOR SELECT USING (tenant_id = public.get_user_tenant_id());

-- =============================================
-- DİĞER TABLOLAR - Politikaları güncelle (helper function kullan)
-- =============================================

-- TENANTS
DROP POLICY IF EXISTS "tenants_own_tenant" ON tenants;
DROP POLICY IF EXISTS "tenants_super_admin_all" ON tenants;
DROP POLICY IF EXISTS "tenants_tenant_admin_update" ON tenants;

CREATE POLICY "tenants_own_tenant" ON tenants
  FOR SELECT USING (id = public.get_user_tenant_id());

CREATE POLICY "tenants_super_admin_all" ON tenants
  FOR ALL USING (public.is_super_admin());

CREATE POLICY "tenants_tenant_admin_update" ON tenants
  FOR UPDATE USING (id = public.get_user_tenant_id());

-- CUSTOMERS
DROP POLICY IF EXISTS "customers_tenant_isolation" ON customers;
DROP POLICY IF EXISTS "customers_super_admin_all" ON customers;

CREATE POLICY "customers_tenant_isolation" ON customers
  FOR ALL USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "customers_super_admin_all" ON customers
  FOR ALL USING (public.is_super_admin());

-- APPOINTMENT_SLOTS
DROP POLICY IF EXISTS "slots_tenant_isolation" ON appointment_slots;
DROP POLICY IF EXISTS "slots_super_admin_all" ON appointment_slots;

CREATE POLICY "slots_tenant_isolation" ON appointment_slots
  FOR ALL USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "slots_super_admin_all" ON appointment_slots
  FOR ALL USING (public.is_super_admin());

-- TEST_DRIVE_APPOINTMENTS
DROP POLICY IF EXISTS "test_drive_tenant_isolation" ON test_drive_appointments;
DROP POLICY IF EXISTS "test_drive_super_admin_all" ON test_drive_appointments;

CREATE POLICY "test_drive_tenant_isolation" ON test_drive_appointments
  FOR ALL USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "test_drive_super_admin_all" ON test_drive_appointments
  FOR ALL USING (public.is_super_admin());

-- SERVICE_APPOINTMENTS
DROP POLICY IF EXISTS "service_apt_tenant_isolation" ON service_appointments;
DROP POLICY IF EXISTS "service_apt_super_admin_all" ON service_appointments;

CREATE POLICY "service_apt_tenant_isolation" ON service_appointments
  FOR ALL USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "service_apt_super_admin_all" ON service_appointments
  FOR ALL USING (public.is_super_admin());

-- BEAUTY_APPOINTMENTS
DROP POLICY IF EXISTS "beauty_apt_tenant_isolation" ON beauty_appointments;
DROP POLICY IF EXISTS "beauty_apt_super_admin_all" ON beauty_appointments;

CREATE POLICY "beauty_apt_tenant_isolation" ON beauty_appointments
  FOR ALL USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "beauty_apt_super_admin_all" ON beauty_appointments
  FOR ALL USING (public.is_super_admin());

-- VEHICLES
DROP POLICY IF EXISTS "vehicles_tenant_isolation" ON vehicles;
DROP POLICY IF EXISTS "vehicles_super_admin_all" ON vehicles;

CREATE POLICY "vehicles_tenant_isolation" ON vehicles
  FOR ALL USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "vehicles_super_admin_all" ON vehicles
  FOR ALL USING (public.is_super_admin());

-- BEAUTY_SERVICES
DROP POLICY IF EXISTS "beauty_services_tenant_isolation" ON beauty_services;
DROP POLICY IF EXISTS "beauty_services_super_admin_all" ON beauty_services;

CREATE POLICY "beauty_services_tenant_isolation" ON beauty_services
  FOR ALL USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "beauty_services_super_admin_all" ON beauty_services
  FOR ALL USING (public.is_super_admin());

-- CALL_LOGS
DROP POLICY IF EXISTS "call_logs_tenant_isolation" ON call_logs;
DROP POLICY IF EXISTS "call_logs_super_admin_all" ON call_logs;

CREATE POLICY "call_logs_tenant_isolation" ON call_logs
  FOR ALL USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "call_logs_super_admin_all" ON call_logs
  FOR ALL USING (public.is_super_admin());

-- STAFF_MEMBERS
DROP POLICY IF EXISTS "staff_tenant_isolation" ON staff_members;
DROP POLICY IF EXISTS "staff_super_admin_all" ON staff_members;

CREATE POLICY "staff_tenant_isolation" ON staff_members
  FOR ALL USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "staff_super_admin_all" ON staff_members
  FOR ALL USING (public.is_super_admin());

-- WORKING_HOURS
DROP POLICY IF EXISTS "working_hours_tenant_isolation" ON working_hours;
DROP POLICY IF EXISTS "working_hours_super_admin_all" ON working_hours;

CREATE POLICY "working_hours_tenant_isolation" ON working_hours
  FOR ALL USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "working_hours_super_admin_all" ON working_hours
  FOR ALL USING (public.is_super_admin());

-- SPECIAL_DAYS
DROP POLICY IF EXISTS "special_days_tenant_isolation" ON special_days;
DROP POLICY IF EXISTS "special_days_super_admin_all" ON special_days;

CREATE POLICY "special_days_tenant_isolation" ON special_days
  FOR ALL USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "special_days_super_admin_all" ON special_days
  FOR ALL USING (public.is_super_admin());

-- CAMPAIGNS
DROP POLICY IF EXISTS "campaigns_tenant_isolation" ON campaigns;
DROP POLICY IF EXISTS "campaigns_super_admin_all" ON campaigns;

CREATE POLICY "campaigns_tenant_isolation" ON campaigns
  FOR ALL USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "campaigns_super_admin_all" ON campaigns
  FOR ALL USING (public.is_super_admin());

-- PROMOTION_CODES
DROP POLICY IF EXISTS "promotion_codes_tenant_isolation" ON promotion_codes;
DROP POLICY IF EXISTS "promotion_codes_super_admin_all" ON promotion_codes;

CREATE POLICY "promotion_codes_tenant_isolation" ON promotion_codes
  FOR ALL USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "promotion_codes_super_admin_all" ON promotion_codes
  FOR ALL USING (public.is_super_admin());

-- LOYALTY_POINTS
DROP POLICY IF EXISTS "loyalty_points_tenant_isolation" ON loyalty_points;
DROP POLICY IF EXISTS "loyalty_points_super_admin_all" ON loyalty_points;

CREATE POLICY "loyalty_points_tenant_isolation" ON loyalty_points
  FOR ALL USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "loyalty_points_super_admin_all" ON loyalty_points
  FOR ALL USING (public.is_super_admin());

-- FEEDBACK
DROP POLICY IF EXISTS "feedback_tenant_isolation" ON feedback;
DROP POLICY IF EXISTS "feedback_super_admin_all" ON feedback;

CREATE POLICY "feedback_tenant_isolation" ON feedback
  FOR ALL USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "feedback_super_admin_all" ON feedback
  FOR ALL USING (public.is_super_admin());

-- PROMPT_TEMPLATES
DROP POLICY IF EXISTS "prompt_templates_tenant_isolation" ON prompt_templates;
DROP POLICY IF EXISTS "prompt_templates_super_admin_all" ON prompt_templates;

CREATE POLICY "prompt_templates_tenant_isolation" ON prompt_templates
  FOR ALL USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "prompt_templates_super_admin_all" ON prompt_templates
  FOR ALL USING (public.is_super_admin());

-- TENANT_USE_CASES
DROP POLICY IF EXISTS "tenant_use_cases_tenant_isolation" ON tenant_use_cases;
DROP POLICY IF EXISTS "tenant_use_cases_super_admin_all" ON tenant_use_cases;

CREATE POLICY "tenant_use_cases_tenant_isolation" ON tenant_use_cases
  FOR ALL USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "tenant_use_cases_super_admin_all" ON tenant_use_cases
  FOR ALL USING (public.is_super_admin());

-- TENANT_ASSISTANT_TEMPLATE
DROP POLICY IF EXISTS "tenant_assistant_template_tenant_isolation" ON tenant_assistant_template;
DROP POLICY IF EXISTS "tenant_assistant_template_super_admin_all" ON tenant_assistant_template;

CREATE POLICY "tenant_assistant_template_tenant_isolation" ON tenant_assistant_template
  FOR ALL USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "tenant_assistant_template_super_admin_all" ON tenant_assistant_template
  FOR ALL USING (public.is_super_admin());

-- VAPI_SYNC_LOG
DROP POLICY IF EXISTS "vapi_sync_log_tenant_isolation" ON vapi_sync_log;
DROP POLICY IF EXISTS "vapi_sync_log_super_admin_all" ON vapi_sync_log;

CREATE POLICY "vapi_sync_log_tenant_isolation" ON vapi_sync_log
  FOR ALL USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "vapi_sync_log_super_admin_all" ON vapi_sync_log
  FOR ALL USING (public.is_super_admin());

-- TENANT_WEBHOOKS
DROP POLICY IF EXISTS "tenant_webhooks_tenant_isolation" ON tenant_webhooks;
DROP POLICY IF EXISTS "tenant_webhooks_super_admin_all" ON tenant_webhooks;

CREATE POLICY "tenant_webhooks_tenant_isolation" ON tenant_webhooks
  FOR ALL USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "tenant_webhooks_super_admin_all" ON tenant_webhooks
  FOR ALL USING (public.is_super_admin());

-- WEBHOOK_LOGS
DROP POLICY IF EXISTS "webhook_logs_tenant_isolation" ON webhook_logs;
DROP POLICY IF EXISTS "webhook_logs_super_admin_all" ON webhook_logs;

CREATE POLICY "webhook_logs_tenant_isolation" ON webhook_logs
  FOR ALL USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "webhook_logs_super_admin_all" ON webhook_logs
  FOR ALL USING (public.is_super_admin());

-- LOYALTY_SETTINGS
DROP POLICY IF EXISTS "loyalty_settings_tenant_isolation" ON loyalty_settings;
DROP POLICY IF EXISTS "loyalty_settings_super_admin_all" ON loyalty_settings;

CREATE POLICY "loyalty_settings_tenant_isolation" ON loyalty_settings
  FOR ALL USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "loyalty_settings_super_admin_all" ON loyalty_settings
  FOR ALL USING (public.is_super_admin());

-- ONBOARDING_AGENT_SESSIONS
DROP POLICY IF EXISTS "onboarding_sessions_tenant_isolation" ON onboarding_agent_sessions;
DROP POLICY IF EXISTS "onboarding_sessions_super_admin_all" ON onboarding_agent_sessions;

CREATE POLICY "onboarding_sessions_tenant_isolation" ON onboarding_agent_sessions
  FOR ALL USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "onboarding_sessions_super_admin_all" ON onboarding_agent_sessions
  FOR ALL USING (public.is_super_admin());

-- =============================================
-- DOĞRULAMA
-- =============================================
-- Test için:
-- SELECT public.is_super_admin();
-- SELECT public.get_user_tenant_id();
