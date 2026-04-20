-- Event-driven notifications compatibility migration
-- Adds optional actor + metadata columns used by centralized notification payloads.

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS notifications_actor_id_idx ON public.notifications (actor_id);
CREATE INDEX IF NOT EXISTS notifications_event_type_idx ON public.notifications (event_type);
