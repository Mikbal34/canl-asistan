-- Migration 025: Deduplicate call_logs and add UNIQUE constraint on call_id
-- Problem: Same calls are being inserted multiple times (webhook + periodic sync)
-- Result: 1767 rows but only ~26 unique calls

BEGIN;

-- Step 1: Delete duplicates, keeping the best record per call_id
-- Best = has duration_seconds filled, or latest created_at
DELETE FROM call_logs
WHERE id NOT IN (
  SELECT DISTINCT ON (call_id) id
  FROM call_logs
  WHERE call_id IS NOT NULL
  ORDER BY call_id,
    (duration_seconds IS NOT NULL AND duration_seconds > 0) DESC,
    created_at DESC
)
AND call_id IS NOT NULL;

-- Step 2: Add UNIQUE constraint on call_id to prevent future duplicates
ALTER TABLE call_logs ADD CONSTRAINT call_logs_call_id_unique UNIQUE (call_id);

COMMIT;
