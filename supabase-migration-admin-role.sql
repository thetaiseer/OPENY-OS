-- OPENY OS — Admin Role Fix Migration
-- Run this in your Supabase SQL editor to promote the admin user.
--
-- Replace 'thetaiseer@gmail.com' with the actual admin email if different,
-- or set the ADMIN_EMAIL environment variable in your deployment.
--
-- This migration is SAFE to re-run (uses INSERT ... ON CONFLICT UPDATE).

-- ── 1. Promote admin email to admin role (upsert) ─────────────────────────────
INSERT INTO public.users (id, email, name, role)
SELECT
  au.id,
  au.email,
  coalesce(au.raw_user_meta_data ->> 'name', split_part(au.email, '@', 1)) AS name,
  'admin' AS role
FROM auth.users au
WHERE lower(au.email) = lower('thetaiseer@gmail.com')
ON CONFLICT (id)
  DO UPDATE SET role = 'admin';

-- ── 2. Ensure the auto-promote trigger checks ADMIN_EMAIL on sign-up ──────────
-- This replaces the existing trigger function so that new sign-ups from the
-- admin email automatically receive the admin role.
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
  -- The check is intentionally case-insensitive.
  IF lower(coalesce(new.email, '')) = lower(coalesce(current_setting('app.admin_email', true), 'thetaiseer@gmail.com')) THEN
    v_role := 'admin';
  ELSE
    v_role := coalesce(new.raw_user_meta_data ->> 'role', 'client');
  END IF;

  INSERT INTO public.users (id, email, name, role)
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

-- Re-attach the trigger (drop first to be idempotent).
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_new_user();
