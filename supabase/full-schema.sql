-- =============================================================================
-- OPENY OS — consolidated database schema
-- Generated: 2026-04-27T18:08:51.321Z
-- Source: 70 files under supabase/migrations/ (lexicographic order = Supabase CLI migration order)
--
-- Run on a new Supabase project at your own risk: review RLS, grants, and storage
-- policies for your environment. Prefer supabase db push for incremental history.
-- =============================================================================

-- Canonical extensions (migrations also reference pgcrypto; duplicates below are commented)
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- >>> BEGIN: 20260425_accounting_settlement.sql
-- Partner settlement: who paid each expense, inter-partner transfers, month notes

ALTER TABLE docs_accounting_expenses
  ADD COLUMN IF NOT EXISTS paid_by_partner TEXT;

CREATE TABLE IF NOT EXISTS docs_accounting_transfers (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  month_key       TEXT NOT NULL,
  from_partner    TEXT NOT NULL,
  to_partner      TEXT NOT NULL,
  amount          NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency        TEXT DEFAULT 'SAR',
  transfer_date   DATE DEFAULT CURRENT_DATE,
  notes           TEXT,
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_docs_accounting_transfers_month
  ON docs_accounting_transfers(month_key);

CREATE TABLE IF NOT EXISTS docs_accounting_month_meta (
  month_key   TEXT PRIMARY KEY,
  notes       TEXT DEFAULT '',
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER docs_accounting_transfers_updated_at
  BEFORE UPDATE ON docs_accounting_transfers
  FOR EACH ROW EXECUTE FUNCTION docs_set_updated_at();

CREATE TRIGGER docs_accounting_month_meta_updated_at
  BEFORE UPDATE ON docs_accounting_month_meta
  FOR EACH ROW EXECUTE FUNCTION docs_set_updated_at();

ALTER TABLE docs_accounting_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "docs_accounting_transfers_auth"
  ON docs_accounting_transfers FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

ALTER TABLE docs_accounting_month_meta ENABLE ROW LEVEL SECURITY;

CREATE POLICY "docs_accounting_month_meta_auth"
  ON docs_accounting_month_meta FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
-- <<< END: 20260425_accounting_settlement.sql


-- >>> BEGIN: 20260425_unified_missing_columns.sql
-- ============================================================================
-- OPENY OS — Unified Missing Columns Patch
-- Generated from code usage audit on 2026-04-25
-- ============================================================================
-- Purpose:
-- 1) Add missing columns that runtime code expects (safe, idempotent).
-- 2) Cover requested business columns for clients/assets.
-- 3) Backfill core app tables (tasks/projects/profiles) to avoid query failures.
--
-- Notes:
-- - This file uses ADD COLUMN IF NOT EXISTS everywhere.
-- - It is safe to run multiple times.
-- - It does NOT drop or rewrite existing columns.
-- ============================================================================

BEGIN;

-- (consolidated at top) CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- ----------------------------------------------------------------------------
-- 1) CLIENTS — requested + code-referenced safety columns
-- ----------------------------------------------------------------------------
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS tax_number text,
  ADD COLUMN IF NOT EXISTS contact_person text,
  ADD COLUMN IF NOT EXISTS social_media jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS default_currency text DEFAULT 'USD';

CREATE INDEX IF NOT EXISTS clients_slug_idx ON public.clients(slug);
CREATE INDEX IF NOT EXISTS clients_created_by_idx ON public.clients(created_by);

-- ----------------------------------------------------------------------------
-- 2) ASSETS — requested + code-referenced safety columns
-- ----------------------------------------------------------------------------
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS original_filename text,
  ADD COLUMN IF NOT EXISTS uploaded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS folder text,
  ADD COLUMN IF NOT EXISTS mime_type text,
  ADD COLUMN IF NOT EXISTS width integer,
  ADD COLUMN IF NOT EXISTS height integer,
  ADD COLUMN IF NOT EXISTS duration numeric,
  ADD COLUMN IF NOT EXISTS duration_seconds integer,
  ADD COLUMN IF NOT EXISTS thumbnail_url text,
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS file_path text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ready',
  ADD COLUMN IF NOT EXISTS upload_state text,
  ADD COLUMN IF NOT EXISTS preview_status text,
  ADD COLUMN IF NOT EXISTS version_number integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS parent_asset_id uuid REFERENCES public.assets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS main_category text,
  ADD COLUMN IF NOT EXISTS sub_category text,
  ADD COLUMN IF NOT EXISTS storage_key text,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS source_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}'::text[];

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'assets'
      AND constraint_name = 'assets_status_check_unified_patch'
  ) THEN
    ALTER TABLE public.assets
      ADD CONSTRAINT assets_status_check_unified_patch
      CHECK (status IN ('pending', 'ready', 'linked', 'archived'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS assets_uploaded_by_idx ON public.assets(uploaded_by);
CREATE INDEX IF NOT EXISTS assets_is_public_idx ON public.assets(is_public);
CREATE INDEX IF NOT EXISTS assets_file_path_idx ON public.assets(file_path);

-- ----------------------------------------------------------------------------
-- 3) TASKS — columns used across API/UI code
-- ----------------------------------------------------------------------------
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS position integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS due_time time,
  ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS task_date date,
  ADD COLUMN IF NOT EXISTS task_category text,
  ADD COLUMN IF NOT EXISTS content_purpose text,
  ADD COLUMN IF NOT EXISTS caption text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS client_name text,
  ADD COLUMN IF NOT EXISTS assigned_to text,
  ADD COLUMN IF NOT EXISTS assignee_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by text,
  ADD COLUMN IF NOT EXISTS created_by_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS content_item_id uuid REFERENCES public.content_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approval_id uuid REFERENCES public.approvals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS mentions text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS publishing_schedule_id uuid REFERENCES public.publishing_schedules(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS asset_id uuid REFERENCES public.assets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS platforms text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS post_types text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS reminder_at timestamptz,
  ADD COLUMN IF NOT EXISTS linked_drive_folder_id text;

CREATE INDEX IF NOT EXISTS tasks_project_id_idx ON public.tasks(project_id);
CREATE INDEX IF NOT EXISTS tasks_assignee_id_idx ON public.tasks(assignee_id);
CREATE INDEX IF NOT EXISTS tasks_created_by_id_idx ON public.tasks(created_by_id);

-- ----------------------------------------------------------------------------
-- 4) PROJECTS — columns used across API/UI code
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'active',
  start_date date,
  end_date date,
  color text DEFAULT '#6366f1',
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS end_date date,
  ADD COLUMN IF NOT EXISTS color text DEFAULT '#6366f1',
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'projects'
      AND constraint_name = 'projects_status_check_unified_patch'
  ) THEN
    ALTER TABLE public.projects
      ADD CONSTRAINT projects_status_check_unified_patch
      CHECK (status IN ('planning', 'active', 'on_hold', 'completed', 'cancelled'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS projects_workspace_id_idx ON public.projects(workspace_id);
CREATE INDEX IF NOT EXISTS projects_client_id_idx ON public.projects(client_id);
CREATE INDEX IF NOT EXISTS projects_created_by_idx ON public.projects(created_by);

-- ----------------------------------------------------------------------------
-- 5) PROFILES — columns used by auth/team/notifications flows
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'team_member',
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS email text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'team_member',
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS avatar text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND constraint_name = 'profiles_status_check_unified_patch'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_status_check_unified_patch
      CHECK (status IN ('active', 'inactive', 'suspended'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND constraint_name = 'profiles_role_check_unified_patch'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_role_check_unified_patch
      CHECK (role IN ('owner', 'admin', 'manager', 'team_member', 'member', 'viewer', 'client'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS profiles_email_idx ON public.profiles(email);
CREATE INDEX IF NOT EXISTS profiles_status_idx ON public.profiles(status);
CREATE INDEX IF NOT EXISTS profiles_role_idx ON public.profiles(role);

COMMIT;
-- <<< END: 20260425_unified_missing_columns.sql


-- >>> BEGIN: 20260425_user_sessions_missing_columns.sql
-- Ensure user_sessions contains columns used by API/session security UI.
-- Safe to run multiple times.

ALTER TABLE IF EXISTS public.user_sessions
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS city text;
-- <<< END: 20260425_user_sessions_missing_columns.sql


-- >>> BEGIN: 20260426_activity_log_v2.sql
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
-- <<< END: 20260426_activity_log_v2.sql


-- >>> BEGIN: 20260426_clients_logo_column.sql
-- Client brand image URL (public CDN or storage URL), shown in UI and on asset covers.
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS logo text;
-- <<< END: 20260426_clients_logo_column.sql


-- >>> BEGIN: 20260426_notifications_v3_module_targeting.sql
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
-- <<< END: 20260426_notifications_v3_module_targeting.sql


-- >>> BEGIN: 20260427_content_items_platform_targets_guard.sql
-- Guard migration: ensure content_items multi-platform columns exist in production.
-- Safe to run multiple times.

alter table if exists public.content_items
  add column if not exists platform_targets text[] not null default '{}',
  add column if not exists post_types text[] not null default '{}';

-- Verification (run manually in SQL editor if needed):
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name = 'content_items'
--   AND column_name = 'platform_targets';
-- <<< END: 20260427_content_items_platform_targets_guard.sql


-- >>> BEGIN: 20260427_content_items_rls_workspace_scope.sql
-- Tighten content_items read policy to workspace-scoped access.
-- Keeps RLS enabled and does not broaden permissions.

alter table public.content_items enable row level security;

drop policy if exists "content_items: staff read all" on public.content_items;
drop policy if exists "content_items: staff read scoped workspace" on public.content_items;

create policy "content_items: staff read scoped workspace"
  on public.content_items
  for select
  using (
    public.current_user_role() in ('owner', 'admin', 'manager', 'team_member')
    and (
      public.current_user_role() = 'owner'
      or exists (
        select 1
        from public.workspace_members wm
        where wm.workspace_id = content_items.workspace_id
          and wm.user_id = auth.uid()
      )
    )
  );
-- <<< END: 20260427_content_items_rls_workspace_scope.sql


-- >>> BEGIN: 20260427_intelligent_workflow_automations.sql
-- Intelligent workflow automations foundation.
-- Safe/idempotent migration.

create table if not exists public.workspace_automation_settings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  rule_key text not null,
  enabled boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, rule_key)
);

create index if not exists workspace_automation_settings_workspace_idx
  on public.workspace_automation_settings(workspace_id);

alter table public.workspace_automation_settings enable row level security;
drop policy if exists "workspace_automation_settings: team read" on public.workspace_automation_settings;
create policy "workspace_automation_settings: team read"
  on public.workspace_automation_settings for select
  using (public.current_user_role() in ('owner', 'admin', 'manager', 'team_member'));

drop policy if exists "workspace_automation_settings: admin write" on public.workspace_automation_settings;
create policy "workspace_automation_settings: admin write"
  on public.workspace_automation_settings for all
  using (public.current_user_role() in ('owner', 'admin', 'manager'));

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'projects'
      and column_name = 'health_status'
  ) then
    alter table public.projects
      add column health_status text not null default 'healthy'
      check (health_status in ('healthy', 'at_risk', 'critical'));
  end if;
end
$$;

create index if not exists projects_workspace_health_idx
  on public.projects(workspace_id, health_status);

create table if not exists public.recurring_task_schedules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null,
  description text,
  client_id uuid references public.clients(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  assignee_id uuid references auth.users(id) on delete set null,
  frequency text not null check (frequency in ('daily', 'weekly', 'monthly')),
  interval_count int not null default 1,
  next_run_at timestamptz not null,
  is_active boolean not null default true,
  last_run_at timestamptz,
  last_task_id uuid references public.tasks(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists recurring_task_schedules_workspace_idx
  on public.recurring_task_schedules(workspace_id, is_active, next_run_at);

alter table public.recurring_task_schedules enable row level security;
drop policy if exists "recurring_task_schedules: team read" on public.recurring_task_schedules;
create policy "recurring_task_schedules: team read"
  on public.recurring_task_schedules for select
  using (public.current_user_role() in ('owner', 'admin', 'manager', 'team_member'));

drop policy if exists "recurring_task_schedules: admin write" on public.recurring_task_schedules;
create policy "recurring_task_schedules: admin write"
  on public.recurring_task_schedules for all
  using (public.current_user_role() in ('owner', 'admin', 'manager'));
-- <<< END: 20260427_intelligent_workflow_automations.sql


-- >>> BEGIN: 20260427_operational_indexes.sql
-- Operational performance indexes for daily workspace workflows.
-- Safe to run multiple times.

create index if not exists idx_tasks_workspace_due_date
  on public.tasks (workspace_id, due_date);

create index if not exists idx_tasks_assignee_id
  on public.tasks (assignee_id);

create index if not exists idx_projects_client_id
  on public.projects (client_id);
-- <<< END: 20260427_operational_indexes.sql


-- >>> BEGIN: 20260427_supabase_perf_rls_indexes.sql
-- Performance + RLS support indexes for OPENY OS multi-tenant workloads.
-- Safe migration: only additive indexes.

-- Core workspace scoping
create index if not exists idx_workspace_members_workspace_user
  on public.workspace_members (workspace_id, user_id);

create index if not exists idx_workspace_members_user_workspace
  on public.workspace_members (user_id, workspace_id);

create index if not exists idx_clients_workspace_created
  on public.clients (workspace_id, created_at desc);

create index if not exists idx_clients_workspace_name
  on public.clients (workspace_id, name);

create index if not exists idx_projects_workspace_created
  on public.projects (workspace_id, created_at desc);

create index if not exists idx_projects_workspace_client
  on public.projects (workspace_id, client_id);

create index if not exists idx_projects_workspace_status
  on public.projects (workspace_id, status);

create index if not exists idx_tasks_workspace_created
  on public.tasks (workspace_id, created_at desc);

create index if not exists idx_tasks_workspace_due
  on public.tasks (workspace_id, due_date);

create index if not exists idx_tasks_workspace_status
  on public.tasks (workspace_id, status);

create index if not exists idx_tasks_workspace_assignee
  on public.tasks (workspace_id, assignee_id);

create index if not exists idx_tasks_workspace_client
  on public.tasks (workspace_id, client_id);

create index if not exists idx_assets_workspace_created
  on public.assets (workspace_id, created_at desc);

create index if not exists idx_assets_workspace_client
  on public.assets (workspace_id, client_id);

create index if not exists idx_assets_workspace_type
  on public.assets (workspace_id, content_type);

create index if not exists idx_content_items_workspace_created
  on public.content_items (workspace_id, created_at desc);

create index if not exists idx_content_items_workspace_status
  on public.content_items (workspace_id, status);

create index if not exists idx_content_items_workspace_client
  on public.content_items (workspace_id, client_id);

create index if not exists idx_activities_workspace_created
  on public.activities (workspace_id, created_at desc);

create index if not exists idx_activities_workspace_entity
  on public.activities (workspace_id, entity_type, entity_id);

create index if not exists idx_notifications_workspace_user_created
  on public.notifications (workspace_id, user_id, created_at desc);

create index if not exists idx_notifications_workspace_user_unread
  on public.notifications (workspace_id, user_id, read);

-- Docs/accounting-related
create index if not exists idx_docs_invoices_workspace_created
  on public.docs_invoices (workspace_id, created_at desc);

create index if not exists idx_docs_employees_workspace_created
  on public.docs_employees (workspace_id, created_at desc);

create index if not exists idx_docs_accounting_entries_workspace_date
  on public.docs_accounting_entries (workspace_id, entry_date desc);

-- Permissions lookups
create index if not exists idx_member_permissions_team_member_workspace_module
  on public.member_permissions (team_member_id, workspace, module);

-- Publishing schedule access patterns
create index if not exists idx_publishing_schedules_workspace_date
  on public.publishing_schedules (workspace_id, scheduled_date);
-- <<< END: 20260427_supabase_perf_rls_indexes.sql


-- >>> BEGIN: 20260427_workspace_invitations_invite_only.sql
-- Invite-only auth: canonical workspace invitations table.
-- Safe to run multiple times.

create table if not exists public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  role text not null check (role in ('owner', 'admin', 'manager', 'team_member')),
  token text not null unique,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'expired')),
  invited_by uuid references public.profiles(id) on delete set null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_workspace_invitations_workspace_id
  on public.workspace_invitations (workspace_id);

create index if not exists idx_workspace_invitations_email
  on public.workspace_invitations (lower(email));

create index if not exists idx_workspace_invitations_status
  on public.workspace_invitations (status);

create index if not exists idx_workspace_invitations_expires_at
  on public.workspace_invitations (expires_at);
-- <<< END: 20260427_workspace_invitations_invite_only.sql


-- >>> BEGIN: 20260427_workspace_invitations_rls_invite_only.sql
-- Invite-only workspace invitations schema hardening.
-- Idempotent migration.

create table if not exists public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  role text not null,
  token text unique not null,
  status text not null default 'pending',
  invited_by uuid references auth.users(id),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz default now()
);

alter table public.workspace_invitations
  alter column status set default 'pending';

alter table public.workspace_invitations
  add column if not exists accepted_at timestamptz;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'workspace_invitations'
      and column_name = 'invited_by'
  ) then
    begin
      alter table public.workspace_invitations
        drop constraint if exists workspace_invitations_invited_by_fkey;
      alter table public.workspace_invitations
        add constraint workspace_invitations_invited_by_fkey
        foreign key (invited_by) references auth.users(id);
    exception
      when duplicate_object then null;
    end;
  end if;
end $$;

create index if not exists idx_workspace_invitations_workspace_id
  on public.workspace_invitations (workspace_id);

create index if not exists idx_workspace_invitations_email
  on public.workspace_invitations (email);

create index if not exists idx_workspace_invitations_token
  on public.workspace_invitations (token);

create index if not exists idx_workspace_invitations_status
  on public.workspace_invitations (status);

alter table public.workspace_invitations enable row level security;

drop policy if exists "owners_admins_manage_workspace_invitations" on public.workspace_invitations;
create policy "owners_admins_manage_workspace_invitations"
  on public.workspace_invitations
  for all
  using (
    exists (
      select 1
      from public.workspace_memberships wm
      where wm.user_id = auth.uid()
        and wm.workspace_id = workspace_invitations.workspace_id
        and wm.is_active = true
        and wm.role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1
      from public.workspace_memberships wm
      where wm.user_id = auth.uid()
        and wm.workspace_id = workspace_invitations.workspace_id
        and wm.is_active = true
        and wm.role in ('owner', 'admin')
    )
  );
-- <<< END: 20260427_workspace_invitations_rls_invite_only.sql


-- >>> BEGIN: supabase-migration-admin-role.sql
-- OPENY OS — Admin Role Fix Migration
-- Run this in your Supabase SQL editor to promote the admin user.
--
-- Replace 'thetaiseer@gmail.com' with the actual admin email if different,
-- or set the ADMIN_EMAIL environment variable in your deployment.
--
-- This migration is SAFE to re-run (uses INSERT ... ON CONFLICT UPDATE).

-- ── 1. Promote admin email to admin role (upsert) ─────────────────────────────
INSERT INTO public.profiles (id, email, name, role)
SELECT
  au.id,
  au.email,
  coalesce(au.raw_user_meta_data ->> 'name', split_part(au.email, '@', 1)) AS name,
  'admin' AS role
FROM auth.users au
WHERE lower(au.email) = lower('thetaiseer@gmail.com')
ON CONFLICT (id)
  DO UPDATE SET role = 'admin';

-- ── 2. Ensure the auto-promote trigger checks ADMIN_EMAIL on sign-up ──────────
-- This replaces the existing trigger function so that new sign-ups from the
-- admin email automatically receive the admin role.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  -- Promote to admin if the email matches the configured admin address.
  -- The check is intentionally case-insensitive.
  IF lower(coalesce(new.email, '')) = lower(coalesce(current_setting('app.admin_email', true), 'thetaiseer@gmail.com')) THEN
    v_role := 'admin';
  ELSE
    v_role := coalesce(new.raw_user_meta_data ->> 'role', 'client');
  END IF;

  INSERT INTO public.profiles (id, email, name, role)
  VALUES (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'name', split_part(coalesce(new.email, ''), '@', 1)),
    v_role
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END;
$$;

-- Re-attach the trigger (drop first to be idempotent).
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_new_user();
-- <<< END: supabase-migration-admin-role.sql


-- >>> BEGIN: supabase-migration-advanced.sql
-- ── Advanced Assets: tags, versioning ────────────────────────────────────────
-- Run this migration in your Supabase SQL editor.

-- Add tags column (array of text) to assets table
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS version_number integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS parent_asset_id uuid REFERENCES public.assets(id) ON DELETE SET NULL;

-- GIN index for fast array search on tags
CREATE INDEX IF NOT EXISTS assets_tags_gin_idx ON public.assets USING GIN (tags);

-- ── Manager role ──────────────────────────────────────────────────────────────
-- Add 'manager' to profiles role column (if using a CHECK constraint, update it)
-- If your role column uses an enum type, alter the enum instead.
-- Example for text column with CHECK constraint (adjust as needed):
-- ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
-- ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
--   CHECK (role IN ('admin', 'manager', 'team_member', 'viewer', 'client'));

-- ── Notifications table (if not yet created) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type       text,
  message    text,
  user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id  uuid,
  task_id    uuid,
  asset_id   uuid,
  read       boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_idx ON public.notifications (user_id);
CREATE INDEX IF NOT EXISTS notifications_created_idx ON public.notifications (created_at DESC);
-- <<< END: supabase-migration-advanced.sql


-- >>> BEGIN: supabase-migration-agency-v1.sql
-- Agency v1 migration
-- Add start_date to tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS start_date date;

-- Update status check constraint on tasks
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_status_check
  CHECK (status IN ('todo', 'in_progress', 'review', 'done', 'delivered', 'overdue'));

-- Add task_id to assets
ALTER TABLE assets ADD COLUMN IF NOT EXISTS task_id uuid REFERENCES tasks(id) ON DELETE SET NULL;

-- Add uploaded_by to assets (may already exist)
ALTER TABLE assets ADD COLUMN IF NOT EXISTS uploaded_by text;

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title      text,
  message    text NOT NULL,
  type       text CHECK (type IN ('info', 'success', 'warning', 'error')),
  read       boolean DEFAULT false,
  user_id    text,
  client_id  uuid REFERENCES clients(id),
  task_id    uuid REFERENCES tasks(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- RLS: allow all on notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all on notifications" ON notifications;
CREATE POLICY "allow all on notifications" ON notifications FOR ALL USING (true) WITH CHECK (true);
-- <<< END: supabase-migration-agency-v1.sql


-- >>> BEGIN: supabase-migration-asset-previews.sql
-- ============================================================
-- OPENY OS — Asset Previews Migration
-- ============================================================
-- Adds columns needed for the file-preview enhancement system:
--   duration_seconds  — video duration in seconds
--   preview_status    — tracks preview generation state
--
-- Safe to run multiple times (ADD COLUMN IF NOT EXISTS).
-- ============================================================

ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS duration_seconds NUMERIC,
  ADD COLUMN IF NOT EXISTS preview_status   TEXT;

-- Optional constraint to keep preview_status values consistent.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   information_schema.table_constraints
    WHERE  table_schema = 'public'
      AND  table_name   = 'assets'
      AND  constraint_name = 'assets_preview_status_check'
  ) THEN
    ALTER TABLE public.assets
      ADD CONSTRAINT assets_preview_status_check
      CHECK (preview_status IS NULL OR preview_status IN (
        'pending', 'generating', 'ready', 'failed'
      ));
  END IF;
END $$;

DO $$
BEGIN
  RAISE NOTICE 'Asset previews migration complete: duration_seconds, preview_status added.';
END $$;
-- <<< END: supabase-migration-asset-previews.sql


-- >>> BEGIN: supabase-migration-assets-db-save-fix.sql
-- ============================================================
-- OPENY OS — Assets DB save fix (R2 metadata path)
-- ============================================================
-- Purpose:
--   1) Verify columns used by /api/upload/complete exist.
--   2) Ensure canonical aliases for key/url are present.
--   3) Ensure RLS allows authenticated inserts.
--   4) Refresh PostgREST schema cache (prevents stale PGRST204 cache misses).

