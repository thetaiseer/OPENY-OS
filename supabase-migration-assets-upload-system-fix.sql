-- OPENY OS — Supabase assets upload system repair
-- Idempotent migration focused on fixing storage->DB metadata inserts.

-- ============================================================
-- 1) INSPECTION QUERIES (run anytime to inspect current state)
-- ============================================================

-- List all columns + types + required/default:
SELECT
  c.ordinal_position,
  c.column_name,
  c.data_type,
  c.udt_name,
  c.is_nullable,
  c.column_default
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name = 'assets'
ORDER BY c.ordinal_position;

-- List table constraints:
SELECT
  tc.constraint_name,
  tc.constraint_type,
  pg_get_constraintdef(con.oid) AS definition
FROM information_schema.table_constraints tc
JOIN pg_constraint con
  ON con.conname = tc.constraint_name
JOIN pg_class rel
  ON rel.oid = con.conrelid
JOIN pg_namespace nsp
  ON nsp.oid = rel.relnamespace
WHERE tc.table_schema = 'public'
  AND tc.table_name = 'assets'
  AND nsp.nspname = 'public'
ORDER BY tc.constraint_type, tc.constraint_name;

-- List RLS policies:
SELECT
  p.schemaname,
  p.tablename,
  p.policyname,
  p.roles,
  p.cmd,
  p.qual,
  p.with_check
FROM pg_policies p
WHERE p.schemaname = 'public'
  AND p.tablename = 'assets'
ORDER BY p.policyname;

-- ============================================================
-- 2) REQUIRED COLUMNS + SAFE ALTERS (NO DATA DROP)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Ensure required columns exist with expected types.
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS file_name      TEXT,
  ADD COLUMN IF NOT EXISTS original_name  TEXT,
  ADD COLUMN IF NOT EXISTS file_extension TEXT,
  ADD COLUMN IF NOT EXISTS mime_type      TEXT,
  ADD COLUMN IF NOT EXISTS file_size      BIGINT,
  ADD COLUMN IF NOT EXISTS storage_bucket TEXT,
  ADD COLUMN IF NOT EXISTS storage_path   TEXT,
  ADD COLUMN IF NOT EXISTS public_url     TEXT,
  ADD COLUMN IF NOT EXISTS client_id      UUID,
  ADD COLUMN IF NOT EXISTS project_id     UUID,
  ADD COLUMN IF NOT EXISTS task_id        UUID,
  ADD COLUMN IF NOT EXISTS created_at     TIMESTAMPTZ;

-- uploaded_by must be UUID nullable.
DO $$
DECLARE
  uploaded_by_type TEXT;
BEGIN
  SELECT c.udt_name
  INTO uploaded_by_type
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'assets'
    AND c.column_name = 'uploaded_by';

  IF uploaded_by_type IS NULL THEN
    ALTER TABLE public.assets ADD COLUMN uploaded_by UUID;
  ELSIF uploaded_by_type <> 'uuid' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'assets'
        AND column_name = 'uploaded_by_legacy_text'
    ) THEN
      ALTER TABLE public.assets RENAME COLUMN uploaded_by TO uploaded_by_legacy_text;
    ELSE
      UPDATE public.assets
      SET uploaded_by_legacy_text = COALESCE(uploaded_by_legacy_text, uploaded_by::TEXT);
      ALTER TABLE public.assets DROP COLUMN uploaded_by;
    END IF;

    ALTER TABLE public.assets ADD COLUMN uploaded_by UUID;

    UPDATE public.assets
    SET uploaded_by = NULLIF(uploaded_by_legacy_text, '')::UUID
    WHERE uploaded_by IS NULL
      AND uploaded_by_legacy_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  END IF;
END $$;

-- Ensure defaults for id + created_at.
ALTER TABLE public.assets
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN created_at SET DEFAULT now();

-- Ensure primary key exists on id.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.assets'::regclass
      AND contype = 'p'
  ) THEN
    ALTER TABLE public.assets
      ADD CONSTRAINT assets_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- Keep optional metadata columns nullable so inserts don't fail unnecessarily.
