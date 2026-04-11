-- ─────────────────────────────────────────────────────────────────────────────
-- Job Title + Manager Role Migration
-- Run this in your Supabase SQL Editor.
--
-- Changes:
--   1. Add job_title column to public.team_members
--   2. Add job_title column to public.team_invitations
--   3. Expand permission_role CHECK constraint to include 'manager'
--   4. Add permission_role column to team_invitations for record-keeping
-- ─────────────────────────────────────────────────────────────────────────────

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Add job_title to team_members
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'team_members'
      AND column_name  = 'job_title'
  ) THEN
    ALTER TABLE public.team_members ADD COLUMN job_title TEXT;
  END IF;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Add job_title to team_invitations
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'team_invitations'
      AND column_name  = 'job_title'
  ) THEN
    ALTER TABLE public.team_invitations ADD COLUMN job_title TEXT;
  END IF;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Add permission_role to team_invitations (for record-keeping)
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'team_invitations'
      AND column_name  = 'permission_role'
  ) THEN
    ALTER TABLE public.team_invitations
      ADD COLUMN permission_role TEXT NOT NULL DEFAULT 'member';
  END IF;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. Expand permission_role CHECK constraint on team_members to include 'manager'
--
--    The previous constraint only allowed: owner|admin|member|viewer
--    We now add 'manager' as a first-class role between admin and member.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  -- Drop the old constraint if it exists (constraint name may vary)
  ALTER TABLE public.team_members
    DROP CONSTRAINT IF EXISTS team_members_permission_role_check;

  -- Add the expanded constraint
  ALTER TABLE public.team_members
    ADD CONSTRAINT team_members_permission_role_check
      CHECK (permission_role IN ('owner', 'admin', 'manager', 'member', 'viewer'));
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. Migrate role column → job_title for existing records
--    The `role` column previously held job titles (e.g., "Graphic Designer").
--    Copy those values into the new job_title column where job_title is NULL.
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE public.team_members
SET job_title = role
WHERE job_title IS NULL
  AND role IS NOT NULL
  AND role NOT IN ('owner', 'admin', 'manager', 'member', 'viewer');

-- ═══════════════════════════════════════════════════════════════════════════
-- Done.
--
-- After running this migration:
--   - team_members has both `role` (legacy/job-title) and `job_title` columns
--   - team_invitations has `job_title` and `permission_role` columns
--   - permission_role now accepts: owner|admin|manager|member|viewer
-- ═══════════════════════════════════════════════════════════════════════════
