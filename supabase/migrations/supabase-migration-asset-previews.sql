-- ============================================================
-- OPENY OS — Asset Previews Migration
-- ============================================================
-- Adds columns needed for the file-preview enhancement system:
--   duration_seconds  — video duration in seconds
--   preview_status    — tracks preview generation state
--
-- Safe to run multiple times (ADD COLUMN IF NOT EXISTS).
-- ============================================================

ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS duration_seconds NUMERIC,
  ADD COLUMN IF NOT EXISTS preview_status   TEXT;

-- Optional constraint to keep preview_status values consistent.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   information_schema.table_constraints
    WHERE  table_schema = 'public'
      AND  table_name   = 'assets'
      AND  constraint_name = 'assets_preview_status_check'
  ) THEN
    ALTER TABLE public.assets
      ADD CONSTRAINT assets_preview_status_check
      CHECK (preview_status IS NULL OR preview_status IN (
        'pending', 'generating', 'ready', 'failed'
      ));
  END IF;
END $$;

DO $$
BEGIN
  RAISE NOTICE 'Asset previews migration complete: duration_seconds, preview_status added.';
END $$;
