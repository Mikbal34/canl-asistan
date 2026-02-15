-- Migration 024: Verimor SIP Trunk Integration
-- Adds SIP phone number fields for BYO (Bring Your Own) SIP trunk via Verimor

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS sip_phone_number VARCHAR(20),
  ADD COLUMN IF NOT EXISTS vapi_credential_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS sip_inbound_enabled BOOLEAN DEFAULT false;

-- Index for quick lookup by SIP phone number
CREATE INDEX IF NOT EXISTS idx_tenants_sip_phone
  ON tenants(sip_phone_number) WHERE sip_phone_number IS NOT NULL;

-- Note: vapi_phone_number_id column already exists from migration 004
