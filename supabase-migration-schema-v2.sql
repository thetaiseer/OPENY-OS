-- ============================================================
-- OPENY OS — Schema v2 Migration
-- Production-grade relational structure connecting all modules.
--
-- Steps covered:
--   Step 1: Non-breaking additions to existing tables + new tables
--   Step 2: Extend content_items
--   Step 3: Fix publishing_schedules
--   Step 4: Fix approvals (proper FKs)
--   Step 5: Data backfills (safe, idempotent)
--
-- ALL statements use IF NOT EXISTS / IF EXISTS so this file is
-- safe to re-run against any schema version.
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- STEP 1 — NON-BREAKING ADDITIONS
-- ══════════════════════════════════════════════════════════════

-- ── 1.1 clients.drive_folder_id ──────────────────────────────────────────────
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS drive_folder_id TEXT;

COMMENT ON COLUMN public.clients.drive_folder_id IS 'Google Drive root folder ID for this client (Clients/{name}/)';

-- ── 1.2 profiles: avatar, status, updated_at ─────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar     TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Add status with constraint only if column does not yet exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE  table_schema = 'public'
      AND  table_name   = 'profiles'
      AND  column_name  = 'status'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'inactive', 'suspended'));
  END IF;
END $$;

-- Also expand the role check to include 'manager' if not already there
DO $$
BEGIN
  -- Drop old constraint, re-add with manager included
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE  table_schema   = 'public'
      AND  table_name     = 'profiles'
      AND  constraint_name = 'profiles_role_check'
  ) THEN
    ALTER TABLE public.profiles DROP CONSTRAINT profiles_role_check;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE  table_schema   = 'public'
      AND  table_name     = 'profiles'
      AND  constraint_name = 'profiles_role_check_v2'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_role_check_v2
      CHECK (role IN ('admin', 'manager', 'team_member', 'client'));
  END IF;
END $$;

-- ── 1.3 tasks: assignee_id, created_by (UUID FKs), notes, content_item_id, approval_id ──
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS assignee_id      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS content_item_id  UUID,   -- FK added after content_items extended
  ADD COLUMN IF NOT EXISTS approval_id      UUID,   -- FK added after approvals extended
  ADD COLUMN IF NOT EXISTS notes            TEXT;

-- created_by: may already exist as TEXT; add UUID version alongside it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE  table_schema = 'public'
      AND  table_name   = 'tasks'
      AND  column_name  = 'created_by_id'
  ) THEN
    ALTER TABLE public.tasks
      ADD COLUMN created_by_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ── 1.4 assets: status, original_filename ────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE  table_schema = 'public'
      AND  table_name   = 'assets'
      AND  column_name  = 'status'
  ) THEN
    ALTER TABLE public.assets
      ADD COLUMN status TEXT NOT NULL DEFAULT 'ready';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE  table_schema   = 'public'
      AND  table_name     = 'assets'
      AND  constraint_name = 'assets_status_check'
  ) THEN
    ALTER TABLE public.assets
      ADD CONSTRAINT assets_status_check
      CHECK (status IN ('pending', 'ready', 'linked', 'archived'));
  END IF;
END $$;

ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS original_filename TEXT;

-- ── 1.5 activities: entity_type, entity_id, metadata_json, user_uuid ─────────
ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS entity_type    TEXT,
  ADD COLUMN IF NOT EXISTS entity_id      UUID,
  ADD COLUMN IF NOT EXISTS metadata_json  JSONB,
  ADD COLUMN IF NOT EXISTS user_uuid      UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS activities_entity_idx
  ON public.activities (entity_type, entity_id);

-- ── 1.6 NEW TABLE: task_asset_links ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.task_asset_links (
  task_id   UUID        NOT NULL REFERENCES public.tasks(id)  ON DELETE CASCADE,
  asset_id  UUID        NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  linked_by UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  PRIMARY KEY (task_id, asset_id)
);

CREATE INDEX IF NOT EXISTS task_asset_links_task_idx  ON public.task_asset_links (task_id);
CREATE INDEX IF NOT EXISTS task_asset_links_asset_idx ON public.task_asset_links (asset_id);

ALTER TABLE public.task_asset_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow all task_asset_links"
  ON public.task_asset_links FOR ALL USING (true) WITH CHECK (true);

