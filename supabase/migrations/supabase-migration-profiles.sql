-- OPENY OS — Profiles Table Migration
-- Run this in your Supabase SQL editor.
--
-- If you previously ran supabase-migration-users-roles.sql and have a
-- public.users table, this migration renames it to public.profiles and
-- updates all associated policies and triggers.
--
-- If no public.users table exists, it simply creates public.profiles.
--
-- This migration is SAFE to re-run.

-- ── 1. Rename existing public.users → public.profiles (if it exists) ──────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'users'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'profiles'
  ) THEN
    ALTER TABLE public.users RENAME TO profiles;
    RAISE NOTICE 'Renamed public.users to public.profiles';
  END IF;
END $$;

-- ── 2. Create public.profiles if it does not yet exist ────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id          uuid        PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  name        text        NOT NULL DEFAULT '',
  email       text        NOT NULL DEFAULT '',
  role        text        NOT NULL DEFAULT 'client'
                CHECK (role IN ('admin', 'team_member', 'client')),
  client_id   uuid        REFERENCES public.clients (id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── 3. Row Level Security ─────────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop legacy policies from the old table name (no-ops if already dropped).
DROP POLICY IF EXISTS "users_read_own"       ON public.profiles;
DROP POLICY IF EXISTS "users_admin_read_all" ON public.profiles;
DROP POLICY IF EXISTS "users_admin_write"    ON public.profiles;

-- A user can always read their own profile row.
CREATE POLICY "profiles_read_own"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Admins can read every profile row.
CREATE POLICY "profiles_admin_read_all"
  ON public.profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
    )
  );

-- Only admins can insert / update / delete profile rows directly.
-- Normal sign-up rows are created via the trigger below (SECURITY DEFINER).
CREATE POLICY "profiles_admin_write"
  ON public.profiles
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
    )
  );

-- ── 4. Trigger: auto-create profile on sign-up ────────────────────────────────
-- Promotes the configured admin email to role='admin' automatically.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  -- Promote to admin if the email matches the configured admin address.
  IF lower(coalesce(new.email, '')) = lower(coalesce(current_setting('app.admin_email', true), 'thetaiseer@gmail.com')) THEN
    v_role := 'admin';
  ELSE
    v_role := coalesce(new.raw_user_meta_data ->> 'role', 'client');
  END IF;

  INSERT INTO public.profiles (id, email, name, role)
  VALUES (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'name', split_part(coalesce(new.email, ''), '@', 1)),
    v_role
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_new_user();

-- ── 5. Promote existing admin email if already signed up ─────────────────────
INSERT INTO public.profiles (id, email, name, role)
SELECT
  au.id,
  au.email,
  coalesce(au.raw_user_meta_data ->> 'name', split_part(au.email, '@', 1)) AS name,
  'admin' AS role
FROM auth.users au
WHERE lower(au.email) = lower('thetaiseer@gmail.com')
ON CONFLICT (id)
  DO UPDATE SET role = 'admin';
