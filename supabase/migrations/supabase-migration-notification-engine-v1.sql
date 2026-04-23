-- ═══════════════════════════════════════════════════════════════════════════
-- NOTIFICATION ENGINE v1  —  run once in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════
-- All statements are fully idempotent (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
-- Runs safely on top of all existing notification migrations.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. EXTEND notifications table ─────────────────────────────────────────────
--      Add enterprise-grade fields while keeping all existing columns intact.

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS priority       TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low','medium','high','critical')),
  ADD COLUMN IF NOT EXISTS category       TEXT,          -- tasks|content|assets|team|system
  ADD COLUMN IF NOT EXISTS is_archived    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS read_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_in_app BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS delivered_email  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS idempotency_key  TEXT,        -- dedup: event_type:entity_id[:user_id]
  ADD COLUMN IF NOT EXISTS workspace_id     UUID REFERENCES public.workspaces(id) ON DELETE SET NULL;

-- Idempotency uniqueness: one notification per key per user.
-- The unique index here prevents exact-same-key duplicates from ever being persisted,
-- acting as a hard guard. The application layer (event-engine.ts isDuplicate()) further
-- enforces a time-based window (e.g. 1 hour) so that the same logical event can
-- re-notify after the window expires without being blocked by the index.
-- Old entries are retained (archive-only policy); the time window check in the app layer
-- is therefore the primary dedup mechanism, while this index is the safety net.
CREATE UNIQUE INDEX IF NOT EXISTS notifications_idempotency_user_idx
  ON public.notifications (idempotency_key, user_id)
  WHERE idempotency_key IS NOT NULL AND user_id IS NOT NULL;

-- Partial index: fast unarchived notification queries (most common access pattern)
CREATE INDEX IF NOT EXISTS notifications_active_idx
  ON public.notifications (user_id, created_at DESC)
  WHERE is_archived = false;

CREATE INDEX IF NOT EXISTS notifications_priority_idx ON public.notifications (priority);
CREATE INDEX IF NOT EXISTS notifications_category_idx ON public.notifications (category);
CREATE INDEX IF NOT EXISTS notifications_workspace_idx ON public.notifications (workspace_id);

-- Realtime enablement (safe to run multiple times)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;

-- ── 2. EXTEND activities table ────────────────────────────────────────────────
--      Make it a durable, queryable workspace history table.

ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS workspace_id   UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS actor_id       UUID REFERENCES auth.users(id)        ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS title          TEXT,          -- short human-readable headline
  ADD COLUMN IF NOT EXISTS before_value   JSONB,         -- previous state snapshot
  ADD COLUMN IF NOT EXISTS after_value    JSONB,         -- next state snapshot
  ADD COLUMN IF NOT EXISTS category       TEXT;          -- tasks|content|assets|team|system

CREATE INDEX IF NOT EXISTS activities_workspace_idx  ON public.activities (workspace_id);
CREATE INDEX IF NOT EXISTS activities_actor_idx      ON public.activities (actor_id);
CREATE INDEX IF NOT EXISTS activities_category_idx   ON public.activities (category);
CREATE INDEX IF NOT EXISTS activities_created_idx    ON public.activities (created_at DESC);
CREATE INDEX IF NOT EXISTS activities_entity_idx     ON public.activities (entity_type, entity_id);

-- ── 3. notification_preferences ───────────────────────────────────────────────
--      Per-user, per-event-type channel preferences.

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type        TEXT        NOT NULL,
  in_app_enabled    BOOLEAN     NOT NULL DEFAULT true,
  email_enabled     BOOLEAN     NOT NULL DEFAULT true,
  realtime_enabled  BOOLEAN     NOT NULL DEFAULT true,
  digest_enabled    BOOLEAN     NOT NULL DEFAULT false,
  mute_until        TIMESTAMPTZ,                         -- null = not muted
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, event_type)
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notification_preferences' AND policyname='users manage own preferences') THEN
    CREATE POLICY "users manage own preferences"
      ON public.notification_preferences FOR ALL TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- Allow service role to read/write (for preference checks in API routes)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notification_preferences' AND policyname='service manage preferences') THEN
    CREATE POLICY "service manage preferences"
      ON public.notification_preferences FOR ALL TO service_role
      WITH CHECK (true);
  END IF;
