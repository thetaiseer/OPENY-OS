-- ============================================================
-- OPENY OS — R2 Clean Migration
-- ============================================================
-- Purpose:
--   1. Delete all existing data (full reset).
--   2. Drop Google Drive-specific columns.
--   3. Ensure the assets table has the minimal clean schema
--      required for Cloudflare R2 as the sole storage provider.
--
-- Run this ONCE in the Supabase SQL Editor after deploying
-- the application code that removes all Google Drive logic.
--
-- WARNING: This is DESTRUCTIVE. All rows in the tables below
--          will be permanently deleted.
-- ============================================================

-- ── 1. Delete all data ────────────────────────────────────────────────────────

-- Disable RLS temporarily so the service role can truncate freely.
-- (Supabase service role bypasses RLS by default, but CASCADE
--  requires FK awareness — TRUNCATE handles this cleanly.)

TRUNCATE TABLE
  activities,
  approvals,
  assets,
  clients,
  content_items,
  tasks
CASCADE;

-- ── 2. Drop Google Drive columns ──────────────────────────────────────────────

-- assets table — remove Drive-specific columns
ALTER TABLE assets
  DROP COLUMN IF EXISTS drive_file_id,
  DROP COLUMN IF EXISTS drive_folder_id,
  DROP COLUMN IF EXISTS original_filename,
  DROP COLUMN IF EXISTS last_synced_at,
  DROP COLUMN IF EXISTS source_updated_at,
  DROP COLUMN IF EXISTS upload_state,
  DROP COLUMN IF EXISTS version_number,
  DROP COLUMN IF EXISTS parent_asset_id,
  DROP COLUMN IF EXISTS is_deleted;

-- clients table — remove Drive folder reference
ALTER TABLE clients
  DROP COLUMN IF EXISTS drive_folder_id;

-- tasks table — remove Drive folder link
ALTER TABLE tasks
  DROP COLUMN IF EXISTS linked_drive_folder_id;

-- ── 3. Ensure clean assets schema ─────────────────────────────────────────────

-- Make sure the R2-native columns exist (idempotent).

ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS file_path        TEXT,
  ADD COLUMN IF NOT EXISTS storage_provider TEXT DEFAULT 'r2',
  ADD COLUMN IF NOT EXISTS bucket_name      TEXT,
  ADD COLUMN IF NOT EXISTS mime_type        TEXT;

-- ── 4. Drop Drive-related tables/migration artefacts ─────────────────────────

-- sync_logs table (Drive sync logs) — drop if it exists
DROP TABLE IF EXISTS sync_logs CASCADE;

-- google_oauth_tokens table — drop if it exists
DROP TABLE IF EXISTS google_oauth_tokens CASCADE;

-- ── 5. Confirm ────────────────────────────────────────────────────────────────

DO $$
BEGIN
  RAISE NOTICE 'R2 clean migration complete. Google Drive columns removed, all data reset.';
END $$;
