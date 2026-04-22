-- Unified file metadata registry for OPENY OS + OPENY DOCS (R2-backed)
CREATE TABLE IF NOT EXISTS public.stored_files (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module        TEXT NOT NULL CHECK (module IN ('os', 'docs')),
  section       TEXT NOT NULL,
  entity_id     TEXT,
  original_name TEXT NOT NULL,
  stored_name   TEXT NOT NULL,
  mime_type     TEXT NOT NULL,
  size_bytes    BIGINT NOT NULL CHECK (size_bytes >= 0),
  r2_key        TEXT NOT NULL,
  file_url      TEXT NOT NULL,
  visibility    TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
  uploaded_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_stored_files_r2_key ON public.stored_files (r2_key);
CREATE INDEX IF NOT EXISTS idx_stored_files_module_section_entity ON public.stored_files (module, section, entity_id);
CREATE INDEX IF NOT EXISTS idx_stored_files_created_at ON public.stored_files (created_at DESC);

ALTER TABLE public.stored_files ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'stored_files'
      AND policyname = 'stored_files_auth_all'
  ) THEN
    CREATE POLICY "stored_files_auth_all"
      ON public.stored_files
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

