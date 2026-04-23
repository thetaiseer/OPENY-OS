-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: bidirectional sync columns
-- Adds last_synced_at, source_updated_at, and is_deleted to the assets table
-- so the sync engine can track when each row was last confirmed alive in Drive
-- and whether the remote file has been removed.
-- ─────────────────────────────────────────────────────────────────────────────

-- Timestamp of the last successful Drive → DB sync pass that touched this row.
ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;

-- Timestamp reported by Google Drive as the file's last-modified time.
ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS source_updated_at timestamptz;

-- Soft-delete flag: true when the file was detected as missing from Drive
-- during a sync pass.  Hard-deletes are still used for app-initiated deletes.
ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;

-- Index for efficient filtering of non-deleted assets.
CREATE INDEX IF NOT EXISTS assets_is_deleted_idx ON assets (is_deleted);
-- Index for filtering Drive assets needing re-sync.
CREATE INDEX IF NOT EXISTS assets_last_synced_at_idx ON assets (last_synced_at);
