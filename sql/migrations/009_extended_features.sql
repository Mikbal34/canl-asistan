-- Migration 009: Extended AI Features
-- Campaigns, Promotion Codes, Loyalty Points, Feedback
-- IDEMPOTENT: Safe to run multiple times

-- ==========================================
-- CAMPAIGNS TABLOSU (Kampanyalar)
-- ==========================================
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Campaign Info
  name VARCHAR(100) NOT NULL,
  description TEXT,

  -- Discount
  discount_type VARCHAR(20) NOT NULL, -- 'percent' | 'fixed'
  discount_value DECIMAL(10,2) NOT NULL,

  -- Validity
  valid_from DATE NOT NULL,
  valid_until DATE NOT NULL,

  -- Conditions (optional)
  min_purchase_amount DECIMAL(10,2),
  applicable_services TEXT[], -- null = all services
  applicable_categories TEXT[], -- null = all categories

  -- Status
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes (IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_campaigns_tenant_id ON campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_active ON campaigns(tenant_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_campaigns_dates ON campaigns(tenant_id, valid_from, valid_until);

-- ==========================================
-- PROMOTION CODES TABLOSU (Indirim Kodlari)
-- ==========================================
CREATE TABLE IF NOT EXISTS promotion_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,

  -- Code Info
  code VARCHAR(20) NOT NULL,
  description TEXT,

  -- Discount (can override campaign or standalone)
  discount_type VARCHAR(20), -- 'percent' | 'fixed' (null = use campaign)
  discount_value DECIMAL(10,2), -- null = use campaign

  -- Usage Limits
  max_uses INTEGER, -- null = unlimited
  current_uses INTEGER DEFAULT 0,
  max_uses_per_customer INTEGER DEFAULT 1,

  -- Validity
  valid_from DATE,
  valid_until DATE,

  -- Status
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Code unique per tenant
  UNIQUE(tenant_id, code)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_promotion_codes_tenant_id ON promotion_codes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_promotion_codes_code ON promotion_codes(tenant_id, code);
CREATE INDEX IF NOT EXISTS idx_promotion_codes_active ON promotion_codes(tenant_id, is_active) WHERE is_active = true;

-- ==========================================
-- PROMOTION CODE USAGE TABLOSU
-- ==========================================
CREATE TABLE IF NOT EXISTS promotion_code_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_code_id UUID NOT NULL REFERENCES promotion_codes(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  appointment_id UUID, -- Can reference any appointment type
  appointment_type VARCHAR(20), -- 'test_drive', 'service', 'beauty'

  -- Discount Applied
  discount_amount DECIMAL(10,2),

  -- Timestamp
  used_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_promotion_code_usage_code ON promotion_code_usage(promotion_code_id);
CREATE INDEX IF NOT EXISTS idx_promotion_code_usage_customer ON promotion_code_usage(customer_id);

-- ==========================================
-- LOYALTY POINTS TABLOSU (Sadakat Puanlari)
-- ==========================================
CREATE TABLE IF NOT EXISTS loyalty_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  -- Points
  points INTEGER DEFAULT 0,

  -- Tier
  tier VARCHAR(20) DEFAULT 'bronze', -- 'bronze', 'silver', 'gold', 'platinum'

  -- Statistics
  total_earned INTEGER DEFAULT 0,
  total_redeemed INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- One loyalty record per customer per tenant
  UNIQUE(tenant_id, customer_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_loyalty_points_tenant_id ON loyalty_points(tenant_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_points_customer_id ON loyalty_points(customer_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_points_tier ON loyalty_points(tenant_id, tier);

-- ==========================================
-- LOYALTY TRANSACTIONS TABLOSU
-- ==========================================
CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loyalty_id UUID NOT NULL REFERENCES loyalty_points(id) ON DELETE CASCADE,

  -- Transaction
  points INTEGER NOT NULL, -- + earned, - redeemed
  reason VARCHAR(100) NOT NULL,

  -- Reference
  appointment_id UUID,
  appointment_type VARCHAR(20),

  -- Balance after transaction
  balance_after INTEGER,

  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_loyalty ON loyalty_transactions(loyalty_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_date ON loyalty_transactions(loyalty_id, created_at DESC);

-- ==========================================
-- FEEDBACK TABLOSU (Geri Bildirimler)
-- ==========================================
CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,

  -- Reference (optional)
  appointment_id UUID,
  appointment_type VARCHAR(20), -- 'test_drive', 'service', 'beauty'

  -- Feedback
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  message TEXT,
  feedback_type VARCHAR(20) NOT NULL, -- 'complaint', 'suggestion', 'praise', 'general'

  -- Contact Info (if customer not found)
  contact_phone VARCHAR(20),
  contact_name VARCHAR(100),

  -- Status
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'in_review', 'resolved', 'closed'
  resolution_notes TEXT,
  resolved_by UUID REFERENCES users(id),
  resolved_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_feedback_tenant_id ON feedback(tenant_id);
CREATE INDEX IF NOT EXISTS idx_feedback_customer_id ON feedback(customer_id);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_feedback_type ON feedback(tenant_id, feedback_type);
CREATE INDEX IF NOT EXISTS idx_feedback_date ON feedback(tenant_id, created_at DESC);

-- ==========================================
-- WORKING HOURS TABLOSU
-- ==========================================
CREATE TABLE IF NOT EXISTS working_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Day of week (0=Sunday, 1=Monday, ..., 6=Saturday)
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),

  -- Hours
  open_time TIME NOT NULL,
  close_time TIME NOT NULL,

  -- Break time (optional)
  break_start TIME,
  break_end TIME,

  -- Status
  is_open BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- One record per day per tenant
  UNIQUE(tenant_id, day_of_week)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_working_hours_tenant_id ON working_hours(tenant_id);

-- ==========================================
-- SPECIAL DAYS TABLOSU (Ozel Gunler - Tatiller, Kapalı Gunler)
-- ==========================================
CREATE TABLE IF NOT EXISTS special_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Date
  date DATE NOT NULL,

  -- Type
  type VARCHAR(20) NOT NULL, -- 'closed', 'holiday', 'special_hours'
  reason VARCHAR(255),

  -- Special hours (if type = 'special_hours')
  open_time TIME,
  close_time TIME,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- One record per date per tenant
  UNIQUE(tenant_id, date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_special_days_tenant_id ON special_days(tenant_id);
CREATE INDEX IF NOT EXISTS idx_special_days_date ON special_days(tenant_id, date);

-- ==========================================
-- LOYALTY SETTINGS TABLOSU
-- ==========================================
CREATE TABLE IF NOT EXISTS loyalty_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Point Earning
  points_per_currency DECIMAL(10,4) DEFAULT 1, -- 1 TRY = 1 point
  points_per_appointment INTEGER DEFAULT 10, -- Bonus points per appointment

  -- Tier Thresholds
  silver_threshold INTEGER DEFAULT 500,
  gold_threshold INTEGER DEFAULT 1000,
  platinum_threshold INTEGER DEFAULT 2000,

  -- Redemption
  points_to_currency DECIMAL(10,4) DEFAULT 0.1, -- 100 points = 10 TRY
  min_redemption_points INTEGER DEFAULT 100,

  -- Status
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- One setting per tenant
  UNIQUE(tenant_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_loyalty_settings_tenant_id ON loyalty_settings(tenant_id);

-- ==========================================
-- RLS Policies (with DROP IF EXISTS pattern)
-- ==========================================

-- Enable RLS
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotion_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotion_code_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE working_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE special_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_settings ENABLE ROW LEVEL SECURITY;

-- Campaigns
DROP POLICY IF EXISTS "Users can view their tenant campaigns" ON campaigns;
CREATE POLICY "Users can view their tenant campaigns" ON campaigns
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE auth_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM users WHERE auth_user_id = auth.uid() AND role = 'super_admin')
  );

DROP POLICY IF EXISTS "Tenant admins can manage campaigns" ON campaigns;
CREATE POLICY "Tenant admins can manage campaigns" ON campaigns
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE auth_user_id = auth.uid() AND role IN ('tenant_admin', 'super_admin'))
  );

-- Promotion Codes
DROP POLICY IF EXISTS "Users can view their tenant promo codes" ON promotion_codes;
CREATE POLICY "Users can view their tenant promo codes" ON promotion_codes
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE auth_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM users WHERE auth_user_id = auth.uid() AND role = 'super_admin')
  );

DROP POLICY IF EXISTS "Tenant admins can manage promo codes" ON promotion_codes;
CREATE POLICY "Tenant admins can manage promo codes" ON promotion_codes
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE auth_user_id = auth.uid() AND role IN ('tenant_admin', 'super_admin'))
  );

