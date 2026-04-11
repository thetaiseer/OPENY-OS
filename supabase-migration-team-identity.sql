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
  role      = 'team'
WHERE
  role IS NOT NULL
  AND lower(role) NOT IN ('owner', 'admin', 'manager', 'team', 'member', 'viewer', 'client')
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
