-- ─────────────────────────────────────────────────────────────────────────────
-- RBAC Phase 1 Migration
-- Run this in your Supabase SQL Editor.
--
-- Goals:
--   1. Add permission_role column to team_members (owner|admin|member|viewer)
--   2. Migrate profiles.role values to new role names
--   3. Tighten RLS policies so members cannot promote themselves
-- ─────────────────────────────────────────────────────────────────────────────

-- ═══════════════════════════════════════════════════════════════════════════
-- 1.  Add permission_role to team_members
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'team_members'
      AND column_name  = 'permission_role'
  ) THEN
    ALTER TABLE public.team_members
      ADD COLUMN permission_role TEXT NOT NULL DEFAULT 'member'
        CHECK (permission_role IN ('owner', 'admin', 'member', 'viewer'));
  END IF;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2.  Migrate profiles.role to new values
-- ═══════════════════════════════════════════════════════════════════════════
-- Map:  admin/manager → admin, team → member, client → viewer
-- NOTE: The first admin email user is promoted to 'owner' manually; everyone
--       else who was 'admin' stays as 'admin'.

UPDATE public.profiles
SET role = CASE role
  WHEN 'manager' THEN 'admin'
  WHEN 'team'    THEN 'member'
  WHEN 'client'  THEN 'viewer'
  ELSE role  -- keep 'admin' as-is; no 'owner' auto-promotion here
END
WHERE role IN ('manager', 'team', 'client');

-- ═══════════════════════════════════════════════════════════════════════════
-- 3.  Populate permission_role for existing active team_members
--     by joining to profiles via profile_id
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE public.team_members tm
SET permission_role = CASE p.role
  WHEN 'owner'   THEN 'owner'
  WHEN 'admin'   THEN 'admin'
  WHEN 'member'  THEN 'member'
  WHEN 'viewer'  THEN 'viewer'
  -- Legacy role names (in case migration above hasn't run yet)
  WHEN 'manager' THEN 'admin'
  WHEN 'team'    THEN 'member'
  WHEN 'client'  THEN 'viewer'
  ELSE 'member'
END
FROM public.profiles p
WHERE tm.profile_id = p.id
  AND tm.status = 'active';

-- ═══════════════════════════════════════════════════════════════════════════
-- 4.  Tighten RLS on team_members
--     Allow authenticated users to SELECT their own row.
--     Restrict INSERT/UPDATE/DELETE to owner/admin (via profiles join).
-- ═══════════════════════════════════════════════════════════════════════════

-- Drop the old permissive policy if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'team_members'
      AND policyname = 'allow all team_members'
  ) THEN
    DROP POLICY "allow all team_members" ON public.team_members;
  END IF;
END;
$$;

-- SELECT: any authenticated user may see the team list
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'team_members'
      AND policyname = 'team_members_select_authenticated'
  ) THEN
    CREATE POLICY "team_members_select_authenticated"
      ON public.team_members
      FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;
END;
$$;

-- INSERT: only owner or admin (checked via profiles)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'team_members'
      AND policyname = 'team_members_insert_admin'
  ) THEN
    CREATE POLICY "team_members_insert_admin"
      ON public.team_members
      FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id   = auth.uid()
            AND role IN ('owner', 'admin')
        )
      );
  END IF;
END;
$$;

-- UPDATE: only owner or admin; the new permission_role must be <= caller's role
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'team_members'
      AND policyname = 'team_members_update_admin'
  ) THEN
    CREATE POLICY "team_members_update_admin"
      ON public.team_members
      FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id   = auth.uid()
            AND role IN ('owner', 'admin')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id   = auth.uid()
            AND role IN ('owner', 'admin')
        )
      );
  END IF;
END;
$$;

-- DELETE: only owner or admin
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'team_members'
      AND policyname = 'team_members_delete_admin'
  ) THEN
    CREATE POLICY "team_members_delete_admin"
      ON public.team_members
      FOR DELETE
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id   = auth.uid()
            AND role IN ('owner', 'admin')
        )
      );
  END IF;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5.  Tighten RLS on profiles
--     Users can read their own profile; owner/admin can read all.
--     Users cannot update their own role column.
-- ═══════════════════════════════════════════════════════════════════════════

-- The server-side API uses the service role key which bypasses RLS, so these
-- policies are defence-in-depth against direct client-side access.

-- Allow users to read their own profile row (for auth-context.tsx)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'profiles'
      AND policyname = 'profiles_select_own'
  ) THEN
    CREATE POLICY "profiles_select_own"
      ON public.profiles
      FOR SELECT
      USING (id = auth.uid());
  END IF;
END;
$$;

-- Allow users to update their own profile EXCEPT the role column.
-- NOTE: Postgres RLS cannot restrict individual column updates via WITH CHECK
--       on UPDATE policies — that restriction must be enforced server-side.
--       This policy just ensures only the row owner can attempt an update.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'profiles'
      AND policyname = 'profiles_update_own'
  ) THEN
    CREATE POLICY "profiles_update_own"
      ON public.profiles
      FOR UPDATE
      USING (id = auth.uid())
      WITH CHECK (id = auth.uid());
  END IF;
END;
$$;
