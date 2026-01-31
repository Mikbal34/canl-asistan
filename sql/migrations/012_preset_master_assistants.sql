-- Migration: 012_preset_master_assistants.sql
-- Purpose: Industry preset'lere MASTER asistan ID'leri ekle
-- Date: 2026-01-29
--
-- Bu migration, her industry preset için tenant'tan bağımsız
-- MASTER asistanları oluşturabilmek için VAPI ID kolonları ekler.
-- Master asistanlar, yeni tenant geldiğinde duplicate edilerek
-- tenant-specific asistanlar oluşturulur.

-- ============================================
-- Master Assistant ID Kolonları
-- ============================================

-- Rename demo columns to master (if they exist)
DO $$
BEGIN
  -- Rename TR column
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'industry_presets' AND column_name = 'vapi_demo_assistant_id_tr') THEN
    ALTER TABLE industry_presets RENAME COLUMN vapi_demo_assistant_id_tr TO vapi_master_assistant_id_tr;
  END IF;

  -- Rename EN column
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'industry_presets' AND column_name = 'vapi_demo_assistant_id_en') THEN
    ALTER TABLE industry_presets RENAME COLUMN vapi_demo_assistant_id_en TO vapi_master_assistant_id_en;
  END IF;

  -- Rename DE column
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'industry_presets' AND column_name = 'vapi_demo_assistant_id_de') THEN
    ALTER TABLE industry_presets RENAME COLUMN vapi_demo_assistant_id_de TO vapi_master_assistant_id_de;
  END IF;
END $$;

-- Add master columns if they don't exist (fresh install case)
ALTER TABLE industry_presets
ADD COLUMN IF NOT EXISTS vapi_master_assistant_id_tr VARCHAR,
ADD COLUMN IF NOT EXISTS vapi_master_assistant_id_en VARCHAR,
ADD COLUMN IF NOT EXISTS vapi_master_assistant_id_de VARCHAR;

-- ============================================
-- Remove demo-specific columns (no longer needed)
-- Master asistanlar placeholder değerler kullanacak
-- ============================================

ALTER TABLE industry_presets
DROP COLUMN IF EXISTS demo_company_name,
DROP COLUMN IF EXISTS demo_phone,
DROP COLUMN IF EXISTS demo_email,
DROP COLUMN IF EXISTS demo_address;

-- ============================================
-- Verification
-- ============================================
-- SELECT industry, vapi_master_assistant_id_tr, vapi_master_assistant_id_en, vapi_master_assistant_id_de
-- FROM industry_presets;
