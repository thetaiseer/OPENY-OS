-- OPENY OS — Asset upload compatibility fix (Supabase Storage + DB)
-- Adds required metadata columns and authenticated RLS policies used by the
-- client-side upload flow.

ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS file_name         TEXT,
  ADD COLUMN IF NOT EXISTS original_name     TEXT,
  ADD COLUMN IF NOT EXISTS storage_path      TEXT,
  ADD COLUMN IF NOT EXISTS category          TEXT,
  ADD COLUMN IF NOT EXISTS uploaded_by_email TEXT,
  ADD COLUMN IF NOT EXISTS workspace_key     TEXT DEFAULT 'os';

ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

UPDATE public.assets
SET workspace_key = 'os'
WHERE workspace_key IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'assets'
      AND constraint_name = 'assets_workspace_key_check_v2'
  ) THEN
    ALTER TABLE public.assets
      ADD CONSTRAINT assets_workspace_key_check_v2
      CHECK (workspace_key IS NULL OR workspace_key IN ('os', 'docs'));
  END IF;
END $$;

ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "assets: authenticated select" ON public.assets;
CREATE POLICY "assets: authenticated select"
  ON public.assets FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "assets: authenticated insert" ON public.assets;
CREATE POLICY "assets: authenticated insert"
  ON public.assets FOR INSERT
  TO authenticated
  WITH CHECK (true);

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "storage: authenticated read client-assets" ON storage.objects;
CREATE POLICY "storage: authenticated read client-assets"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'client-assets');

DROP POLICY IF EXISTS "storage: authenticated insert client-assets" ON storage.objects;
CREATE POLICY "storage: authenticated insert client-assets"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'client-assets');