ALTER TABLE public.assets
  ALTER COLUMN file_name DROP NOT NULL,
  ALTER COLUMN original_name DROP NOT NULL,
  ALTER COLUMN file_extension DROP NOT NULL,
  ALTER COLUMN mime_type DROP NOT NULL,
  ALTER COLUMN file_size DROP NOT NULL,
  ALTER COLUMN storage_bucket DROP NOT NULL,
  ALTER COLUMN public_url DROP NOT NULL,
  ALTER COLUMN client_id DROP NOT NULL,
  ALTER COLUMN project_id DROP NOT NULL,
  ALTER COLUMN task_id DROP NOT NULL,
  ALTER COLUMN uploaded_by DROP NOT NULL;

-- Backfill storage_path from existing path columns when possible.
UPDATE public.assets
SET storage_path = COALESCE(storage_path, storage_key, file_path)
WHERE storage_path IS NULL;

-- storage_path is required for new inserts and must match canonical upload path.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'assets_storage_path_required_chk'
      AND conrelid = 'public.assets'::regclass
  ) THEN
    ALTER TABLE public.assets
      ADD CONSTRAINT assets_storage_path_required_chk
      CHECK (storage_path IS NOT NULL AND btrim(storage_path) <> '')
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'assets_storage_path_matches_upload_path_chk'
      AND conrelid = 'public.assets'::regclass
  ) THEN
    ALTER TABLE public.assets
      ADD CONSTRAINT assets_storage_path_matches_upload_path_chk
      CHECK (
        (file_path IS NULL OR storage_path = file_path)
        AND (storage_key IS NULL OR storage_path = storage_key)
      )
      NOT VALID;
  END IF;
END $$;

-- Validate storage_path constraints only when existing rows already satisfy them.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'assets_storage_path_required_chk'
      AND conrelid = 'public.assets'::regclass
      AND NOT convalidated
  ) AND NOT EXISTS (
    SELECT 1
    FROM public.assets
    WHERE storage_path IS NULL OR btrim(storage_path) = ''
  ) THEN
    ALTER TABLE public.assets VALIDATE CONSTRAINT assets_storage_path_required_chk;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'assets_storage_path_matches_upload_path_chk'
      AND conrelid = 'public.assets'::regclass
      AND NOT convalidated
  ) AND NOT EXISTS (
    SELECT 1
    FROM public.assets
    WHERE (file_path IS NOT NULL AND storage_path <> file_path)
       OR (storage_key IS NOT NULL AND storage_path <> storage_key)
  ) THEN
    ALTER TABLE public.assets VALIDATE CONSTRAINT assets_storage_path_matches_upload_path_chk;
  END IF;
END $$;

-- Keep commonly-used aliases in sync for new writes.
UPDATE public.assets
SET storage_bucket = COALESCE(storage_bucket, bucket_name)
WHERE storage_bucket IS NULL;

-- ============================================================
-- 3) RLS FIX (AUTHENTICATED INSERT + SELECT)
-- ============================================================

ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "assets_auth_select" ON public.assets;
CREATE POLICY "assets_auth_select"
  ON public.assets
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "assets_auth_insert" ON public.assets;
CREATE POLICY "assets_auth_insert"
  ON public.assets
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================================
-- 4) DEBUG INSERT TEST (SAFE MANUAL CHECK)
-- ============================================================

-- Run as authenticated user in SQL editor/session:
-- BEGIN;
-- INSERT INTO assets (
--   file_name,
--   original_name,
--   storage_bucket,
--   storage_path,
--   file_size
-- )
-- VALUES (
--   'test.pdf',
--   'test.pdf',
--   'assets',
--   'Clients/test/test.pdf',
--   12345
-- )
-- RETURNING id, file_name, storage_path, created_at;
-- ROLLBACK;

-- Final step: refresh PostgREST schema cache.
NOTIFY pgrst, 'reload schema';
