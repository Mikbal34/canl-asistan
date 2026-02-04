-- Migration 018: Onboarding Agent Sessions
-- LLM tabanlı müşteri kurulum chat oturumları

-- =====================================================
-- ONBOARDING AGENT SESSIONS TABLE
-- Chat ile yeni tenant oluşturma oturumları
-- =====================================================
CREATE TABLE IF NOT EXISTS onboarding_agent_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  current_step VARCHAR(50) DEFAULT 'industry',
  collected_data JSONB DEFAULT '{}',
  conversation_history JSONB DEFAULT '[]',
  created_by UUID REFERENCES users(id),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled', 'expired')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 minutes')
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_onboarding_sessions_status ON onboarding_agent_sessions(status);
CREATE INDEX IF NOT EXISTS idx_onboarding_sessions_created_by ON onboarding_agent_sessions(created_by);
CREATE INDEX IF NOT EXISTS idx_onboarding_sessions_expires ON onboarding_agent_sessions(expires_at);

-- =====================================================
-- TRIGGER: Update updated_at on session changes
-- =====================================================
CREATE OR REPLACE FUNCTION update_onboarding_session_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_onboarding_agent_session_updated_at ON onboarding_agent_sessions;
CREATE TRIGGER update_onboarding_agent_session_updated_at
  BEFORE UPDATE ON onboarding_agent_sessions
  FOR EACH ROW EXECUTE FUNCTION update_onboarding_session_updated_at();

-- =====================================================
-- FUNCTION: Cleanup expired sessions
-- =====================================================
CREATE OR REPLACE FUNCTION cleanup_expired_onboarding_sessions()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  UPDATE onboarding_agent_sessions
  SET status = 'expired'
  WHERE status = 'active' AND expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- COMMENTS for documentation
-- =====================================================
COMMENT ON TABLE onboarding_agent_sessions IS 'LLM chat oturumları ile yeni tenant oluşturma';
COMMENT ON COLUMN onboarding_agent_sessions.current_step IS 'Mevcut adım: industry, company_info, assistant, services, working_hours, staff, password, summary';
COMMENT ON COLUMN onboarding_agent_sessions.collected_data IS 'Toplanan bilgiler (industry, name, phone, email, assistantName, services, workingHours, staff, password)';
COMMENT ON COLUMN onboarding_agent_sessions.conversation_history IS 'Chat mesaj geçmişi [{role, content, timestamp}]';
COMMENT ON COLUMN onboarding_agent_sessions.status IS 'Oturum durumu: active, completed, cancelled, expired';
