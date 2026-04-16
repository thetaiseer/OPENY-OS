-- ============================================================
-- OPENY OS — Assets DB save fix (R2 metadata path)
-- ============================================================
-- Purpose:
--   1) Verify columns used by /api/upload/complete exist.
--   2) Ensure canonical aliases for key/url are present.
--   3) Ensure RLS allows authenticated inserts.
--   4) Refresh PostgREST schema cache (prevents stale PGRST204 cache misses).

-- 1) Inspect current assets columns (run before/after)
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

-- 2) Ensure metadata columns used by upload completion exist
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS file_path        TEXT,
  ADD COLUMN IF NOT EXISTS storage_key      TEXT,
  ADD COLUMN IF NOT EXISTS file_key         TEXT,
  ADD COLUMN IF NOT EXISTS file_url         TEXT,
  ADD COLUMN IF NOT EXISTS public_url       TEXT,
  ADD COLUMN IF NOT EXISTS storage_provider TEXT,
  ADD COLUMN IF NOT EXISTS bucket_name      TEXT,
  ADD COLUMN IF NOT EXISTS storage_bucket   TEXT,
  ADD COLUMN IF NOT EXISTS mime_type        TEXT,
  ADD COLUMN IF NOT EXISTS preview_url      TEXT,
  ADD COLUMN IF NOT EXISTS thumbnail_url    TEXT,
  ADD COLUMN IF NOT EXISTS web_view_link    TEXT,
  ADD COLUMN IF NOT EXISTS main_category    TEXT,
  ADD COLUMN IF NOT EXISTS sub_category     TEXT,
  ADD COLUMN IF NOT EXISTS month_key        TEXT,
  ADD COLUMN IF NOT EXISTS uploaded_by      TEXT;

-- Keep aliases in sync where possible for existing rows.
UPDATE public.assets
SET
  file_key       = COALESCE(file_key, storage_key, file_path),
  storage_key    = COALESCE(storage_key, file_key, file_path),
  file_path      = COALESCE(file_path, storage_key, file_key),
  public_url     = COALESCE(public_url, file_url),
  file_url       = COALESCE(file_url, public_url),
  storage_bucket = COALESCE(storage_bucket, bucket_name),
  bucket_name    = COALESCE(bucket_name, storage_bucket);

-- 3) RLS: allow authenticated users to insert rows
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "assets_auth_insert" ON public.assets;
CREATE POLICY "assets_auth_insert"
  ON public.assets
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "assets_auth_select" ON public.assets;
CREATE POLICY "assets_auth_select"
  ON public.assets
  FOR SELECT
  TO authenticated
  USING (true);

-- Optional emergency toggle during incident response:
-- ALTER TABLE public.assets DISABLE ROW LEVEL SECURITY;

-- 4) Refresh PostgREST schema cache to clear stale metadata (PGRST204)
NOTIFY pgrst, 'reload schema';
