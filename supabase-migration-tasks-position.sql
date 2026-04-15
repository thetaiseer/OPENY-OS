-- OPENY OS — Tasks Position Migration
-- Adds sortable position field for kanban ordering.

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS position INTEGER NOT NULL DEFAULT 0;

-- Backfill deterministic order inside each status bucket.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY status ORDER BY created_at ASC, id ASC) - 1 AS row_pos
  FROM public.tasks
)
UPDATE public.tasks t
SET position = ranked.row_pos
FROM ranked
WHERE t.id = ranked.id
  AND (t.position IS NULL OR t.position = 0);

CREATE INDEX IF NOT EXISTS tasks_status_position_idx ON public.tasks (status, position, created_at);
