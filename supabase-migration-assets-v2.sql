-- ============================================================
-- OPENY OS – Assets v2 Migration
-- Adds main_category, sub_category, and storage_key columns
-- to the assets table to support the new folder hierarchy:
--   Client → Main Category → Year → Month → Subcategory → Files
-- ============================================================

-- New category columns
ALTER TABLE assets ADD COLUMN IF NOT EXISTS main_category TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS sub_category  TEXT;

-- Canonical storage key in the new hierarchy format:
--   clients/{clientSlug}/{mainCategory}/{year}/{month}/{subCategory}/{timestamp}-{filename}
ALTER TABLE assets ADD COLUMN IF NOT EXISTS storage_key   TEXT;

-- Back-fill storage_key from file_path for assets uploaded before this migration
UPDATE assets SET storage_key = file_path WHERE storage_key IS NULL AND file_path IS NOT NULL;

-- Indexes for efficient filtering
CREATE INDEX IF NOT EXISTS idx_assets_main_category ON assets(main_category);
CREATE INDEX IF NOT EXISTS idx_assets_sub_category  ON assets(sub_category);
CREATE INDEX IF NOT EXISTS idx_assets_storage_key   ON assets(storage_key);
CREATE INDEX IF NOT EXISTS idx_assets_client_id_cat ON assets(client_id, main_category);
CREATE INDEX IF NOT EXISTS idx_assets_created_at    ON assets(created_at DESC);
