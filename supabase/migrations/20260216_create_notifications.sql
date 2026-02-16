-- Notifications table for in-app real-time notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('appointment_created', 'appointment_cancelled', 'appointment_updated', 'customer_created', 'call_completed')),
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_notifications_tenant_id ON notifications(tenant_id);
CREATE INDEX idx_notifications_tenant_unread ON notifications(tenant_id, is_read) WHERE is_read = false;
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX idx_notifications_tenant_type ON notifications(tenant_id, type);

-- RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- SELECT: Realtime-uyumlu (channel filter tenant izolasyonu saglar)
CREATE POLICY "Allow select for realtime" ON notifications FOR SELECT USING (true);

-- UPDATE: Tenant kullanicilari kendi bildirimlerini okundu isaretleyebilir
CREATE POLICY "Tenant users can update own notifications"
  ON notifications FOR UPDATE
  USING (tenant_id IN (
    SELECT tenant_id FROM users WHERE auth_user_id = auth.uid()
  ));

-- INSERT: Sadece service_role (backend)
CREATE POLICY "Service role insert" ON notifications FOR INSERT WITH CHECK (true);

-- Enable Supabase Realtime for notifications table
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