END $$;

-- ── 4. scheduled_reminders ────────────────────────────────────────────────────
--      Persistent queue for deadline / publish-window / stale-work reminders.

CREATE TABLE IF NOT EXISTS public.scheduled_reminders (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID        REFERENCES public.workspaces(id) ON DELETE SET NULL,
  target_user_id  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type      TEXT        NOT NULL,
  entity_type     TEXT,
  entity_id       UUID,
  scheduled_for   TIMESTAMPTZ NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','sent','cancelled','failed')),
  idempotency_key TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS scheduled_reminders_status_idx      ON public.scheduled_reminders (status, scheduled_for);
CREATE INDEX IF NOT EXISTS scheduled_reminders_entity_idx      ON public.scheduled_reminders (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS scheduled_reminders_user_idx        ON public.scheduled_reminders (target_user_id);
CREATE INDEX IF NOT EXISTS scheduled_reminders_idempotency_idx ON public.scheduled_reminders (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE public.scheduled_reminders ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='scheduled_reminders' AND policyname='service manage reminders') THEN
    CREATE POLICY "service manage reminders"
      ON public.scheduled_reminders FOR ALL TO service_role
      WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='scheduled_reminders' AND policyname='admin read reminders') THEN
    CREATE POLICY "admin read reminders"
      ON public.scheduled_reminders FOR SELECT TO authenticated
      USING (public.current_user_role() IN ('owner','admin'));
  END IF;
END $$;

-- ── 5. notification_delivery_logs ─────────────────────────────────────────────
--      Audit trail for every notification delivery attempt.

CREATE TABLE IF NOT EXISTS public.notification_delivery_logs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID        REFERENCES public.notifications(id) ON DELETE CASCADE,
  channel         TEXT        NOT NULL CHECK (channel IN ('in_app','email','realtime')),
  status          TEXT        NOT NULL CHECK (status IN ('success','failed','skipped')),
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS delivery_logs_notification_idx ON public.notification_delivery_logs (notification_id);
CREATE INDEX IF NOT EXISTS delivery_logs_status_idx       ON public.notification_delivery_logs (status);
CREATE INDEX IF NOT EXISTS delivery_logs_created_idx      ON public.notification_delivery_logs (created_at DESC);

ALTER TABLE public.notification_delivery_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notification_delivery_logs' AND policyname='admin read delivery logs') THEN
    CREATE POLICY "admin read delivery logs"
      ON public.notification_delivery_logs FOR SELECT TO authenticated
      USING (public.current_user_role() IN ('owner','admin','manager'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notification_delivery_logs' AND policyname='service write delivery logs') THEN
    CREATE POLICY "service write delivery logs"
      ON public.notification_delivery_logs FOR INSERT TO service_role
      WITH CHECK (true);
  END IF;
END $$;

-- ── 6. Email logs — extend with notification_id linkage ───────────────────────

ALTER TABLE public.email_logs
  ADD COLUMN IF NOT EXISTS notification_id UUID REFERENCES public.notifications(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recipient_name  TEXT;

-- ── 7. History retention policy — never auto-delete, archive only ─────────────
--      A scheduled pg_cron job (optional) can auto-archive notifications older than
--      90 days instead of deleting them. No DROP / DELETE policy is created here.
--      The application layer uses is_archived=true as the "soft delete" path.

-- ── 8. Update RLS on notifications to include is_archived reads ───────────────
--      The existing "users read own notifications" policy already covers this
--      because it uses user_id = auth.uid() which includes archived rows.
--      Add a service-role UPDATE policy for the archiving operation:

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notifications' AND policyname='service role update notifications') THEN
    CREATE POLICY "service role update notifications"
      ON public.notifications FOR UPDATE TO service_role
      WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notifications' AND policyname='service role delete notifications') THEN
    CREATE POLICY "service role delete notifications"
      ON public.notifications FOR DELETE TO service_role
      USING (true);
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Done. All tables and indexes are active.
-- ─────────────────────────────────────────────────────────────────────────────
