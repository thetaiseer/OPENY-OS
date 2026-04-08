-- ============================================================
-- OPENY OS — Tasks v3 Migration
-- Upgrades the tasks table to support the full workflow hub:
-- task categories, due time, timezone, content purpose,
-- caption, denormalised client name, and an expanded status set.
-- ALL statements are idempotent (safe to re-run).
-- ============================================================

-- ── 1. New task columns ───────────────────────────────────────────────────────

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS task_category   TEXT,
  ADD COLUMN IF NOT EXISTS due_time        TIME,
  ADD COLUMN IF NOT EXISTS timezone        TEXT DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS content_purpose TEXT,
  ADD COLUMN IF NOT EXISTS caption         TEXT,
  ADD COLUMN IF NOT EXISTS client_name     TEXT,
  ADD COLUMN IF NOT EXISTS start_date      DATE;

-- ── 2. Drop the old narrow status check constraint (if it exists) and replace
--      it with the expanded set used by the v3 API.
--      We use a DO block so it's safe even if the old constraint name differs.
DO $$
BEGIN
  -- Remove any check constraint on the status column.
  -- Supabase names auto-generated check constraints as <table>_<column>_check.
  IF EXISTS (
    SELECT 1
    FROM   information_schema.table_constraints tc
    JOIN   information_schema.constraint_column_usage ccu USING (constraint_name, table_schema)
    WHERE  tc.table_schema      = 'public'
      AND  tc.table_name        = 'tasks'
      AND  tc.constraint_type   = 'CHECK'
      AND  ccu.column_name      = 'status'
  ) THEN
    -- Iterate over every check constraint that mentions the status column and drop it.
    DECLARE
      r RECORD;
    BEGIN
      FOR r IN
        SELECT tc.constraint_name
        FROM   information_schema.table_constraints tc
        JOIN   information_schema.constraint_column_usage ccu
               USING (constraint_name, table_schema)
        WHERE  tc.table_schema    = 'public'
          AND  tc.table_name      = 'tasks'
          AND  tc.constraint_type = 'CHECK'
          AND  ccu.column_name    = 'status'
      LOOP
        EXECUTE format('ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS %I', r.constraint_name);
      END LOOP;
    END;
  END IF;
END $$;

-- Add the expanded status check constraint (idempotent name).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   information_schema.table_constraints
    WHERE  table_schema     = 'public'
      AND  table_name       = 'tasks'
      AND  constraint_name  = 'tasks_status_check_v3'
  ) THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT tasks_status_check_v3
      CHECK (status IN (
        'todo',
        'in_progress',
        'in_review',
        'review',
        'waiting_client',
        'approved',
        'scheduled',
        'published',
        'done',
        'completed',
        'delivered',
        'overdue',
        'cancelled'
      ));
  END IF;
END $$;

-- ── 3. task_category check constraint ────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   information_schema.table_constraints
    WHERE  table_schema    = 'public'
      AND  table_name      = 'tasks'
      AND  constraint_name = 'tasks_task_category_check'
  ) THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT tasks_task_category_check
      CHECK (task_category IS NULL OR task_category IN (
        'internal_task',
        'content_creation',
        'design_task',
        'approval_task',
        'publishing_task',
        'asset_upload_task',
        'follow_up_task'
      ));
  END IF;
END $$;

-- ── 4. content_purpose check constraint ──────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   information_schema.table_constraints
    WHERE  table_schema    = 'public'
      AND  table_name      = 'tasks'
      AND  constraint_name = 'tasks_content_purpose_check'
  ) THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT tasks_content_purpose_check
      CHECK (content_purpose IS NULL OR content_purpose IN (
        'awareness',
        'engagement',
        'promotion',
        'branding',
        'lead_generation',
        'announcement',
        'offer_campaign'
      ));
  END IF;
END $$;

-- ── 5. Indexes for new columns ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS tasks_task_category_idx ON public.tasks (task_category);
CREATE INDEX IF NOT EXISTS tasks_due_time_idx       ON public.tasks (due_date, due_time);
