-- Extend notifications table with workflow fields (all idempotent)
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS entity_type TEXT,
  ADD COLUMN IF NOT EXISTS entity_id   UUID,
  ADD COLUMN IF NOT EXISTS action_url  TEXT,
  ADD COLUMN IF NOT EXISTS event_type  TEXT;

CREATE INDEX IF NOT EXISTS notifications_user_id_idx   ON public.notifications (user_id);
CREATE INDEX IF NOT EXISTS notifications_entity_idx    ON public.notifications (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS notifications_read_idx      ON public.notifications (read);

-- Approvals table
CREATE TABLE IF NOT EXISTS public.approvals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id         UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  asset_id        UUID REFERENCES public.assets(id) ON DELETE SET NULL,
  client_id       UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name     TEXT,
  reviewer_id     UUID,
  reviewer_name   TEXT,
  requested_by    UUID,
  requested_by_name TEXT,
  status          TEXT NOT NULL DEFAULT 'pending',
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS approvals_task_id_idx   ON public.approvals (task_id);
CREATE INDEX IF NOT EXISTS approvals_asset_id_idx  ON public.approvals (asset_id);
CREATE INDEX IF NOT EXISTS approvals_client_id_idx ON public.approvals (client_id);
CREATE INDEX IF NOT EXISTS approvals_status_idx    ON public.approvals (status);

ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "authenticated view approvals" ON public.approvals FOR SELECT TO authenticated USING (true);
CREATE POLICY IF NOT EXISTS "authenticated insert approvals" ON public.approvals FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "authenticated update approvals" ON public.approvals FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Link approvals to tasks
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS approval_id UUID REFERENCES public.approvals(id) ON DELETE SET NULL;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS reminder_at TIMESTAMPTZ;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS linked_drive_folder_id TEXT;

-- Email log
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
CREATE POLICY IF NOT EXISTS "authenticated view email_logs" ON public.email_logs FOR SELECT TO authenticated USING (true);
