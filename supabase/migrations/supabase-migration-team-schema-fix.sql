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
