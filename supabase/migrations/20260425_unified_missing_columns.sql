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

CREATE EXTENSION IF NOT EXISTS pgcrypto;

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

