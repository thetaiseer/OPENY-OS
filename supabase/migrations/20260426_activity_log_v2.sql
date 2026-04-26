-- Centralized activity log v2: structured, filterable, immutable.
-- Safe to run multiple times.

ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS module TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT,
  ADD COLUMN IF NOT EXISTS user_role TEXT,
  ADD COLUMN IF NOT EXISTS related_entity_type TEXT,
  ADD COLUMN IF NOT EXISTS related_entity_id UUID,
  ADD COLUMN IF NOT EXISTS metadata_json JSONB;

UPDATE public.activities
SET module = COALESCE(module, split_part(type, '.', 1), 'system')
WHERE module IS NULL;

UPDATE public.activities
SET status = COALESCE(status, 'success')
WHERE status IS NULL;

UPDATE public.activities
SET related_entity_type = COALESCE(related_entity_type, entity_type),
    related_entity_id = COALESCE(related_entity_id, entity_id)
WHERE related_entity_type IS NULL OR related_entity_id IS NULL;

ALTER TABLE public.activities
  ALTER COLUMN module SET DEFAULT 'system',
  ALTER COLUMN status SET DEFAULT 'success';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'activities_status_check'
      AND conrelid = 'public.activities'::regclass
  ) THEN
    ALTER TABLE public.activities
      ADD CONSTRAINT activities_status_check
      CHECK (status IN ('success', 'failed', 'pending'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_activities_module_created
  ON public.activities (module, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_type_created
  ON public.activities (type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_status_created
  ON public.activities (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_role_created
  ON public.activities (user_role, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_related_entity
  ON public.activities (related_entity_type, related_entity_id);

CREATE INDEX IF NOT EXISTS idx_activities_search_vector
  ON public.activities
  USING GIN (to_tsvector('simple', COALESCE(title, '') || ' ' || COALESCE(description, '')));

CREATE OR REPLACE FUNCTION public.activities_sync_related_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.related_entity_type IS NULL THEN
    NEW.related_entity_type := NEW.entity_type;
  END IF;
  IF NEW.related_entity_id IS NULL THEN
    NEW.related_entity_id := NEW.entity_id;
  END IF;
  IF NEW.module IS NULL OR btrim(NEW.module) = '' THEN
    NEW.module := COALESCE(NULLIF(split_part(COALESCE(NEW.type, ''), '.', 1), ''), 'system');
  END IF;
  IF NEW.status IS NULL OR btrim(NEW.status) = '' THEN
    NEW.status := 'success';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_activities_sync_related_fields ON public.activities;
CREATE TRIGGER trg_activities_sync_related_fields
BEFORE INSERT ON public.activities
FOR EACH ROW EXECUTE FUNCTION public.activities_sync_related_fields();
