-- ============================================================
-- OPENY OS — Upload State Migration
-- ============================================================
-- Adds upload_state tracking to the assets table so the system
-- can distinguish between uploading / completed / partial_success.
--
-- Safe to run multiple times (uses IF NOT EXISTS / IF EXISTS).
-- ============================================================

-- ── 1. Upload state column ────────────────────────────────────────────────────
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS upload_state TEXT DEFAULT 'completed';

-- Allowed values:
--   uploading       – file is currently being uploaded (transient)
--   completed       – Drive upload + DB save both succeeded
--   partial_success – Drive upload succeeded but DB save failed
--   failed_upload   – Drive upload itself failed
--   failed_db_save  – Drive upload succeeded, DB save failed and could not reconcile
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   information_schema.table_constraints
    WHERE  table_schema = 'public'
      AND  table_name   = 'assets'
      AND  constraint_name = 'assets_upload_state_check'
  ) THEN
    ALTER TABLE public.assets
      ADD CONSTRAINT assets_upload_state_check
      CHECK (upload_state IS NULL OR upload_state IN (
        'uploading', 'completed', 'partial_success', 'failed_upload', 'failed_db_save'
      ));
  END IF;
END $$;

-- ── 2. Backfill existing rows ─────────────────────────────────────────────────
-- Any asset already in the DB without an upload_state was successfully uploaded,
-- so treat it as completed.
UPDATE public.assets
SET    upload_state = 'completed'
WHERE  upload_state IS NULL;

-- ── 3. last_synced_at (already added by bidirectional-sync migration) ─────────
-- Repeated here as a safety net in case that migration was not applied.
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS assets_upload_state_idx ON public.assets (upload_state);