-- 1) Inspect current assets columns (run before/after)
SELECT
  c.ordinal_position,
  c.column_name,
  c.data_type,
  c.udt_name,
  c.is_nullable,
  c.column_default
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name = 'assets'
ORDER BY c.ordinal_position;

-- 2) Ensure metadata columns used by upload completion exist
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS file_path        TEXT,
  ADD COLUMN IF NOT EXISTS storage_key      TEXT,
  ADD COLUMN IF NOT EXISTS file_key         TEXT,
  ADD COLUMN IF NOT EXISTS file_url         TEXT,
  ADD COLUMN IF NOT EXISTS public_url       TEXT,
  ADD COLUMN IF NOT EXISTS storage_provider TEXT,
  ADD COLUMN IF NOT EXISTS bucket_name      TEXT,
  ADD COLUMN IF NOT EXISTS storage_bucket   TEXT,
  ADD COLUMN IF NOT EXISTS mime_type        TEXT,
  ADD COLUMN IF NOT EXISTS preview_url      TEXT,
  ADD COLUMN IF NOT EXISTS thumbnail_url    TEXT,
  ADD COLUMN IF NOT EXISTS web_view_link    TEXT,
  ADD COLUMN IF NOT EXISTS main_category    TEXT,
  ADD COLUMN IF NOT EXISTS sub_category     TEXT,
  ADD COLUMN IF NOT EXISTS month_key        TEXT,
  ADD COLUMN IF NOT EXISTS uploaded_by      TEXT;

-- Keep aliases in sync where possible for existing rows.
UPDATE public.assets
SET
  file_key       = COALESCE(file_key, storage_key, file_path),
  storage_key    = COALESCE(storage_key, file_key, file_path),
  file_path      = COALESCE(file_path, storage_key, file_key),
  public_url     = COALESCE(public_url, file_url),
  file_url       = COALESCE(file_url, public_url),
  storage_bucket = COALESCE(storage_bucket, bucket_name),
  bucket_name    = COALESCE(bucket_name, storage_bucket);

-- 3) RLS: allow authenticated users to insert rows
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "assets_auth_insert" ON public.assets;
CREATE POLICY "assets_auth_insert"
  ON public.assets
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "assets_auth_select" ON public.assets;
CREATE POLICY "assets_auth_select"
  ON public.assets
  FOR SELECT
  TO authenticated
  USING (true);

-- Optional emergency toggle during incident response:
-- ALTER TABLE public.assets DISABLE ROW LEVEL SECURITY;

-- 4) Refresh PostgREST schema cache to clear stale metadata (PGRST204)
NOTIFY pgrst, 'reload schema';
-- <<< END: supabase-migration-assets-db-save-fix.sql


-- >>> BEGIN: supabase-migration-assets-upload-fix.sql
-- OPENY OS — Asset upload compatibility fix (Supabase Storage + DB)
-- Adds required metadata columns and authenticated RLS policies used by the
-- client-side upload flow.

ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS file_name         TEXT,
  ADD COLUMN IF NOT EXISTS original_name     TEXT,
  ADD COLUMN IF NOT EXISTS storage_path      TEXT,
  ADD COLUMN IF NOT EXISTS category          TEXT,
  ADD COLUMN IF NOT EXISTS uploaded_by_email TEXT,
  ADD COLUMN IF NOT EXISTS workspace_key     TEXT DEFAULT 'os';

ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

UPDATE public.assets
SET workspace_key = 'os'
WHERE workspace_key IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'assets'
      AND constraint_name = 'assets_workspace_key_check_v2'
  ) THEN
    ALTER TABLE public.assets
      ADD CONSTRAINT assets_workspace_key_check_v2
      CHECK (workspace_key IS NULL OR workspace_key IN ('os', 'docs'));
  END IF;
END $$;

ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "assets: authenticated select" ON public.assets;
CREATE POLICY "assets: authenticated select"
  ON public.assets FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "assets: authenticated insert" ON public.assets;
CREATE POLICY "assets: authenticated insert"
  ON public.assets FOR INSERT
  TO authenticated
  WITH CHECK (true);

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "storage: authenticated read client-assets" ON storage.objects;
CREATE POLICY "storage: authenticated read client-assets"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'client-assets');

DROP POLICY IF EXISTS "storage: authenticated insert client-assets" ON storage.objects;
CREATE POLICY "storage: authenticated insert client-assets"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'client-assets');
-- <<< END: supabase-migration-assets-upload-fix.sql


-- >>> BEGIN: supabase-migration-assets-upload-system-fix.sql
-- OPENY OS — Supabase assets upload system repair
-- Idempotent migration focused on fixing storage->DB metadata inserts.

-- ============================================================
-- 1) INSPECTION QUERIES (run anytime to inspect current state)
-- ============================================================

-- List all columns + types + required/default:
SELECT
  c.ordinal_position,
  c.column_name,
  c.data_type,
  c.udt_name,
  c.is_nullable,
  c.column_default
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name = 'assets'
ORDER BY c.ordinal_position;

-- List table constraints:
SELECT
  tc.constraint_name,
  tc.constraint_type,
  pg_get_constraintdef(con.oid) AS definition
FROM information_schema.table_constraints tc
JOIN pg_constraint con
  ON con.conname = tc.constraint_name
JOIN pg_class rel
  ON rel.oid = con.conrelid
JOIN pg_namespace nsp
  ON nsp.oid = rel.relnamespace
WHERE tc.table_schema = 'public'
  AND tc.table_name = 'assets'
  AND nsp.nspname = 'public'
ORDER BY tc.constraint_type, tc.constraint_name;

-- List RLS policies:
SELECT
  p.schemaname,
  p.tablename,
  p.policyname,
  p.roles,
  p.cmd,
  p.qual,
  p.with_check
FROM pg_policies p
WHERE p.schemaname = 'public'
  AND p.tablename = 'assets'
ORDER BY p.policyname;

-- ============================================================
-- 2) REQUIRED COLUMNS + SAFE ALTERS (NO DATA DROP)
-- ============================================================

-- (consolidated at top) CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- Ensure required columns exist with expected types.
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS file_name      TEXT,
  ADD COLUMN IF NOT EXISTS original_name  TEXT,
  ADD COLUMN IF NOT EXISTS file_extension TEXT,
  ADD COLUMN IF NOT EXISTS mime_type      TEXT,
  ADD COLUMN IF NOT EXISTS file_size      BIGINT,
  ADD COLUMN IF NOT EXISTS storage_bucket TEXT,
  ADD COLUMN IF NOT EXISTS storage_path   TEXT,
  ADD COLUMN IF NOT EXISTS public_url     TEXT,
  ADD COLUMN IF NOT EXISTS client_id      UUID,
  ADD COLUMN IF NOT EXISTS project_id     UUID,
  ADD COLUMN IF NOT EXISTS task_id        UUID,
  ADD COLUMN IF NOT EXISTS created_at     TIMESTAMPTZ;

-- uploaded_by must be UUID nullable.
DO $$
DECLARE
  uploaded_by_type TEXT;
BEGIN
  SELECT c.udt_name
  INTO uploaded_by_type
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'assets'
    AND c.column_name = 'uploaded_by';

  IF uploaded_by_type IS NULL THEN
    ALTER TABLE public.assets ADD COLUMN uploaded_by UUID;
  ELSIF uploaded_by_type <> 'uuid' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'assets'
        AND column_name = 'uploaded_by_legacy_text'
    ) THEN
      ALTER TABLE public.assets RENAME COLUMN uploaded_by TO uploaded_by_legacy_text;
    ELSE
      UPDATE public.assets
      SET uploaded_by_legacy_text = COALESCE(uploaded_by_legacy_text, uploaded_by::TEXT);
      ALTER TABLE public.assets DROP COLUMN uploaded_by;
    END IF;

    ALTER TABLE public.assets ADD COLUMN uploaded_by UUID;

    UPDATE public.assets
    SET uploaded_by = NULLIF(uploaded_by_legacy_text, '')::UUID
    WHERE uploaded_by IS NULL
      AND uploaded_by_legacy_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  END IF;
END $$;

-- Ensure defaults for id + created_at.
ALTER TABLE public.assets
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN created_at SET DEFAULT now();

-- Ensure primary key exists on id.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.assets'::regclass
      AND contype = 'p'
  ) THEN
    ALTER TABLE public.assets
      ADD CONSTRAINT assets_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- Keep optional metadata columns nullable so inserts don't fail unnecessarily.
ALTER TABLE public.assets
  ALTER COLUMN file_name DROP NOT NULL,
  ALTER COLUMN original_name DROP NOT NULL,
  ALTER COLUMN file_extension DROP NOT NULL,
  ALTER COLUMN mime_type DROP NOT NULL,
  ALTER COLUMN file_size DROP NOT NULL,
  ALTER COLUMN storage_bucket DROP NOT NULL,
  ALTER COLUMN public_url DROP NOT NULL,
  ALTER COLUMN client_id DROP NOT NULL,
  ALTER COLUMN project_id DROP NOT NULL,
  ALTER COLUMN task_id DROP NOT NULL,
  ALTER COLUMN uploaded_by DROP NOT NULL;

-- Backfill storage_path from existing path columns when possible.
DO $$
DECLARE
  has_storage_key BOOLEAN;
  has_file_path   BOOLEAN;
  has_mismatch    BOOLEAN := FALSE;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'assets' AND column_name = 'storage_key'
  ) INTO has_storage_key;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'assets' AND column_name = 'file_path'
  ) INTO has_file_path;

  IF has_storage_key AND has_file_path THEN
    EXECUTE '
      UPDATE public.assets
      SET storage_path = COALESCE(storage_path, storage_key, file_path)
      WHERE storage_path IS NULL
    ';
  ELSIF has_storage_key THEN
    EXECUTE '
      UPDATE public.assets
      SET storage_path = COALESCE(storage_path, storage_key)
      WHERE storage_path IS NULL
    ';
  ELSIF has_file_path THEN
    EXECUTE '
      UPDATE public.assets
      SET storage_path = COALESCE(storage_path, file_path)
      WHERE storage_path IS NULL
    ';
  END IF;
END $$;

-- storage_path is required for new inserts and must match canonical upload path.
DO $$
DECLARE
  has_storage_key BOOLEAN;
  has_file_path   BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'assets' AND column_name = 'storage_key'
  ) INTO has_storage_key;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'assets' AND column_name = 'file_path'
  ) INTO has_file_path;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'assets_storage_path_required_chk'
      AND conrelid = 'public.assets'::regclass
  ) THEN
    ALTER TABLE public.assets
      ADD CONSTRAINT assets_storage_path_required_chk
      CHECK (storage_path IS NOT NULL AND btrim(storage_path) <> '')
      NOT VALID;
  END IF;

  IF has_storage_key OR has_file_path THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'assets_storage_path_matches_upload_path_chk'
        AND conrelid = 'public.assets'::regclass
    ) THEN
      IF has_storage_key AND has_file_path THEN
        ALTER TABLE public.assets
          ADD CONSTRAINT assets_storage_path_matches_upload_path_chk
          CHECK (
            (file_path IS NULL OR storage_path = file_path)
            AND (storage_key IS NULL OR storage_path = storage_key)
          )
          NOT VALID;
      ELSIF has_file_path THEN
        ALTER TABLE public.assets
          ADD CONSTRAINT assets_storage_path_matches_upload_path_chk
          CHECK (file_path IS NULL OR storage_path = file_path)
          NOT VALID;
      ELSE
        ALTER TABLE public.assets
          ADD CONSTRAINT assets_storage_path_matches_upload_path_chk
          CHECK (storage_key IS NULL OR storage_path = storage_key)
          NOT VALID;
      END IF;
    END IF;
  END IF;
END $$;

-- Validate storage_path constraints only when existing rows already satisfy them.
DO $$
DECLARE
  has_storage_key BOOLEAN;
  has_file_path   BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'assets' AND column_name = 'storage_key'
  ) INTO has_storage_key;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'assets' AND column_name = 'file_path'
  ) INTO has_file_path;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'assets_storage_path_required_chk'
      AND conrelid = 'public.assets'::regclass
      AND NOT convalidated
  ) AND NOT EXISTS (
    SELECT 1
    FROM public.assets
    WHERE storage_path IS NULL OR btrim(storage_path) = ''
  ) THEN
    ALTER TABLE public.assets VALIDATE CONSTRAINT assets_storage_path_required_chk;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'assets_storage_path_matches_upload_path_chk'
      AND conrelid = 'public.assets'::regclass
      AND NOT convalidated
  ) THEN
    IF has_file_path AND has_storage_key THEN
      EXECUTE '
        SELECT EXISTS (
          SELECT 1
          FROM public.assets
          WHERE (file_path IS NOT NULL AND storage_path <> file_path)
             OR (storage_key IS NOT NULL AND storage_path <> storage_key)
        )
      ' INTO has_mismatch;
    ELSIF has_file_path THEN
      EXECUTE '
        SELECT EXISTS (
          SELECT 1
          FROM public.assets
          WHERE file_path IS NOT NULL AND storage_path <> file_path
        )
      ' INTO has_mismatch;
    ELSIF has_storage_key THEN
      EXECUTE '
        SELECT EXISTS (
          SELECT 1
          FROM public.assets
          WHERE storage_key IS NOT NULL AND storage_path <> storage_key
        )
      ' INTO has_mismatch;
    ELSE
      has_mismatch := FALSE;
    END IF;

    IF NOT has_mismatch THEN
      ALTER TABLE public.assets VALIDATE CONSTRAINT assets_storage_path_matches_upload_path_chk;
    END IF;
  END IF;
END $$;

-- Keep commonly-used aliases in sync for new writes.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'assets'
      AND column_name = 'bucket_name'
  ) THEN
    UPDATE public.assets
    SET storage_bucket = COALESCE(storage_bucket, bucket_name)
    WHERE storage_bucket IS NULL;
  END IF;
END $$;

-- ============================================================
-- 3) RLS FIX (AUTHENTICATED INSERT + SELECT)
-- ============================================================

ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "assets_auth_select" ON public.assets;
CREATE POLICY "assets_auth_select"
  ON public.assets
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "assets_auth_insert" ON public.assets;
CREATE POLICY "assets_auth_insert"
  ON public.assets
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================================
-- 4) DEBUG INSERT TEST (SAFE MANUAL CHECK)
-- ============================================================

-- Run as authenticated user in SQL editor/session:
-- BEGIN;
-- INSERT INTO assets (
--   file_name,
--   original_name,
--   storage_bucket,
--   storage_path,
--   file_size
-- )
-- VALUES (
--   'test.pdf',
--   'test.pdf',
--   'assets',
--   'Clients/test/test.pdf',
--   12345
-- )
-- RETURNING id, file_name, storage_path, created_at;
-- ROLLBACK;

-- Final step: refresh PostgREST schema cache.
NOTIFY pgrst, 'reload schema';
-- <<< END: supabase-migration-assets-upload-system-fix.sql


-- >>> BEGIN: supabase-migration-assets-v2.sql
-- ============================================================
-- OPENY OS – Assets v2 Migration
-- Adds main_category, sub_category, and storage_key columns
-- to the assets table to support the new folder hierarchy:
--   Client → Main Category → Year → Month → Subcategory → Files
-- ============================================================

-- New category columns
ALTER TABLE assets ADD COLUMN IF NOT EXISTS main_category TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS sub_category  TEXT;

-- Canonical storage key in the new hierarchy format:
--   clients/{clientSlug}/{mainCategory}/{year}/{month}/{subCategory}/{timestamp}-{filename}
ALTER TABLE assets ADD COLUMN IF NOT EXISTS storage_key   TEXT;

-- Back-fill storage_key from file_path for assets uploaded before this migration
UPDATE assets SET storage_key = file_path WHERE storage_key IS NULL AND file_path IS NOT NULL;

-- Indexes for efficient filtering
CREATE INDEX IF NOT EXISTS idx_assets_main_category ON assets(main_category);
CREATE INDEX IF NOT EXISTS idx_assets_sub_category  ON assets(sub_category);
CREATE INDEX IF NOT EXISTS idx_assets_storage_key   ON assets(storage_key);
CREATE INDEX IF NOT EXISTS idx_assets_client_id_cat ON assets(client_id, main_category);
CREATE INDEX IF NOT EXISTS idx_assets_created_at    ON assets(created_at DESC);
-- <<< END: supabase-migration-assets-v2.sql


-- >>> BEGIN: supabase-migration-auth-hardening.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Auth Hardening Migration
-- Run this in your Supabase SQL Editor.
--
-- Changes:
--   1. Updates team_invitations.status from 'invited' → 'pending' (renames
--      the active status value to match the canonical SaaS invitation model).
--   2. Adds revoked_at column to team_invitations.
--   3. Adds 'removed' to team_members.status allowed values.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Fix team_invitations.status ──────────────────────────────────────────

-- Drop the existing status CHECK constraint (auto-named by Postgres).
DO $$
DECLARE
  cname text;
BEGIN
  FOR cname IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.team_invitations'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%status%'
  LOOP
    EXECUTE 'ALTER TABLE public.team_invitations DROP CONSTRAINT ' || quote_ident(cname);
  END LOOP;
END;
$$;

-- Migrate existing 'invited' rows to 'pending'.
UPDATE public.team_invitations
SET status = 'pending'
WHERE status = 'invited';

-- Re-add the constraint with the correct allowed values.
ALTER TABLE public.team_invitations
  ADD CONSTRAINT team_invitations_status_check
    CHECK (status IN ('pending', 'accepted', 'expired', 'revoked'));

-- ── 2. Add revoked_at column ────────────────────────────────────────────────
ALTER TABLE public.team_invitations
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;

-- ── 3. Update team_members.status to add 'removed' ──────────────────────────
DO $$
DECLARE
  cname text;
BEGIN
  FOR cname IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.team_members'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%status%'
  LOOP
    EXECUTE 'ALTER TABLE public.team_members DROP CONSTRAINT ' || quote_ident(cname);
  END LOOP;
END;
$$;

ALTER TABLE public.team_members
  ADD CONSTRAINT team_members_status_check
    CHECK (status IN ('invited', 'active', 'inactive', 'suspended', 'removed'));
-- <<< END: supabase-migration-auth-hardening.sql


-- >>> BEGIN: supabase-migration-automations.sql
-- ── Automation Rules table ────────────────────────────────────────────────────
-- Run this migration in your Supabase SQL editor.

CREATE TABLE IF NOT EXISTS public.automation_rules (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  trigger_type   text NOT NULL CHECK (trigger_type IN ('task_completed', 'asset_uploaded', 'deadline_near')),
  condition_json jsonb,
  action_type    text NOT NULL CHECK (action_type IN ('send_notification', 'link_asset_to_client', 'alert_user', 'send_slack')),
  action_config  jsonb NOT NULL DEFAULT '{}',
  enabled        boolean NOT NULL DEFAULT true,
  created_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Index for efficient trigger lookups
CREATE INDEX IF NOT EXISTS automation_rules_trigger_idx ON public.automation_rules (trigger_type) WHERE enabled = true;

-- RLS: only admin/manager can manage rules
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage automation rules"
  ON public.automation_rules
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );
-- <<< END: supabase-migration-automations.sql


-- >>> BEGIN: supabase-migration-bidirectional-sync.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: bidirectional sync columns
-- Adds last_synced_at, source_updated_at, and is_deleted to the assets table
-- so the sync engine can track when each row was last confirmed alive in Drive
-- and whether the remote file has been removed.
-- ─────────────────────────────────────────────────────────────────────────────

-- Timestamp of the last successful Drive → DB sync pass that touched this row.
ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;

-- Timestamp reported by Google Drive as the file's last-modified time.
ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS source_updated_at timestamptz;

-- Soft-delete flag: true when the file was detected as missing from Drive
-- during a sync pass.  Hard-deletes are still used for app-initiated deletes.
ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;

-- Index for efficient filtering of non-deleted assets.
CREATE INDEX IF NOT EXISTS assets_is_deleted_idx ON assets (is_deleted);
-- Index for filtering Drive assets needing re-sync.
CREATE INDEX IF NOT EXISTS assets_last_synced_at_idx ON assets (last_synced_at);
-- <<< END: supabase-migration-bidirectional-sync.sql


-- >>> BEGIN: supabase-migration-docs-client-profiles.sql
-- ============================================================
-- OPENY DOCS — Client Document Profiles
-- ============================================================

CREATE TABLE IF NOT EXISTS docs_client_document_profiles (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id                  UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  default_currency           TEXT NOT NULL DEFAULT 'SAR',
  invoice_type               TEXT,
  quotation_type             TEXT,
  contract_type              TEXT,
  default_template_style     TEXT,
  billing_address            TEXT,
  tax_info                   TEXT,
  notes                      TEXT,
  invoice_layout_mode        TEXT NOT NULL DEFAULT 'branch_platform',
  supports_branch_breakdown  BOOLEAN NOT NULL DEFAULT TRUE,
  default_platforms          JSONB NOT NULL DEFAULT '[]'::jsonb,
  default_branch_names       JSONB NOT NULL DEFAULT '[]'::jsonb,
  service_description_default TEXT,
  default_fees_logic         JSONB NOT NULL DEFAULT '{}'::jsonb,
  default_totals_logic       JSONB NOT NULL DEFAULT '{}'::jsonb,
  invoice_template_config    JSONB NOT NULL DEFAULT '{}'::jsonb,
  quotation_template_config  JSONB NOT NULL DEFAULT '{}'::jsonb,
  contract_template_config   JSONB NOT NULL DEFAULT '{}'::jsonb,
  hr_contract_template_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  employees_template_config  JSONB NOT NULL DEFAULT '{}'::jsonb,
  accounting_template_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_docs_client_profiles_client_id
  ON docs_client_document_profiles(client_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_docs_client_profiles_client_id
  ON docs_client_document_profiles(client_id);

ALTER TABLE docs_client_document_profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'docs_client_document_profiles'
      AND policyname = 'docs_client_profiles_auth'
  ) THEN
    CREATE POLICY "docs_client_profiles_auth"
      ON docs_client_document_profiles
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'docs_client_profiles_updated_at'
  ) THEN
    CREATE TRIGGER docs_client_profiles_updated_at
      BEFORE UPDATE ON docs_client_document_profiles
      FOR EACH ROW
      EXECUTE FUNCTION docs_set_updated_at();
  END IF;
END $$;

ALTER TABLE docs_invoices ADD COLUMN IF NOT EXISTS client_profile_id UUID REFERENCES docs_client_document_profiles(id) ON DELETE SET NULL;
ALTER TABLE docs_quotations ADD COLUMN IF NOT EXISTS client_profile_id UUID REFERENCES docs_client_document_profiles(id) ON DELETE SET NULL;
ALTER TABLE docs_client_contracts ADD COLUMN IF NOT EXISTS client_profile_id UUID REFERENCES docs_client_document_profiles(id) ON DELETE SET NULL;
ALTER TABLE docs_hr_contracts ADD COLUMN IF NOT EXISTS client_profile_id UUID REFERENCES docs_client_document_profiles(id) ON DELETE SET NULL;
ALTER TABLE docs_employees ADD COLUMN IF NOT EXISTS client_profile_id UUID REFERENCES docs_client_document_profiles(id) ON DELETE SET NULL;
ALTER TABLE docs_accounting_entries ADD COLUMN IF NOT EXISTS client_profile_id UUID REFERENCES docs_client_document_profiles(id) ON DELETE SET NULL;
-- <<< END: supabase-migration-docs-client-profiles.sql


-- >>> BEGIN: supabase-migration-docs-invoice-grouped.sql
alter table if exists public.docs_invoices
  add column if not exists branch_groups jsonb default '[]'::jsonb;

alter table if exists public.docs_invoices
  add column if not exists final_budget numeric(14,2);

alter table if exists public.docs_invoices
  add column if not exists our_fees numeric(14,2);

alter table if exists public.docs_invoices
  add column if not exists grand_total numeric(14,2);

update public.docs_invoices
set final_budget = total_budget
where final_budget is null;

update public.docs_invoices
set grand_total = coalesce(total_budget, 0) + coalesce(our_fees, 0)
where grand_total is null;

alter table if exists public.docs_invoices
  alter column final_budget set default 0;

alter table if exists public.docs_invoices
  alter column our_fees set default 0;

alter table if exists public.docs_invoices
  alter column grand_total set default 0;
-- <<< END: supabase-migration-docs-invoice-grouped.sql


