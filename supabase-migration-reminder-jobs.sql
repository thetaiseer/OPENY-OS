-- reminder_jobs table: event-driven, one-shot job queue for reminder notifications.
-- Jobs are written at event time (task created, publishing scheduled) and consumed
-- by the daily cron at 08:00 UTC. No frequent polling is required.
--
-- Run this migration in your Supabase SQL editor.

CREATE TABLE IF NOT EXISTS public.reminder_jobs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type   TEXT NOT NULL,
  entity_id     UUID NOT NULL,
  job_type      TEXT NOT NULL,
  -- 'due_soon'    – fire ~24 h before task due date
  -- 'overdue_1h'  – fire ~1 h after task due date
  -- 'overdue_24h' – fire ~24 h after task due date
  -- 'overdue_daily' – repeating daily overdue alarm (self-renews until cancelled)
  -- 'pre_publish' – fire on the morning of the scheduled publish date
  execute_at    TIMESTAMPTZ NOT NULL,
  user_id       UUID,
  client_id     UUID,
  status        TEXT NOT NULL DEFAULT 'pending',
  -- 'pending' | 'processed' | 'cancelled'
  processed_at  TIMESTAMPTZ,
  metadata_json JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Efficient lookup for the daily cron: all pending jobs ready to fire.
CREATE INDEX IF NOT EXISTS reminder_jobs_pending_idx
  ON public.reminder_jobs (execute_at, status)
  WHERE status = 'pending';

-- Cancel/reschedule lookups by entity.
CREATE INDEX IF NOT EXISTS reminder_jobs_entity_idx
  ON public.reminder_jobs (entity_type, entity_id);

-- RLS: service role manages all; authenticated users have no direct access.
ALTER TABLE public.reminder_jobs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'reminder_jobs' AND policyname = 'service role manage reminder jobs'
  ) THEN
    CREATE POLICY "service role manage reminder jobs"
      ON public.reminder_jobs
      FOR ALL TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
