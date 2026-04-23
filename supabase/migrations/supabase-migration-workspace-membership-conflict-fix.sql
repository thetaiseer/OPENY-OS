-- OPENY Platform — workspace membership ON CONFLICT hardening
-- Ensures all ON CONFLICT targets used by invitation/team flows have matching unique constraints.

DO $$
BEGIN
  IF to_regclass('public.workspace_memberships') IS NOT NULL THEN
    DELETE FROM public.workspace_memberships a
    USING public.workspace_memberships b
    WHERE a.id < b.id
      AND a.user_id = b.user_id
      AND a.workspace_key = b.workspace_key;

    CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_memberships_user_workspace_unique
      ON public.workspace_memberships(user_id, workspace_key);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.workspace_members') IS NOT NULL THEN
    DELETE FROM public.workspace_members a
    USING public.workspace_members b
    WHERE a.id < b.id
      AND a.user_id = b.user_id
      AND a.workspace_id = b.workspace_id;

    CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_members_user_workspace_unique
      ON public.workspace_members(user_id, workspace_id);
  END IF;
END $$;