-- >>> BEGIN: supabase-migration-docs-invoice-nested-tables.sql
-- Ensure invoice root table exists in public schema.
create table if not exists public.docs_invoices (
  id               uuid primary key default gen_random_uuid(),
  invoice_number   text not null,
  client_name      text not null,
  campaign_month   text,
  invoice_date     date,
  total_budget     numeric(14,2) default 0,
  final_budget     numeric(14,2) default 0,
  our_fees         numeric(14,2) default 0,
  grand_total      numeric(14,2) default 0,
  currency         text default 'SAR',
  status           text default 'unpaid',
  branch_groups    jsonb default '[]'::jsonb,
  platforms        jsonb default '[]'::jsonb,
  deliverables     jsonb default '[]'::jsonb,
  custom_client    text,
  custom_project   text,
  notes            text,
  export_pdf_url   text,
  export_excel_url text,
  is_duplicate     boolean default false,
  original_id      uuid,
  created_by       uuid references auth.users(id) on delete set null,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

alter table if exists public.docs_invoices
  alter column branch_groups set default '[]'::jsonb;

-- Normalized nested structure: Invoice -> Branches -> Platforms -> Rows
create table if not exists public.docs_invoice_branches (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references public.docs_invoices(id) on delete cascade,
  branch_name text not null default 'Branch',
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.docs_invoice_platforms (
  id            uuid primary key default gen_random_uuid(),
  branch_id     uuid not null references public.docs_invoice_branches(id) on delete cascade,
  platform_name text not null default 'Platform',
  position      integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.docs_invoice_rows (
  id          uuid primary key default gen_random_uuid(),
  platform_id uuid not null references public.docs_invoice_platforms(id) on delete cascade,
  ad_name     text not null default '',
  date        date,
  results     text,
  cost        numeric(14,2) not null default 0,
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_docs_invoice_branches_invoice on public.docs_invoice_branches(invoice_id, position);
create index if not exists idx_docs_invoice_platforms_branch on public.docs_invoice_platforms(branch_id, position);
create index if not exists idx_docs_invoice_rows_platform on public.docs_invoice_rows(platform_id, position);

create or replace function public.docs_invoice_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists docs_invoice_branches_updated_at on public.docs_invoice_branches;
create trigger docs_invoice_branches_updated_at
before update on public.docs_invoice_branches
for each row execute function public.docs_invoice_set_updated_at();

drop trigger if exists docs_invoice_platforms_updated_at on public.docs_invoice_platforms;
create trigger docs_invoice_platforms_updated_at
before update on public.docs_invoice_platforms
for each row execute function public.docs_invoice_set_updated_at();

drop trigger if exists docs_invoice_rows_updated_at on public.docs_invoice_rows;
create trigger docs_invoice_rows_updated_at
before update on public.docs_invoice_rows
for each row execute function public.docs_invoice_set_updated_at();

alter table if exists public.docs_invoice_branches enable row level security;
alter table if exists public.docs_invoice_platforms enable row level security;
alter table if exists public.docs_invoice_rows enable row level security;

drop policy if exists "docs_invoice_branches_auth" on public.docs_invoice_branches;
create policy "docs_invoice_branches_auth"
on public.docs_invoice_branches
for all
to authenticated
using (true)
with check (true);

drop policy if exists "docs_invoice_platforms_auth" on public.docs_invoice_platforms;
create policy "docs_invoice_platforms_auth"
on public.docs_invoice_platforms
for all
to authenticated
using (true)
with check (true);

drop policy if exists "docs_invoice_rows_auth" on public.docs_invoice_rows;
create policy "docs_invoice_rows_auth"
on public.docs_invoice_rows
for all
to authenticated
using (true)
with check (true);

-- Force PostgREST (Supabase API) schema cache refresh.
select pg_notify('pgrst', 'reload');
-- <<< END: supabase-migration-docs-invoice-nested-tables.sql


-- >>> BEGIN: supabase-migration-docs-invoice-template-v2.sql
alter table if exists public.docs_invoices
  add column if not exists invoice_template text default 'Manual';

update public.docs_invoices
set invoice_template = 'Manual'
where invoice_template is null;

alter table if exists public.docs_invoices
  drop constraint if exists docs_invoices_invoice_template_check;

alter table if exists public.docs_invoices
  add constraint docs_invoices_invoice_template_check
  check (
    invoice_template in (
      'Manual',
      'Pro icon KSA Template',
      'Pro icon UAE Template',
      'Pro icon Global Template',
      'SAMA Travel Template'
    )
  );
-- <<< END: supabase-migration-docs-invoice-template-v2.sql


-- >>> BEGIN: supabase-migration-docs-invoice-template.sql
alter table if exists public.docs_invoices
  add column if not exists invoice_template text default 'Manual';

update public.docs_invoices
set invoice_template = 'Manual'
where invoice_template is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'docs_invoices_invoice_template_check'
  ) then
    alter table if exists public.docs_invoices
      add constraint docs_invoices_invoice_template_check
      check (invoice_template in ('Manual', 'Pro icon KSA Template'));
  end if;
end
$$;
-- <<< END: supabase-migration-docs-invoice-template.sql


-- >>> BEGIN: supabase-migration-docs-unique-document-numbers.sql
-- One sequence per document type; enforced at DB level so concurrent creates cannot collide.

CREATE UNIQUE INDEX IF NOT EXISTS docs_invoices_invoice_number_key
  ON public.docs_invoices (invoice_number);

CREATE UNIQUE INDEX IF NOT EXISTS docs_quotations_quote_number_key
  ON public.docs_quotations (quote_number);

CREATE UNIQUE INDEX IF NOT EXISTS docs_client_contracts_contract_number_key
  ON public.docs_client_contracts (contract_number);

CREATE UNIQUE INDEX IF NOT EXISTS docs_hr_contracts_contract_number_key
  ON public.docs_hr_contracts (contract_number);
-- <<< END: supabase-migration-docs-unique-document-numbers.sql


-- >>> BEGIN: supabase-migration-docs.sql
-- ============================================================
-- OPENY DOCS Migration
-- All tables for the OPENY DOCS subsystem
-- Run AFTER the base supabase-schema.sql migrations.
-- ============================================================

-- ── Invoices ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS docs_invoices (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_number  TEXT NOT NULL,
  client_name     TEXT NOT NULL,
  campaign_month  TEXT,
  invoice_date    DATE,
  total_budget    NUMERIC(14,2) DEFAULT 0,
  currency        TEXT DEFAULT 'SAR',
  status          TEXT DEFAULT 'unpaid' CHECK (status IN ('paid', 'unpaid')),
  platforms       JSONB DEFAULT '[]',
  deliverables    JSONB DEFAULT '[]',
  custom_client   TEXT,
  custom_project  TEXT,
  notes           TEXT,
  export_pdf_url  TEXT,
  export_excel_url TEXT,
  is_duplicate    BOOLEAN DEFAULT FALSE,
  original_id     UUID,
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Quotations ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS docs_quotations (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_number          TEXT NOT NULL,
  quote_date            DATE,
  currency              TEXT DEFAULT 'SAR',
  client_name           TEXT NOT NULL,
  company_brand         TEXT,
  project_title         TEXT,
  project_description   TEXT,
  deliverables          JSONB DEFAULT '[]',
  total_value           NUMERIC(14,2) DEFAULT 0,
  payment_due_days      INTEGER DEFAULT 30,
  payment_method        TEXT,
  custom_payment_method TEXT,
  additional_notes      TEXT,
  status                TEXT DEFAULT 'unpaid' CHECK (status IN ('paid', 'unpaid')),
  export_pdf_url        TEXT,
  export_excel_url      TEXT,
  is_duplicate          BOOLEAN DEFAULT FALSE,
  original_id           UUID,
  created_by            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ── Client Contracts ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS docs_client_contracts (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_number       TEXT NOT NULL,
  contract_date         DATE,
  duration_months       INTEGER DEFAULT 12,
  status                TEXT DEFAULT 'draft',
  currency              TEXT DEFAULT 'SAR',
  language              TEXT DEFAULT 'en' CHECK (language IN ('ar', 'en')),
  party1_company_name   TEXT,
  party1_representative TEXT,
  party1_address        TEXT,
  party1_email          TEXT,
  party1_phone          TEXT,
  party1_website        TEXT,
  party1_tax_reg        TEXT,
  party2_client_name    TEXT,
  party2_contact_person TEXT,
  party2_address        TEXT,
  party2_email          TEXT,
  party2_phone          TEXT,
  party2_website        TEXT,
  party2_tax_reg        TEXT,
  services              JSONB DEFAULT '[]',
  total_value           NUMERIC(14,2) DEFAULT 0,
  payment_method        TEXT,
  payment_terms         TEXT,
  notes                 TEXT,
  legal_clauses         JSONB DEFAULT '[]',
  sig_party1            TEXT,
  sig_party2            TEXT,
  sig_date              DATE,
  sig_place             TEXT,
  export_pdf_url        TEXT,
  export_doc_url        TEXT,
  is_duplicate          BOOLEAN DEFAULT FALSE,
  original_id           UUID,
  created_by            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ── HR Contracts ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS docs_hr_contracts (
  id                     UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_number        TEXT NOT NULL,
  contract_date          DATE,
  duration               TEXT,
  status                 TEXT DEFAULT 'draft',
  currency               TEXT DEFAULT 'SAR',
  language               TEXT DEFAULT 'en' CHECK (language IN ('ar', 'en')),
  company_name           TEXT,
  company_representative TEXT,
  company_address        TEXT,
  company_email          TEXT,
  company_phone          TEXT,
  employee_full_name     TEXT NOT NULL,
  employee_national_id   TEXT,
  employee_address       TEXT,
  employee_phone         TEXT,
  employee_email         TEXT,
  employee_nationality   TEXT,
  employee_marital_status TEXT,
  job_title              TEXT,
  department             TEXT,
  direct_manager         TEXT,
  employment_type        TEXT,
  start_date             DATE,
  contract_duration      TEXT,
  probation_period       TEXT,
  workplace              TEXT,
  salary                 NUMERIC(14,2) DEFAULT 0,
  payment_method         TEXT,
  payment_date           TEXT,
  benefits               JSONB DEFAULT '[]',
  daily_hours            NUMERIC(5,2) DEFAULT 8,
  work_days              TEXT,
  annual_leave           INTEGER DEFAULT 21,
  legal_clauses          JSONB DEFAULT '[]',
  sig_company_rep        TEXT,
  sig_employee_name      TEXT,
  sig_date               DATE,
  sig_place              TEXT,
  export_pdf_url         TEXT,
  export_doc_url         TEXT,
  is_duplicate           BOOLEAN DEFAULT FALSE,
  original_id            UUID,
  created_by             UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);

-- ── Employees ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS docs_employees (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id       TEXT UNIQUE NOT NULL,
  full_name         TEXT NOT NULL,
  date_of_birth     DATE,
  phone             TEXT,
  address           TEXT,
  job_title         TEXT,
  employment_type   TEXT DEFAULT 'full_time',
  hire_date         DATE,
  status            TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'terminated')),
  daily_hours       NUMERIC(5,2) DEFAULT 8,
  contract_duration TEXT,
  salary            NUMERIC(14,2) DEFAULT 0,
  created_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── Salary Adjustments ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS docs_salary_adjustments (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id   UUID NOT NULL REFERENCES docs_employees(id) ON DELETE CASCADE,
  new_salary    NUMERIC(14,2) NOT NULL,
  change_amount NUMERIC(14,2),
  change_type   TEXT CHECK (change_type IN ('increase', 'decrease', 'initial')),
  effective_date DATE,
  notes         TEXT,
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Accounting Entries (Clients Ledger) ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS docs_accounting_entries (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_name     TEXT NOT NULL,
  service         TEXT,
  amount          NUMERIC(14,2) DEFAULT 0,
  currency        TEXT DEFAULT 'SAR',
  collection_type TEXT DEFAULT 'local' CHECK (collection_type IN ('local', 'overseas')),
  collector       TEXT,
  entry_date      DATE DEFAULT CURRENT_DATE,
  month_key       TEXT NOT NULL,
  notes           TEXT,
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Accounting Expenses ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS docs_accounting_expenses (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  description  TEXT NOT NULL,
  amount       NUMERIC(14,2) DEFAULT 0,
  currency     TEXT DEFAULT 'SAR',
  expense_date DATE DEFAULT CURRENT_DATE,
  month_key    TEXT NOT NULL,
  notes        TEXT,
  created_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Document Backups ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS docs_backups (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  module     TEXT NOT NULL CHECK (module IN ('invoices','quotations','client_contracts','hr_contracts','employees','accounting')),
  label      TEXT,
  data       JSONB NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_docs_invoices_status      ON docs_invoices(status);
CREATE INDEX IF NOT EXISTS idx_docs_invoices_client_name ON docs_invoices(client_name);
CREATE INDEX IF NOT EXISTS idx_docs_invoices_date        ON docs_invoices(invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_docs_invoices_created_at  ON docs_invoices(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_docs_quotations_status      ON docs_quotations(status);
CREATE INDEX IF NOT EXISTS idx_docs_quotations_client_name ON docs_quotations(client_name);
CREATE INDEX IF NOT EXISTS idx_docs_quotations_created_at  ON docs_quotations(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_docs_client_contracts_status     ON docs_client_contracts(status);
CREATE INDEX IF NOT EXISTS idx_docs_client_contracts_created_at ON docs_client_contracts(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_docs_hr_contracts_status        ON docs_hr_contracts(status);
CREATE INDEX IF NOT EXISTS idx_docs_hr_contracts_employee_name ON docs_hr_contracts(employee_full_name);
CREATE INDEX IF NOT EXISTS idx_docs_hr_contracts_created_at    ON docs_hr_contracts(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_docs_employees_status          ON docs_employees(status);
CREATE INDEX IF NOT EXISTS idx_docs_employees_employment_type ON docs_employees(employment_type);

CREATE INDEX IF NOT EXISTS idx_docs_salary_adjustments_employee ON docs_salary_adjustments(employee_id);
CREATE INDEX IF NOT EXISTS idx_docs_salary_adjustments_date     ON docs_salary_adjustments(effective_date DESC);

CREATE INDEX IF NOT EXISTS idx_docs_accounting_entries_month    ON docs_accounting_entries(month_key);
CREATE INDEX IF NOT EXISTS idx_docs_accounting_entries_collector ON docs_accounting_entries(collector);

CREATE INDEX IF NOT EXISTS idx_docs_accounting_expenses_month   ON docs_accounting_expenses(month_key);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE docs_invoices           ENABLE ROW LEVEL SECURITY;
ALTER TABLE docs_quotations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE docs_client_contracts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE docs_hr_contracts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE docs_employees          ENABLE ROW LEVEL SECURITY;
ALTER TABLE docs_salary_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE docs_accounting_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE docs_accounting_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE docs_backups            ENABLE ROW LEVEL SECURITY;

-- API routes use service_role key which bypasses RLS.
-- Authenticated users may read/write their workspace data.

CREATE POLICY "docs_invoices_auth"            ON docs_invoices           FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "docs_quotations_auth"          ON docs_quotations         FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "docs_client_contracts_auth"    ON docs_client_contracts   FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "docs_hr_contracts_auth"        ON docs_hr_contracts       FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "docs_employees_auth"           ON docs_employees          FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "docs_salary_adjustments_auth"  ON docs_salary_adjustments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "docs_accounting_entries_auth"  ON docs_accounting_entries  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "docs_accounting_expenses_auth" ON docs_accounting_expenses FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "docs_backups_auth"             ON docs_backups            FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── updated_at triggers ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION docs_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER docs_invoices_updated_at
  BEFORE UPDATE ON docs_invoices
  FOR EACH ROW EXECUTE FUNCTION docs_set_updated_at();

CREATE TRIGGER docs_quotations_updated_at
  BEFORE UPDATE ON docs_quotations
  FOR EACH ROW EXECUTE FUNCTION docs_set_updated_at();

CREATE TRIGGER docs_client_contracts_updated_at
  BEFORE UPDATE ON docs_client_contracts
  FOR EACH ROW EXECUTE FUNCTION docs_set_updated_at();

CREATE TRIGGER docs_hr_contracts_updated_at
  BEFORE UPDATE ON docs_hr_contracts
  FOR EACH ROW EXECUTE FUNCTION docs_set_updated_at();

CREATE TRIGGER docs_employees_updated_at
  BEFORE UPDATE ON docs_employees
  FOR EACH ROW EXECUTE FUNCTION docs_set_updated_at();

CREATE TRIGGER docs_accounting_entries_updated_at
  BEFORE UPDATE ON docs_accounting_entries
  FOR EACH ROW EXECUTE FUNCTION docs_set_updated_at();

CREATE TRIGGER docs_accounting_expenses_updated_at
  BEFORE UPDATE ON docs_accounting_expenses
  FOR EACH ROW EXECUTE FUNCTION docs_set_updated_at();
-- <<< END: supabase-migration-docs.sql


-- >>> BEGIN: supabase-migration-drive-schema-v2.sql
-- Migration: add all required columns for the Google Drive upload flow (v2)
-- Run this in your Supabase SQL editor.
--
-- Safe to run multiple times (all statements use IF NOT EXISTS / IF EXISTS).

-- 1. Make previously-required columns nullable (they are unused for Drive assets)
alter table assets
  alter column file_path   drop not null,
  alter column bucket_name drop not null;

-- 2. Add Google Drive columns (added by supabase-migration-google-drive.sql, repeated here for safety)
alter table assets
  add column if not exists view_url          text,
  add column if not exists download_url      text,
  add column if not exists storage_provider  text not null default 'supabase',
  add column if not exists drive_file_id     text;

-- 3. Add new Drive-folder tracking columns
alter table assets
  add column if not exists drive_folder_id    text,
  add column if not exists client_folder_name text;

-- 4. Add content_type with an allowed-values constraint
alter table assets
  add column if not exists content_type text;

-- Apply the check constraint only if it does not already exist
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where table_name = 'assets' and constraint_name = 'assets_content_type_check'
  ) then
    alter table assets
      add constraint assets_content_type_check
      check (content_type is null or content_type in (
        'SOCIAL_POSTS', 'REELS', 'VIDEOS', 'LOGOS', 'BRAND_ASSETS',
        'PASSWORDS', 'DOCUMENTS', 'RAW_FILES', 'ADS_CREATIVES', 'REPORTS', 'OTHER'
      ));
  end if;
end$$;

-- 5. Add month_key with a YYYY-MM format constraint
alter table assets
  add column if not exists month_key text;

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where table_name = 'assets' and constraint_name = 'assets_month_key_check'
  ) then
    alter table assets
      add constraint assets_month_key_check
      check (month_key is null or month_key ~ '^\d{4}-(0[1-9]|1[0-2])$');
  end if;
end$$;
-- <<< END: supabase-migration-drive-schema-v2.sql


-- >>> BEGIN: supabase-migration-google-tokens.sql
-- OPENY OS — Google OAuth token storage
-- Run this once in your Supabase SQL editor.
--
-- Stores the Google Drive refresh token so it survives re-deploys and can be
-- updated at runtime via /api/google/callback without touching env vars.
-- Only one row is ever stored (key = 'default').

create table if not exists google_oauth_tokens (
  key          text primary key default 'default',
  refresh_token text not null,
  obtained_at  timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Disable Row Level Security — this table is only accessed server-side via the
-- service-role key.  No client-side access is ever granted.
alter table google_oauth_tokens disable row level security;

-- Optional: auto-update updated_at on every write (requires moddatetime extension).
-- comment out the next two lines if you haven't enabled the extension.
-- create extension if not exists moddatetime schema extensions;
-- create trigger handle_updated_at before update on google_oauth_tokens
--   for each row execute procedure moddatetime(updated_at);
-- <<< END: supabase-migration-google-tokens.sql


-- >>> BEGIN: supabase-migration-invitation-status-fix.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Invitation Status Fix Migration
-- Run this in your Supabase SQL Editor.
--
-- Resolves the team_invitation_status_check constraint violation that blocked
-- invitation inserts.
--
-- Root cause: an older migration or manual schema creation left a CHECK
-- constraint that did NOT include 'invited' as a valid status value, while the
-- application always writes status = 'invited' on insert.
--
-- Changes:
--   1. Drop whatever CHECK constraint currently exists on team_invitations.status
--   2. Re-add it with the canonical set: invited | accepted | revoked | expired
--   3. Set / confirm DEFAULT = 'invited'
--   4. Normalise any legacy rows (e.g. 'pending' → 'invited')
--   5. Mirror the same cleanup on team_members.status
--
-- Canonical status lifecycle:
--   invited  → the invitation has been sent and is awaiting acceptance
--   accepted → the invitee clicked the link and completed sign-up
--   revoked  → an admin/manager cancelled the invitation before it was accepted
--   expired  → the invitation was not accepted before the expiry date
--
-- Safe to run multiple times (idempotent).
-- ─────────────────────────────────────────────────────────────────────────────

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Fix team_invitations.status CHECK constraint
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_con TEXT;
BEGIN
  -- Drop every CHECK constraint that references the status column
  -- (there may be more than one if migrations were re-run)
  FOR v_con IN
    SELECT conname
    FROM   pg_constraint
    WHERE  conrelid = 'public.team_invitations'::regclass
      AND  contype  = 'c'
      AND  pg_get_constraintdef(oid) LIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.team_invitations DROP CONSTRAINT IF EXISTS %I', v_con);
    RAISE NOTICE 'Dropped constraint: %', v_con;
  END LOOP;

  -- Re-add the canonical constraint
  ALTER TABLE public.team_invitations
    ADD CONSTRAINT team_invitation_status_check
      CHECK (status IN ('invited', 'accepted', 'revoked', 'expired'));

  RAISE NOTICE 'Added team_invitation_status_check (invited|accepted|revoked|expired)';
END;
$$;

-- Ensure the column default is 'invited'
ALTER TABLE public.team_invitations
  ALTER COLUMN status SET DEFAULT 'invited';

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Normalise legacy rows
-- ═══════════════════════════════════════════════════════════════════════════

-- Lowercase everything first (defensive: catches 'Invited', 'INVITED', etc.)
UPDATE public.team_invitations
SET    status     = lower(status),
       updated_at = now()
WHERE  status IS DISTINCT FROM lower(status);

-- Migrate legacy 'pending' → 'invited'
UPDATE public.team_invitations
SET    status     = 'invited',
       updated_at = now()
WHERE  status = 'pending';

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Fix team_members.status CHECK constraint
--    (ensure 'invited' is allowed there too)
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_con TEXT;
BEGIN
  FOR v_con IN
    SELECT conname
    FROM   pg_constraint
    WHERE  conrelid = 'public.team_members'::regclass
      AND  contype  = 'c'
      AND  pg_get_constraintdef(oid) LIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.team_members DROP CONSTRAINT IF EXISTS %I', v_con);
    RAISE NOTICE 'Dropped team_members constraint: %', v_con;
  END LOOP;

  ALTER TABLE public.team_members
    ADD CONSTRAINT team_members_status_check
      CHECK (status IN ('active', 'invited', 'inactive', 'suspended'));

  RAISE NOTICE 'Added team_members_status_check (active|invited|inactive|suspended)';
END;
$$;

ALTER TABLE public.team_members
  ALTER COLUMN status SET DEFAULT 'active';

-- Lowercase legacy rows
UPDATE public.team_members
SET    status     = lower(status),
       updated_at = now()
WHERE  status IS DISTINCT FROM lower(status);

-- ═══════════════════════════════════════════════════════════════════════════
-- Done.
--
-- Final allowed status values:
--   team_invitations.status: invited | accepted | revoked | expired
--   team_members.status:     active  | invited  | inactive | suspended
--
-- Sending an invitation (POST /api/team/invite) now succeeds because:
--   • The app inserts status = 'invited'
--   • The DB CHECK constraint explicitly allows 'invited'
--   • The DEFAULT is also 'invited'
-- ═══════════════════════════════════════════════════════════════════════════
-- <<< END: supabase-migration-invitation-status-fix.sql


-- >>> BEGIN: supabase-migration-missing-columns.sql
-- ============================================================
-- OPENY OS — Missing Columns Comprehensive Migration
-- ============================================================
-- Adds every column that the upload flow and asset renderer
-- expect but that may not exist if previous incremental
-- migrations were not applied.
--
-- ALL statements use ADD COLUMN IF NOT EXISTS so this file is
-- safe to run multiple times and against any schema version.
-- ============================================================

-- ── 1. Google Drive core columns ─────────────────────────────────────────────
-- Added by supabase-migration-google-drive.sql / supabase-migration-drive-schema-v2.sql
-- Repeated here as a safety net.
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS view_url         TEXT,
  ADD COLUMN IF NOT EXISTS file_url         TEXT,
  ADD COLUMN IF NOT EXISTS download_url     TEXT,
  ADD COLUMN IF NOT EXISTS drive_file_id    TEXT,
  ADD COLUMN IF NOT EXISTS drive_folder_id  TEXT,
  ADD COLUMN IF NOT EXISTS file_size        BIGINT,
  ADD COLUMN IF NOT EXISTS file_type        TEXT;

-- storage_provider defaults to 'supabase' to keep old rows valid.
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS storage_provider TEXT NOT NULL DEFAULT 'supabase';

-- ── 2. Drive folder / content organisation columns ───────────────────────────
-- Added by supabase-migration-drive-structure.sql
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS client_name        TEXT,
  ADD COLUMN IF NOT EXISTS client_folder_name TEXT,
  ADD COLUMN IF NOT EXISTS content_type       TEXT,
  ADD COLUMN IF NOT EXISTS month_key          TEXT,
  ADD COLUMN IF NOT EXISTS uploaded_by        TEXT;

-- ── 3. content_type check constraint (idempotent) ────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   information_schema.table_constraints
    WHERE  table_schema = 'public'
      AND  table_name   = 'assets'
      AND  constraint_name = 'assets_content_type_check'
  ) THEN
    ALTER TABLE public.assets
      ADD CONSTRAINT assets_content_type_check
      CHECK (content_type IS NULL OR content_type IN (
        'SOCIAL_POSTS', 'REELS', 'VIDEOS', 'LOGOS', 'BRAND_ASSETS',
        'PASSWORDS', 'DOCUMENTS', 'RAW_FILES', 'ADS_CREATIVES', 'REPORTS', 'OTHER'
      ));
  END IF;
END $$;

-- ── 4. month_key format constraint (idempotent) ───────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   information_schema.table_constraints
    WHERE  table_schema = 'public'
      AND  table_name   = 'assets'
      AND  constraint_name = 'assets_month_key_check'
  ) THEN
    ALTER TABLE public.assets
      ADD CONSTRAINT assets_month_key_check
      CHECK (month_key IS NULL OR month_key ~ '^\d{4}-(0[1-9]|1[0-2])$');
  END IF;
END $$;

-- ── 5. Agency / task columns ─────────────────────────────────────────────────
-- Added by supabase-migration-agency-v1.sql
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS task_id UUID REFERENCES public.tasks (id) ON DELETE SET NULL;

-- ── 6. SaaS approval columns ─────────────────────────────────────────────────
-- Added by supabase-migration-saas-v1.sql
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS publish_date    DATE,
  ADD COLUMN IF NOT EXISTS approval_notes  TEXT;

ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   information_schema.table_constraints
    WHERE  table_schema = 'public'
      AND  table_name   = 'assets'
      AND  constraint_name = 'assets_approval_status_check'
  ) THEN
    ALTER TABLE public.assets
      ADD CONSTRAINT assets_approval_status_check
      CHECK (approval_status IS NULL OR approval_status IN (
        'pending', 'approved', 'rejected', 'scheduled', 'published'
      ));
  END IF;
END $$;

-- ── 7. Preview / thumbnail metadata columns (THE PRIMARY FIX) ────────────────
-- These four columns are inserted by every upload route but were only added
-- by supabase-migration-asset-preview.sql.  If that migration was never run
-- the insert fails with: column "mime_type" of relation "assets" does not exist
--
-- Required vs optional:
--   REQUIRED  (upload fails without them) : name, file_url, drive_file_id,
--                                           client_name, content_type, month_key
--   OPTIONAL  (gracefully degraded below) : mime_type, preview_url,
--                                           thumbnail_url, web_view_link
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS mime_type     TEXT,
  ADD COLUMN IF NOT EXISTS preview_url   TEXT,
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
  ADD COLUMN IF NOT EXISTS web_view_link TEXT;

-- ── 8. Bidirectional-sync tracking columns ───────────────────────────────────
-- Added by supabase-migration-bidirectional-sync.sql.
-- Repeated here so the comprehensive migration covers them too.
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS last_synced_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS source_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_deleted        BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS assets_is_deleted_idx   ON public.assets (is_deleted);
CREATE INDEX IF NOT EXISTS assets_last_synced_at_idx ON public.assets (last_synced_at);

-- ── 9. Ensure nullable columns that were originally NOT NULL are relaxed ──────
-- Needed if the table was created from the old supabase-schema.sql where
-- file_url was NOT NULL and bucket_name had a DEFAULT (later dropped to nullable).
ALTER TABLE public.assets
  ALTER COLUMN file_path   DROP NOT NULL,
  ALTER COLUMN bucket_name DROP NOT NULL;
-- <<< END: supabase-migration-missing-columns.sql


-- >>> BEGIN: supabase-migration-notification-engine-v1.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- NOTIFICATION ENGINE v1  —  run once in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════
-- All statements are fully idempotent (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
-- Runs safely on top of all existing notification migrations.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. EXTEND notifications table ─────────────────────────────────────────────
--      Add enterprise-grade fields while keeping all existing columns intact.

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS priority       TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low','medium','high','critical')),
  ADD COLUMN IF NOT EXISTS category       TEXT,          -- tasks|content|assets|team|system
  ADD COLUMN IF NOT EXISTS is_archived    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS read_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_in_app BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS delivered_email  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS idempotency_key  TEXT,        -- dedup: event_type:entity_id[:user_id]
  ADD COLUMN IF NOT EXISTS workspace_id     UUID REFERENCES public.workspaces(id) ON DELETE SET NULL;

-- Idempotency uniqueness: one notification per key per user.
-- The unique index here prevents exact-same-key duplicates from ever being persisted,
-- acting as a hard guard. The application layer (event-engine.ts isDuplicate()) further
-- enforces a time-based window (e.g. 1 hour) so that the same logical event can
-- re-notify after the window expires without being blocked by the index.
-- Old entries are retained (archive-only policy); the time window check in the app layer
-- is therefore the primary dedup mechanism, while this index is the safety net.
CREATE UNIQUE INDEX IF NOT EXISTS notifications_idempotency_user_idx
  ON public.notifications (idempotency_key, user_id)
  WHERE idempotency_key IS NOT NULL AND user_id IS NOT NULL;

-- Partial index: fast unarchived notification queries (most common access pattern)
CREATE INDEX IF NOT EXISTS notifications_active_idx
  ON public.notifications (user_id, created_at DESC)
  WHERE is_archived = false;

CREATE INDEX IF NOT EXISTS notifications_priority_idx ON public.notifications (priority);
CREATE INDEX IF NOT EXISTS notifications_category_idx ON public.notifications (category);
CREATE INDEX IF NOT EXISTS notifications_workspace_idx ON public.notifications (workspace_id);

-- Realtime enablement (safe to run multiple times)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;

-- ── 2. EXTEND activities table ────────────────────────────────────────────────
--      Make it a durable, queryable workspace history table.

ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS workspace_id   UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS actor_id       UUID REFERENCES auth.users(id)        ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS title          TEXT,          -- short human-readable headline
  ADD COLUMN IF NOT EXISTS before_value   JSONB,         -- previous state snapshot
  ADD COLUMN IF NOT EXISTS after_value    JSONB,         -- next state snapshot
  ADD COLUMN IF NOT EXISTS category       TEXT;          -- tasks|content|assets|team|system

CREATE INDEX IF NOT EXISTS activities_workspace_idx  ON public.activities (workspace_id);
CREATE INDEX IF NOT EXISTS activities_actor_idx      ON public.activities (actor_id);
CREATE INDEX IF NOT EXISTS activities_category_idx   ON public.activities (category);
CREATE INDEX IF NOT EXISTS activities_created_idx    ON public.activities (created_at DESC);
CREATE INDEX IF NOT EXISTS activities_entity_idx     ON public.activities (entity_type, entity_id);

-- ── 3. notification_preferences ───────────────────────────────────────────────
--      Per-user, per-event-type channel preferences.

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type        TEXT        NOT NULL,
  in_app_enabled    BOOLEAN     NOT NULL DEFAULT true,
  email_enabled     BOOLEAN     NOT NULL DEFAULT true,
  realtime_enabled  BOOLEAN     NOT NULL DEFAULT true,
  digest_enabled    BOOLEAN     NOT NULL DEFAULT false,
  mute_until        TIMESTAMPTZ,                         -- null = not muted
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, event_type)
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notification_preferences' AND policyname='users manage own preferences') THEN
    CREATE POLICY "users manage own preferences"
      ON public.notification_preferences FOR ALL TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- Allow service role to read/write (for preference checks in API routes)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notification_preferences' AND policyname='service manage preferences') THEN
    CREATE POLICY "service manage preferences"
      ON public.notification_preferences FOR ALL TO service_role
      WITH CHECK (true);
  END IF;
END $$;

-- ── 4. scheduled_reminders ────────────────────────────────────────────────────
--      Persistent queue for deadline / publish-window / stale-work reminders.

CREATE TABLE IF NOT EXISTS public.scheduled_reminders (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID        REFERENCES public.workspaces(id) ON DELETE SET NULL,
  target_user_id  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type      TEXT        NOT NULL,
  entity_type     TEXT,
  entity_id       UUID,
  scheduled_for   TIMESTAMPTZ NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','sent','cancelled','failed')),
  idempotency_key TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS scheduled_reminders_status_idx      ON public.scheduled_reminders (status, scheduled_for);
CREATE INDEX IF NOT EXISTS scheduled_reminders_entity_idx      ON public.scheduled_reminders (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS scheduled_reminders_user_idx        ON public.scheduled_reminders (target_user_id);
CREATE INDEX IF NOT EXISTS scheduled_reminders_idempotency_idx ON public.scheduled_reminders (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE public.scheduled_reminders ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='scheduled_reminders' AND policyname='service manage reminders') THEN
    CREATE POLICY "service manage reminders"
      ON public.scheduled_reminders FOR ALL TO service_role
      WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='scheduled_reminders' AND policyname='admin read reminders') THEN
    CREATE POLICY "admin read reminders"
      ON public.scheduled_reminders FOR SELECT TO authenticated
      USING (public.current_user_role() IN ('owner','admin'));
  END IF;
END $$;

-- ── 5. notification_delivery_logs ─────────────────────────────────────────────
--      Audit trail for every notification delivery attempt.

CREATE TABLE IF NOT EXISTS public.notification_delivery_logs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID        REFERENCES public.notifications(id) ON DELETE CASCADE,
  channel         TEXT        NOT NULL CHECK (channel IN ('in_app','email','realtime')),
  status          TEXT        NOT NULL CHECK (status IN ('success','failed','skipped')),
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS delivery_logs_notification_idx ON public.notification_delivery_logs (notification_id);
CREATE INDEX IF NOT EXISTS delivery_logs_status_idx       ON public.notification_delivery_logs (status);
CREATE INDEX IF NOT EXISTS delivery_logs_created_idx      ON public.notification_delivery_logs (created_at DESC);

ALTER TABLE public.notification_delivery_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notification_delivery_logs' AND policyname='admin read delivery logs') THEN
    CREATE POLICY "admin read delivery logs"
      ON public.notification_delivery_logs FOR SELECT TO authenticated
      USING (public.current_user_role() IN ('owner','admin','manager'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notification_delivery_logs' AND policyname='service write delivery logs') THEN
    CREATE POLICY "service write delivery logs"
      ON public.notification_delivery_logs FOR INSERT TO service_role
      WITH CHECK (true);
  END IF;
END $$;

-- ── 6. Email logs — extend with notification_id linkage ───────────────────────

ALTER TABLE public.email_logs
  ADD COLUMN IF NOT EXISTS notification_id UUID REFERENCES public.notifications(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recipient_name  TEXT;

-- ── 7. History retention policy — never auto-delete, archive only ─────────────
--      A scheduled pg_cron job (optional) can auto-archive notifications older than
--      90 days instead of deleting them. No DROP / DELETE policy is created here.
--      The application layer uses is_archived=true as the "soft delete" path.

-- ── 8. Update RLS on notifications to include is_archived reads ───────────────
--      The existing "users read own notifications" policy already covers this
--      because it uses user_id = auth.uid() which includes archived rows.
--      Add a service-role UPDATE policy for the archiving operation:

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notifications' AND policyname='service role update notifications') THEN
    CREATE POLICY "service role update notifications"
      ON public.notifications FOR UPDATE TO service_role
      WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notifications' AND policyname='service role delete notifications') THEN
    CREATE POLICY "service role delete notifications"
      ON public.notifications FOR DELETE TO service_role
      USING (true);
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Done. All tables and indexes are active.
-- ─────────────────────────────────────────────────────────────────────────────
-- <<< END: supabase-migration-notification-engine-v1.sql


-- >>> BEGIN: supabase-migration-notifications-event-driven.sql
-- Event-driven notifications compatibility migration
-- Adds optional actor + metadata columns used by centralized notification payloads.

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS notifications_actor_id_idx ON public.notifications (actor_id);
CREATE INDEX IF NOT EXISTS notifications_event_type_idx ON public.notifications (event_type);
-- <<< END: supabase-migration-notifications-event-driven.sql


-- >>> BEGIN: supabase-migration-notifications-v2.sql
-- Notification system v2 — run this migration once in Supabase SQL editor.
-- This file complements supabase-migration-workflow-hub.sql with Realtime
-- enablement, additional indexes, and a read-state alias view.

-- ── 1. Ensure the `notifications` table has all required columns ──────────────
--      (workflow-hub.sql already adds entity_type/entity_id/action_url/event_type,
--       so these are safe no-ops if that migration was applied first)
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS entity_type TEXT,
  ADD COLUMN IF NOT EXISTS entity_id   UUID,
  ADD COLUMN IF NOT EXISTS action_url  TEXT,
  ADD COLUMN IF NOT EXISTS event_type  TEXT,
  ADD COLUMN IF NOT EXISTS client_id   UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS task_id     UUID REFERENCES public.tasks(id)   ON DELETE SET NULL;

-- ── 2. Indexes for common query patterns ─────────────────────────────────────
CREATE INDEX IF NOT EXISTS notifications_user_id_idx   ON public.notifications (user_id);
CREATE INDEX IF NOT EXISTS notifications_read_idx      ON public.notifications (read);
CREATE INDEX IF NOT EXISTS notifications_created_idx   ON public.notifications (created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_entity_idx    ON public.notifications (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS notifications_client_id_idx ON public.notifications (client_id);
CREATE INDEX IF NOT EXISTS notifications_task_id_idx   ON public.notifications (task_id);

-- ── 3. Enable Row Level Security (idempotent) ─────────────────────────────────
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read notifications addressed to them or broadcast (user_id IS NULL)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'users read own notifications'
  ) THEN
    CREATE POLICY "users read own notifications"
      ON public.notifications FOR SELECT TO authenticated
      USING (user_id = auth.uid() OR user_id IS NULL);
  END IF;
END $$;

-- Service role (used by backend API routes) can insert notifications
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'service role insert notifications'
  ) THEN
    CREATE POLICY "service role insert notifications"
      ON public.notifications FOR INSERT TO service_role
      WITH CHECK (true);
  END IF;
END $$;

-- Users can update (mark read) their own notifications
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'users update own notifications'
  ) THEN
    CREATE POLICY "users update own notifications"
      ON public.notifications FOR UPDATE TO authenticated
      USING (user_id = auth.uid() OR user_id IS NULL)
      WITH CHECK (true);
  END IF;
END $$;

-- Users can delete their own notifications
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'users delete own notifications'
  ) THEN
    CREATE POLICY "users delete own notifications"
      ON public.notifications FOR DELETE TO authenticated
      USING (user_id = auth.uid() OR user_id IS NULL);
  END IF;
END $$;

-- ── 4. Enable Supabase Realtime for notifications ─────────────────────────────
--      This adds the table to the supabase_realtime publication so INSERT events
--      are broadcast to subscribed clients. Safe to run multiple times.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;

-- ── 5. Email logs table (idempotent — also in workflow-hub.sql) ───────────────
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
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'email_logs' AND policyname = 'authenticated view email_logs'
  ) THEN
    CREATE POLICY "authenticated view email_logs" ON public.email_logs FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
-- <<< END: supabase-migration-notifications-v2.sql


-- >>> BEGIN: supabase-migration-performance-indexes.sql
-- Common lookup paths for OPENY OS list/detail views (safe IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_clients_slug ON public.clients (slug);
CREATE INDEX IF NOT EXISTS idx_clients_created_at ON public.clients (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_members_email ON public.team_members (email);
CREATE INDEX IF NOT EXISTS idx_tasks_client_id ON public.tasks (client_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks (status);
CREATE INDEX IF NOT EXISTS idx_activities_client_created ON public.activities (client_id, created_at DESC);
-- <<< END: supabase-migration-performance-indexes.sql


-- >>> BEGIN: supabase-migration-permissions-v1.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- OPENY Platform — Member Permissions v1
-- Run once in Supabase SQL Editor (fully idempotent).
--
-- Adds:
--   1. member_permissions  — per-member, per-module access overrides
--   2. invite_permissions  — permission snapshot attached to invitations
--   3. Realtime enablement for team_members and team_invitations
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. member_permissions ────────────────────────────────────────────────────
--    Stores per-member, per-module access level overrides.
--    Omitted rows fall back to the member's role default (see permissions.ts).
--    Owner and admin rows are never inserted — their access is always 'full'.

CREATE TABLE IF NOT EXISTS public.member_permissions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id  UUID        NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  workspace       TEXT        NOT NULL CHECK (workspace IN ('os', 'docs')),
  module          TEXT        NOT NULL,
  access_level    TEXT        NOT NULL DEFAULT 'read'
                               CHECK (access_level IN ('full', 'read', 'none')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (team_member_id, workspace, module)
);

CREATE INDEX IF NOT EXISTS idx_member_permissions_member_id
  ON public.member_permissions (team_member_id);

CREATE INDEX IF NOT EXISTS idx_member_permissions_workspace
  ON public.member_permissions (team_member_id, workspace);

-- Keep updated_at fresh.
CREATE OR REPLACE FUNCTION public.touch_member_permissions_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_member_permissions_updated_at ON public.member_permissions;
CREATE TRIGGER trg_member_permissions_updated_at
  BEFORE UPDATE ON public.member_permissions
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_member_permissions_updated_at();

ALTER TABLE public.member_permissions ENABLE ROW LEVEL SECURITY;

-- Admins/owners can read all permissions.
-- NOTE: 'manager' is included here to match the existing role column during
-- the migration period.  Once all rows are backfilled to platform_role,
-- the policy can be tightened to ('owner', 'admin') only.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='member_permissions' AND policyname='member_permissions_admin_read') THEN
    CREATE POLICY "member_permissions_admin_read"
      ON public.member_permissions FOR SELECT TO authenticated
      USING (public.current_user_role() IN ('owner', 'admin', 'manager'));
  END IF;
END $$;

-- Members can read their own permissions.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='member_permissions' AND policyname='member_permissions_self_read') THEN
    CREATE POLICY "member_permissions_self_read"
      ON public.member_permissions FOR SELECT TO authenticated
      USING (
        team_member_id IN (
          SELECT id FROM public.team_members WHERE profile_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Admins/owners can write permissions.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='member_permissions' AND policyname='member_permissions_admin_write') THEN
    CREATE POLICY "member_permissions_admin_write"
      ON public.member_permissions FOR ALL TO authenticated
      USING  (public.current_user_role() IN ('owner', 'admin'))
      WITH CHECK (public.current_user_role() IN ('owner', 'admin'));
  END IF;
END $$;

-- Service role can do everything (API routes use service role).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='member_permissions' AND policyname='member_permissions_service') THEN
    CREATE POLICY "member_permissions_service"
      ON public.member_permissions FOR ALL TO service_role
      WITH CHECK (true);
  END IF;
END $$;

-- ── 2. Add permissions_snapshot to team_invitations ──────────────────────────
--    Stores the module-level permission matrix at invitation time so that
--    accepting the invite automatically seeds member_permissions.

ALTER TABLE public.team_invitations
  ADD COLUMN IF NOT EXISTS permissions_snapshot JSONB;

-- ── 3. Add platform_role to team_members (canonical: owner|admin|member) ─────
--    Separate from the job-title "role" column — stores the access control role.
--    Null means "inherit from existing role column" during migration period.

ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS platform_role TEXT
    CHECK (platform_role IN ('owner', 'admin', 'member'));

-- Backfill: map existing role values to platform_role.
-- 'manager' maps to 'admin' in the canonical platform_role column.
-- The legacy 'role' column and its RLS policies still recognise 'manager'
-- during the transition period.
UPDATE public.team_members
SET platform_role = CASE
  WHEN lower(role) = 'owner'       THEN 'owner'
  WHEN lower(role) IN ('admin', 'manager') THEN 'admin'
  ELSE 'member'
END
WHERE platform_role IS NULL;

-- ── 4. Enable Realtime on team tables ─────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'team_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.team_members;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'team_invitations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.team_invitations;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'member_permissions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.member_permissions;
  END IF;
END $$;

-- ── 5. Auto-expire invitations via a Postgres cron job (pg_cron) ─────────────
--    Marks pending/invited invitations as 'expired' when expires_at has passed.
--    Requires pg_cron extension enabled in Supabase dashboard.
--    Safe to run even if pg_cron is not enabled — wrapped in DO block.
--    Idempotent: unschedules existing job before re-scheduling.

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Remove any existing job with this name to keep the migration idempotent.
    PERFORM cron.unschedule('expire-stale-invitations');
    PERFORM cron.schedule(
      'expire-stale-invitations',
      '0 * * * *',   -- every hour
      $$
        UPDATE public.team_invitations
        SET status = 'expired', updated_at = now()
        WHERE status IN ('pending', 'invited')
          AND expires_at <= now();
      $$
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- pg_cron job scheduling is optional; ignore errors.
  NULL;
END $$;
-- <<< END: supabase-migration-permissions-v1.sql


-- >>> BEGIN: supabase-migration-profiles.sql
-- OPENY OS — Profiles Table Migration
-- Run this in your Supabase SQL editor.
--
-- If you previously ran supabase-migration-users-roles.sql and have a
-- public.users table, this migration renames it to public.profiles and
-- updates all associated policies and triggers.
--
-- If no public.users table exists, it simply creates public.profiles.
--
-- This migration is SAFE to re-run.

-- ── 1. Rename existing public.users → public.profiles (if it exists) ──────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'users'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'profiles'
  ) THEN
    ALTER TABLE public.users RENAME TO profiles;
    RAISE NOTICE 'Renamed public.users to public.profiles';
  END IF;
END $$;

-- ── 2. Create public.profiles if it does not yet exist ────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id          uuid        PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  name        text        NOT NULL DEFAULT '',
  email       text        NOT NULL DEFAULT '',
  role        text        NOT NULL DEFAULT 'client'
                CHECK (role IN ('admin', 'team_member', 'client')),
  client_id   uuid        REFERENCES public.clients (id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── 3. Row Level Security ─────────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop legacy policies from the old table name (no-ops if already dropped).
DROP POLICY IF EXISTS "users_read_own"       ON public.profiles;
DROP POLICY IF EXISTS "users_admin_read_all" ON public.profiles;
DROP POLICY IF EXISTS "users_admin_write"    ON public.profiles;

-- A user can always read their own profile row.
CREATE POLICY "profiles_read_own"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Admins can read every profile row.
CREATE POLICY "profiles_admin_read_all"
  ON public.profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
    )
  );

-- Only admins can insert / update / delete profile rows directly.
-- Normal sign-up rows are created via the trigger below (SECURITY DEFINER).
CREATE POLICY "profiles_admin_write"
  ON public.profiles
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
    )
  );

-- ── 4. Trigger: auto-create profile on sign-up ────────────────────────────────
-- Promotes the configured admin email to role='admin' automatically.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  -- Promote to admin if the email matches the configured admin address.
  IF lower(coalesce(new.email, '')) = lower(coalesce(current_setting('app.admin_email', true), 'thetaiseer@gmail.com')) THEN
    v_role := 'admin';
  ELSE
    v_role := coalesce(new.raw_user_meta_data ->> 'role', 'client');
  END IF;

  INSERT INTO public.profiles (id, email, name, role)
  VALUES (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'name', split_part(coalesce(new.email, ''), '@', 1)),
    v_role
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_new_user();

-- ── 5. Promote existing admin email if already signed up ─────────────────────
INSERT INTO public.profiles (id, email, name, role)
SELECT
  au.id,
  au.email,
  coalesce(au.raw_user_meta_data ->> 'name', split_part(au.email, '@', 1)) AS name,
  'admin' AS role
FROM auth.users au
WHERE lower(au.email) = lower('thetaiseer@gmail.com')
ON CONFLICT (id)
  DO UPDATE SET role = 'admin';
-- <<< END: supabase-migration-profiles.sql


-- >>> BEGIN: supabase-migration-publishing-schedules.sql
-- ============================================================
-- Publishing Schedules Migration
-- Run this in your Supabase SQL editor to enable social
-- media publishing scheduling on any asset.
-- ============================================================

-- Allowed platforms enum
DO $$ BEGIN
  CREATE TYPE publishing_platform AS ENUM (
    'instagram',
    'facebook',
    'tiktok',
    'linkedin',
    'twitter',
    'snapchat',
    'youtube_shorts'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Allowed post types enum
DO $$ BEGIN
  CREATE TYPE publishing_post_type AS ENUM (
    'post',
    'reel',
    'carousel',
    'story'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Publishing status enum
DO $$ BEGIN
  CREATE TYPE publishing_status AS ENUM (
    'draft',
    'scheduled',
    'pending_review',
    'approved',
    'published',
    'missed',
    'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Main publishing_schedules table
CREATE TABLE IF NOT EXISTS publishing_schedules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Asset relation
  asset_id        UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,

  -- Client info (denormalized for quick access)
  client_id       UUID REFERENCES clients(id) ON DELETE SET NULL,
  client_name     TEXT,

  -- Schedule timing
  scheduled_date  DATE NOT NULL,
  scheduled_time  TIME NOT NULL DEFAULT '09:00:00',
  timezone        TEXT NOT NULL DEFAULT 'UTC',

  -- Platform + post type (stored as text arrays for flexibility)
  platforms       TEXT[] NOT NULL DEFAULT '{}',
  post_types      TEXT[] NOT NULL DEFAULT '{}',

  -- Content
  caption         TEXT,
  notes           TEXT,

  -- Workflow status
  status          TEXT NOT NULL DEFAULT 'scheduled',

  -- Optional assignee
  assigned_to     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assignee_name   TEXT,

  -- Optional reminder (minutes before publish time)
  reminder_minutes INTEGER,

  -- Linked task (auto-created on schedule)
  task_id         UUID REFERENCES tasks(id) ON DELETE SET NULL,

  -- Audit
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_name TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_publishing_schedules_asset_id
  ON publishing_schedules(asset_id);

CREATE INDEX IF NOT EXISTS idx_publishing_schedules_client_id
  ON publishing_schedules(client_id);

CREATE INDEX IF NOT EXISTS idx_publishing_schedules_scheduled_date
  ON publishing_schedules(scheduled_date);

CREATE INDEX IF NOT EXISTS idx_publishing_schedules_status
  ON publishing_schedules(status);

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_publishing_schedules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_publishing_schedules_updated_at ON publishing_schedules;
CREATE TRIGGER trg_publishing_schedules_updated_at
  BEFORE UPDATE ON publishing_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_publishing_schedules_updated_at();

-- Add optional extra columns to tasks table for publishing linkage
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS publishing_schedule_id UUID REFERENCES publishing_schedules(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS asset_id UUID REFERENCES assets(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS platforms TEXT[];
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS post_types TEXT[];

-- Enable RLS (Row Level Security)
ALTER TABLE publishing_schedules ENABLE ROW LEVEL SECURITY;

-- Policy: service role bypasses RLS (handled by using service role key in API)
-- Policy: authenticated users can read all publishing schedules in their org
CREATE POLICY "authenticated users can view publishing schedules"
  ON publishing_schedules
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "authenticated users can insert publishing schedules"
  ON publishing_schedules
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "authenticated users can update publishing schedules"
  ON publishing_schedules
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "authenticated users can delete publishing schedules"
  ON publishing_schedules
  FOR DELETE
  TO authenticated
  USING (true);
-- <<< END: supabase-migration-publishing-schedules.sql


-- >>> BEGIN: supabase-migration-r2-clean.sql
-- ============================================================
-- OPENY OS — R2 Clean Migration
-- ============================================================
-- Purpose:
--   1. Delete all existing data (full reset).
--   2. Drop Google Drive-specific columns.
--   3. Ensure the assets table has the minimal clean schema
--      required for Cloudflare R2 as the sole storage provider.
--
-- Run this ONCE in the Supabase SQL Editor after deploying
-- the application code that removes all Google Drive logic.
--
-- WARNING: This is DESTRUCTIVE. All rows in the tables below
--          will be permanently deleted.
-- ============================================================

-- ── 1. Delete all data ────────────────────────────────────────────────────────

-- Disable RLS temporarily so the service role can truncate freely.
-- (Supabase service role bypasses RLS by default, but CASCADE
--  requires FK awareness — TRUNCATE handles this cleanly.)

TRUNCATE TABLE
  activities,
  approvals,
  assets,
  clients,
  content_items,
  tasks
CASCADE;

-- ── 2. Drop Google Drive columns ──────────────────────────────────────────────

-- assets table — remove Drive-specific columns
ALTER TABLE assets
  DROP COLUMN IF EXISTS drive_file_id,
  DROP COLUMN IF EXISTS drive_folder_id,
  DROP COLUMN IF EXISTS original_filename,
  DROP COLUMN IF EXISTS last_synced_at,
  DROP COLUMN IF EXISTS source_updated_at,
  DROP COLUMN IF EXISTS upload_state,
  DROP COLUMN IF EXISTS version_number,
  DROP COLUMN IF EXISTS parent_asset_id,
  DROP COLUMN IF EXISTS is_deleted;

-- clients table — remove Drive folder reference
ALTER TABLE clients
  DROP COLUMN IF EXISTS drive_folder_id;

-- tasks table — remove Drive folder link
ALTER TABLE tasks
  DROP COLUMN IF EXISTS linked_drive_folder_id;

-- ── 3. Ensure clean assets schema ─────────────────────────────────────────────

-- Make sure the R2-native columns exist (idempotent).

ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS file_path        TEXT,
  ADD COLUMN IF NOT EXISTS storage_provider TEXT DEFAULT 'r2',
  ADD COLUMN IF NOT EXISTS bucket_name      TEXT,
  ADD COLUMN IF NOT EXISTS mime_type        TEXT;

-- ── 4. Drop Drive-related tables/migration artefacts ─────────────────────────

-- sync_logs table (Drive sync logs) — drop if it exists
DROP TABLE IF EXISTS sync_logs CASCADE;

-- google_oauth_tokens table — drop if it exists
DROP TABLE IF EXISTS google_oauth_tokens CASCADE;

-- ── 5. Confirm ────────────────────────────────────────────────────────────────

DO $$
BEGIN
  RAISE NOTICE 'R2 clean migration complete. Google Drive columns removed, all data reset.';
END $$;
-- <<< END: supabase-migration-r2-clean.sql


-- >>> BEGIN: supabase-migration-rls-v1.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- OPENY OS — Real per-role RLS policies (Phase 0 · F3)
--
-- Run this in your Supabase SQL editor AFTER all previous migrations.
--
-- Strategy:
--   • client role → can only read rows scoped to their own client_id
--   • editor / team → can read all, write own workspace rows, cannot delete
--   • manager → full read/write, cannot delete assets or clients
--   • admin → unrestricted
--   • service_role (server-side API) → always bypasses RLS
--
-- IMPORTANT: The OPENY OS backend API routes use the service_role key and
-- therefore bypass RLS entirely. These policies protect direct client-SDK
-- access (e.g. from the browser via the anon/user key).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Helper function: get the calling user's role from profiles ────────────────

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- ── Helper function: get the calling user's client_id from profiles ───────────

CREATE OR REPLACE FUNCTION public.current_user_client_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT client_id FROM public.profiles WHERE id = auth.uid();
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- profiles
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing blanket policies
DROP POLICY IF EXISTS "allow all profiles" ON public.profiles;

-- Everyone can read their own profile
CREATE POLICY "profiles: self read"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

-- Admin/manager can read all profiles
CREATE POLICY "profiles: admin manager read all"
  ON public.profiles FOR SELECT
  USING (public.current_user_role() IN ('admin', 'manager'));

-- Admin/manager can update any profile
CREATE POLICY "profiles: admin manager update"
  ON public.profiles FOR UPDATE
  USING (public.current_user_role() IN ('admin', 'manager'));

-- Users can update their own profile
CREATE POLICY "profiles: self update"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid());

-- Admin can delete profiles
CREATE POLICY "profiles: admin delete"
  ON public.profiles FOR DELETE
  USING (public.current_user_role() = 'admin');

-- ─────────────────────────────────────────────────────────────────────────────
-- clients
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow all clients" ON public.clients;

-- client role: read only their own record
CREATE POLICY "clients: client self read"
  ON public.clients FOR SELECT
  USING (
    public.current_user_role() = 'client'
    AND id = public.current_user_client_id()
  );

-- team/editor/manager/admin: read all clients
CREATE POLICY "clients: staff read all"
  ON public.clients FOR SELECT
  USING (public.current_user_role() IN ('admin', 'manager', 'team_member'));

-- manager/admin: insert clients
CREATE POLICY "clients: manager admin insert"
  ON public.clients FOR INSERT
  WITH CHECK (public.current_user_role() IN ('admin', 'manager'));

-- manager/admin: update clients
CREATE POLICY "clients: manager admin update"
  ON public.clients FOR UPDATE
  USING (public.current_user_role() IN ('admin', 'manager'));

-- admin only: delete clients
CREATE POLICY "clients: admin delete"
  ON public.clients FOR DELETE
  USING (public.current_user_role() = 'admin');

-- ─────────────────────────────────────────────────────────────────────────────
-- assets
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow all assets" ON public.assets;

-- client role: only their own client's assets
CREATE POLICY "assets: client scoped read"
  ON public.assets FOR SELECT
  USING (
    public.current_user_role() = 'client'
    AND client_id = public.current_user_client_id()
  );

-- staff read all
CREATE POLICY "assets: staff read all"
  ON public.assets FOR SELECT
  USING (public.current_user_role() IN ('admin', 'manager', 'team_member'));

-- team/manager/admin: insert
CREATE POLICY "assets: staff insert"
  ON public.assets FOR INSERT
  WITH CHECK (public.current_user_role() IN ('admin', 'manager', 'team_member'));

-- team/manager/admin: update
CREATE POLICY "assets: staff update"
  ON public.assets FOR UPDATE
  USING (public.current_user_role() IN ('admin', 'manager', 'team_member'));

-- admin/manager only: delete
CREATE POLICY "assets: admin manager delete"
  ON public.assets FOR DELETE
  USING (public.current_user_role() IN ('admin', 'manager'));

-- ─────────────────────────────────────────────────────────────────────────────
-- tasks
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow all tasks" ON public.tasks;

-- client role: tasks linked to their client_id
CREATE POLICY "tasks: client scoped read"
  ON public.tasks FOR SELECT
  USING (
    public.current_user_role() = 'client'
    AND client_id = public.current_user_client_id()
  );

-- staff read all
CREATE POLICY "tasks: staff read all"
  ON public.tasks FOR SELECT
  USING (public.current_user_role() IN ('admin', 'manager', 'team_member'));

-- all staff can insert tasks
CREATE POLICY "tasks: staff insert"
  ON public.tasks FOR INSERT
  WITH CHECK (public.current_user_role() IN ('admin', 'manager', 'team_member'));

-- all staff can update tasks
CREATE POLICY "tasks: staff update"
  ON public.tasks FOR UPDATE
  USING (public.current_user_role() IN ('admin', 'manager', 'team_member'));

-- admin/manager only: delete tasks
CREATE POLICY "tasks: admin manager delete"
  ON public.tasks FOR DELETE
  USING (public.current_user_role() IN ('admin', 'manager'));

-- ─────────────────────────────────────────────────────────────────────────────
-- approvals
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow all approvals" ON public.approvals;

-- client role: approvals for their client_id
CREATE POLICY "approvals: client scoped read"
  ON public.approvals FOR SELECT
  USING (
    public.current_user_role() = 'client'
    AND client_id = public.current_user_client_id()
  );

-- staff: read all
CREATE POLICY "approvals: staff read all"
  ON public.approvals FOR SELECT
  USING (public.current_user_role() IN ('admin', 'manager', 'team_member'));

-- staff: insert/update
CREATE POLICY "approvals: staff insert"
  ON public.approvals FOR INSERT
  WITH CHECK (public.current_user_role() IN ('admin', 'manager', 'team_member'));

CREATE POLICY "approvals: staff update"
  ON public.approvals FOR UPDATE
  USING (public.current_user_role() IN ('admin', 'manager', 'team_member'));

-- admin/manager: delete
CREATE POLICY "approvals: admin manager delete"
  ON public.approvals FOR DELETE
  USING (public.current_user_role() IN ('admin', 'manager'));

-- ─────────────────────────────────────────────────────────────────────────────
-- notifications
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow all notifications" ON public.notifications;

-- Users read only their own notifications
CREATE POLICY "notifications: self read"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid()::text OR user_id IS NULL);

-- Server-side inserts via service role bypass RLS. Allow staff inserts from browser too.
CREATE POLICY "notifications: staff insert"
  ON public.notifications FOR INSERT
  WITH CHECK (public.current_user_role() IN ('admin', 'manager', 'team_member'));

-- Users can update (mark read) their own notifications
CREATE POLICY "notifications: self update"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid()::text OR user_id IS NULL);

-- Admin can delete notifications
CREATE POLICY "notifications: admin delete"
  ON public.notifications FOR DELETE
  USING (public.current_user_role() = 'admin');

-- ─────────────────────────────────────────────────────────────────────────────
-- publishing_schedules
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.publishing_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow all publishing_schedules" ON public.publishing_schedules;

-- client role: only schedules for their client
CREATE POLICY "publishing_schedules: client scoped read"
  ON public.publishing_schedules FOR SELECT
  USING (
    public.current_user_role() = 'client'
    AND client_id = public.current_user_client_id()
  );

-- staff: read all
CREATE POLICY "publishing_schedules: staff read all"
  ON public.publishing_schedules FOR SELECT
  USING (public.current_user_role() IN ('admin', 'manager', 'team_member'));

-- staff: insert/update
CREATE POLICY "publishing_schedules: staff write"
  ON public.publishing_schedules FOR INSERT
  WITH CHECK (public.current_user_role() IN ('admin', 'manager', 'team_member'));

CREATE POLICY "publishing_schedules: staff update"
  ON public.publishing_schedules FOR UPDATE
  USING (public.current_user_role() IN ('admin', 'manager', 'team_member'));

-- admin/manager: delete
CREATE POLICY "publishing_schedules: admin manager delete"
  ON public.publishing_schedules FOR DELETE
  USING (public.current_user_role() IN ('admin', 'manager'));

-- ─────────────────────────────────────────────────────────────────────────────
-- activities
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow all activities" ON public.activities;

-- staff: read all activities
CREATE POLICY "activities: staff read all"
  ON public.activities FOR SELECT
  USING (public.current_user_role() IN ('admin', 'manager', 'team_member'));

-- staff: insert activities
CREATE POLICY "activities: staff insert"
  ON public.activities FOR INSERT
  WITH CHECK (public.current_user_role() IN ('admin', 'manager', 'team_member'));

-- admin: delete
CREATE POLICY "activities: admin delete"
  ON public.activities FOR DELETE
  USING (public.current_user_role() = 'admin');

-- ─────────────────────────────────────────────────────────────────────────────
-- content_items
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.content_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow all content_items" ON public.content_items;

-- client role: only their client's content
CREATE POLICY "content_items: client scoped read"
  ON public.content_items FOR SELECT
  USING (
    public.current_user_role() = 'client'
    AND client_id = public.current_user_client_id()
  );

-- staff: read all
CREATE POLICY "content_items: staff read all"
  ON public.content_items FOR SELECT
  USING (public.current_user_role() IN ('admin', 'manager', 'team_member'));

-- staff: insert/update
CREATE POLICY "content_items: staff write"
  ON public.content_items FOR INSERT
  WITH CHECK (public.current_user_role() IN ('admin', 'manager', 'team_member'));

CREATE POLICY "content_items: staff update"
  ON public.content_items FOR UPDATE
  USING (public.current_user_role() IN ('admin', 'manager', 'team_member'));

-- admin/manager: delete
CREATE POLICY "content_items: admin manager delete"
  ON public.content_items FOR DELETE
  USING (public.current_user_role() IN ('admin', 'manager'));

-- ─────────────────────────────────────────────────────────────────────────────
-- automation_rules
-- ─────────────────────────────────────────────────────────────────────────────
-- Already has proper RLS from supabase-migration-automations.sql.
-- No changes needed.

-- ─────────────────────────────────────────────────────────────────────────────
-- calendar_events
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow all calendar_events" ON public.calendar_events;

CREATE POLICY "calendar_events: client scoped read"
  ON public.calendar_events FOR SELECT
  USING (
    public.current_user_role() = 'client'
    AND client_id = public.current_user_client_id()
  );

CREATE POLICY "calendar_events: staff read all"
  ON public.calendar_events FOR SELECT
  USING (public.current_user_role() IN ('admin', 'manager', 'team_member'));

CREATE POLICY "calendar_events: staff write"
  ON public.calendar_events FOR INSERT
  WITH CHECK (public.current_user_role() IN ('admin', 'manager', 'team_member'));

CREATE POLICY "calendar_events: staff update"
  ON public.calendar_events FOR UPDATE
  USING (public.current_user_role() IN ('admin', 'manager', 'team_member'));

CREATE POLICY "calendar_events: admin manager delete"
  ON public.calendar_events FOR DELETE
  USING (public.current_user_role() IN ('admin', 'manager'));
-- <<< END: supabase-migration-rls-v1.sql


-- >>> BEGIN: supabase-migration-role-consistency.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- OPENY OS — Role Consistency Migration
--
-- Purpose:
--   Standardise the canonical role set across the whole team system.
--
--   Canonical internal role values:
--     owner | admin | manager | team_member | viewer
--
--   The old value 'team' is renamed to 'team_member'.
--   'client' rows are left untouched (client portal access, not an invitable role).
--
-- Run this in your Supabase SQL Editor.
-- Safe to run multiple times (idempotent).
-- ─────────────────────────────────────────────────────────────────────────────

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. public.team_members — migrate 'team' → 'team_member' data
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE public.team_members
SET role = 'team_member'
WHERE role = 'team';

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. public.team_members — drop old role check constraint (if any) and
--    add new one with canonical values
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  -- Drop any existing role check constraint on team_members
  IF EXISTS (
    SELECT 1
    FROM   information_schema.table_constraints
    WHERE  table_schema    = 'public'
      AND  table_name      = 'team_members'
      AND  constraint_name = 'team_members_role_check'
      AND  constraint_type = 'CHECK'
  ) THEN
    ALTER TABLE public.team_members DROP CONSTRAINT team_members_role_check;
  END IF;
END;
$$;

ALTER TABLE public.team_members
  ADD CONSTRAINT team_members_role_check
  CHECK (role IN ('owner', 'admin', 'manager', 'team_member', 'viewer', 'client'));

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. public.team_invitations — migrate 'team' → 'team_member' data
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE public.team_invitations
SET role = 'team_member'
WHERE role = 'team';

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. public.team_invitations — drop old role check constraint (if any) and
--    add new one with canonical values
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM   information_schema.table_constraints
    WHERE  table_schema    = 'public'
      AND  table_name      = 'team_invitations'
      AND  constraint_name = 'team_invitations_role_check'
      AND  constraint_type = 'CHECK'
  ) THEN
    ALTER TABLE public.team_invitations DROP CONSTRAINT team_invitations_role_check;
  END IF;
END;
$$;

ALTER TABLE public.team_invitations
  ADD CONSTRAINT team_invitations_role_check
  CHECK (role IN ('owner', 'admin', 'manager', 'team_member', 'viewer', 'client'));

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. public.profiles — ensure role column accepts the canonical values
--    (profiles stores the role for the authenticated user's access context)
-- ═══════════════════════════════════════════════════════════════════════════

-- Migrate any 'team' values first
UPDATE public.profiles
SET role = 'team_member'
WHERE role = 'team';

-- Drop old profiles role constraints and add new canonical one
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM   information_schema.table_constraints
    WHERE  table_schema    = 'public'
      AND  table_name      = 'profiles'
      AND  constraint_name = 'profiles_role_check'
      AND  constraint_type = 'CHECK'
  ) THEN
    ALTER TABLE public.profiles DROP CONSTRAINT profiles_role_check;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM   information_schema.table_constraints
    WHERE  table_schema    = 'public'
      AND  table_name      = 'profiles'
      AND  constraint_name = 'profiles_role_check_v2'
      AND  constraint_type = 'CHECK'
  ) THEN
    ALTER TABLE public.profiles DROP CONSTRAINT profiles_role_check_v2;
  END IF;
END;
$$;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('owner', 'admin', 'manager', 'team_member', 'viewer', 'client'));

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. RLS policies — re-create any policies that referenced 'team' so they
--    now reference 'team_member' instead.
--    (The current_user_role() helper reads profiles.role; after step 5 above
--    migrates existing rows, policies must check for 'team_member'.)
--
-- The IF NOT EXISTS / DROP + CREATE pattern makes this idempotent.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  rec RECORD;
BEGIN
  -- For every RLS policy on every table in the 'public' schema, if the
  -- policy definition contains '''team''' (i.e., the literal string 'team')
  -- without the '_member' suffix, we must recreate it.
  --
  -- Rather than enumerating every table, we simply ALTER each affected
  -- policy's USING / WITH CHECK expression by dropping and re-creating it.
  --
  -- This loop finds and drops all affected policies.
  -- A policy is considered outdated if it references the literal 'team'
  -- (without '_member') in either its USING or WITH CHECK expression.
  FOR rec IN
    SELECT schemaname, tablename, policyname
    FROM   pg_policies
    WHERE  schemaname = 'public'
      AND  (
        (qual       LIKE $q$%'team'%$q$ AND qual       NOT LIKE $q$%'team_member'%$q$)
        OR
        (with_check LIKE $q$%'team'%$q$ AND with_check NOT LIKE $q$%'team_member'%$q$)
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
      rec.policyname, rec.schemaname, rec.tablename);
  END LOOP;
END;
$$;

-- Re-create the standard team-scoped read policy for assets (example).
-- NOTE: If your actual policies differ from supabase-migration-rls-v1.sql,
-- run that migration again after applying this one — it now uses team_member.
-- The SELECT-for-team_member policy on assets:
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE  schemaname = 'public' AND tablename = 'assets'
      AND  policyname = 'team_member can view assets'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE  table_schema = 'public' AND table_name = 'assets'
  ) THEN
    -- Only recreate if the generic allow-all policy is not present
    -- (i.e., the more restrictive rls-v1 policies are in effect).
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE  schemaname = 'public' AND tablename = 'assets'
        AND  policyname = 'allow all assets'
    ) THEN
      EXECUTE $pol$
        CREATE POLICY "team_member can view assets"
          ON public.assets FOR SELECT
          USING (public.current_user_role() IN ('admin', 'manager', 'team_member'));
      $pol$;
    END IF;
  END IF;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Done.
--
-- After running this migration:
--   • team_members.role  CHECK: owner | admin | manager | team_member | viewer | client
--   • team_invitations.role CHECK: same
--   • profiles.role      CHECK: same
--   • All existing 'team' rows migrated to 'team_member'
--
-- Canonical internal role values going forward:
--   owner        — workspace owner (cannot be invited)
--   admin        — full access
--   manager      — manage tasks & team
--   team_member  — standard access
--   viewer       — read-only access
-- ═══════════════════════════════════════════════════════════════════════════
-- <<< END: supabase-migration-role-consistency.sql


-- >>> BEGIN: supabase-migration-saas-v1.sql
-- OPENY OS SaaS v1 Migration
-- Run this in your Supabase SQL editor after supabase-schema.sql

-- ── New columns on assets ──────────────────────────────────────────────────────
ALTER TABLE assets ADD COLUMN IF NOT EXISTS publish_date      date;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS approval_status   text default 'pending'
  CHECK (approval_status IN ('pending','approved','rejected','scheduled','published'));
ALTER TABLE assets ADD COLUMN IF NOT EXISTS approval_notes    text;

-- ── Comments ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content     text NOT NULL,
  user_id     text NOT NULL,
  user_name   text NOT NULL,
  asset_id    uuid REFERENCES assets(id) ON DELETE CASCADE,
  task_id     uuid REFERENCES tasks(id)  ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "allow all comments" ON comments FOR ALL USING (true) WITH CHECK (true);

-- ── Notifications ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  message     text NOT NULL,
  type        text NOT NULL DEFAULT 'info'
    CHECK (type IN ('info','success','warning','error')),
  read        boolean NOT NULL DEFAULT false,
  client_id   uuid REFERENCES clients(id) ON DELETE CASCADE,
  user_id     text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "allow all notifications" ON notifications FOR ALL USING (true) WITH CHECK (true);

-- ── Approval history ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS approval_history (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id    uuid REFERENCES assets(id) ON DELETE CASCADE,
  action      text NOT NULL
    CHECK (action IN ('approved','rejected','pending','scheduled','published')),
  user_id     text,
  user_name   text,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE approval_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "allow all approval_history" ON approval_history FOR ALL USING (true) WITH CHECK (true);
-- <<< END: supabase-migration-saas-v1.sql


-- >>> BEGIN: supabase-migration-schema-v2.sql
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
-- <<< END: supabase-migration-schema-v2.sql


-- >>> BEGIN: supabase-migration-sessions.sql
-- OPENY OS — Session / Login History Migration
-- Run this in your Supabase SQL editor
-- Safe to re-run: uses IF NOT EXISTS / idempotent DO blocks

create table if not exists user_sessions (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users(id) on delete cascade,
  ip_address   text,
  country      text,
  city         text,
  user_agent   text,
  browser      text,
  os           text,
  device_type  text,
  is_active    boolean     not null default true,
  last_seen_at timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  revoked_at   timestamptz,
  revoked_by   text,
  risk_flag    boolean     not null default false
);

-- Fast lookup by user
create index if not exists idx_user_sessions_user_id
  on user_sessions(user_id);

-- Fast lookup of active sessions per user
create index if not exists idx_user_sessions_user_active
  on user_sessions(user_id, is_active)
  where is_active = true;

-- Fast lookup of most-recent activity
create index if not exists idx_user_sessions_last_seen
  on user_sessions(user_id, last_seen_at desc);

-- Enable Row Level Security
alter table user_sessions enable row level security;

-- Users can read their own sessions
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'user_sessions' and policyname = 'users_select_own_sessions'
  ) then
    create policy "users_select_own_sessions"
      on user_sessions for select
      using (auth.uid() = user_id);
  end if;
end $$;

-- Users can insert their own sessions
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'user_sessions' and policyname = 'users_insert_own_sessions'
  ) then
    create policy "users_insert_own_sessions"
      on user_sessions for insert
      with check (auth.uid() = user_id);
  end if;
end $$;

-- Users can update their own sessions (last_seen_at, is_active, etc.)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'user_sessions' and policyname = 'users_update_own_sessions'
  ) then
    create policy "users_update_own_sessions"
      on user_sessions for update
      using (auth.uid() = user_id);
  end if;
end $$;

-- Users can delete their own sessions
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'user_sessions' and policyname = 'users_delete_own_sessions'
  ) then
    create policy "users_delete_own_sessions"
      on user_sessions for delete
      using (auth.uid() = user_id);
  end if;
end $$;
-- <<< END: supabase-migration-sessions.sql


-- >>> BEGIN: supabase-migration-storage-rls.sql
-- ============================================================================
-- Supabase Storage RLS policies for the "client-assets" bucket
--
-- Run this migration once in the Supabase SQL Editor.
--
-- This script is idempotent — it is safe to run multiple times.
--
-- What this does:
--   1. Creates the "client-assets" storage bucket (public, 250 MB file size limit).
--   2. Enables Row Level Security on storage.objects.
--   3. Creates RLS policies so authenticated users can upload, read, update,
--      and delete files in the "client-assets" bucket.
--
-- Note: Server-side API routes use the SUPABASE_SERVICE_ROLE_KEY which
-- bypasses RLS automatically. These policies are also needed for any
-- direct client-side storage access (e.g. presigned URLs, browser uploads).
--
-- IMPORTANT — ensure the following environment variables are set in your
-- deployment (Vercel / .env.local):
--   NEXT_PUBLIC_SUPABASE_URL      — your Supabase project URL
--   NEXT_PUBLIC_SUPABASE_ANON_KEY — your Supabase anon/public key
--   SUPABASE_SERVICE_ROLE_KEY     — your Supabase service role key
--                                   (used by /api/upload for server-side uploads)
-- ============================================================================

-- ── 1. Create the client-assets bucket ───────────────────────────────────────
-- public = true  → files are accessible via the /storage/v1/object/public/ URL
--                  without authentication (required for the public URLs stored
--                  in file_url / preview_url / thumbnail_url columns).
-- file_size_limit → 250 MB, matching the server-side MAX_FILE_SIZE constant.
insert into storage.buckets (id, name, public, file_size_limit)
values ('client-assets', 'client-assets', true, 262144000)  -- 250 MB = 250 * 1024 * 1024
on conflict (id) do update
  set public          = excluded.public,
      file_size_limit = excluded.file_size_limit;

-- ── 2. Enable RLS on storage.objects ─────────────────────────────────────────
-- Already enabled by default on hosted Supabase; included for self-hosted setups.
alter table storage.objects enable row level security;

-- ── 3. Upload policy ─────────────────────────────────────────────────────────
-- Authenticated users may upload files to the "client-assets" bucket.
-- Path convention enforced by the application: {user_id}/{timestamp}_{filename}
-- The check on bucket_id scopes this policy exclusively to our bucket.
drop policy if exists "Allow authenticated upload to assets" on storage.objects;
drop policy if exists "Allow authenticated upload to client-assets" on storage.objects;
create policy "Allow authenticated upload to client-assets"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'client-assets');

-- ── 4. Read policy ────────────────────────────────────────────────────────────
-- Authenticated users may read (list/download) any file in the "client-assets" bucket.
-- Public reads via /object/public/ URLs bypass this policy — they are governed
-- by the bucket's public flag set above.
drop policy if exists "Allow authenticated read from assets" on storage.objects;
drop policy if exists "Allow authenticated read from client-assets" on storage.objects;
create policy "Allow authenticated read from client-assets"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'client-assets');

-- ── 5. Update policy ──────────────────────────────────────────────────────────
-- Authenticated users may update (overwrite/upsert) objects in the "client-assets" bucket.
drop policy if exists "Allow authenticated update to assets" on storage.objects;
drop policy if exists "Allow authenticated update to client-assets" on storage.objects;
create policy "Allow authenticated update to client-assets"
  on storage.objects
  for update
  to authenticated
  using     (bucket_id = 'client-assets')
  with check (bucket_id = 'client-assets');

-- ── 6. Delete policy ─────────────────────────────────────────────────────────
-- Authenticated users may delete files from the "client-assets" bucket.
-- Access control for deletion is enforced at the API route level
-- (DELETE /api/assets/[id] requires admin or team role).
drop policy if exists "Allow authenticated delete from assets" on storage.objects;
drop policy if exists "Allow authenticated delete from client-assets" on storage.objects;
create policy "Allow authenticated delete from client-assets"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'client-assets');
-- <<< END: supabase-migration-storage-rls.sql


