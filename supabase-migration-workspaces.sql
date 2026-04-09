-- ─────────────────────────────────────────────────────────────────────────────
-- OPENY OS — Workspaces multi-tenancy groundwork (Phase 1 · F6 + C4)
--
-- Run this in your Supabase SQL editor AFTER supabase-migration-rls-v1.sql.
--
-- This migration:
--   1. Creates the `workspaces` table
--   2. Creates a default workspace for existing data
--   3. Adds nullable `workspace_id` FK to all entity tables
--   4. Adds workspace RLS policies
--
-- After running, update your API routes to scope queries to workspace_id
-- as part of Phase 1 implementation.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Create workspaces table ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.workspaces (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  text NOT NULL DEFAULT 'My Workspace',
  slug                  text UNIQUE,                        -- URL-safe identifier
  plan                  text NOT NULL DEFAULT 'starter'
    CHECK (plan IN ('starter', 'agency', 'enterprise')),
  owner_id              uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  seat_limit            int NOT NULL DEFAULT 3,             -- max team members
  client_limit          int NOT NULL DEFAULT 1,             -- max clients
  logo_url              text,
  custom_domain         text,
  timezone              text NOT NULL DEFAULT 'UTC',
  -- Billing
  stripe_customer_id    text,
  stripe_subscription_id text,
  subscription_status   text DEFAULT 'trial'
    CHECK (subscription_status IN ('trial', 'active', 'past_due', 'cancelled', 'paused')),
  trial_ends_at         timestamptz,
  -- Onboarding
  onboarding_completed_at timestamptz,
  onboarding_step       int NOT NULL DEFAULT 0,             -- 0-5
  -- Metadata
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_workspace_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_workspace_updated_at ON public.workspaces;
CREATE TRIGGER trg_workspace_updated_at
  BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.set_workspace_updated_at();

-- ── 2. Create workspace_members junction ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.workspace_members (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role         text NOT NULL DEFAULT 'team'
    CHECK (role IN ('admin', 'manager', 'team', 'client')),
  joined_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS workspace_members_workspace_idx ON public.workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS workspace_members_user_idx      ON public.workspace_members(user_id);

-- ── 3. Create a default workspace for existing data ───────────────────────────
-- This ensures existing rows are not orphaned when workspace_id FKs are added.

INSERT INTO public.workspaces (id, name, plan, seat_limit, client_limit)
VALUES ('00000000-0000-0000-0000-000000000001', 'Default Workspace', 'enterprise', 9999, 9999)
ON CONFLICT (id) DO NOTHING;

-- ── 4. Add workspace_id FK to entity tables (nullable — backward compatible) ──

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS workspace_id uuid
    REFERENCES public.workspaces(id) ON DELETE SET NULL;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS workspace_id uuid
    REFERENCES public.workspaces(id) ON DELETE SET NULL;

ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS workspace_id uuid
    REFERENCES public.workspaces(id) ON DELETE SET NULL;

ALTER TABLE public.content_items
  ADD COLUMN IF NOT EXISTS workspace_id uuid
    REFERENCES public.workspaces(id) ON DELETE SET NULL;

ALTER TABLE public.approvals
  ADD COLUMN IF NOT EXISTS workspace_id uuid
    REFERENCES public.workspaces(id) ON DELETE SET NULL;

ALTER TABLE public.publishing_schedules
  ADD COLUMN IF NOT EXISTS workspace_id uuid
    REFERENCES public.workspaces(id) ON DELETE SET NULL;

ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS workspace_id uuid
    REFERENCES public.workspaces(id) ON DELETE SET NULL;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS workspace_id uuid
    REFERENCES public.workspaces(id) ON DELETE SET NULL;

ALTER TABLE public.automation_rules
  ADD COLUMN IF NOT EXISTS workspace_id uuid
    REFERENCES public.workspaces(id) ON DELETE SET NULL;

-- ── 5. Back-fill existing rows to the default workspace ───────────────────────
-- Remove these UPDATE statements after deploying to a fresh DB.

UPDATE public.clients            SET workspace_id = '00000000-0000-0000-0000-000000000001' WHERE workspace_id IS NULL;
UPDATE public.tasks              SET workspace_id = '00000000-0000-0000-0000-000000000001' WHERE workspace_id IS NULL;
UPDATE public.assets             SET workspace_id = '00000000-0000-0000-0000-000000000001' WHERE workspace_id IS NULL;
UPDATE public.content_items      SET workspace_id = '00000000-0000-0000-0000-000000000001' WHERE workspace_id IS NULL;
UPDATE public.approvals          SET workspace_id = '00000000-0000-0000-0000-000000000001' WHERE workspace_id IS NULL;
UPDATE public.publishing_schedules SET workspace_id = '00000000-0000-0000-0000-000000000001' WHERE workspace_id IS NULL;
UPDATE public.calendar_events    SET workspace_id = '00000000-0000-0000-0000-000000000001' WHERE workspace_id IS NULL;
UPDATE public.notifications      SET workspace_id = '00000000-0000-0000-0000-000000000001' WHERE workspace_id IS NULL;
UPDATE public.automation_rules   SET workspace_id = '00000000-0000-0000-0000-000000000001' WHERE workspace_id IS NULL;

-- ── 6. Indexes for workspace-scoped queries ───────────────────────────────────

CREATE INDEX IF NOT EXISTS clients_workspace_idx             ON public.clients(workspace_id);
CREATE INDEX IF NOT EXISTS tasks_workspace_idx               ON public.tasks(workspace_id);
CREATE INDEX IF NOT EXISTS assets_workspace_idx              ON public.assets(workspace_id);
CREATE INDEX IF NOT EXISTS content_items_workspace_idx       ON public.content_items(workspace_id);
CREATE INDEX IF NOT EXISTS approvals_workspace_idx           ON public.approvals(workspace_id);
CREATE INDEX IF NOT EXISTS publishing_schedules_workspace_idx ON public.publishing_schedules(workspace_id);

-- ── 7. RLS for workspaces ─────────────────────────────────────────────────────

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

-- Workspace members can read their workspace
CREATE POLICY "workspaces: members read"
  ON public.workspaces FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_id = workspaces.id AND user_id = auth.uid()
    )
    OR owner_id = auth.uid()
  );

