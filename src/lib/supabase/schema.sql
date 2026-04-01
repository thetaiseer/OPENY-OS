-- ============================================================
-- OPENY OS – Supabase Schema
-- Run this in your Supabase SQL editor to create all required tables.
-- Enable Row Level Security on each table after creation if desired.
-- ============================================================

-- Enable UUID extension (already available in Supabase by default)
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── clients ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clients (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  company     TEXT,
  email       TEXT,
  phone       TEXT,
  website     TEXT,
  status      TEXT NOT NULL DEFAULT 'prospect',
  initials    TEXT,
  color       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── tasks ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title                 TEXT NOT NULL,
  client_id             UUID REFERENCES clients(id) ON DELETE SET NULL,
  assigned_to           TEXT,
  assignee_id           TEXT,
  assignee              TEXT,
  assignee_name         TEXT,
  status                TEXT NOT NULL DEFAULT 'todo',
  priority              TEXT NOT NULL DEFAULT 'medium',
  due_date              TEXT,
  workflow_steps        JSONB,
  workflow_index        INTEGER,
  recurring_template_id UUID,
  completed_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── team_members ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS team_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  role       TEXT,
  team_role  TEXT DEFAULT 'creative',
  email      TEXT,
  status     TEXT NOT NULL DEFAULT 'active',
  initials   TEXT,
  color      TEXT,
  uid        TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── activities ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activities (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type       TEXT NOT NULL,
  message    TEXT NOT NULL,
  detail     TEXT,
  entity_id  TEXT,
  timestamp  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── content_items ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS content_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id        UUID REFERENCES clients(id) ON DELETE SET NULL,
  title            TEXT NOT NULL,
  description      TEXT,
  caption          TEXT,
  hashtags         JSONB DEFAULT '[]',
  platform         TEXT,
  content_type     TEXT,
  status           TEXT NOT NULL DEFAULT 'idea',
  priority         TEXT NOT NULL DEFAULT 'medium',
  assigned_to      TEXT,
  scheduled_date   TEXT,
  scheduled_time   TEXT,
  published_at     TIMESTAMPTZ,
  approval_status  TEXT DEFAULT 'pending_internal',
  attachments      JSONB DEFAULT '[]',
  comments         JSONB DEFAULT '[]',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── approvals ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS approvals (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id     UUID REFERENCES content_items(id) ON DELETE CASCADE,
  client_id           UUID REFERENCES clients(id) ON DELETE SET NULL,
  status              TEXT NOT NULL DEFAULT 'pending_internal',
  assigned_to         TEXT,
  internal_comments   JSONB DEFAULT '[]',
  client_comments     JSONB DEFAULT '[]',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── assets ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS assets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     UUID REFERENCES clients(id) ON DELETE SET NULL,
  name          TEXT NOT NULL,
  type          TEXT,
  file_url      TEXT,
  thumbnail_url TEXT,
  file_size     BIGINT DEFAULT 0,
  format        TEXT,
  tags          JSONB DEFAULT '[]',
  folder        TEXT,
  uploaded_by   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── notifications ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type       TEXT NOT NULL,
  title      TEXT NOT NULL,
  message    TEXT,
  entity_id  TEXT,
  is_read    BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── bank_entries ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bank_entries (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id  UUID REFERENCES clients(id) ON DELETE SET NULL,
  category   TEXT,
  text       TEXT NOT NULL,
  tags       JSONB DEFAULT '[]',
  platform   TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── client_notes ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_notes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id  UUID REFERENCES clients(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── publishing_events ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS publishing_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id  UUID REFERENCES content_items(id) ON DELETE SET NULL,
  client_id        UUID REFERENCES clients(id) ON DELETE SET NULL,
  platform         TEXT,
  status           TEXT NOT NULL DEFAULT 'pending',
  scheduled_at     TIMESTAMPTZ,
  published_at     TIMESTAMPTZ,
  failure_reason   TEXT,
  failure_log      JSONB DEFAULT '[]',
  retries          INTEGER DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── recurring_task_templates ──────────────────────────────────
CREATE TABLE IF NOT EXISTS recurring_task_templates (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title               TEXT NOT NULL,
  client_id           UUID REFERENCES clients(id) ON DELETE SET NULL,
  assignee_id         TEXT,
  assignee_name       TEXT,
  priority            TEXT NOT NULL DEFAULT 'medium',
  frequency           TEXT NOT NULL DEFAULT 'monthly',
  last_generated_month TEXT,
  last_generated_week  TEXT,
  workflow_steps      JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── invitations ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invitations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT NOT NULL,
  name       TEXT,
  role       TEXT,
  team_role  TEXT DEFAULT 'creative',
  token      TEXT UNIQUE NOT NULL,
  status     TEXT NOT NULL DEFAULT 'pending',
  invited_by TEXT,
  expires_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── user_notification_preferences ────────────────────────────
CREATE TABLE IF NOT EXISTS user_notification_preferences (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT NOT NULL UNIQUE,
  preferences JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── user_ui_preferences ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_ui_preferences (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT NOT NULL UNIQUE,
  preferences JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Enable Realtime for all tables ───────────────────────────
-- Run these in the Supabase Dashboard → Database → Replication,
-- or via the SQL editor:
ALTER PUBLICATION supabase_realtime ADD TABLE clients;
ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE team_members;
ALTER PUBLICATION supabase_realtime ADD TABLE activities;
ALTER PUBLICATION supabase_realtime ADD TABLE content_items;
ALTER PUBLICATION supabase_realtime ADD TABLE approvals;
ALTER PUBLICATION supabase_realtime ADD TABLE assets;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE bank_entries;
ALTER PUBLICATION supabase_realtime ADD TABLE client_notes;
ALTER PUBLICATION supabase_realtime ADD TABLE publishing_events;
ALTER PUBLICATION supabase_realtime ADD TABLE recurring_task_templates;
ALTER PUBLICATION supabase_realtime ADD TABLE user_notification_preferences;
ALTER PUBLICATION supabase_realtime ADD TABLE user_ui_preferences;
