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
