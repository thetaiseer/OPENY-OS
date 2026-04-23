-- OPENY OS SaaS v1 Migration
-- Run this in your Supabase SQL editor after supabase-schema.sql

-- ── New columns on assets ──────────────────────────────────────────────────────
ALTER TABLE assets ADD COLUMN IF NOT EXISTS publish_date      date;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS approval_status   text default 'pending'
  CHECK (approval_status IN ('pending','approved','rejected','scheduled','published'));
ALTER TABLE assets ADD COLUMN IF NOT EXISTS approval_notes    text;

-- ── Comments ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content     text NOT NULL,
  user_id     text NOT NULL,
  user_name   text NOT NULL,
  asset_id    uuid REFERENCES assets(id) ON DELETE CASCADE,
  task_id     uuid REFERENCES tasks(id)  ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "allow all comments" ON comments FOR ALL USING (true) WITH CHECK (true);

-- ── Notifications ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  message     text NOT NULL,
  type        text NOT NULL DEFAULT 'info'
    CHECK (type IN ('info','success','warning','error')),
  read        boolean NOT NULL DEFAULT false,
  client_id   uuid REFERENCES clients(id) ON DELETE CASCADE,
  user_id     text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "allow all notifications" ON notifications FOR ALL USING (true) WITH CHECK (true);

-- ── Approval history ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS approval_history (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id    uuid REFERENCES assets(id) ON DELETE CASCADE,
  action      text NOT NULL
    CHECK (action IN ('approved','rejected','pending','scheduled','published')),
  user_id     text,
  user_name   text,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE approval_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "allow all approval_history" ON approval_history FOR ALL USING (true) WITH CHECK (true);
