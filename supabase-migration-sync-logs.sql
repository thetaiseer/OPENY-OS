-- ── Drive Sync Logs ──────────────────────────────────────────────────────────
-- Run this migration to enable Google Drive ↔ DB sync logging.
-- Requires: supabase-migration-drive-schema-v2.sql to have been applied.

CREATE TABLE IF NOT EXISTS drive_sync_logs (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  synced_at     timestamptz NOT NULL DEFAULT now(),
  files_added   int         NOT NULL DEFAULT 0,
  files_updated int         NOT NULL DEFAULT 0,
  files_removed int         NOT NULL DEFAULT 0,
  errors_count  int         NOT NULL DEFAULT 0,
  error_details text[]      NOT NULL DEFAULT '{}',
  duration_ms   int,
  triggered_by  text        NOT NULL DEFAULT 'manual' CHECK (triggered_by IN ('manual', 'cron'))
);

-- Allow the app to read and insert sync logs
ALTER TABLE drive_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role full access to drive_sync_logs"
  ON drive_sync_logs FOR ALL
  USING (true)
  WITH CHECK (true);

-- Index for fast "last sync" queries
CREATE INDEX IF NOT EXISTS drive_sync_logs_synced_at_idx ON drive_sync_logs (synced_at DESC);
