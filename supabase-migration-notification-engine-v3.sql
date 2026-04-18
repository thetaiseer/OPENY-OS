-- Notification Engine v3 (enterprise foundation)
-- Run after previous notifications migrations.

-- 1) Extend notifications with category/priority/history metadata
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS category        TEXT,
  ADD COLUMN IF NOT EXISTS priority        TEXT,
  ADD COLUMN IF NOT EXISTS dedupe_key      TEXT,
  ADD COLUMN IF NOT EXISTS metadata_json   JSONB,
  ADD COLUMN IF NOT EXISTS read_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivery_channels TEXT[] DEFAULT ARRAY['in_app']::TEXT[];

CREATE INDEX IF NOT EXISTS notifications_category_idx    ON public.notifications (category);
CREATE INDEX IF NOT EXISTS notifications_priority_idx    ON public.notifications (priority);
CREATE INDEX IF NOT EXISTS notifications_dedupe_key_idx  ON public.notifications (dedupe_key);
CREATE INDEX IF NOT EXISTS notifications_user_date_idx   ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_client_date_idx ON public.notifications (client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_type_date_idx   ON public.notifications (event_type, created_at DESC);

-- 2) User notification preferences (email toggles + digest mode + DND)
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id                                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                             UUID NOT NULL UNIQUE,
  email_task                          BOOLEAN NOT NULL DEFAULT true,
  email_content                       BOOLEAN NOT NULL DEFAULT true,
  email_team                          BOOLEAN NOT NULL DEFAULT true,
  email_system                        BOOLEAN NOT NULL DEFAULT true,
  realtime_in_app                     BOOLEAN NOT NULL DEFAULT true,
  digest_mode                         TEXT NOT NULL DEFAULT 'realtime', -- realtime | daily | weekly
  scheduled_content_reminder_minutes  INTEGER NOT NULL DEFAULT 15,
  overdue_reminder_1h                 BOOLEAN NOT NULL DEFAULT true,
  overdue_reminder_24h                BOOLEAN NOT NULL DEFAULT true,
  overdue_reminder_daily              BOOLEAN NOT NULL DEFAULT true,
  dnd_until                           TIMESTAMPTZ,
  quiet_hours_start                   TIME,
  quiet_hours_end                     TIME,
  created_at                          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notification_preferences_user_idx
  ON public.notification_preferences (user_id);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'notification_preferences' AND policyname = 'users read own notification preferences'
  ) THEN
    CREATE POLICY "users read own notification preferences"
      ON public.notification_preferences
      FOR SELECT TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'notification_preferences' AND policyname = 'users update own notification preferences'
  ) THEN
    CREATE POLICY "users update own notification preferences"
      ON public.notification_preferences
      FOR UPDATE TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'notification_preferences' AND policyname = 'service role manage notification preferences'
  ) THEN
    CREATE POLICY "service role manage notification preferences"
      ON public.notification_preferences
      FOR ALL TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- 3) Delivery log for anti-duplicate and retry-safe notification delivery
CREATE TABLE IF NOT EXISTS public.notification_delivery_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel       TEXT NOT NULL, -- in_app | email | push
  user_id       UUID,
  recipient     TEXT,
  dedupe_key    TEXT,
  event_type    TEXT,
  entity_type   TEXT,
  entity_id     UUID,
  status        TEXT NOT NULL DEFAULT 'sent',
  error         TEXT,
  sent_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notification_delivery_logs_channel_idx
  ON public.notification_delivery_logs (channel, sent_at DESC);
CREATE INDEX IF NOT EXISTS notification_delivery_logs_user_idx
  ON public.notification_delivery_logs (user_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS notification_delivery_logs_dedupe_idx
  ON public.notification_delivery_logs (channel, dedupe_key, sent_at DESC);

ALTER TABLE public.notification_delivery_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'notification_delivery_logs' AND policyname = 'authenticated read delivery logs'
  ) THEN
    CREATE POLICY "authenticated read delivery logs"
      ON public.notification_delivery_logs
      FOR SELECT TO authenticated
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'notification_delivery_logs' AND policyname = 'service role write delivery logs'
  ) THEN
    CREATE POLICY "service role write delivery logs"
      ON public.notification_delivery_logs
      FOR ALL TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
