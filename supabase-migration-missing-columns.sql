-- ============================================================
-- OPENY OS — Missing Columns Comprehensive Migration
-- ============================================================
-- Adds every column that the upload flow and asset renderer
-- expect but that may not exist if previous incremental
-- migrations were not applied.
--
-- ALL statements use ADD COLUMN IF NOT EXISTS so this file is
-- safe to run multiple times and against any schema version.
-- ============================================================

-- ── 1. Google Drive core columns ─────────────────────────────────────────────
-- Added by supabase-migration-google-drive.sql / supabase-migration-drive-schema-v2.sql
-- Repeated here as a safety net.
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS view_url         TEXT,
  ADD COLUMN IF NOT EXISTS download_url     TEXT,
  ADD COLUMN IF NOT EXISTS drive_file_id    TEXT,
  ADD COLUMN IF NOT EXISTS drive_folder_id  TEXT;

-- storage_provider defaults to 'supabase' to keep old rows valid.
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS storage_provider TEXT NOT NULL DEFAULT 'supabase';

-- ── 2. Drive folder / content organisation columns ───────────────────────────
-- Added by supabase-migration-drive-structure.sql
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS client_name        TEXT,
  ADD COLUMN IF NOT EXISTS client_folder_name TEXT,
  ADD COLUMN IF NOT EXISTS content_type       TEXT,
  ADD COLUMN IF NOT EXISTS month_key          TEXT,
  ADD COLUMN IF NOT EXISTS uploaded_by        TEXT;

-- ── 3. content_type check constraint (idempotent) ────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   information_schema.table_constraints
    WHERE  table_schema = 'public'
      AND  table_name   = 'assets'
      AND  constraint_name = 'assets_content_type_check'
  ) THEN
    ALTER TABLE public.assets
      ADD CONSTRAINT assets_content_type_check
      CHECK (content_type IS NULL OR content_type IN (
        'SOCIAL_POSTS', 'REELS', 'VIDEOS', 'LOGOS', 'BRAND_ASSETS',
        'PASSWORDS', 'DOCUMENTS', 'RAW_FILES', 'ADS_CREATIVES', 'REPORTS', 'OTHER'
      ));
  END IF;
END $$;

-- ── 4. month_key format constraint (idempotent) ───────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   information_schema.table_constraints
    WHERE  table_schema = 'public'
      AND  table_name   = 'assets'
      AND  constraint_name = 'assets_month_key_check'
  ) THEN
    ALTER TABLE public.assets
      ADD CONSTRAINT assets_month_key_check
      CHECK (month_key IS NULL OR month_key ~ '^\d{4}-(0[1-9]|1[0-2])$');
  END IF;
END $$;

-- ── 5. Agency / task columns ─────────────────────────────────────────────────
-- Added by supabase-migration-agency-v1.sql
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS task_id UUID REFERENCES public.tasks (id) ON DELETE SET NULL;

-- ── 6. SaaS approval columns ─────────────────────────────────────────────────
-- Added by supabase-migration-saas-v1.sql
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS publish_date    DATE,
  ADD COLUMN IF NOT EXISTS approval_notes  TEXT;

ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   information_schema.table_constraints
    WHERE  table_schema = 'public'
      AND  table_name   = 'assets'
      AND  constraint_name = 'assets_approval_status_check'
  ) THEN
    ALTER TABLE public.assets
      ADD CONSTRAINT assets_approval_status_check
      CHECK (approval_status IS NULL OR approval_status IN (
        'pending', 'approved', 'rejected', 'scheduled', 'published'
      ));
  END IF;
END $$;

-- ── 7. Preview / thumbnail metadata columns (THE PRIMARY FIX) ────────────────
-- These four columns are inserted by every upload route but were only added
-- by supabase-migration-asset-preview.sql.  If that migration was never run
-- the insert fails with: column "mime_type" of relation "assets" does not exist
--
-- Required vs optional:
--   REQUIRED  (upload fails without them) : name, file_url, drive_file_id,
--                                           client_name, content_type, month_key
--   OPTIONAL  (gracefully degraded below) : mime_type, preview_url,
--                                           thumbnail_url, web_view_link
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS mime_type     TEXT,
  ADD COLUMN IF NOT EXISTS preview_url   TEXT,
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
  ADD COLUMN IF NOT EXISTS web_view_link TEXT;

-- ── 8. Ensure nullable columns that were originally NOT NULL are relaxed ──────
-- Needed if the table was created from the old supabase-schema.sql where
-- file_url was NOT NULL and bucket_name had a DEFAULT (later dropped to nullable).
ALTER TABLE public.assets
  ALTER COLUMN file_path   DROP NOT NULL,
  ALTER COLUMN bucket_name DROP NOT NULL;
