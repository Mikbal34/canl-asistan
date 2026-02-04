-- Migration 020: Clean up redundant fields
-- Remove tenants.selected_template_id as it duplicates tenant_assistant_template.template_id

-- =====================================================
-- STEP 1: Ensure all data is properly migrated
-- Copy any orphaned selected_template_id values to tenant_assistant_template
-- =====================================================
INSERT INTO tenant_assistant_template (tenant_id, template_id, selected_at, updated_at)
SELECT
  t.id AS tenant_id,
  t.selected_template_id AS template_id,
  NOW() AS selected_at,
  NOW() AS updated_at
FROM tenants t
WHERE t.selected_template_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM tenant_assistant_template tat
    WHERE tat.tenant_id = t.id
  )
ON CONFLICT (tenant_id) DO NOTHING;

-- =====================================================
-- STEP 2: Create a view for backward compatibility
-- This allows code that reads selected_template_id to still work
-- =====================================================
CREATE OR REPLACE VIEW tenant_template_view AS
SELECT
  t.*,
  COALESCE(tat.template_id, t.selected_template_id) AS effective_template_id,
  tat.added_use_cases,
  tat.removed_use_cases,
  tat.selected_at AS template_selected_at
FROM tenants t
LEFT JOIN tenant_assistant_template tat ON tat.tenant_id = t.id;

-- =====================================================
-- STEP 3: Create helper function to get template_id
-- This should be used instead of reading selected_template_id directly
-- =====================================================
CREATE OR REPLACE FUNCTION get_tenant_template_id(p_tenant_id UUID)
RETURNS VARCHAR(50) AS $$
DECLARE
  v_template_id VARCHAR(50);
BEGIN
  -- First try tenant_assistant_template (authoritative source)
  SELECT template_id INTO v_template_id
  FROM tenant_assistant_template
  WHERE tenant_id = p_tenant_id;

  -- Fallback to tenants.selected_template_id if not found
  IF v_template_id IS NULL THEN
    SELECT selected_template_id INTO v_template_id
    FROM tenants
    WHERE id = p_tenant_id;
  END IF;

  RETURN v_template_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- STEP 4: Update assign_template_to_tenant function
-- Remove the tenants.selected_template_id update
-- =====================================================
CREATE OR REPLACE FUNCTION assign_template_to_tenant(
  p_tenant_id UUID,
  p_template_id VARCHAR(50)
)
RETURNS void AS $$
BEGIN
  -- Insert or update tenant_assistant_template (single source of truth)
  INSERT INTO tenant_assistant_template (tenant_id, template_id, added_use_cases, removed_use_cases, selected_at, updated_at)
  VALUES (p_tenant_id, p_template_id, ARRAY[]::TEXT[], ARRAY[]::TEXT[], NOW(), NOW())
  ON CONFLICT (tenant_id) DO UPDATE SET
    template_id = p_template_id,
    added_use_cases = ARRAY[]::TEXT[],
    removed_use_cases = ARRAY[]::TEXT[],
    selected_at = NOW(),
    updated_at = NOW();

  -- Sync use cases: Clear existing and add template use cases
  DELETE FROM tenant_use_cases WHERE tenant_id = p_tenant_id;

  INSERT INTO tenant_use_cases (tenant_id, use_case_id, enabled)
  SELECT p_tenant_id, unnest(included_use_cases), true
  FROM assistant_templates
  WHERE id = p_template_id;

  -- Note: No longer updating tenants.selected_template_id
  -- tenant_assistant_template is now the single source of truth
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- STEP 5: Add deprecation comment to the column
-- We keep the column for now but mark it as deprecated
-- =====================================================
COMMENT ON COLUMN tenants.selected_template_id IS
  'DEPRECATED: Use tenant_assistant_template.template_id instead. This column will be removed in a future migration.';

-- =====================================================
-- OPTIONAL STEP 6: Actually drop the column
-- Uncomment this when you're sure all code has been updated
-- =====================================================
-- ALTER TABLE tenants DROP COLUMN IF EXISTS selected_template_id;

-- =====================================================
-- COMMENTS for documentation
-- =====================================================
COMMENT ON VIEW tenant_template_view IS 'Unified view of tenant with template info - use this for queries';
COMMENT ON FUNCTION get_tenant_template_id(UUID) IS 'Get template ID for a tenant from authoritative source';