-- >>> BEGIN: supabase-migration-storage-upload-policy-fix.sql
-- OPENY OS — Supabase Storage upload policy fix
-- Ensures the upload bucket exists and authenticated users can upload/read/update.

insert into storage.buckets (id, name, public)
values ('assets', 'assets', true)
on conflict (id) do update
  set public = excluded.public;

insert into storage.buckets (id, name, public)
values ('client-assets', 'client-assets', true)
on conflict (id) do update
  set public = excluded.public;

alter table storage.objects enable row level security;

drop policy if exists "storage_auth_upload_insert" on storage.objects;
create policy "storage_auth_upload_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    auth.uid() is not null
    and bucket_id in ('assets', 'client-assets')
  );

drop policy if exists "storage_auth_upload_select" on storage.objects;
create policy "storage_auth_upload_select"
  on storage.objects
  for select
  to authenticated
  using (
    auth.uid() is not null
    and bucket_id in ('assets', 'client-assets')
  );

drop policy if exists "storage_auth_upload_update" on storage.objects;
create policy "storage_auth_upload_update"
  on storage.objects
  for update
  to authenticated
  using (
    auth.uid() is not null
    and bucket_id in ('assets', 'client-assets')
  )
  with check (
    auth.uid() is not null
    and bucket_id in ('assets', 'client-assets')
  );
