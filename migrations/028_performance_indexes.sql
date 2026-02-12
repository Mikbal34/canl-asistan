-- Performance indexes for common query patterns
-- Run this migration in Supabase SQL Editor

-- Appointment slot lookups (tenant + date + availability)
CREATE INDEX IF NOT EXISTS idx_appointment_slots_tenant_date
  ON appointment_slots(tenant_id, slot_date, is_available);

-- Call log listing (tenant + date descending sort)
CREATE INDEX IF NOT EXISTS idx_call_logs_tenant_created
  ON call_logs(tenant_id, created_at DESC);

-- Customer phone lookup (webhook tenant+phone search)
CREATE INDEX IF NOT EXISTS idx_customers_tenant_phone
  ON customers(tenant_id, phone);

-- VAPI assistant ID reverse lookup (webhook tenant resolution)
CREATE INDEX IF NOT EXISTS idx_tenants_vapi_tr
  ON tenants(vapi_assistant_id_tr) WHERE vapi_assistant_id_tr IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tenants_vapi_en
  ON tenants(vapi_assistant_id_en) WHERE vapi_assistant_id_en IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tenants_vapi_de
  ON tenants(vapi_assistant_id_de) WHERE vapi_assistant_id_de IS NOT NULL;

-- Tenant slug lookup (login page resolution)
CREATE INDEX IF NOT EXISTS idx_tenants_slug_active
  ON tenants(slug) WHERE is_active = true;
