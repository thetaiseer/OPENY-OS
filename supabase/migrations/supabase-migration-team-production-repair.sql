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
