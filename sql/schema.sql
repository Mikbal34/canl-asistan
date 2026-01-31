-- Otomotiv Sesli Asistan - Supabase Veritabanı Şeması

-- Müşteriler tablosu
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(100),
  email VARCHAR(255),
  preferred_language VARCHAR(10) DEFAULT 'tr',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Araçlar tablosu
CREATE TABLE vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand VARCHAR(50) NOT NULL,
  model VARCHAR(100) NOT NULL,
  year INTEGER,
  color VARCHAR(50),
  price DECIMAL(12,2),
  fuel_type VARCHAR(30),
  transmission VARCHAR(30),
  available_for_test_drive BOOLEAN DEFAULT true,
  stock_count INTEGER DEFAULT 0,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Test sürüşü randevuları tablosu
CREATE TABLE test_drive_appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- pending, confirmed, completed, cancelled
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Servis randevuları tablosu
CREATE TABLE service_appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  vehicle_plate VARCHAR(20),
  vehicle_brand VARCHAR(50),
  vehicle_model VARCHAR(100),
  service_type VARCHAR(50), -- bakim, tamir, lastik, yag_degisimi, etc.
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- pending, confirmed, in_progress, completed, cancelled
  estimated_duration INTEGER, -- dakika cinsinden
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Arama geçmişi tablosu
CREATE TABLE call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  call_sid VARCHAR(100),
  from_number VARCHAR(20),
  to_number VARCHAR(20),
  direction VARCHAR(20), -- inbound, outbound
  duration INTEGER, -- saniye cinsinden
  status VARCHAR(20), -- completed, no-answer, busy, failed
  transcript TEXT,
  summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Müsait zaman slotları tablosu
CREATE TABLE available_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_date DATE NOT NULL,
  slot_time TIME NOT NULL,
  slot_type VARCHAR(30) NOT NULL, -- test_drive, service
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexler
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_vehicles_brand_model ON vehicles(brand, model);
CREATE INDEX idx_test_drive_date ON test_drive_appointments(appointment_date);
CREATE INDEX idx_service_date ON service_appointments(appointment_date);
CREATE INDEX idx_available_slots ON available_slots(slot_date, slot_type, is_available);

-- Örnek araç verileri
INSERT INTO vehicles (brand, model, year, color, price, fuel_type, transmission, available_for_test_drive, stock_count, description) VALUES
('Toyota', 'Corolla', 2024, 'Beyaz', 1250000, 'Benzin', 'Otomatik', true, 5, 'Ekonomik ve güvenilir sedan'),
('Toyota', 'RAV4', 2024, 'Gri', 1850000, 'Hybrid', 'Otomatik', true, 3, 'Geniş aileler için SUV'),
('Honda', 'Civic', 2024, 'Siyah', 1350000, 'Benzin', 'Otomatik', true, 4, 'Sportif tasarım, yüksek performans'),
('Volkswagen', 'Golf', 2024, 'Mavi', 1400000, 'Dizel', 'Manuel', true, 2, 'Kompakt hatchback, ekonomik'),
('BMW', '320i', 2024, 'Beyaz', 2100000, 'Benzin', 'Otomatik', true, 2, 'Premium sedan deneyimi'),
('Mercedes', 'A180', 2024, 'Kırmızı', 1950000, 'Benzin', 'Otomatik', true, 1, 'Lüks kompakt araç');

-- Örnek müsait slotlar (önümüzdeki 7 gün)
DO $$
DECLARE
  d DATE;
  t TIME;
BEGIN
  FOR d IN SELECT generate_series(CURRENT_DATE, CURRENT_DATE + 6, '1 day'::interval)::date LOOP
    FOR t IN SELECT generate_series('09:00'::time, '17:00'::time, '1 hour'::interval)::time LOOP
      INSERT INTO available_slots (slot_date, slot_time, slot_type, is_available) VALUES
      (d, t, 'test_drive', true),
      (d, t, 'service', true);
    END LOOP;
  END LOOP;
END $$;
