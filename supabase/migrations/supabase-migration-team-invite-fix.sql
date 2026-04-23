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