-- Loyalty Points
DROP POLICY IF EXISTS "Users can view their tenant loyalty points" ON loyalty_points;
CREATE POLICY "Users can view their tenant loyalty points" ON loyalty_points
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE auth_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM users WHERE auth_user_id = auth.uid() AND role = 'super_admin')
  );

DROP POLICY IF EXISTS "Tenant users can manage loyalty points" ON loyalty_points;
CREATE POLICY "Tenant users can manage loyalty points" ON loyalty_points
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE auth_user_id = auth.uid())
  );

-- Feedback
DROP POLICY IF EXISTS "Users can view their tenant feedback" ON feedback;
CREATE POLICY "Users can view their tenant feedback" ON feedback
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE auth_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM users WHERE auth_user_id = auth.uid() AND role = 'super_admin')
  );

DROP POLICY IF EXISTS "Tenant users can manage feedback" ON feedback;
CREATE POLICY "Tenant users can manage feedback" ON feedback
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE auth_user_id = auth.uid())
  );

-- Working Hours
DROP POLICY IF EXISTS "Users can view their tenant working hours" ON working_hours;
CREATE POLICY "Users can view their tenant working hours" ON working_hours
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE auth_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM users WHERE auth_user_id = auth.uid() AND role = 'super_admin')
  );

DROP POLICY IF EXISTS "Tenant admins can manage working hours" ON working_hours;
CREATE POLICY "Tenant admins can manage working hours" ON working_hours
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE auth_user_id = auth.uid() AND role IN ('tenant_admin', 'super_admin'))
  );