-- <<< END: supabase-migration-storage-upload-policy-fix.sql


-- >>> BEGIN: supabase-migration-sync-logs.sql
-- ── Drive Sync Logs ──────────────────────────────────────────────────────────
-- Run this migration to enable Google Drive ↔ DB sync logging.
-- Requires: supabase-migration-drive-schema-v2.sql to have been applied.

CREATE TABLE IF NOT EXISTS drive_sync_logs (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  synced_at     timestamptz NOT NULL DEFAULT now(),
  files_added   int         NOT NULL DEFAULT 0,
  files_updated int         NOT NULL DEFAULT 0,
  files_removed int         NOT NULL DEFAULT 0,
  errors_count  int         NOT NULL DEFAULT 0,
  error_details text[]      NOT NULL DEFAULT '{}',
  duration_ms   int,
  triggered_by  text        NOT NULL DEFAULT 'manual' CHECK (triggered_by IN ('manual', 'cron'))
);

-- Allow the app to read and insert sync logs
ALTER TABLE drive_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role full access to drive_sync_logs"
  ON drive_sync_logs FOR ALL
  USING (true)
  WITH CHECK (true);

-- Index for fast "last sync" queries
CREATE INDEX IF NOT EXISTS drive_sync_logs_synced_at_idx ON drive_sync_logs (synced_at DESC);
-- <<< END: supabase-migration-sync-logs.sql