-- ── 1.7 NEW TABLE: calendar_events ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.calendar_events (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title                  TEXT        NOT NULL,
  client_id              UUID        REFERENCES public.clients(id)              ON DELETE SET NULL,
  task_id                UUID        REFERENCES public.tasks(id)                ON DELETE SET NULL,
  publishing_schedule_id UUID        REFERENCES public.publishing_schedules(id) ON DELETE SET NULL,
  event_type             TEXT        NOT NULL DEFAULT 'task'
    CHECK (event_type IN ('task', 'publishing', 'deadline', 'meeting', 'reminder', 'other')),
  starts_at              TIMESTAMPTZ NOT NULL,
  ends_at                TIMESTAMPTZ,
  status                 TEXT        NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'cancelled', 'completed')),
  notes                  TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS calendar_events_client_idx   ON public.calendar_events (client_id);
CREATE INDEX IF NOT EXISTS calendar_events_task_idx     ON public.calendar_events (task_id);
CREATE INDEX IF NOT EXISTS calendar_events_starts_at_idx ON public.calendar_events (starts_at);
CREATE INDEX IF NOT EXISTS calendar_events_status_idx   ON public.calendar_events (status);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_calendar_events_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_calendar_events_updated_at ON public.calendar_events;
CREATE TRIGGER trg_calendar_events_updated_at
  BEFORE UPDATE ON public.calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.update_calendar_events_updated_at();

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow all calendar_events"
  ON public.calendar_events FOR ALL USING (true) WITH CHECK (true);


-- ══════════════════════════════════════════════════════════════
-- STEP 2 — EXTEND content_items
-- ══════════════════════════════════════════════════════════════

ALTER TABLE public.content_items
  ADD COLUMN IF NOT EXISTS description     TEXT,
  ADD COLUMN IF NOT EXISTS platform_targets TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS post_types       TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS purpose          TEXT,
  ADD COLUMN IF NOT EXISTS caption          TEXT,
  ADD COLUMN IF NOT EXISTS task_id          UUID REFERENCES public.tasks(id)    ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approval_id      UUID,   -- FK added after approvals extended
  ADD COLUMN IF NOT EXISTS created_by       UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Expand content_items status check constraint
DO $$
BEGIN
  -- Drop any existing status check constraint on content_items
  DECLARE r RECORD;
  BEGIN
    FOR r IN
      SELECT tc.constraint_name
      FROM   information_schema.table_constraints tc
      JOIN   information_schema.constraint_column_usage ccu
             USING (constraint_name, table_schema)
      WHERE  tc.table_schema    = 'public'
        AND  tc.table_name      = 'content_items'
        AND  tc.constraint_type = 'CHECK'
        AND  ccu.column_name    = 'status'
    LOOP
      EXECUTE format('ALTER TABLE public.content_items DROP CONSTRAINT IF EXISTS %I', r.constraint_name);
    END LOOP;
  END;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE  table_schema   = 'public'
      AND  table_name     = 'content_items'
      AND  constraint_name = 'content_items_status_check_v2'
  ) THEN
    ALTER TABLE public.content_items
      ADD CONSTRAINT content_items_status_check_v2
      CHECK (status IN (
        'draft', 'pending_review', 'approved', 'scheduled', 'published', 'rejected'
      ));
  END IF;
END $$;

-- purpose check constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE  table_schema   = 'public'
      AND  table_name     = 'content_items'
      AND  constraint_name = 'content_items_purpose_check'
  ) THEN
    ALTER TABLE public.content_items
      ADD CONSTRAINT content_items_purpose_check
      CHECK (purpose IS NULL OR purpose IN (
        'awareness', 'engagement', 'promotion', 'branding',
        'lead_generation', 'announcement', 'offer_campaign'
      ));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS content_items_task_idx   ON public.content_items (task_id);
CREATE INDEX IF NOT EXISTS content_items_client_idx ON public.content_items (client_id);
CREATE INDEX IF NOT EXISTS content_items_status_idx ON public.content_items (status);


-- ══════════════════════════════════════════════════════════════
-- STEP 3 — FIX publishing_schedules
-- ══════════════════════════════════════════════════════════════

-- 3.1 Make asset_id nullable (was NOT NULL — blocks content-first workflows)
ALTER TABLE public.publishing_schedules
  ALTER COLUMN asset_id DROP NOT NULL;

