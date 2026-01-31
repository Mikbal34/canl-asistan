-- Migration 008: Fix Voice Provider
-- VAPI API icin 'elevenlabs' -> '11labs' duzeltmesi

-- ==========================================
-- INDUSTRY_PRESETS: voice_provider duzelt
-- ==========================================

-- config_tr icindeki voice_provider'i duzelt
UPDATE industry_presets
SET config_tr = jsonb_set(
  config_tr,
  '{voice_provider}',
  '"11labs"'
)
WHERE config_tr->>'voice_provider' = 'elevenlabs';

-- config_en icindeki voice_provider'i duzelt
UPDATE industry_presets
SET config_en = jsonb_set(
  config_en,
  '{voice_provider}',
  '"11labs"'
)
WHERE config_en->>'voice_provider' = 'elevenlabs';

-- config_de icindeki voice_provider'i duzelt
UPDATE industry_presets
SET config_de = jsonb_set(
  config_de,
  '{voice_provider}',
  '"11labs"'
)
WHERE config_de->>'voice_provider' = 'elevenlabs';

-- ==========================================
-- VOICE_PRESETS: provider duzelt
-- ==========================================

UPDATE voice_presets
SET provider = '11labs'
WHERE provider = 'elevenlabs';

-- ==========================================
-- TENANTS: voice_config_override duzelt
-- ==========================================

UPDATE tenants
SET voice_config_override = jsonb_set(
  voice_config_override,
  '{voice_provider}',
  '"11labs"'
)
WHERE voice_config_override->>'voice_provider' = 'elevenlabs';

-- ==========================================
-- DOGRULAMA
-- ==========================================

-- Degisiklikleri dogrula
DO $$
DECLARE
  preset_count INTEGER;
  voice_count INTEGER;
  tenant_count INTEGER;
BEGIN
  -- elevenlabs kalmamis olmali
  SELECT COUNT(*) INTO preset_count
  FROM industry_presets
  WHERE config_tr->>'voice_provider' = 'elevenlabs'
     OR config_en->>'voice_provider' = 'elevenlabs'
     OR config_de->>'voice_provider' = 'elevenlabs';

  SELECT COUNT(*) INTO voice_count
  FROM voice_presets
  WHERE provider = 'elevenlabs';

  SELECT COUNT(*) INTO tenant_count
  FROM tenants
  WHERE voice_config_override->>'voice_provider' = 'elevenlabs';

  IF preset_count > 0 OR voice_count > 0 OR tenant_count > 0 THEN
    RAISE WARNING 'Migration incomplete: % presets, % voices, % tenants still have elevenlabs',
      preset_count, voice_count, tenant_count;
  ELSE
    RAISE NOTICE 'Migration successful: All voice providers updated to 11labs';
  END IF;
END $$;