-- >>> BEGIN: supabase-migration-tasks-position.sql
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
-- <<< END: supabase-migration-tasks-position.sql


-- >>> BEGIN: supabase-migration-tasks-v2.sql
-- OPENY OS Task Manager v2 Migration
-- Run this in your Supabase SQL editor after the initial supabase-schema.sql

-- Team Members table
create table if not exists team_members (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  email      text,
  role       text,
  avatar     text,
  created_at timestamptz not null default now()
);

-- Add new columns to tasks (safe: IF NOT EXISTS via DO block)
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name='tasks' and column_name='created_by') then
    alter table tasks add column created_by text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='tasks' and column_name='mentions') then
    alter table tasks add column mentions text[] default '{}';
  end if;
  if not exists (select 1 from information_schema.columns where table_name='tasks' and column_name='tags') then
    alter table tasks add column tags text[] default '{}';
  end if;
  if not exists (select 1 from information_schema.columns where table_name='tasks' and column_name='task_date') then
    alter table tasks add column task_date date;
  end if;
end $$;

-- RLS for team_members
alter table team_members enable row level security;
create policy "allow all team_members" on team_members for all using (true) with check (true);
-- <<< END: supabase-migration-tasks-v2.sql


-- >>> BEGIN: supabase-migration-tasks-v3.sql
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
-- <<< END: supabase-migration-tasks-v3.sql


-- >>> BEGIN: supabase-migration-team-complete.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Team Complete Migration
-- Run this in your Supabase SQL Editor.
--
-- This is the canonical, idempotent migration for the team invite flow.
-- It is safe to run even if earlier partial migrations (tasks-v2,
-- team-invitations) were already applied — every step uses IF NOT EXISTS
-- or DO/IF blocks.
--
-- Creates / patches:
--   1. public.team_members   — with status + updated_at columns
--   2. public.team_invitations — full invitation record
--   3. RLS policies for both tables (development-friendly allow-all)
-- ─────────────────────────────────────────────────────────────────────────────

-- ═══════════════════════════════════════════════════════════════════════════
-- 1.  public.team_members
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.team_members (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  email      TEXT,
  role       TEXT,
  avatar     TEXT,
  status     TEXT        NOT NULL DEFAULT 'active'
               CHECK (status IN ('active', 'invited', 'inactive', 'suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Patch existing table: add missing columns if they were omitted in older migrations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'team_members' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.team_members
      ADD COLUMN status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'invited', 'inactive', 'suspended'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'team_members' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.team_members
      ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'team_members' AND column_name = 'avatar'
  ) THEN
    ALTER TABLE public.team_members
      ADD COLUMN avatar TEXT;
  END IF;
END;
$$;

-- RLS for team_members
-- NOTE: The policy below is intentionally permissive for development / testing.
-- Before going to production replace it with role-scoped policies, e.g.:
--   SELECT allowed for authenticated users
--   INSERT/UPDATE/DELETE restricted to admin and manager roles
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'team_members'
      AND policyname = 'allow all team_members'
  ) THEN
    CREATE POLICY "allow all team_members"
      ON public.team_members FOR ALL USING (true) WITH CHECK (true);
  END IF;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2.  public.team_invitations
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Columns expected by code:
--   id             UUID     PK
--   team_member_id UUID     FK → team_members(id) ON DELETE CASCADE
--   email          TEXT     recipient email
--   name           TEXT     recipient display name
--   role           TEXT     assigned role (admin|manager|team|client)
--   token          TEXT     UNIQUE secure random token (64 hex chars)
--   status         TEXT     invited|accepted|expired|revoked
--   invited_by     UUID     FK → profiles(id) ON DELETE SET NULL (nullable)
--   expires_at     TIMESTAMPTZ
--   accepted_at    TIMESTAMPTZ (nullable)
--   created_at     TIMESTAMPTZ
--   updated_at     TIMESTAMPTZ
-- ─────────────────────────────────────────────────────────────────────────────

--
-- DEPENDENCY: public.profiles must exist before this table is created.
-- It is created by supabase-migration-profiles.sql (or the Supabase Auth
-- trigger that auto-creates it).  Run that migration first if needed.
--
CREATE TABLE IF NOT EXISTS public.team_invitations (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id UUID        NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  email          TEXT        NOT NULL,
  name           TEXT        NOT NULL,
  role           TEXT        NOT NULL,
  token          TEXT        NOT NULL UNIQUE,
  status         TEXT        NOT NULL DEFAULT 'invited'
                               CHECK (status IN ('invited', 'accepted', 'expired', 'revoked')),
  invited_by     UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  expires_at     TIMESTAMPTZ NOT NULL,
  accepted_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_team_invitations_token
  ON public.team_invitations (token);

CREATE INDEX IF NOT EXISTS idx_team_invitations_email
  ON public.team_invitations (email);

CREATE INDEX IF NOT EXISTS idx_team_invitations_status
  ON public.team_invitations (status);

CREATE INDEX IF NOT EXISTS idx_team_invitations_team_member_id
  ON public.team_invitations (team_member_id);

-- RLS for team_invitations
-- NOTE: The policy below is intentionally permissive for development / testing.
-- Invitation tokens are single-use and expire after 7 days. Before going to
-- production replace with tighter policies, e.g.:
--   SELECT restricted to the invited email or admin/manager roles
--   INSERT/UPDATE/DELETE restricted to admin and manager roles
ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'team_invitations'
      AND policyname = 'allow all team_invitations'
  ) THEN
    CREATE POLICY "allow all team_invitations"
      ON public.team_invitations FOR ALL USING (true) WITH CHECK (true);
  END IF;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Done.
--
-- After running this migration the following invite-flow operations work:
--
--   POST /api/team/invite
--     → inserts team_members {name, email, role, status='invited'}
--     → inserts team_invitations {team_member_id, email, name, role,
--                                 token, status='invited', invited_by,
--                                 expires_at}
--     → sends invite email via Resend
--
--   GET  /api/team/invite/[token]
--     → reads team_invitations {id, email, name, role, status, expires_at,
--                               accepted_at}
--
--   POST /api/team/invite/[token]/accept
--     → reads  team_invitations {id, email, name, role, status, expires_at,
--                                team_member_id}
--     → creates Supabase auth user + profiles row
--     → updates team_members  {status='active', updated_at}
--     → updates team_invitations {status='accepted', accepted_at, updated_at}
--
--   POST /api/team/invite/resend
--     → reads  team_invitations {*} by team_member_id
--     → updates team_invitations {token, status, expires_at, updated_at}
--     → updates team_members    {status='invited', updated_at}
--
--   POST /api/team/invite/revoke
--     → updates team_invitations {status='revoked', updated_at}
--     → deletes team_members row where status='invited'
-- ═══════════════════════════════════════════════════════════════════════════
-- <<< END: supabase-migration-team-complete.sql


-- >>> BEGIN: supabase-migration-team-identity.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- OPENY OS — Team Identity Migration
--
-- Purpose:
--   1. Adds `job_title` column to team_members so that access role (role)
--      and actual job title (job_title) are stored separately.
--   2. Migrates existing rows where `role` looks like a job title — moves
--      the value to `job_title` and sets `role` to 'team'.
--   3. Ensures thetaiseer@gmail.com has an active team_members row with
--      role = 'owner'.
--   4. Updates the profiles row for thetaiseer@gmail.com to role = 'owner'.
--
-- Safe to run multiple times (idempotent).
-- ─────────────────────────────────────────────────────────────────────────────

-- ══════════════════════════════════════════════════════════════════════════════
-- 1. Add job_title column to team_members
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS job_title TEXT;

-- ══════════════════════════════════════════════════════════════════════════════
-- 2. Migrate old job-title values from `role` → `job_title`
--
--    Rows where `role` is NOT a valid access role are treated as job-title
--    leftovers and moved to `job_title`. The `role` column is then set to
--    'team' (the default non-privileged access level).
-- ══════════════════════════════════════════════════════════════════════════════

UPDATE public.team_members
SET
  job_title = role,
  role      = 'team_member'
WHERE
  role IS NOT NULL
  AND lower(role) NOT IN ('owner', 'admin', 'manager', 'team', 'team_member', 'member', 'viewer', 'client')
  AND job_title IS NULL;  -- only migrate if job_title not already set

-- ══════════════════════════════════════════════════════════════════════════════
-- 3. Ensure thetaiseer@gmail.com has an active owner team_members row
-- ══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_existing_id UUID;
BEGIN
  -- Find an existing team_members row for this email
  SELECT id INTO v_existing_id
  FROM public.team_members
  WHERE lower(email) = 'thetaiseer@gmail.com'
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    -- Update existing row to owner + active
    UPDATE public.team_members
    SET
      role       = 'owner',
      status     = 'active',
      updated_at = now()
    WHERE id = v_existing_id;

    RAISE NOTICE 'Updated existing team_members row % to owner/active', v_existing_id;
  ELSE
    -- Insert a new owner row
    INSERT INTO public.team_members (full_name, email, role, status)
    VALUES ('Thetaiseer', 'thetaiseer@gmail.com', 'owner', 'active');

    RAISE NOTICE 'Inserted new team_members owner row for thetaiseer@gmail.com';
  END IF;
END;
$$;

-- ══════════════════════════════════════════════════════════════════════════════
-- 4. Promote thetaiseer@gmail.com to owner in profiles
--
--    This ensures the auth-context resolves the correct role even when
--    the profile row exists with an old role value.
-- ══════════════════════════════════════════════════════════════════════════════

UPDATE public.profiles
SET role = 'owner'
WHERE lower(email) = 'thetaiseer@gmail.com';

-- Also upsert via auth.users in case the profiles row doesn't exist yet
INSERT INTO public.profiles (id, email, name, role)
SELECT
  au.id,
  au.email,
  coalesce(au.raw_user_meta_data ->> 'name', split_part(au.email, '@', 1)),
  'owner'
FROM auth.users au
WHERE lower(au.email) = 'thetaiseer@gmail.com'
ON CONFLICT (id)
  DO UPDATE SET role = 'owner';

-- ══════════════════════════════════════════════════════════════════════════════
-- Done.
--
-- After running this migration:
--   • team_members.role  = access role (owner|admin|manager|team|viewer|client)
--   • team_members.job_title = human-readable job description (Graphic Designer…)
--   • thetaiseer@gmail.com has role=owner, status=active in team_members
--   • thetaiseer@gmail.com has role=owner in profiles
-- ══════════════════════════════════════════════════════════════════════════════
-- <<< END: supabase-migration-team-identity.sql


-- >>> BEGIN: supabase-migration-team-invitations-accepted-at.sql
-- Add accepted_at to team_invitations when missing (legacy / hand-made schemas).
-- Fixes: column team_invitations.accepted_at does not exist → GET /api/team/invitations 500
ALTER TABLE public.team_invitations
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz;

NOTIFY pgrst, 'reload schema';
-- <<< END: supabase-migration-team-invitations-accepted-at.sql


-- >>> BEGIN: supabase-migration-team-invitations.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Team Invitations Migration
-- Run this in your Supabase SQL Editor.
--
-- Changes:
--   1. Adds `status` and `updated_at` columns to team_members (if missing)
--   2. Creates the `team_invitations` table
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Patch team_members
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'team_members' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.team_members
      ADD COLUMN status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'invited', 'inactive', 'suspended'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'team_members' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.team_members
      ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
  END IF;
END;
$$;

-- 2. Create team_invitations
CREATE TABLE IF NOT EXISTS public.team_invitations (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id UUID        NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  email          TEXT        NOT NULL,
  name           TEXT        NOT NULL,
  role           TEXT        NOT NULL,
  token          TEXT        NOT NULL UNIQUE,
  status         TEXT        NOT NULL DEFAULT 'invited'
                               CHECK (status IN ('invited', 'accepted', 'expired', 'revoked')),
  invited_by     UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  expires_at     TIMESTAMPTZ NOT NULL,
  accepted_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_team_invitations_token
  ON public.team_invitations (token);

CREATE INDEX IF NOT EXISTS idx_team_invitations_email
  ON public.team_invitations (email);

CREATE INDEX IF NOT EXISTS idx_team_invitations_status
  ON public.team_invitations (status);

-- RLS — allow all for now (matches existing team_members policy)
ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'team_invitations' AND policyname = 'allow all team_invitations'
  ) THEN
    CREATE POLICY "allow all team_invitations"
      ON public.team_invitations FOR ALL USING (true) WITH CHECK (true);
  END IF;
END;
$$;
-- <<< END: supabase-migration-team-invitations.sql


-- >>> BEGIN: supabase-migration-team-invite-fix.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Team Invite Fix Migration
-- Run this in your Supabase SQL Editor.
--
-- Fixes the invitation flow bug where:
--   1. team_invitations.role was missing (NOT NULL violation causing insert failure)
--   2. Invitations were stored with status='pending' (not in CHECK constraint)
--   3. The 'name' column (if still present) was blocking inserts
--
-- Safe to run multiple times (idempotent).
-- ─────────────────────────────────────────────────────────────────────────────

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Ensure team_invitations has a `role` column
--    (the original team-complete migration has role NOT NULL but no DEFAULT;
--     if it was omitted or dropped, add it back as nullable for safety)
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'team_invitations'
      AND column_name  = 'role'
  ) THEN
    -- Add nullable first so existing rows don't violate NOT NULL
    ALTER TABLE public.team_invitations ADD COLUMN role TEXT;
    RAISE NOTICE 'Added role column to team_invitations';
  END IF;
END;
$$;

-- Back-fill role from the linked team_members row where it is NULL
UPDATE public.team_invitations ti
SET    role = tm.role
FROM   public.team_members tm
WHERE  ti.team_member_id = tm.id
  AND  ti.role IS NULL;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Widen the status CHECK constraint to include 'pending'
