-- ─────────────────────────────────────────────────────────────────────────────
-- OPENY Platform — Member Permissions v1
-- Run once in Supabase SQL Editor (fully idempotent).
--
-- Adds:
--   1. member_permissions  — per-member, per-module access overrides
--   2. invite_permissions  — permission snapshot attached to invitations
--   3. Realtime enablement for team_members and team_invitations
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. member_permissions ────────────────────────────────────────────────────
--    Stores per-member, per-module access level overrides.
--    Omitted rows fall back to the member's role default (see permissions.ts).
--    Owner and admin rows are never inserted — their access is always 'full'.

CREATE TABLE IF NOT EXISTS public.member_permissions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id  UUID        NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  workspace       TEXT        NOT NULL CHECK (workspace IN ('os', 'docs')),
  module          TEXT        NOT NULL,
  access_level    TEXT        NOT NULL DEFAULT 'read'
                               CHECK (access_level IN ('full', 'read', 'none')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (team_member_id, workspace, module)
);

CREATE INDEX IF NOT EXISTS idx_member_permissions_member_id
  ON public.member_permissions (team_member_id);

CREATE INDEX IF NOT EXISTS idx_member_permissions_workspace
  ON public.member_permissions (team_member_id, workspace);

-- Keep updated_at fresh.
CREATE OR REPLACE FUNCTION public.touch_member_permissions_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_member_permissions_updated_at ON public.member_permissions;
CREATE TRIGGER trg_member_permissions_updated_at
  BEFORE UPDATE ON public.member_permissions
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_member_permissions_updated_at();

ALTER TABLE public.member_permissions ENABLE ROW LEVEL SECURITY;

-- Admins/owners can read all permissions.
-- NOTE: 'manager' is included here to match the existing role column during
-- the migration period.  Once all rows are backfilled to platform_role,
-- the policy can be tightened to ('owner', 'admin') only.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='member_permissions' AND policyname='member_permissions_admin_read') THEN
    CREATE POLICY "member_permissions_admin_read"
      ON public.member_permissions FOR SELECT TO authenticated
      USING (public.current_user_role() IN ('owner', 'admin', 'manager'));
  END IF;
END $$;

-- Members can read their own permissions.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='member_permissions' AND policyname='member_permissions_self_read') THEN
    CREATE POLICY "member_permissions_self_read"
      ON public.member_permissions FOR SELECT TO authenticated
      USING (
        team_member_id IN (
          SELECT id FROM public.team_members WHERE profile_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Admins/owners can write permissions.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='member_permissions' AND policyname='member_permissions_admin_write') THEN
    CREATE POLICY "member_permissions_admin_write"
      ON public.member_permissions FOR ALL TO authenticated
      USING  (public.current_user_role() IN ('owner', 'admin'))
      WITH CHECK (public.current_user_role() IN ('owner', 'admin'));
  END IF;
END $$;

-- Service role can do everything (API routes use service role).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='member_permissions' AND policyname='member_permissions_service') THEN
    CREATE POLICY "member_permissions_service"
      ON public.member_permissions FOR ALL TO service_role
      WITH CHECK (true);
  END IF;
END $$;

-- ── 2. Add permissions_snapshot to team_invitations ──────────────────────────
--    Stores the module-level permission matrix at invitation time so that
--    accepting the invite automatically seeds member_permissions.

ALTER TABLE public.team_invitations
  ADD COLUMN IF NOT EXISTS permissions_snapshot JSONB;

-- ── 3. Add platform_role to team_members (canonical: owner|admin|member) ─────
--    Separate from the job-title "role" column — stores the access control role.
--    Null means "inherit from existing role column" during migration period.

ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS platform_role TEXT
    CHECK (platform_role IN ('owner', 'admin', 'member'));

-- Backfill: map existing role values to platform_role.
-- 'manager' maps to 'admin' in the canonical platform_role column.
-- The legacy 'role' column and its RLS policies still recognise 'manager'
-- during the transition period.
UPDATE public.team_members
SET platform_role = CASE
  WHEN lower(role) = 'owner'       THEN 'owner'
  WHEN lower(role) IN ('admin', 'manager') THEN 'admin'
  ELSE 'member'
END
WHERE platform_role IS NULL;

-- ── 4. Enable Realtime on team tables ─────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'team_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.team_members;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'team_invitations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.team_invitations;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'member_permissions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.member_permissions;
  END IF;
END $$;

-- ── 5. Auto-expire invitations via a Postgres cron job (pg_cron) ─────────────
--    Marks pending/invited invitations as 'expired' when expires_at has passed.
--    Requires pg_cron extension enabled in Supabase dashboard.
--    Safe to run even if pg_cron is not enabled — wrapped in DO block.

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'expire-stale-invitations',
      '0 * * * *',   -- every hour
      $$
        UPDATE public.team_invitations
        SET status = 'expired', updated_at = now()
        WHERE status IN ('pending', 'invited')
          AND expires_at <= now();
      $$
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- pg_cron job scheduling is optional; ignore errors.
  NULL;
END $$;