-- 3.2 Add content_item_id and published_at
ALTER TABLE public.publishing_schedules
  ADD COLUMN IF NOT EXISTS content_item_id UUID REFERENCES public.content_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS published_at     TIMESTAMPTZ;

-- 3.3 Expand status enum: add 'queued'; backfill 'draft'/'pending_review' → 'scheduled'
UPDATE public.publishing_schedules
  SET status = 'scheduled'
  WHERE status IN ('draft', 'pending_review');

-- Drop old status constraint and add new one
DO $$
BEGIN
  DECLARE r RECORD;
  BEGIN
    FOR r IN
      SELECT tc.constraint_name
      FROM   information_schema.table_constraints tc
      JOIN   information_schema.constraint_column_usage ccu
             USING (constraint_name, table_schema)
      WHERE  tc.table_schema    = 'public'
        AND  tc.table_name      = 'publishing_schedules'
        AND  tc.constraint_type = 'CHECK'
        AND  ccu.column_name    = 'status'
    LOOP
      EXECUTE format('ALTER TABLE public.publishing_schedules DROP CONSTRAINT IF EXISTS %I', r.constraint_name);
    END LOOP;
  END;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE  table_schema   = 'public'
      AND  table_name     = 'publishing_schedules'
      AND  constraint_name = 'publishing_schedules_status_check_v2'
  ) THEN
    ALTER TABLE public.publishing_schedules
      ADD CONSTRAINT publishing_schedules_status_check_v2
      CHECK (status IN ('scheduled', 'queued', 'published', 'missed', 'cancelled'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS publishing_schedules_content_item_idx
  ON public.publishing_schedules (content_item_id);


-- ══════════════════════════════════════════════════════════════
-- STEP 4 — FIX approvals (proper FKs + timestamps)
-- ══════════════════════════════════════════════════════════════

-- 4.1 Add structural FK columns
ALTER TABLE public.approvals
  ADD COLUMN IF NOT EXISTS task_id         UUID REFERENCES public.tasks(id)         ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS content_item_id UUID REFERENCES public.content_items(id)  ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS asset_id        UUID REFERENCES public.assets(id)         ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewer_id     UUID REFERENCES public.profiles(id)       ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS notes           TEXT,
  ADD COLUMN IF NOT EXISTS approved_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 4.2 Expand approval status check constraint
DO $$
BEGIN
  DECLARE r RECORD;
  BEGIN
    FOR r IN
      SELECT tc.constraint_name
      FROM   information_schema.table_constraints tc
      JOIN   information_schema.constraint_column_usage ccu
             USING (constraint_name, table_schema)
      WHERE  tc.table_schema    = 'public'
        AND  tc.table_name      = 'approvals'
        AND  tc.constraint_type = 'CHECK'
        AND  ccu.column_name    = 'status'
    LOOP
      EXECUTE format('ALTER TABLE public.approvals DROP CONSTRAINT IF EXISTS %I', r.constraint_name);
    END LOOP;
  END;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE  table_schema   = 'public'
      AND  table_name     = 'approvals'
      AND  constraint_name = 'approvals_status_check_v2'
  ) THEN
    ALTER TABLE public.approvals
      ADD CONSTRAINT approvals_status_check_v2
      CHECK (status IN ('pending', 'approved', 'rejected'));
  END IF;
END $$;

-- Auto-update updated_at on approvals
CREATE OR REPLACE FUNCTION public.update_approvals_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_approvals_updated_at ON public.approvals;
CREATE TRIGGER trg_approvals_updated_at
  BEFORE UPDATE ON public.approvals
  FOR EACH ROW EXECUTE FUNCTION public.update_approvals_updated_at();

-- 4.3 Populate approved_at / rejected_at from approval_history (best-effort)
UPDATE public.approvals a
SET approved_at = (
  SELECT MAX(ah.created_at) FROM public.approval_history ah
  WHERE  ah.asset_id = a.asset_id AND ah.action = 'approved'
)
WHERE a.approved_at IS NULL
  AND a.asset_id IS NOT NULL;

UPDATE public.approvals a
SET rejected_at = (
  SELECT MAX(ah.created_at) FROM public.approval_history ah
  WHERE  ah.asset_id = a.asset_id AND ah.action = 'rejected'
)
WHERE a.rejected_at IS NULL
  AND a.asset_id IS NOT NULL;

-- 4.4 Index
CREATE INDEX IF NOT EXISTS approvals_task_idx         ON public.approvals (task_id);
CREATE INDEX IF NOT EXISTS approvals_asset_idx        ON public.approvals (asset_id);
CREATE INDEX IF NOT EXISTS approvals_content_item_idx ON public.approvals (content_item_id);
CREATE INDEX IF NOT EXISTS approvals_status_idx       ON public.approvals (status);


-- ══════════════════════════════════════════════════════════════
-- STEP 5 — DATA BACKFILLS
-- ══════════════════════════════════════════════════════════════

-- 5.1 tasks: backfill assignee_id from profiles where email matches assigned_to text
UPDATE public.tasks t
SET assignee_id = p.id
FROM public.profiles p
WHERE p.email = t.assigned_to
  AND t.assignee_id IS NULL
  AND t.assigned_to IS NOT NULL
  AND t.assigned_to LIKE '%@%';

-- 5.2 tasks: backfill created_by_id from profiles where email matches created_by text
UPDATE public.tasks t
SET created_by_id = p.id
FROM public.profiles p
WHERE p.email = t.created_by
  AND t.created_by_id IS NULL
  AND t.created_by IS NOT NULL
  AND t.created_by LIKE '%@%';

-- 5.3 task_asset_links: backfill from existing tasks.asset_id single-link
INSERT INTO public.task_asset_links (task_id, asset_id)
SELECT t.id, t.asset_id
FROM   public.tasks t
WHERE  t.asset_id IS NOT NULL
ON CONFLICT (task_id, asset_id) DO NOTHING;

-- 5.4 tasks: backfill task status aliases
UPDATE public.tasks
SET status = 'in_review'
WHERE status = 'review';

UPDATE public.tasks
SET status = 'completed'
WHERE status IN ('done', 'delivered');

-- 5.5 publishing_schedules: status aliases were already backfilled in Step 3.
--     No duplicate UPDATE needed here.

-- 5.6 assets.status: best-effort backfill for existing rows.
-- Note: assets that have a task_id set from the old single-link model are marked
-- 'linked' here as a reasonable approximation. Once task_asset_links is fully
-- adopted, this field should be managed exclusively through that junction table.
UPDATE public.assets
SET status = CASE
  WHEN is_deleted = true           THEN 'archived'
  WHEN task_id IS NOT NULL         THEN 'linked'
  WHEN upload_state = 'completed'  THEN 'ready'
  ELSE 'ready'
END
WHERE status = 'ready';  -- Only rows with the default — don't overwrite manual values


-- ══════════════════════════════════════════════════════════════
-- STEP 6 — ADD DEFERRED FKs (after all referenced tables exist)
-- ══════════════════════════════════════════════════════════════

-- tasks.content_item_id → content_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE  table_schema   = 'public'
      AND  table_name     = 'tasks'
      AND  constraint_name = 'tasks_content_item_id_fkey'
  ) THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT tasks_content_item_id_fkey
      FOREIGN KEY (content_item_id) REFERENCES public.content_items(id) ON DELETE SET NULL;
  END IF;
END $$;

-- tasks.approval_id → approvals
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE  table_schema   = 'public'
      AND  table_name     = 'tasks'
      AND  constraint_name = 'tasks_approval_id_fkey'
  ) THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT tasks_approval_id_fkey
      FOREIGN KEY (approval_id) REFERENCES public.approvals(id) ON DELETE SET NULL;
  END IF;
END $$;

-- content_items.approval_id → approvals
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE  table_schema   = 'public'
      AND  table_name     = 'content_items'
      AND  constraint_name = 'content_items_approval_id_fkey'
  ) THEN
    ALTER TABLE public.content_items
      ADD CONSTRAINT content_items_approval_id_fkey
      FOREIGN KEY (approval_id) REFERENCES public.approvals(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ── Final indexes for new FK columns on tasks ─────────────────────────────────
CREATE INDEX IF NOT EXISTS tasks_assignee_id_idx     ON public.tasks (assignee_id);
CREATE INDEX IF NOT EXISTS tasks_created_by_id_idx   ON public.tasks (created_by_id);
CREATE INDEX IF NOT EXISTS tasks_content_item_id_idx ON public.tasks (content_item_id);
CREATE INDEX IF NOT EXISTS tasks_approval_id_idx     ON public.tasks (approval_id);