--    (some rows may have been stored with the old status value before the
--     code was updated to use 'invited')
--
-- Note: PostgreSQL requires dropping and re-adding the constraint.
-- The NOT NULL + DEFAULT 'invited' are preserved.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  -- Find the existing CHECK constraint on status (name may vary)
  SELECT conname INTO v_constraint_name
  FROM   pg_constraint
  WHERE  conrelid = 'public.team_invitations'::regclass
    AND  contype  = 'c'
    AND  pg_get_constraintdef(oid) LIKE '%status%';

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.team_invitations DROP CONSTRAINT %I', v_constraint_name);
    RAISE NOTICE 'Dropped old status CHECK constraint: %', v_constraint_name;
  END IF;

  -- Re-add constraint that includes all valid statuses
  ALTER TABLE public.team_invitations
    ADD CONSTRAINT team_invitations_status_check
      CHECK (status IN ('invited', 'pending', 'accepted', 'expired', 'revoked'));

  RAISE NOTICE 'Added new status CHECK constraint (includes invited|pending|accepted|expired|revoked)';
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Migrate legacy 'pending' rows to 'invited'
--    (the code now always writes 'invited'; normalise existing data)
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE public.team_invitations
SET    status     = 'invited',
       updated_at = now()
WHERE  status = 'pending';

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. Remove the 'name' / 'full_name' columns from team_invitations
--    if they still exist from an earlier migration that was never cleaned up.
--    (full_name lives in team_members and is retrieved via JOIN)
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'team_invitations'
      AND column_name  = 'full_name'
  ) THEN
    ALTER TABLE public.team_invitations DROP COLUMN full_name;
    RAISE NOTICE 'Dropped full_name column from team_invitations';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'team_invitations'
      AND column_name  = 'name'
  ) THEN
    ALTER TABLE public.team_invitations DROP COLUMN name;
    RAISE NOTICE 'Dropped name column from team_invitations';
  END IF;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. Ensure team_members has profile_id and job_title columns
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'team_members'
      AND column_name  = 'profile_id'
  ) THEN
    ALTER TABLE public.team_members
      ADD COLUMN profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
    RAISE NOTICE 'Added profile_id to team_members';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'team_members'
      AND column_name  = 'job_title'
  ) THEN
    ALTER TABLE public.team_members ADD COLUMN job_title TEXT;
    RAISE NOTICE 'Added job_title to team_members';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'team_members'
      AND column_name  = 'full_name'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'team_members'
      AND column_name  = 'name'
  ) THEN
    ALTER TABLE public.team_members RENAME COLUMN name TO full_name;
    RAISE NOTICE 'Renamed team_members.name to full_name';
  END IF;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Done.
--
-- After running this migration:
--   • team_invitations.role         — populated (was missing)
--   • team_invitations.status       — CHECK allows invited|pending|accepted|expired|revoked
--   • team_invitations legacy rows  — normalised from 'pending' → 'invited'
--   • team_invitations.name/full_name — removed (full_name is in team_members)
--   • team_members.profile_id       — added
--   • team_members.job_title        — added
--   • team_members.full_name        — renamed from name if needed
-- ═══════════════════════════════════════════════════════════════════════════
-- <<< END: supabase-migration-team-invite-fix.sql


-- >>> BEGIN: supabase-migration-team-production-repair.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- OPENY OS — Team tables production repair (views / wrong legacy shape)
--
-- Use when the browser console shows errors like:
--   column team_members.profile_id does not exist
--   column team_members.full_name does not exist
--   column team_members_1.name does not exist   (failed PostgREST embed on invitations)
--
-- This script is NOT the same as creating minimal workspace tables by hand:
--   the Next.js app expects the shapes in supabase-migration-team-complete.sql
--   plus patches in supabase-migration-team-schema-fix.sql and
--   supabase-migration-team-invite-fix.sql (profile_id, full_name, team_member_id,
--   token, expires_at, workspace_access, workspace_roles, …).
--
-- Idempotent where possible. BACK UP your database before running on production.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) profiles.display name (API selects profiles.name)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS name text;

-- 2) Drop only if the relation is a VIEW or MATERIALIZED VIEW (never drop a real BASE TABLE).
DO $$
DECLARE
  rk "char";
BEGIN
  SELECT c.relkind INTO rk
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'team_invitations';

  IF rk = 'v' THEN
    DROP VIEW public.team_invitations CASCADE;
    RAISE NOTICE 'Dropped VIEW public.team_invitations';
  ELSIF rk = 'm' THEN
    DROP MATERIALIZED VIEW public.team_invitations CASCADE;
    RAISE NOTICE 'Dropped MATERIALIZED VIEW public.team_invitations';
  END IF;

  SELECT c.relkind INTO rk
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'team_members';

  IF rk = 'v' THEN
    DROP VIEW public.team_members CASCADE;
    RAISE NOTICE 'Dropped VIEW public.team_members';
  ELSIF rk = 'm' THEN
    DROP MATERIALIZED VIEW public.team_members CASCADE;
    RAISE NOTICE 'Dropped MATERIALIZED VIEW public.team_members';
  END IF;
END;
$$;

-- 3) Create real team_members if missing (after view drop). Matches /api/team/members + /api/team/invite.
CREATE TABLE IF NOT EXISTS public.team_members (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  full_name   text NOT NULL DEFAULT '',
  email       text,
  role        text,
  job_title   text,
  status      text NOT NULL DEFAULT 'active',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- 4) Create real team_invitations if missing — FK must use team_member_id (not member_id).
CREATE TABLE IF NOT EXISTS public.team_invitations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id   uuid NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  email            text NOT NULL,
  role             text,
  token            text NOT NULL,
  status           text NOT NULL DEFAULT 'invited',
  invited_by       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  expires_at       timestamptz NOT NULL,
  accepted_at      timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  workspace_access jsonb NOT NULL DEFAULT '["os"]'::jsonb,
  workspace_roles  jsonb NOT NULL DEFAULT '{"os":"member"}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_team_invitations_token
  ON public.team_invitations (token);

CREATE INDEX IF NOT EXISTS idx_team_invitations_email
  ON public.team_invitations (email);

CREATE INDEX IF NOT EXISTS idx_team_invitations_status
  ON public.team_invitations (status);

CREATE INDEX IF NOT EXISTS idx_team_invitations_team_member_id
  ON public.team_invitations (team_member_id);

-- 5) Patch existing BASE tables (wrong hand-made migrations: user_id, member_id, missing columns)
DO $$
BEGIN
  -- team_members: legacy user_id → profile_id
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'team_members' AND column_name = 'user_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'team_members' AND column_name = 'profile_id'
  ) THEN
    ALTER TABLE public.team_members RENAME COLUMN user_id TO profile_id;
    RAISE NOTICE 'Renamed team_members.user_id → profile_id';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'team_members' AND column_name = 'name'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'team_members' AND column_name = 'full_name'
  ) THEN
    ALTER TABLE public.team_members RENAME COLUMN name TO full_name;
    RAISE NOTICE 'Renamed team_members.name → full_name';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'team_members' AND column_name = 'full_name'
  ) THEN
    ALTER TABLE public.team_members ADD COLUMN full_name text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'team_members' AND column_name = 'profile_id'
  ) THEN
    ALTER TABLE public.team_members
      ADD COLUMN profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'team_members' AND column_name = 'email'
  ) THEN
    ALTER TABLE public.team_members ADD COLUMN email text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'team_members' AND column_name = 'role'
  ) THEN
    ALTER TABLE public.team_members ADD COLUMN role text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'team_members' AND column_name = 'job_title'
  ) THEN
    ALTER TABLE public.team_members ADD COLUMN job_title text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'team_members' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.team_members
      ADD COLUMN status text NOT NULL DEFAULT 'active';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'team_members' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.team_members
      ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'team_members' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.team_members
      ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
  END IF;
END;
$$;

DO $$
BEGIN
  -- team_invitations: member_id → team_member_id
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'team_invitations' AND column_name = 'member_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'team_invitations' AND column_name = 'team_member_id'
  ) THEN
    ALTER TABLE public.team_invitations RENAME COLUMN member_id TO team_member_id;
    RAISE NOTICE 'Renamed team_invitations.member_id → team_member_id';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'team_invitations' AND column_name = 'team_member_id'
  ) THEN
    ALTER TABLE public.team_invitations
      ADD COLUMN team_member_id uuid REFERENCES public.team_members(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'team_invitations' AND column_name = 'token'
  ) THEN
    ALTER TABLE public.team_invitations ADD COLUMN token text;
    UPDATE public.team_invitations SET token = encode(gen_random_bytes(32), 'hex') WHERE token IS NULL;
    ALTER TABLE public.team_invitations ALTER COLUMN token SET NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'team_invitations' AND column_name = 'expires_at'
  ) THEN
    ALTER TABLE public.team_invitations ADD COLUMN expires_at timestamptz;
    UPDATE public.team_invitations SET expires_at = now() + interval '7 days' WHERE expires_at IS NULL;
    ALTER TABLE public.team_invitations ALTER COLUMN expires_at SET NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'team_invitations' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.team_invitations
      ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'team_invitations' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.team_invitations
      ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'team_invitations' AND column_name = 'accepted_at'
  ) THEN
    ALTER TABLE public.team_invitations ADD COLUMN accepted_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'team_invitations' AND column_name = 'invited_by'
  ) THEN
    ALTER TABLE public.team_invitations
      ADD COLUMN invited_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'team_invitations' AND column_name = 'workspace_access'
  ) THEN
    ALTER TABLE public.team_invitations
      ADD COLUMN workspace_access jsonb NOT NULL DEFAULT '["os"]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'team_invitations' AND column_name = 'workspace_roles'
  ) THEN
    ALTER TABLE public.team_invitations
      ADD COLUMN workspace_roles jsonb NOT NULL DEFAULT '{"os":"member"}'::jsonb;
  END IF;
END;
$$;

-- 6) RLS: keep enabled with permissive dev-style policies (service role bypasses RLS; matches older migrations)
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'team_members' AND policyname = 'allow all team_members'
  ) THEN
    CREATE POLICY "allow all team_members"
      ON public.team_members FOR ALL USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'team_invitations' AND policyname = 'allow all team_invitations'
  ) THEN
    CREATE POLICY "allow all team_invitations"
      ON public.team_invitations FOR ALL USING (true) WITH CHECK (true);
  END IF;
END;
$$;

GRANT ALL ON public.team_members TO authenticated, anon, service_role;
GRANT ALL ON public.team_invitations TO authenticated, anon, service_role;

-- PostgREST schema cache (Supabase)
NOTIFY pgrst, 'reload schema';
-- <<< END: supabase-migration-team-production-repair.sql


-- >>> BEGIN: supabase-migration-team-schema-fix.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Team Schema Fix Migration
-- Run this in your Supabase SQL Editor.
--
-- Changes:
--   1. Renames `name` → `full_name` in team_members (if still named `name`)
--   2. Adds `profile_id` column to team_members (if missing)
--   3. Removes `name` / `full_name` columns from team_invitations
--      (full_name now lives only in team_members and is retrieved via JOIN)
-- ─────────────────────────────────────────────────────────────────────────────

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. team_members – rename name → full_name
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  -- If the old column is still called `name`, rename it
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'team_members'
      AND column_name  = 'name'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'team_members'
      AND column_name  = 'full_name'
  ) THEN
    ALTER TABLE public.team_members RENAME COLUMN name TO full_name;
  END IF;

  -- Ensure full_name exists (in case the table was created without either column)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'team_members'
      AND column_name  = 'full_name'
  ) THEN
    ALTER TABLE public.team_members ADD COLUMN full_name TEXT NOT NULL DEFAULT '';
  END IF;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. team_members – add profile_id column
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'team_members'
      AND column_name  = 'profile_id'
  ) THEN
    ALTER TABLE public.team_members
      ADD COLUMN profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. team_invitations – remove name / full_name columns
--    (full_name is only in team_members; retrieve via JOIN when needed)
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  -- Drop `full_name` if it was accidentally added
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'team_invitations'
      AND column_name  = 'full_name'
  ) THEN
    ALTER TABLE public.team_invitations DROP COLUMN full_name;
  END IF;

  -- Drop old `name` column (replaced by team_members.full_name)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'team_invitations'
      AND column_name  = 'name'
  ) THEN
    ALTER TABLE public.team_invitations DROP COLUMN name;
  END IF;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Done.
--
-- After applying this migration the invite flow works as follows:
--
--   POST /api/team/invite
--     → inserts team_members {full_name, email, role, status='invited'}
--     → inserts team_invitations {team_member_id, email, token,
--                                 status='invited', invited_by, expires_at}
--       (no full_name / name in team_invitations)
--
--   GET  /api/team/invite/[token]
--     → joins team_invitations ⟶ team_members to resolve full_name
--
--   POST /api/team/invite/[token]/accept
--     → joins team_invitations ⟶ team_members to resolve full_name
--
--   POST /api/team/invite/resend
--     → joins team_invitations ⟶ team_members to resolve full_name
-- ═══════════════════════════════════════════════════════════════════════════
-- <<< END: supabase-migration-team-schema-fix.sql


-- >>> BEGIN: supabase-migration-unified-storage-files.sql
-- Unified file metadata registry for OPENY OS + OPENY DOCS (R2-backed)
CREATE TABLE IF NOT EXISTS public.stored_files (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module        TEXT NOT NULL CHECK (module IN ('os', 'docs')),
  section       TEXT NOT NULL,
  entity_id     TEXT,
  original_name TEXT NOT NULL,
  stored_name   TEXT NOT NULL,
  mime_type     TEXT NOT NULL,
  size_bytes    BIGINT NOT NULL CHECK (size_bytes >= 0),
  r2_key        TEXT NOT NULL,
  file_url      TEXT NOT NULL,
  visibility    TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
  uploaded_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_stored_files_r2_key ON public.stored_files (r2_key);
CREATE INDEX IF NOT EXISTS idx_stored_files_module_section_entity ON public.stored_files (module, section, entity_id);
CREATE INDEX IF NOT EXISTS idx_stored_files_created_at ON public.stored_files (created_at DESC);

ALTER TABLE public.stored_files ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'stored_files'
      AND policyname = 'stored_files_auth_all'
  ) THEN
    CREATE POLICY "stored_files_auth_all"
      ON public.stored_files
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
-- <<< END: supabase-migration-unified-storage-files.sql


-- >>> BEGIN: supabase-migration-upload-state.sql
-- ============================================================
-- OPENY OS — Upload State Migration
-- ============================================================
-- Adds upload_state tracking to the assets table so the system
-- can distinguish between uploading / completed / partial_success.
--
-- Safe to run multiple times (uses IF NOT EXISTS / IF EXISTS).
-- ============================================================

-- ── 1. Upload state column ────────────────────────────────────────────────────
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS upload_state TEXT DEFAULT 'completed';

-- Allowed values:
--   uploading       – file is currently being uploaded (transient)
--   completed       – Drive upload + DB save both succeeded
--   partial_success – Drive upload succeeded but DB save failed
--   failed_upload   – Drive upload itself failed
--   failed_db_save  – Drive upload succeeded, DB save failed and could not reconcile
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   information_schema.table_constraints
    WHERE  table_schema = 'public'
      AND  table_name   = 'assets'
      AND  constraint_name = 'assets_upload_state_check'
  ) THEN
    ALTER TABLE public.assets
      ADD CONSTRAINT assets_upload_state_check
      CHECK (upload_state IS NULL OR upload_state IN (
        'uploading', 'completed', 'partial_success', 'failed_upload', 'failed_db_save'
      ));
  END IF;
END $$;

-- ── 2. Backfill existing rows ─────────────────────────────────────────────────
-- Any asset already in the DB without an upload_state was successfully uploaded,
-- so treat it as completed.
UPDATE public.assets
SET    upload_state = 'completed'
WHERE  upload_state IS NULL;

-- ── 3. last_synced_at (already added by bidirectional-sync migration) ─────────
-- Repeated here as a safety net in case that migration was not applied.
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS assets_upload_state_idx ON public.assets (upload_state);
-- <<< END: supabase-migration-upload-state.sql


