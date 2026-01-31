-- Migration 002: Güzellik sektörü tabloları
-- Beauty Services, Beauty Appointments

-- ==========================================
-- BEAUTY SERVICES TABLOSU
-- ==========================================
CREATE TABLE IF NOT EXISTS beauty_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Service Info
  name VARCHAR(255) NOT NULL,
  name_en VARCHAR(255),
  name_de VARCHAR(255),
  description TEXT,

  -- Category
  category VARCHAR(50) NOT NULL, -- 'hair', 'nails', 'skin', 'makeup', 'other'

  -- Duration & Pricing
  duration_minutes INTEGER DEFAULT 30,
  price DECIMAL(10,2),
  currency VARCHAR(3) DEFAULT 'TRY', -- 'TRY', 'EUR', 'USD'

  -- Display
  display_order INTEGER DEFAULT 0,
  icon VARCHAR(50),

  -- Status
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_beauty_services_tenant_id ON beauty_services(tenant_id);
CREATE INDEX idx_beauty_services_category ON beauty_services(category);
CREATE INDEX idx_beauty_services_active ON beauty_services(tenant_id, is_active);

-- ==========================================
-- BEAUTY APPOINTMENTS TABLOSU
-- ==========================================
CREATE TABLE IF NOT EXISTS beauty_appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  service_id UUID REFERENCES beauty_services(id) ON DELETE SET NULL,

  -- Appointment Details
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  duration_minutes INTEGER, -- Override service duration if needed

  -- Status
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'

  -- Optional Staff Assignment
  staff_name VARCHAR(100),

  -- Notes
  notes TEXT,
  cancellation_reason TEXT,

  -- Pricing (captured at booking time)
  price_at_booking DECIMAL(10,2),
  currency VARCHAR(3) DEFAULT 'TRY',

  -- Reminder
  reminder_sent BOOLEAN DEFAULT false,
  reminder_sent_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_beauty_appointments_tenant_id ON beauty_appointments(tenant_id);
CREATE INDEX idx_beauty_appointments_customer_id ON beauty_appointments(customer_id);
CREATE INDEX idx_beauty_appointments_date ON beauty_appointments(tenant_id, appointment_date);
CREATE INDEX idx_beauty_appointments_status ON beauty_appointments(tenant_id, status);
CREATE INDEX idx_beauty_appointments_upcoming ON beauty_appointments(tenant_id, appointment_date, appointment_time)
  WHERE status IN ('pending', 'confirmed');

-- ==========================================
-- STAFF MEMBERS TABLOSU (Opsiyonel)
-- ==========================================
CREATE TABLE IF NOT EXISTS staff_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Staff Info
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(255),

  -- Specialization
  specializations TEXT[], -- Array of service categories they can do

  -- Availability (JSON: {"monday": ["09:00-12:00", "14:00-18:00"], ...})
  working_hours JSONB DEFAULT '{}',

  -- Status
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_staff_members_tenant_id ON staff_members(tenant_id);

-- ==========================================
-- DEFAULT BEAUTY SERVICES (Template)
-- ==========================================

-- Not: Bu veriler her yeni tenant oluşturulduğunda kopyalanacak
-- Örnek hizmetler (tenant oluşturulduğunda eklenecek)
-- Burada sadece referans olarak bırakıyorum

/*
Sample services to be created for new beauty tenants:

Hair:
- Kadın Saç Kesimi (Women's Haircut) - 45 min - 250 TRY
- Erkek Saç Kesimi (Men's Haircut) - 30 min - 100 TRY
- Saç Boyama (Hair Coloring) - 90 min - 500 TRY
- Röfle (Highlights) - 120 min - 600 TRY
- Saç Bakımı (Hair Treatment) - 60 min - 400 TRY
- Keratin Bakımı (Keratin Treatment) - 120 min - 1500 TRY
- Fön (Blow Dry) - 30 min - 150 TRY

Nails:
- Manikür (Manicure) - 45 min - 200 TRY
- Pedikür (Pedicure) - 60 min - 250 TRY
- Kalıcı Oje (Gel Polish) - 60 min - 300 TRY
- Protez Tırnak (Acrylic Nails) - 90 min - 500 TRY

Skin:
- Cilt Bakımı (Facial) - 60 min - 400 TRY
- Cilt Temizliği (Deep Cleansing) - 45 min - 300 TRY
- Anti-Aging Bakım - 75 min - 600 TRY

Makeup:
- Günlük Makyaj (Day Makeup) - 45 min - 300 TRY
- Gelin Makyajı (Bridal Makeup) - 90 min - 1500 TRY
- Özel Gün Makyajı (Special Occasion) - 60 min - 500 TRY

Other:
- Kaş Şekillendirme (Eyebrow Shaping) - 15 min - 100 TRY
- Kirpik Lifting - 60 min - 400 TRY
- İpek Kirpik - 90 min - 800 TRY
*/

