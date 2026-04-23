-- Notification system v2 — run this migration once in Supabase SQL editor.
-- This file complements supabase-migration-workflow-hub.sql with Realtime
-- enablement, additional indexes, and a read-state alias view.

-- ── 1. Ensure the `notifications` table has all required columns ──────────────
--      (workflow-hub.sql already adds entity_type/entity_id/action_url/event_type,
--       so these are safe no-ops if that migration was applied first)
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS entity_type TEXT,
  ADD COLUMN IF NOT EXISTS entity_id   UUID,
  ADD COLUMN IF NOT EXISTS action_url  TEXT,
  ADD COLUMN IF NOT EXISTS event_type  TEXT,
  ADD COLUMN IF NOT EXISTS client_id   UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS task_id     UUID REFERENCES public.tasks(id)   ON DELETE SET NULL;

-- ── 2. Indexes for common query patterns ─────────────────────────────────────
CREATE INDEX IF NOT EXISTS notifications_user_id_idx   ON public.notifications (user_id);
CREATE INDEX IF NOT EXISTS notifications_read_idx      ON public.notifications (read);
CREATE INDEX IF NOT EXISTS notifications_created_idx   ON public.notifications (created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_entity_idx    ON public.notifications (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS notifications_client_id_idx ON public.notifications (client_id);
CREATE INDEX IF NOT EXISTS notifications_task_id_idx   ON public.notifications (task_id);

-- ── 3. Enable Row Level Security (idempotent) ─────────────────────────────────
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read notifications addressed to them or broadcast (user_id IS NULL)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'users read own notifications'
  ) THEN
    CREATE POLICY "users read own notifications"
      ON public.notifications FOR SELECT TO authenticated
      USING (user_id = auth.uid() OR user_id IS NULL);
  END IF;
END $$;

-- Service role (used by backend API routes) can insert notifications
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'service role insert notifications'
  ) THEN
    CREATE POLICY "service role insert notifications"
      ON public.notifications FOR INSERT TO service_role
      WITH CHECK (true);
  END IF;
END $$;

-- Users can update (mark read) their own notifications
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'users update own notifications'
  ) THEN
    CREATE POLICY "users update own notifications"
      ON public.notifications FOR UPDATE TO authenticated
      USING (user_id = auth.uid() OR user_id IS NULL)
      WITH CHECK (true);
  END IF;
END $$;

-- Users can delete their own notifications
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'users delete own notifications'
  ) THEN
    CREATE POLICY "users delete own notifications"
      ON public.notifications FOR DELETE TO authenticated
      USING (user_id = auth.uid() OR user_id IS NULL);
  END IF;
END $$;

-- ── 4. Enable Supabase Realtime for notifications ─────────────────────────────
--      This adds the table to the supabase_realtime publication so INSERT events
--      are broadcast to subscribed clients. Safe to run multiple times.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;

-- ── 5. Email logs table (idempotent — also in workflow-hub.sql) ───────────────
CREATE TABLE IF NOT EXISTS public.email_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  to_address  TEXT NOT NULL,
  subject     TEXT NOT NULL,
  event_type  TEXT,
  entity_type TEXT,
  entity_id   UUID,
  status      TEXT NOT NULL DEFAULT 'sent',
  error       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'email_logs' AND policyname = 'authenticated view email_logs'
  ) THEN
    CREATE POLICY "authenticated view email_logs" ON public.email_logs FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