-- >>> BEGIN: supabase-migration-v3-unified-workspace.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- OPENY OS v3 — Unified Workspace Migration
--
-- Run this in your Supabase SQL editor AFTER all previous migrations.
--
-- New tables added:
--   projects, entity_links, custom_field_definitions, custom_field_values,
--   notes, note_links, templates, template_items, tags, tag_links,
--   time_entries, saved_views, dashboard_layouts, dashboard_widgets,
--   ai_sessions, ai_actions, comments_v2
--
-- All CREATE statements are idempotent (IF NOT EXISTS).
-- Safe to run multiple times.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. PROJECTS ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.projects (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid        REFERENCES public.workspaces(id) ON DELETE SET NULL,
  client_id     uuid        REFERENCES public.clients(id) ON DELETE CASCADE,
  name          text        NOT NULL,
  description   text,
  status        text        NOT NULL DEFAULT 'active'
    CHECK (status IN ('planning', 'active', 'on_hold', 'completed', 'cancelled')),
  start_date    date,
  end_date      date,
  color         text        DEFAULT '#6366f1',
  created_by    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS projects_client_idx      ON public.projects(client_id);
CREATE INDEX IF NOT EXISTS projects_workspace_idx   ON public.projects(workspace_id);
CREATE INDEX IF NOT EXISTS projects_status_idx      ON public.projects(status);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "projects: team read"   ON public.projects;
CREATE POLICY "projects: team read"
  ON public.projects FOR SELECT
  USING (public.current_user_role() IN ('owner', 'admin', 'manager', 'team_member'));
DROP POLICY IF EXISTS "projects: admin write" ON public.projects;
CREATE POLICY "projects: admin write"
  ON public.projects FOR ALL
  USING (public.current_user_role() IN ('owner', 'admin', 'manager', 'team_member'));

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at_v3()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_projects_updated_at ON public.projects;
CREATE TRIGGER trg_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_v3();

-- Add project_id to tasks (optional FK for project-scoped tasks)
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS tasks_project_idx ON public.tasks(project_id);

-- ── 2. ENTITY LINKS (generic many-to-many relational graph) ──────────────────

CREATE TABLE IF NOT EXISTS public.entity_links (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid        REFERENCES public.workspaces(id) ON DELETE SET NULL,
  source_type   text        NOT NULL
    CHECK (source_type IN ('task', 'asset', 'content', 'client', 'project', 'note', 'template')),
  source_id     uuid        NOT NULL,
  target_type   text        NOT NULL
    CHECK (target_type IN ('task', 'asset', 'content', 'client', 'project', 'note', 'template')),
  target_id     uuid        NOT NULL,
  link_type     text        NOT NULL DEFAULT 'related'
    CHECK (link_type IN ('related', 'blocks', 'blocked_by', 'parent', 'child', 'duplicate')),
  metadata      jsonb,
  created_by    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_type, source_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS entity_links_source_idx     ON public.entity_links(source_type, source_id);
CREATE INDEX IF NOT EXISTS entity_links_target_idx     ON public.entity_links(target_type, target_id);
CREATE INDEX IF NOT EXISTS entity_links_workspace_idx  ON public.entity_links(workspace_id);

ALTER TABLE public.entity_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "entity_links: team all" ON public.entity_links;
CREATE POLICY "entity_links: team all"
  ON public.entity_links FOR ALL
  USING (public.current_user_role() IN ('owner', 'admin', 'manager', 'team_member'));

-- ── 3. CUSTOM FIELD DEFINITIONS ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.custom_field_definitions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid        REFERENCES public.workspaces(id) ON DELETE CASCADE,
  entity_type   text        NOT NULL
    CHECK (entity_type IN ('task', 'client', 'project', 'content', 'asset')),
  name          text        NOT NULL,
  field_key     text        NOT NULL,
  field_type    text        NOT NULL
    CHECK (field_type IN ('text', 'number', 'select', 'multi_select', 'date', 'boolean', 'url', 'email')),
  options       jsonb,
  required      boolean     NOT NULL DEFAULT false,
  default_value text,
  sort_order    int         NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS custom_field_defs_workspace_idx ON public.custom_field_definitions(workspace_id);
CREATE INDEX IF NOT EXISTS custom_field_defs_entity_idx   ON public.custom_field_definitions(entity_type);

ALTER TABLE public.custom_field_definitions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "custom_field_defs: team all" ON public.custom_field_definitions;
CREATE POLICY "custom_field_defs: team all"
  ON public.custom_field_definitions FOR ALL
  USING (public.current_user_role() IN ('owner', 'admin', 'manager', 'team_member'));

-- ── 4. CUSTOM FIELD VALUES ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.custom_field_values (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  definition_id uuid        NOT NULL REFERENCES public.custom_field_definitions(id) ON DELETE CASCADE,
  entity_type   text        NOT NULL,
  entity_id     uuid        NOT NULL,
  value_text    text,
  value_number  numeric,
  value_date    date,
  value_boolean boolean,
  value_json    jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (definition_id, entity_id)
);

CREATE INDEX IF NOT EXISTS custom_field_vals_entity_idx  ON public.custom_field_values(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS custom_field_vals_def_idx     ON public.custom_field_values(definition_id);

ALTER TABLE public.custom_field_values ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "custom_field_vals: team all" ON public.custom_field_values;
CREATE POLICY "custom_field_vals: team all"
  ON public.custom_field_values FOR ALL
  USING (public.current_user_role() IN ('owner', 'admin', 'manager', 'team_member'));

DROP TRIGGER IF EXISTS trg_cfv_updated_at ON public.custom_field_values;
CREATE TRIGGER trg_cfv_updated_at
  BEFORE UPDATE ON public.custom_field_values
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_v3();

-- ── 5. NOTES + NOTE_LINKS ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.notes (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid        REFERENCES public.workspaces(id) ON DELETE SET NULL,
  title         text        NOT NULL DEFAULT 'Untitled',
  content       text,
  entity_type   text
    CHECK (entity_type IS NULL OR entity_type IN ('client', 'task', 'project', 'asset', 'content')),
  entity_id     uuid,
  is_pinned     boolean     NOT NULL DEFAULT false,
  created_by    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notes_workspace_idx  ON public.notes(workspace_id);
CREATE INDEX IF NOT EXISTS notes_entity_idx     ON public.notes(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS notes_created_by_idx ON public.notes(created_by);

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notes: team all" ON public.notes;
CREATE POLICY "notes: team all"
  ON public.notes FOR ALL
  USING (public.current_user_role() IN ('owner', 'admin', 'manager', 'team_member'));

DROP TRIGGER IF EXISTS trg_notes_updated_at ON public.notes;
CREATE TRIGGER trg_notes_updated_at
  BEFORE UPDATE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_v3();

CREATE TABLE IF NOT EXISTS public.note_links (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  source_note_id      uuid        NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  target_note_id      uuid        REFERENCES public.notes(id) ON DELETE CASCADE,
  target_entity_type  text
    CHECK (target_entity_type IS NULL OR target_entity_type IN ('client', 'task', 'project', 'asset', 'content')),
  target_entity_id    uuid,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS note_links_source_idx ON public.note_links(source_note_id);

ALTER TABLE public.note_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "note_links: team all" ON public.note_links;
CREATE POLICY "note_links: team all"
  ON public.note_links FOR ALL
  USING (public.current_user_role() IN ('owner', 'admin', 'manager', 'team_member'));

-- ── 6. TEMPLATES + TEMPLATE ITEMS ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.templates (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid        REFERENCES public.workspaces(id) ON DELETE SET NULL,
  name          text        NOT NULL,
  description   text,
  entity_type   text        NOT NULL
    CHECK (entity_type IN ('task', 'client', 'project', 'content')),
  template_data jsonb       NOT NULL DEFAULT '{}',
  is_global     boolean     NOT NULL DEFAULT false,
  created_by    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS templates_workspace_idx   ON public.templates(workspace_id);
CREATE INDEX IF NOT EXISTS templates_entity_idx      ON public.templates(entity_type);

ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "templates: team all" ON public.templates;
CREATE POLICY "templates: team all"
  ON public.templates FOR ALL
  USING (public.current_user_role() IN ('owner', 'admin', 'manager', 'team_member'));

DROP TRIGGER IF EXISTS trg_templates_updated_at ON public.templates;
CREATE TRIGGER trg_templates_updated_at
  BEFORE UPDATE ON public.templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_v3();

CREATE TABLE IF NOT EXISTS public.template_items (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id   uuid        NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
  title         text        NOT NULL,
  description   text,
  item_type     text        NOT NULL DEFAULT 'task'
    CHECK (item_type IN ('task', 'note', 'checklist_item', 'content')),
  sort_order    int         NOT NULL DEFAULT 0,
  item_data     jsonb       DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS template_items_template_idx ON public.template_items(template_id);

ALTER TABLE public.template_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "template_items: team all" ON public.template_items;
CREATE POLICY "template_items: team all"
  ON public.template_items FOR ALL
  USING (public.current_user_role() IN ('owner', 'admin', 'manager', 'team_member'));

-- ── 7. TAGS + TAG_LINKS ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tags (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid        REFERENCES public.workspaces(id) ON DELETE SET NULL,
  name          text        NOT NULL,
  color         text        NOT NULL DEFAULT '#6366f1',
  description   text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, name)
);

CREATE INDEX IF NOT EXISTS tags_workspace_idx ON public.tags(workspace_id);

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tags: team all" ON public.tags;
CREATE POLICY "tags: team all"
  ON public.tags FOR ALL
  USING (public.current_user_role() IN ('owner', 'admin', 'manager', 'team_member'));

CREATE TABLE IF NOT EXISTS public.tag_links (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_id        uuid        NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  entity_type   text        NOT NULL
    CHECK (entity_type IN ('task', 'asset', 'content', 'client', 'project', 'note')),
  entity_id     uuid        NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tag_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS tag_links_entity_idx ON public.tag_links(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS tag_links_tag_idx    ON public.tag_links(tag_id);

ALTER TABLE public.tag_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tag_links: team all" ON public.tag_links;
CREATE POLICY "tag_links: team all"
  ON public.tag_links FOR ALL
  USING (public.current_user_role() IN ('owner', 'admin', 'manager', 'team_member'));

-- ── 8. TIME ENTRIES ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.time_entries (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     uuid        REFERENCES public.workspaces(id) ON DELETE SET NULL,
  task_id          uuid        REFERENCES public.tasks(id) ON DELETE SET NULL,
  client_id        uuid        REFERENCES public.clients(id) ON DELETE SET NULL,
  user_id          uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  description      text,
  started_at       timestamptz NOT NULL DEFAULT now(),
  ended_at         timestamptz,
  duration_seconds int,
  is_running       boolean     NOT NULL DEFAULT false,
  billable         boolean     NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS time_entries_task_idx      ON public.time_entries(task_id);
CREATE INDEX IF NOT EXISTS time_entries_client_idx    ON public.time_entries(client_id);
CREATE INDEX IF NOT EXISTS time_entries_user_idx      ON public.time_entries(user_id);
CREATE INDEX IF NOT EXISTS time_entries_workspace_idx ON public.time_entries(workspace_id);

ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "time_entries: team all" ON public.time_entries;
CREATE POLICY "time_entries: team all"
  ON public.time_entries FOR ALL
  USING (public.current_user_role() IN ('owner', 'admin', 'manager', 'team_member'));

DROP TRIGGER IF EXISTS trg_time_entries_updated_at ON public.time_entries;
CREATE TRIGGER trg_time_entries_updated_at
  BEFORE UPDATE ON public.time_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_v3();

-- ── 9. SAVED VIEWS ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.saved_views (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid        REFERENCES public.workspaces(id) ON DELETE SET NULL,
  user_id       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  entity_type   text        NOT NULL
    CHECK (entity_type IN ('task', 'asset', 'content', 'client', 'project')),
  name          text        NOT NULL,
  view_type     text        NOT NULL DEFAULT 'list'
    CHECK (view_type IN ('list', 'kanban', 'calendar', 'timeline', 'table', 'grid', 'pipeline')),
  filters       jsonb       DEFAULT '{}',
  sort_config   jsonb       DEFAULT '{}',
  group_by      text,
  columns       jsonb       DEFAULT '[]',
  is_default    boolean     NOT NULL DEFAULT false,
  is_shared     boolean     NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS saved_views_user_idx    ON public.saved_views(user_id);
CREATE INDEX IF NOT EXISTS saved_views_entity_idx  ON public.saved_views(entity_type);

ALTER TABLE public.saved_views ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "saved_views: team all" ON public.saved_views;
CREATE POLICY "saved_views: team all"
  ON public.saved_views FOR ALL
  USING (public.current_user_role() IN ('owner', 'admin', 'manager', 'team_member'));

-- ── 10. DASHBOARD LAYOUTS + WIDGETS ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.dashboard_layouts (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid        REFERENCES public.workspaces(id) ON DELETE SET NULL,
  user_id       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  name          text        NOT NULL DEFAULT 'Default',
  is_default    boolean     NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dashboard_layouts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dashboard_layouts: team all" ON public.dashboard_layouts;
CREATE POLICY "dashboard_layouts: team all"
  ON public.dashboard_layouts FOR ALL
  USING (public.current_user_role() IN ('owner', 'admin', 'manager', 'team_member'));

CREATE TABLE IF NOT EXISTS public.dashboard_widgets (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  layout_id     uuid        NOT NULL REFERENCES public.dashboard_layouts(id) ON DELETE CASCADE,
  widget_type   text        NOT NULL
    CHECK (widget_type IN (
      'tasks_summary', 'assets_count', 'content_pipeline',
      'team_workload', 'recent_activity', 'client_list',
      'time_tracking', 'overdue_tasks', 'upcoming_schedule', 'trend_chart'
    )),
  title         text,
  config        jsonb       DEFAULT '{}',
  grid_x        int         NOT NULL DEFAULT 0,
  grid_y        int         NOT NULL DEFAULT 0,
  grid_w        int         NOT NULL DEFAULT 6,
  grid_h        int         NOT NULL DEFAULT 4,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dashboard_widgets_layout_idx ON public.dashboard_widgets(layout_id);

ALTER TABLE public.dashboard_widgets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dashboard_widgets: team all" ON public.dashboard_widgets;
CREATE POLICY "dashboard_widgets: team all"
  ON public.dashboard_widgets FOR ALL
  USING (public.current_user_role() IN ('owner', 'admin', 'manager', 'team_member'));

-- ── 11. AI SESSIONS + AI ACTIONS (audit trail) ───────────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_sessions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid        REFERENCES public.workspaces(id) ON DELETE SET NULL,
  user_id       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  mode          text        NOT NULL
    CHECK (mode IN ('ask', 'do', 'suggest', 'review')),
  section       text,
  entity_type   text,
  entity_id     uuid,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_sessions_user_idx      ON public.ai_sessions(user_id);
CREATE INDEX IF NOT EXISTS ai_sessions_workspace_idx ON public.ai_sessions(workspace_id);

ALTER TABLE public.ai_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ai_sessions: team read" ON public.ai_sessions;
CREATE POLICY "ai_sessions: team read"
  ON public.ai_sessions FOR ALL
  USING (public.current_user_role() IN ('owner', 'admin', 'manager', 'team_member'));

CREATE TABLE IF NOT EXISTS public.ai_actions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    uuid        REFERENCES public.ai_sessions(id) ON DELETE SET NULL,
  workspace_id  uuid        REFERENCES public.workspaces(id) ON DELETE SET NULL,
  user_id       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  intent        text        NOT NULL,
  prompt        text        NOT NULL,
  actions_taken jsonb       DEFAULT '[]',
  response_text text,
  status        text        NOT NULL DEFAULT 'success'
    CHECK (status IN ('success', 'error', 'partial', 'pending')),
  error_message text,
  duration_ms   int,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_actions_session_idx ON public.ai_actions(session_id);
CREATE INDEX IF NOT EXISTS ai_actions_user_idx    ON public.ai_actions(user_id);

ALTER TABLE public.ai_actions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ai_actions: team read" ON public.ai_actions;
CREATE POLICY "ai_actions: team read"
  ON public.ai_actions FOR ALL
  USING (public.current_user_role() IN ('owner', 'admin', 'manager', 'team_member'));

-- ── 12. COMMENTS v2 (threaded + cross-entity) ────────────────────────────────
-- Upgrades the existing flat comments table to support threads and cross-entity linking.

ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS entity_type text;
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS entity_id   uuid;
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS parent_id   uuid REFERENCES public.comments(id) ON DELETE CASCADE;
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS mentions    uuid[] DEFAULT '{}';
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS is_resolved boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS comments_entity_idx  ON public.comments(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS comments_parent_idx  ON public.comments(parent_id);

-- Backfill entity_type/entity_id from asset_id/task_id where present
UPDATE public.comments SET entity_type = 'asset', entity_id = asset_id WHERE asset_id IS NOT NULL AND entity_type IS NULL;
UPDATE public.comments SET entity_type = 'task',  entity_id = task_id  WHERE task_id  IS NOT NULL AND entity_type IS NULL;

-- ── 13. AUTOMATION RULES (expand existing) ────────────────────────────────────
-- Add missing columns to automation_rules if the table already exists.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'automation_rules') THEN
    ALTER TABLE public.automation_rules ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL;
    ALTER TABLE public.automation_rules ADD COLUMN IF NOT EXISTS description  text;
    ALTER TABLE public.automation_rules ADD COLUMN IF NOT EXISTS run_count    int NOT NULL DEFAULT 0;
    ALTER TABLE public.automation_rules ADD COLUMN IF NOT EXISTS last_run_at  timestamptz;
    ALTER TABLE public.automation_rules ADD COLUMN IF NOT EXISTS error_count  int NOT NULL DEFAULT 0;
  ELSE
    CREATE TABLE public.automation_rules (
      id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id  uuid        REFERENCES public.workspaces(id) ON DELETE SET NULL,
      name          text        NOT NULL,
      description   text,
      is_active     boolean     NOT NULL DEFAULT true,
      trigger_type  text        NOT NULL,
      trigger_config jsonb      DEFAULT '{}',
      conditions    jsonb       DEFAULT '[]',
      actions       jsonb       DEFAULT '[]',
      run_count     int         NOT NULL DEFAULT 0,
      last_run_at   timestamptz,
      error_count   int         NOT NULL DEFAULT 0,
      created_by    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
      created_at    timestamptz NOT NULL DEFAULT now(),
      updated_at    timestamptz NOT NULL DEFAULT now()
    );

    ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "automation_rules: admin write"
      ON public.automation_rules FOR ALL
      USING (public.current_user_role() IN ('owner', 'admin', 'manager'));
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS automation_rules_workspace_idx ON public.automation_rules(workspace_id);

-- ── 14. WORKSPACE_EVENTS (event backbone) ────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.workspace_events (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid        REFERENCES public.workspaces(id) ON DELETE SET NULL,
  event_type    text        NOT NULL,
  entity_type   text,
  entity_id     uuid,
  actor_id      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  payload       jsonb       DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workspace_events_workspace_idx ON public.workspace_events(workspace_id);
CREATE INDEX IF NOT EXISTS workspace_events_entity_idx    ON public.workspace_events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS workspace_events_created_idx   ON public.workspace_events(created_at DESC);

ALTER TABLE public.workspace_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "workspace_events: team read" ON public.workspace_events;
CREATE POLICY "workspace_events: team read"
  ON public.workspace_events FOR SELECT
  USING (public.current_user_role() IN ('owner', 'admin', 'manager', 'team_member'));
DROP POLICY IF EXISTS "workspace_events: service insert" ON public.workspace_events;
CREATE POLICY "workspace_events: service insert"
  ON public.workspace_events FOR INSERT
  WITH CHECK (true);

-- ── 15. FULL-TEXT SEARCH: add tsvector columns where missing ─────────────────

ALTER TABLE public.clients        ADD COLUMN IF NOT EXISTS search_vector tsvector;
ALTER TABLE public.tasks          ADD COLUMN IF NOT EXISTS search_vector tsvector;
ALTER TABLE public.assets         ADD COLUMN IF NOT EXISTS search_vector tsvector;
ALTER TABLE public.content_items  ADD COLUMN IF NOT EXISTS search_vector tsvector;
ALTER TABLE public.notes          ADD COLUMN IF NOT EXISTS search_vector tsvector;
ALTER TABLE public.projects       ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE INDEX IF NOT EXISTS clients_search_idx       ON public.clients       USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS tasks_search_idx         ON public.tasks         USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS assets_search_idx        ON public.assets        USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS content_items_search_idx ON public.content_items USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS notes_search_idx         ON public.notes         USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS projects_search_idx      ON public.projects      USING GIN(search_vector);

-- Populate existing rows (best-effort — run once after migration)
UPDATE public.clients
  SET search_vector = to_tsvector('english', coalesce(name,'') || ' ' || coalesce(email,'') || ' ' || coalesce(industry,''))
  WHERE search_vector IS NULL;

UPDATE public.tasks
  SET search_vector = to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,''))
  WHERE search_vector IS NULL;

UPDATE public.assets
  SET search_vector = to_tsvector('english', coalesce(name,'') || ' ' || coalesce(client_name,''))
  WHERE search_vector IS NULL;

UPDATE public.content_items
  SET search_vector = to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,''))
  WHERE search_vector IS NULL;

UPDATE public.notes
  SET search_vector = to_tsvector('english', coalesce(title,'') || ' ' || coalesce(content,''))
  WHERE search_vector IS NULL;

UPDATE public.projects
  SET search_vector = to_tsvector('english', coalesce(name,'') || ' ' || coalesce(description,''))
  WHERE search_vector IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- Done. New tables and indexes are active.
-- ─────────────────────────────────────────────────────────────────────────────
-- <<< END: supabase-migration-v3-unified-workspace.sql


-- >>> BEGIN: supabase-migration-workflow-hub.sql
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
-- <<< END: supabase-migration-workflow-hub.sql


-- >>> BEGIN: supabase-migration-workspace-members-owner-bootstrap.sql
-- Ensure workspace_members uses normalized roles expected by the UI.
UPDATE public.workspace_members
SET role = 'member'
WHERE role NOT IN ('owner', 'admin', 'member');

ALTER TABLE public.workspace_members
  DROP CONSTRAINT IF EXISTS workspace_members_role_check;

ALTER TABLE public.workspace_members
  ADD CONSTRAINT workspace_members_role_check
  CHECK (role IN ('owner', 'admin', 'member'));

-- Auto-link workspace creator as owner in workspace_members.
CREATE OR REPLACE FUNCTION public.handle_workspace_owner_membership()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE LOG '[workspace_members] workspace created: workspace_id=% owner_id=% name=% slug=%',
    NEW.id, NEW.owner_id, NEW.name, NEW.slug;

  IF NEW.owner_id IS NULL THEN
    RAISE LOG '[workspace_members] skipped owner membership insert because owner_id is null for workspace_id=%', NEW.id;
    RETURN NEW;
  END IF;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner')
  ON CONFLICT (workspace_id, user_id)
  DO UPDATE SET role = 'owner';

  RAISE LOG '[workspace_members] member inserted: workspace_id=% user_id=% role=%',
    NEW.id, NEW.owner_id, 'owner';

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_workspace_owner_membership ON public.workspaces;
CREATE TRIGGER trg_workspace_owner_membership
  AFTER INSERT ON public.workspaces
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_workspace_owner_membership();

-- Backfill existing workspaces that already have owner_id.
INSERT INTO public.workspace_members (workspace_id, user_id, role)
SELECT w.id, w.owner_id, 'owner'
FROM public.workspaces w
WHERE w.owner_id IS NOT NULL
ON CONFLICT (workspace_id, user_id)
DO UPDATE SET role = 'owner';
-- <<< END: supabase-migration-workspace-members-owner-bootstrap.sql


-- >>> BEGIN: supabase-migration-workspace-membership-conflict-fix.sql
-- OPENY Platform — workspace membership ON CONFLICT hardening
-- Ensures all ON CONFLICT targets used by invitation/team flows have matching unique constraints.

DO $$
BEGIN
  IF to_regclass('public.workspace_memberships') IS NOT NULL THEN
    DELETE FROM public.workspace_memberships a
    USING public.workspace_memberships b
    WHERE a.id < b.id
      AND a.user_id = b.user_id
      AND a.workspace_key = b.workspace_key;

    CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_memberships_user_workspace_unique
      ON public.workspace_memberships(user_id, workspace_key);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.workspace_members') IS NOT NULL THEN
    DELETE FROM public.workspace_members a
    USING public.workspace_members b
    WHERE a.id < b.id
      AND a.user_id = b.user_id
      AND a.workspace_id = b.workspace_id;

    CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_members_user_workspace_unique
      ON public.workspace_members(user_id, workspace_id);
  END IF;
END $$;
-- <<< END: supabase-migration-workspace-membership-conflict-fix.sql


-- >>> BEGIN: supabase-migration-workspace-memberships.sql
-- OPENY Platform — Workspace-level access control
-- Adds explicit per-workspace authorization for OPENY OS and OPENY DOCS.

-- 1) Profiles hardening for optional global role fields.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role_global text
    CHECK (role_global IN ('global_owner', 'super_admin'));

-- 2) Workspace memberships (authorization layer).
CREATE TABLE IF NOT EXISTS public.workspace_memberships (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_key text NOT NULL CHECK (workspace_key IN ('os', 'docs')),
  role          text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, workspace_key)
);

CREATE INDEX IF NOT EXISTS idx_workspace_memberships_user_id
  ON public.workspace_memberships(user_id);

CREATE INDEX IF NOT EXISTS idx_workspace_memberships_workspace_key
  ON public.workspace_memberships(workspace_key);

-- Keep updated_at fresh.
CREATE OR REPLACE FUNCTION public.touch_workspace_memberships_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_workspace_memberships_updated_at ON public.workspace_memberships;
CREATE TRIGGER trg_workspace_memberships_updated_at
  BEFORE UPDATE ON public.workspace_memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_workspace_memberships_updated_at();

ALTER TABLE public.workspace_memberships ENABLE ROW LEVEL SECURITY;

-- Users can read their own memberships (required for middleware/runtime checks).
DROP POLICY IF EXISTS "workspace_memberships_select_own" ON public.workspace_memberships;
CREATE POLICY "workspace_memberships_select_own"
  ON public.workspace_memberships
  FOR SELECT
  USING (auth.uid() = user_id);

-- 3) Invitation metadata for explicit workspace grants.
ALTER TABLE public.team_invitations
  ADD COLUMN IF NOT EXISTS workspace_access jsonb NOT NULL DEFAULT '["os"]'::jsonb;

ALTER TABLE public.team_invitations
  ADD COLUMN IF NOT EXISTS workspace_roles jsonb NOT NULL DEFAULT '{"os":"member"}'::jsonb;

-- 4) Promote platform super owner and grant both workspaces.
-- Uses app.owner_email when configured; falls back to thetaiseer@gmail.com.
DO $$
DECLARE
  v_owner_email text := lower(coalesce(current_setting('app.owner_email', true), 'thetaiseer@gmail.com'));
BEGIN
UPDATE public.profiles
SET role_global = 'global_owner'
WHERE lower(email) = v_owner_email;

INSERT INTO public.workspace_memberships (user_id, workspace_key, role, is_active)
SELECT au.id, 'os', 'owner', true
FROM auth.users au
WHERE lower(au.email) = v_owner_email
ON CONFLICT (user_id, workspace_key)
DO UPDATE SET role = EXCLUDED.role, is_active = true, updated_at = now();

INSERT INTO public.workspace_memberships (user_id, workspace_key, role, is_active)
SELECT au.id, 'docs', 'owner', true
FROM auth.users au
WHERE lower(au.email) = v_owner_email
ON CONFLICT (user_id, workspace_key)
DO UPDATE SET role = EXCLUDED.role, is_active = true, updated_at = now();
END $$;
-- <<< END: supabase-migration-workspace-memberships.sql


-- >>> BEGIN: supabase-migration-workspaces.sql
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
  role         text NOT NULL DEFAULT 'team_member'
    CHECK (role IN ('admin', 'manager', 'team_member', 'client')),
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
-- <<< END: supabase-migration-workspaces.sql


-- >>> BEGIN: supabase-schema.sql
-- OPENY OS Supabase Schema
-- Run this in your Supabase SQL editor to create all required tables and storage.

-- Clients
create table if not exists clients (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text,
  phone       text,
  website     text,
  industry    text,
  status      text not null default 'active' check (status in ('active','inactive','prospect')),
  logo        text,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Tasks
create table if not exists tasks (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  status      text not null default 'todo' check (status in ('todo','in_progress','done','overdue')),
  priority    text not null default 'medium' check (priority in ('low','medium','high')),
  due_date    date,
  client_id   uuid references clients(id) on delete set null,
  assigned_to text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Content Items
create table if not exists content_items (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  platform      text not null,
  status        text not null default 'draft' check (status in ('draft','scheduled','published')),
  schedule_date date,
  client_id     uuid references clients(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Assets
create table if not exists assets (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  file_path          text,
  file_url           text not null,
  file_type          text,
  file_size          bigint,
  bucket_name        text,
  client_id          uuid references clients(id) on delete set null,
  storage_provider   text not null default 'supabase',
  drive_file_id      text,
  drive_folder_id    text,
  view_url           text,
  download_url       text,
  content_type       text check (content_type is null or content_type in (
                       'SOCIAL_POSTS','REELS','VIDEOS','LOGOS','BRAND_ASSETS',
                       'PASSWORDS','DOCUMENTS','RAW_FILES','ADS_CREATIVES','REPORTS','OTHER'
                     )),
  month_key          text check (month_key is null or month_key ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  client_folder_name text,
  -- Drive / content organisation columns (added by supabase-migration-drive-structure.sql)
  client_name        text,
  uploaded_by        text,
  -- Preview / thumbnail metadata (added by supabase-migration-asset-preview.sql)
  mime_type          text,
  preview_url        text,
  thumbnail_url      text,
  web_view_link      text,
  -- Approval workflow columns (added by supabase-migration-saas-v1.sql)
  publish_date       date,
  approval_notes     text,
  approval_status    text default 'pending' check (approval_status is null or approval_status in (
                       'pending','approved','rejected','scheduled','published'
                     )),
  -- Task link (added by supabase-migration-agency-v1.sql)
  task_id            uuid references tasks(id) on delete set null,
  created_at         timestamptz not null default now()
);

-- Approvals
create table if not exists approvals (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  status     text not null default 'pending' check (status in ('pending','approved','rejected')),
  client_id  uuid references clients(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Activities
create table if not exists activities (
  id          uuid primary key default gen_random_uuid(),
  type        text not null,
  description text not null,
  user_id     text,
  client_id   uuid references clients(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- Storage bucket: client-assets
-- Create this in Supabase Dashboard > Storage, or via SQL:
-- insert into storage.buckets (id, name, public) values ('client-assets', 'client-assets', true)
-- on conflict do nothing;

-- Row Level Security (RLS) — enable and allow all for anon key (adjust as needed for your auth setup)
alter table clients     enable row level security;
alter table tasks       enable row level security;
alter table content_items enable row level security;
alter table assets      enable row level security;
alter table approvals   enable row level security;
alter table activities  enable row level security;

-- Open policies (use only during development; restrict per user in production)
create policy "allow all clients"       on clients       for all using (true) with check (true);
create policy "allow all tasks"         on tasks         for all using (true) with check (true);
create policy "allow all content_items" on content_items for all using (true) with check (true);
create policy "allow all assets"        on assets        for all using (true) with check (true);
create policy "allow all approvals"     on approvals     for all using (true) with check (true);
create policy "allow all activities"    on activities    for all using (true) with check (true);

-- Storage policy for client-assets bucket
create policy "allow all storage"
  on storage.objects for all
  using (bucket_id = 'client-assets')
  with check (bucket_id = 'client-assets');
-- <<< END: supabase-schema.sql


-- =============================================================================
-- VERIFICATION (run manually in SQL Editor)
-- =============================================================================
-- List public tables:
-- SELECT table_name
-- FROM information_schema.tables
-- WHERE table_schema = 'public'
--   AND table_type = 'BASE TABLE'
-- ORDER BY table_name;
--
-- content_items columns (expect platform_targets as text[] with default):
-- SELECT column_name, data_type, udt_name, column_default, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name = 'content_items'
-- ORDER BY ordinal_position;
--
-- RLS enabled on a table:
-- SELECT relname, relrowsecurity
-- FROM pg_class c
-- JOIN pg_namespace n ON n.oid = c.relnamespace
-- WHERE n.nspname = 'public' AND relkind = 'r'
-- ORDER BY relname;