-- ==========================================
-- RLS Policies
-- ==========================================

ALTER TABLE beauty_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE beauty_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_members ENABLE ROW LEVEL SECURITY;

-- Beauty Services: Tenant users can see their services
CREATE POLICY "Users can view their tenant services" ON beauty_services
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE auth_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM users WHERE auth_user_id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "Tenant admins can manage services" ON beauty_services
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE auth_user_id = auth.uid() AND role IN ('tenant_admin', 'super_admin'))
  );

-- Beauty Appointments: Tenant users can see their appointments
CREATE POLICY "Users can view their tenant appointments" ON beauty_appointments
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE auth_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM users WHERE auth_user_id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "Tenant users can manage appointments" ON beauty_appointments
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE auth_user_id = auth.uid())
  );

-- Staff Members: Tenant admins can manage staff
CREATE POLICY "Users can view their tenant staff" ON staff_members
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE auth_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM users WHERE auth_user_id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "Tenant admins can manage staff" ON staff_members
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE auth_user_id = auth.uid() AND role IN ('tenant_admin', 'super_admin'))
  );

-- ==========================================
-- TRIGGERS
-- ==========================================

CREATE TRIGGER update_beauty_services_updated_at
  BEFORE UPDATE ON beauty_services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_beauty_appointments_updated_at
  BEFORE UPDATE ON beauty_appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_staff_members_updated_at
  BEFORE UPDATE ON staff_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- HELPER FUNCTION: Create Default Services for New Beauty Tenant
-- ==========================================

CREATE OR REPLACE FUNCTION create_default_beauty_services(p_tenant_id UUID)
RETURNS void AS $$
BEGIN
  -- Hair services
  INSERT INTO beauty_services (tenant_id, name, name_en, name_de, category, duration_minutes, price, display_order) VALUES
  (p_tenant_id, 'Kadın Saç Kesimi', 'Women''s Haircut', 'Damen Haarschnitt', 'hair', 45, 250, 1),
  (p_tenant_id, 'Erkek Saç Kesimi', 'Men''s Haircut', 'Herren Haarschnitt', 'hair', 30, 100, 2),
  (p_tenant_id, 'Saç Boyama', 'Hair Coloring', 'Haarfärbung', 'hair', 90, 500, 3),
  (p_tenant_id, 'Röfle', 'Highlights', 'Strähnchen', 'hair', 120, 600, 4),
  (p_tenant_id, 'Saç Bakımı', 'Hair Treatment', 'Haarbehandlung', 'hair', 60, 400, 5),
  (p_tenant_id, 'Fön', 'Blow Dry', 'Föhnen', 'hair', 30, 150, 6);

  -- Nail services
  INSERT INTO beauty_services (tenant_id, name, name_en, name_de, category, duration_minutes, price, display_order) VALUES
  (p_tenant_id, 'Manikür', 'Manicure', 'Maniküre', 'nails', 45, 200, 10),
  (p_tenant_id, 'Pedikür', 'Pedicure', 'Pediküre', 'nails', 60, 250, 11),
  (p_tenant_id, 'Kalıcı Oje', 'Gel Polish', 'Gel-Lack', 'nails', 60, 300, 12);

  -- Skin services
  INSERT INTO beauty_services (tenant_id, name, name_en, name_de, category, duration_minutes, price, display_order) VALUES
  (p_tenant_id, 'Cilt Bakımı', 'Facial', 'Gesichtsbehandlung', 'skin', 60, 400, 20),
  (p_tenant_id, 'Cilt Temizliği', 'Deep Cleansing', 'Tiefenreinigung', 'skin', 45, 300, 21);

  -- Makeup services
  INSERT INTO beauty_services (tenant_id, name, name_en, name_de, category, duration_minutes, price, display_order) VALUES
  (p_tenant_id, 'Günlük Makyaj', 'Day Makeup', 'Tages-Make-up', 'makeup', 45, 300, 30),
  (p_tenant_id, 'Gelin Makyajı', 'Bridal Makeup', 'Braut-Make-up', 'makeup', 90, 1500, 31);

  -- Other services
  INSERT INTO beauty_services (tenant_id, name, name_en, name_de, category, duration_minutes, price, display_order) VALUES
  (p_tenant_id, 'Kaş Şekillendirme', 'Eyebrow Shaping', 'Augenbrauen-Styling', 'other', 15, 100, 40),
  (p_tenant_id, 'Kirpik Lifting', 'Lash Lift', 'Wimpernlifting', 'other', 60, 400, 41);
END;
$$ LANGUAGE plpgsql;
