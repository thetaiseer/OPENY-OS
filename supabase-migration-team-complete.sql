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