-- Only owner or admin member can update
CREATE POLICY "workspaces: owner update"
  ON public.workspaces FOR UPDATE
  USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_id = workspaces.id AND user_id = auth.uid() AND role = 'admin'
    )
  );

-- ── 8. automation_runs table (for C5 — Automation Engine v2 execution log) ────

CREATE TABLE IF NOT EXISTS public.automation_runs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id       uuid REFERENCES public.automation_rules(id) ON DELETE SET NULL,
  trigger_type  text NOT NULL,
  context_json  jsonb,
  status        text NOT NULL DEFAULT 'success'
    CHECK (status IN ('success', 'error')),
  error_message text,
  duration_ms   int,
  executed_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS automation_runs_rule_idx ON public.automation_runs(rule_id);
CREATE INDEX IF NOT EXISTS automation_runs_executed_idx ON public.automation_runs(executed_at DESC);

ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;

-- Admin/manager can read execution logs
CREATE POLICY "automation_runs: admin manager read"
  ON public.automation_runs FOR SELECT
  USING (public.current_user_role() IN ('admin', 'manager'));

-- ── 9. Billing plans reference ────────────────────────────────────────────────
-- Informational only — enforced at application layer.
--
-- Starter:    1 client, 3 seats,    5 GB storage
-- Agency:     10 clients, 10 seats, 50 GB storage
-- Enterprise: unlimited
--
-- Update workspaces.seat_limit + client_limit when a Stripe subscription
-- changes via the /api/billing/webhook route (Phase 3 implementation).
