-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: assets soft-delete + R2 sync columns
-- Safe to run multiple times (idempotent ALTER TABLE … ADD COLUMN IF NOT EXISTS)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add soft-delete columns ──────────────────────────────────────────────────

ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS deleted_at        TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sync_status       TEXT        DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS missing_in_storage BOOLEAN    DEFAULT FALSE;

-- Ensure is_deleted exists (may have been added by an earlier migration).
ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

-- 2. Back-fill existing soft-deleted rows ─────────────────────────────────────
-- If is_deleted was already set on some rows but deleted_at is NULL, fill now.
UPDATE assets
SET deleted_at = NOW()
WHERE is_deleted = TRUE AND deleted_at IS NULL;

-- 3. Indexes for common query patterns ────────────────────────────────────────

-- Speeds up the default list query that filters out soft-deleted rows.
CREATE INDEX IF NOT EXISTS idx_assets_active
  ON assets (workspace_id, created_at DESC)
  WHERE is_deleted IS NOT TRUE AND deleted_at IS NULL;

-- Speeds up the sync-r2 cron scan.
CREATE INDEX IF NOT EXISTS idx_assets_missing_in_storage
  ON assets (missing_in_storage)
  WHERE is_deleted IS NOT TRUE AND deleted_at IS NULL AND storage_key IS NOT NULL;

-- 4. RLS policies ─────────────────────────────────────────────────────────────
-- Allow the service role (used by API routes) to UPDATE and DELETE any asset.
-- Row-level auth is enforced in the route handler layer.

-- Soft-delete UPDATE policy (sets is_deleted, deleted_at, sync_status)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'assets'
      AND policyname = 'service_role_can_update_assets'
  ) THEN
    CREATE POLICY service_role_can_update_assets
      ON assets
      FOR UPDATE
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END;
$$;

-- Hard-delete DELETE policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'assets'
      AND policyname = 'service_role_can_delete_assets'
  ) THEN
    CREATE POLICY service_role_can_delete_assets
      ON assets
      FOR DELETE
      TO service_role
      USING (true);
  END IF;
END;
$$;
