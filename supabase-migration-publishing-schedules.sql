-- ============================================================
-- Publishing Schedules Migration
-- Run this in your Supabase SQL editor to enable social
-- media publishing scheduling on any asset.
-- ============================================================

-- Allowed platforms enum
DO $$ BEGIN
  CREATE TYPE publishing_platform AS ENUM (
    'instagram',
    'facebook',
    'tiktok',
    'linkedin',
    'twitter',
    'snapchat',
    'youtube_shorts'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Allowed post types enum
DO $$ BEGIN
  CREATE TYPE publishing_post_type AS ENUM (
    'post',
    'reel',
    'carousel',
    'story'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Publishing status enum
DO $$ BEGIN
  CREATE TYPE publishing_status AS ENUM (
    'draft',
    'scheduled',
    'pending_review',
    'approved',
    'published',
    'missed',
    'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Main publishing_schedules table
CREATE TABLE IF NOT EXISTS publishing_schedules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Asset relation
  asset_id        UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,

  -- Client info (denormalized for quick access)
  client_id       UUID REFERENCES clients(id) ON DELETE SET NULL,
  client_name     TEXT,

  -- Schedule timing
  scheduled_date  DATE NOT NULL,
  scheduled_time  TIME NOT NULL DEFAULT '09:00:00',
  timezone        TEXT NOT NULL DEFAULT 'UTC',

  -- Platform + post type (stored as text arrays for flexibility)
  platforms       TEXT[] NOT NULL DEFAULT '{}',
  post_types      TEXT[] NOT NULL DEFAULT '{}',

  -- Content
  caption         TEXT,
  notes           TEXT,

  -- Workflow status
  status          TEXT NOT NULL DEFAULT 'scheduled',

  -- Optional assignee
  assigned_to     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assignee_name   TEXT,

  -- Optional reminder (minutes before publish time)
  reminder_minutes INTEGER,

  -- Linked task (auto-created on schedule)
  task_id         UUID REFERENCES tasks(id) ON DELETE SET NULL,

  -- Audit
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_name TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_publishing_schedules_asset_id
  ON publishing_schedules(asset_id);

CREATE INDEX IF NOT EXISTS idx_publishing_schedules_client_id
  ON publishing_schedules(client_id);

CREATE INDEX IF NOT EXISTS idx_publishing_schedules_scheduled_date
  ON publishing_schedules(scheduled_date);

CREATE INDEX IF NOT EXISTS idx_publishing_schedules_status
  ON publishing_schedules(status);

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_publishing_schedules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_publishing_schedules_updated_at ON publishing_schedules;
CREATE TRIGGER trg_publishing_schedules_updated_at
  BEFORE UPDATE ON publishing_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_publishing_schedules_updated_at();

-- Add optional extra columns to tasks table for publishing linkage
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS publishing_schedule_id UUID REFERENCES publishing_schedules(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS asset_id UUID REFERENCES assets(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS platforms TEXT[];
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS post_types TEXT[];

-- Enable RLS (Row Level Security)
ALTER TABLE publishing_schedules ENABLE ROW LEVEL SECURITY;

-- Policy: service role bypasses RLS (handled by using service role key in API)
-- Policy: authenticated users can read all publishing schedules in their org
CREATE POLICY "authenticated users can view publishing schedules"
  ON publishing_schedules
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "authenticated users can insert publishing schedules"
  ON publishing_schedules
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "authenticated users can update publishing schedules"
  ON publishing_schedules
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "authenticated users can delete publishing schedules"
  ON publishing_schedules
  FOR DELETE
  TO authenticated
  USING (true);
