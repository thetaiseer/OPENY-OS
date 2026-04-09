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
