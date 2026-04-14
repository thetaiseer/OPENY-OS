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
