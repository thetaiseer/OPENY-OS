-- OPENY Platform — Workspace-level access control
-- Adds explicit per-workspace authorization for OPENY OS and OPENY DOCS.

-- 1) Profiles hardening for optional global role fields.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role_global text
    CHECK (role_global IN ('global_owner', 'super_admin'));

-- 2) Workspace memberships (authorization layer).
CREATE TABLE IF NOT EXISTS public.workspace_memberships (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_key text NOT NULL CHECK (workspace_key IN ('os', 'docs')),
  role          text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, workspace_key)
);

CREATE INDEX IF NOT EXISTS idx_workspace_memberships_user_id
  ON public.workspace_memberships(user_id);

CREATE INDEX IF NOT EXISTS idx_workspace_memberships_workspace_key
  ON public.workspace_memberships(workspace_key);

-- Keep updated_at fresh.
CREATE OR REPLACE FUNCTION public.touch_workspace_memberships_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_workspace_memberships_updated_at ON public.workspace_memberships;
CREATE TRIGGER trg_workspace_memberships_updated_at
  BEFORE UPDATE ON public.workspace_memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_workspace_memberships_updated_at();

ALTER TABLE public.workspace_memberships ENABLE ROW LEVEL SECURITY;

-- Users can read their own memberships (required for middleware/runtime checks).
DROP POLICY IF EXISTS "workspace_memberships_select_own" ON public.workspace_memberships;
CREATE POLICY "workspace_memberships_select_own"
  ON public.workspace_memberships
  FOR SELECT
  USING (auth.uid() = user_id);

-- 3) Invitation metadata for explicit workspace grants.
ALTER TABLE public.team_invitations
  ADD COLUMN IF NOT EXISTS workspace_access jsonb NOT NULL DEFAULT '["os"]'::jsonb;

ALTER TABLE public.team_invitations
  ADD COLUMN IF NOT EXISTS workspace_roles jsonb NOT NULL DEFAULT '{"os":"member"}'::jsonb;

-- 4) Promote platform super owner and grant both workspaces.
-- Uses app.owner_email when configured; falls back to thetaiseer@gmail.com.
DO $$
DECLARE
  v_owner_email text := lower(coalesce(current_setting('app.owner_email', true), 'thetaiseer@gmail.com'));
BEGIN
UPDATE public.profiles
SET role_global = 'global_owner'
WHERE lower(email) = v_owner_email;

INSERT INTO public.workspace_memberships (user_id, workspace_key, role, is_active)
SELECT au.id, 'os', 'owner', true
FROM auth.users au
WHERE lower(au.email) = v_owner_email
ON CONFLICT (user_id, workspace_key)
DO UPDATE SET role = EXCLUDED.role, is_active = true, updated_at = now();

INSERT INTO public.workspace_memberships (user_id, workspace_key, role, is_active)
SELECT au.id, 'docs', 'owner', true
FROM auth.users au
WHERE lower(au.email) = v_owner_email
ON CONFLICT (user_id, workspace_key)
DO UPDATE SET role = EXCLUDED.role, is_active = true, updated_at = now();
END $$;
