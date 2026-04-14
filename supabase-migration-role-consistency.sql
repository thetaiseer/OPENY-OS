-- ─────────────────────────────────────────────────────────────────────────────
-- OPENY OS — Role Consistency Migration
--
-- Purpose:
--   Standardise the canonical role set across the whole team system.
--
--   Canonical internal role values:
--     owner | admin | manager | team_member | viewer
--
--   The old value 'team' is renamed to 'team_member'.
--   'client' rows are left untouched (client portal access, not an invitable role).
--
-- Run this in your Supabase SQL Editor.
-- Safe to run multiple times (idempotent).
-- ─────────────────────────────────────────────────────────────────────────────

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. public.team_members — migrate 'team' → 'team_member' data
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE public.team_members
SET role = 'team_member'
WHERE role = 'team';

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. public.team_members — drop old role check constraint (if any) and
--    add new one with canonical values
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  -- Drop any existing role check constraint on team_members
  IF EXISTS (
    SELECT 1
    FROM   information_schema.table_constraints
    WHERE  table_schema    = 'public'
      AND  table_name      = 'team_members'
      AND  constraint_name = 'team_members_role_check'
      AND  constraint_type = 'CHECK'
  ) THEN
    ALTER TABLE public.team_members DROP CONSTRAINT team_members_role_check;
  END IF;
END;
$$;

ALTER TABLE public.team_members
  ADD CONSTRAINT team_members_role_check
  CHECK (role IN ('owner', 'admin', 'manager', 'team_member', 'viewer', 'client'));

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. public.team_invitations — migrate 'team' → 'team_member' data
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE public.team_invitations
SET role = 'team_member'
WHERE role = 'team';

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. public.team_invitations — drop old role check constraint (if any) and
--    add new one with canonical values
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM   information_schema.table_constraints
    WHERE  table_schema    = 'public'
      AND  table_name      = 'team_invitations'
      AND  constraint_name = 'team_invitations_role_check'
      AND  constraint_type = 'CHECK'
  ) THEN
    ALTER TABLE public.team_invitations DROP CONSTRAINT team_invitations_role_check;
  END IF;
END;
$$;

ALTER TABLE public.team_invitations
  ADD CONSTRAINT team_invitations_role_check
  CHECK (role IN ('owner', 'admin', 'manager', 'team_member', 'viewer', 'client'));

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. public.profiles — ensure role column accepts the canonical values
--    (profiles stores the role for the authenticated user's access context)
-- ═══════════════════════════════════════════════════════════════════════════

-- Migrate any 'team' values first
UPDATE public.profiles
SET role = 'team_member'
WHERE role = 'team';

-- Drop old profiles role constraints and add new canonical one
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM   information_schema.table_constraints
    WHERE  table_schema    = 'public'
      AND  table_name      = 'profiles'
      AND  constraint_name = 'profiles_role_check'
      AND  constraint_type = 'CHECK'
  ) THEN
    ALTER TABLE public.profiles DROP CONSTRAINT profiles_role_check;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM   information_schema.table_constraints
    WHERE  table_schema    = 'public'
      AND  table_name      = 'profiles'
      AND  constraint_name = 'profiles_role_check_v2'
      AND  constraint_type = 'CHECK'
  ) THEN
    ALTER TABLE public.profiles DROP CONSTRAINT profiles_role_check_v2;
  END IF;
END;
$$;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('owner', 'admin', 'manager', 'team_member', 'viewer', 'client'));

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. RLS policies — re-create any policies that referenced 'team' so they
--    now reference 'team_member' instead.
--    (The current_user_role() helper reads profiles.role; after step 5 above
--    migrates existing rows, policies must check for 'team_member'.)
--
-- The IF NOT EXISTS / DROP + CREATE pattern makes this idempotent.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  rec RECORD;
BEGIN
  -- For every RLS policy on every table in the 'public' schema, if the
  -- policy definition contains '''team''' (i.e., the literal string 'team')
  -- without the '_member' suffix, we must recreate it.
  --
  -- Rather than enumerating every table, we simply ALTER each affected
  -- policy's USING / WITH CHECK expression by dropping and re-creating it.
  --
  -- This loop finds and drops all affected policies.
  FOR rec IN
    SELECT schemaname, tablename, policyname
    FROM   pg_policies
    WHERE  schemaname = 'public'
      AND  (qual LIKE $q$%'team'%$q$ OR with_check LIKE $q$%'team'%$q$)
      AND  (qual NOT LIKE $q$%'team_member'%$q$ OR with_check NOT LIKE $q$%'team_member'%$q$)
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
      rec.policyname, rec.schemaname, rec.tablename);
  END LOOP;
END;
$$;

-- Re-create the standard team-scoped read policy for assets (example).
-- NOTE: If your actual policies differ from supabase-migration-rls-v1.sql,
-- run that migration again after applying this one — it now uses team_member.
-- The SELECT-for-team_member policy on assets:
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE  schemaname = 'public' AND tablename = 'assets'
      AND  policyname = 'team_member can view assets'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE  table_schema = 'public' AND table_name = 'assets'
  ) THEN
    -- Only recreate if the generic allow-all policy is not present
    -- (i.e., the more restrictive rls-v1 policies are in effect).
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE  schemaname = 'public' AND tablename = 'assets'
        AND  policyname = 'allow all assets'
    ) THEN
      EXECUTE $pol$
        CREATE POLICY "team_member can view assets"
          ON public.assets FOR SELECT
          USING (public.current_user_role() IN ('admin', 'manager', 'team_member'));
      $pol$;
    END IF;
  END IF;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Done.
--
-- After running this migration:
--   • team_members.role  CHECK: owner | admin | manager | team_member | viewer | client
--   • team_invitations.role CHECK: same
--   • profiles.role      CHECK: same
--   • All existing 'team' rows migrated to 'team_member'
--
-- Canonical internal role values going forward:
--   owner        — workspace owner (cannot be invited)
--   admin        — full access
--   manager      — manage tasks & team
--   team_member  — standard access
--   viewer       — read-only access
-- ═══════════════════════════════════════════════════════════════════════════
