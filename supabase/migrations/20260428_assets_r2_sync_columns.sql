-- OPENY OS — asset rows aligned with R2 two-way sync metadata

ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS size_bytes BIGINT;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS checksum TEXT;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS sync_status TEXT NOT NULL DEFAULT 'synced';
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS missing_in_storage BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS public_url TEXT;

UPDATE public.assets
SET display_name = COALESCE(display_name, name, file_name, original_filename, original_name)
WHERE display_name IS NULL;

UPDATE public.assets
SET size_bytes = COALESCE(size_bytes, file_size)
WHERE size_bytes IS NULL AND file_size IS NOT NULL;

UPDATE public.assets
SET public_url = COALESCE(
    NULLIF(trim(public_url), ''),
    NULLIF(trim(file_url), ''),
    NULLIF(trim(view_url), ''),
    NULLIF(trim(download_url), ''),
    NULLIF(trim(web_view_link), '')
  )
WHERE public_url IS NULL OR trim(public_url) = '';

UPDATE public.assets
SET sync_status = 'synced'
WHERE sync_status IS NULL OR trim(sync_status) = '';

UPDATE public.assets
SET missing_in_storage = false
WHERE missing_in_storage IS NULL;

-- Lookup by canonical key (uniqueness enforced in app + upload dedupe; avoid migration failure on legacy dupes)
CREATE INDEX IF NOT EXISTS idx_assets_storage_key_lookup
  ON public.assets (storage_key)
  WHERE storage_key IS NOT NULL AND trim(storage_key) <> '';

CREATE INDEX IF NOT EXISTS idx_assets_workspace_visible
  ON public.assets (workspace_id, created_at DESC)
  WHERE deleted_at IS NULL
    AND COALESCE(missing_in_storage, false) = false
    AND sync_status = 'synced';

COMMENT ON COLUMN public.assets.sync_status IS 'synced | missing | needs_review';
COMMENT ON COLUMN public.assets.storage_key IS 'Canonical R2 object key — use for Head/Delete, not public_url';
