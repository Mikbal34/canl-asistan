-- Migration: 016_appointment_slots.sql
-- Appointment slots table for managing available time slots per tenant/date

-- Create appointment_slots table if not exists
CREATE TABLE IF NOT EXISTS appointment_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  slot_date DATE NOT NULL,
  slot_time TIME NOT NULL,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint: one slot per tenant/date/time combination
  CONSTRAINT unique_slot_per_tenant_date_time UNIQUE (tenant_id, slot_date, slot_time)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_appointment_slots_tenant_id ON appointment_slots(tenant_id);
CREATE INDEX IF NOT EXISTS idx_appointment_slots_date ON appointment_slots(slot_date);
CREATE INDEX IF NOT EXISTS idx_appointment_slots_tenant_date ON appointment_slots(tenant_id, slot_date);

-- Enable RLS
ALTER TABLE appointment_slots ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Service role can do everything
CREATE POLICY "Service role full access" ON appointment_slots
  FOR ALL
  USING (auth.role() = 'service_role');

-- Authenticated users can view their tenant's slots
CREATE POLICY "Tenant users can view slots" ON appointment_slots
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

-- Tenant admins can manage their slots
CREATE POLICY "Tenant admins can manage slots" ON appointment_slots
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM users
      WHERE auth_user_id = auth.uid()
      AND role IN ('super_admin', 'tenant_admin')
    )
  );

-- Comments
COMMENT ON TABLE appointment_slots IS 'Stores appointment time slots for each tenant and date';
COMMENT ON COLUMN appointment_slots.slot_date IS 'The date of the slot (YYYY-MM-DD)';
COMMENT ON COLUMN appointment_slots.slot_time IS 'The time of the slot (HH:MM)';
COMMENT ON COLUMN appointment_slots.is_available IS 'Whether the slot is available for booking';