-- Special Days
DROP POLICY IF EXISTS "Users can view their tenant special days" ON special_days;
CREATE POLICY "Users can view their tenant special days" ON special_days
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE auth_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM users WHERE auth_user_id = auth.uid() AND role = 'super_admin')
  );

DROP POLICY IF EXISTS "Tenant admins can manage special days" ON special_days;
CREATE POLICY "Tenant admins can manage special days" ON special_days
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE auth_user_id = auth.uid() AND role IN ('tenant_admin', 'super_admin'))
  );

-- Loyalty Settings
DROP POLICY IF EXISTS "Users can view their tenant loyalty settings" ON loyalty_settings;
CREATE POLICY "Users can view their tenant loyalty settings" ON loyalty_settings
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE auth_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM users WHERE auth_user_id = auth.uid() AND role = 'super_admin')
  );

DROP POLICY IF EXISTS "Tenant admins can manage loyalty settings" ON loyalty_settings;
CREATE POLICY "Tenant admins can manage loyalty settings" ON loyalty_settings
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE auth_user_id = auth.uid() AND role IN ('tenant_admin', 'super_admin'))
  );

-- ==========================================
-- TRIGGERS (DROP IF EXISTS pattern)
-- ==========================================

DROP TRIGGER IF EXISTS update_campaigns_updated_at ON campaigns;
CREATE TRIGGER update_campaigns_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_promotion_codes_updated_at ON promotion_codes;
CREATE TRIGGER update_promotion_codes_updated_at
  BEFORE UPDATE ON promotion_codes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_loyalty_points_updated_at ON loyalty_points;
