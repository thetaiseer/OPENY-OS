-- Notifications v3: module + actor attribution + filtering indexes
-- idempotent

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS module TEXT,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

UPDATE public.notifications
SET module = COALESCE(module, split_part(COALESCE(event_type, ''), '.', 1), 'system')
WHERE module IS NULL;

ALTER TABLE public.notifications
  ALTER COLUMN module SET DEFAULT 'system';

CREATE INDEX IF NOT EXISTS notifications_module_created_idx
  ON public.notifications (module, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_read_created_idx
  ON public.notifications (read, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_user_module_created_idx
  ON public.notifications (user_id, module, created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_search_vector_idx
  ON public.notifications
  USING GIN (to_tsvector('simple', COALESCE(title, '') || ' ' || COALESCE(message, '')));