CREATE TRIGGER update_loyalty_points_updated_at
  BEFORE UPDATE ON loyalty_points
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_feedback_updated_at ON feedback;
CREATE TRIGGER update_feedback_updated_at
  BEFORE UPDATE ON feedback
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_working_hours_updated_at ON working_hours;
CREATE TRIGGER update_working_hours_updated_at
  BEFORE UPDATE ON working_hours
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_loyalty_settings_updated_at ON loyalty_settings;
CREATE TRIGGER update_loyalty_settings_updated_at
  BEFORE UPDATE ON loyalty_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- HELPER FUNCTION: Create Default Working Hours
-- ==========================================
CREATE OR REPLACE FUNCTION create_default_working_hours(p_tenant_id UUID)
RETURNS void AS $$
BEGIN
  -- Monday to Friday: 09:00 - 18:00
  INSERT INTO working_hours (tenant_id, day_of_week, open_time, close_time, is_open) VALUES
  (p_tenant_id, 1, '09:00', '18:00', true), -- Monday
  (p_tenant_id, 2, '09:00', '18:00', true), -- Tuesday
  (p_tenant_id, 3, '09:00', '18:00', true), -- Wednesday
  (p_tenant_id, 4, '09:00', '18:00', true), -- Thursday
  (p_tenant_id, 5, '09:00', '18:00', true), -- Friday
  (p_tenant_id, 6, '10:00', '16:00', true), -- Saturday
  (p_tenant_id, 0, '00:00', '00:00', false) -- Sunday (closed)
  ON CONFLICT (tenant_id, day_of_week) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- HELPER FUNCTION: Create Default Loyalty Settings
-- ==========================================
CREATE OR REPLACE FUNCTION create_default_loyalty_settings(p_tenant_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO loyalty_settings (
    tenant_id,
    points_per_currency,
    points_per_appointment,
    silver_threshold,
    gold_threshold,
    platinum_threshold,
    points_to_currency,
    min_redemption_points,
    is_active
  ) VALUES (
    p_tenant_id,
    1,      -- 1 TRY = 1 point
    10,     -- 10 bonus points per appointment
    500,    -- Silver at 500 points
    1000,   -- Gold at 1000 points
    2000,   -- Platinum at 2000 points
    0.1,    -- 100 points = 10 TRY
    100,    -- Min 100 points to redeem
    true
  ) ON CONFLICT (tenant_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- HELPER FUNCTION: Update Loyalty Tier
-- ==========================================
CREATE OR REPLACE FUNCTION update_loyalty_tier()
RETURNS TRIGGER AS $$
DECLARE
  settings loyalty_settings%ROWTYPE;
BEGIN
  -- Get tenant's loyalty settings
  SELECT * INTO settings FROM loyalty_settings WHERE tenant_id = (
    SELECT tenant_id FROM loyalty_points WHERE id = NEW.id
  );

  -- Update tier based on total_earned
  IF NEW.total_earned >= COALESCE(settings.platinum_threshold, 2000) THEN
    NEW.tier := 'platinum';
  ELSIF NEW.total_earned >= COALESCE(settings.gold_threshold, 1000) THEN
    NEW.tier := 'gold';
  ELSIF NEW.total_earned >= COALESCE(settings.silver_threshold, 500) THEN
    NEW.tier := 'silver';
  ELSE
    NEW.tier := 'bronze';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_update_loyalty_tier ON loyalty_points;
CREATE TRIGGER auto_update_loyalty_tier
  BEFORE UPDATE ON loyalty_points
  FOR EACH ROW
  WHEN (OLD.total_earned IS DISTINCT FROM NEW.total_earned)
  EXECUTE FUNCTION update_loyalty_tier();

-- ==========================================
-- HELPER FUNCTION: Increment Promo Code Usage
-- ==========================================
CREATE OR REPLACE FUNCTION increment_promo_code_usage()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE promotion_codes
  SET current_uses = current_uses + 1
  WHERE id = NEW.promotion_code_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_increment_promo_usage ON promotion_code_usage;
CREATE TRIGGER auto_increment_promo_usage
  AFTER INSERT ON promotion_code_usage
  FOR EACH ROW
  EXECUTE FUNCTION increment_promo_code_usage();
