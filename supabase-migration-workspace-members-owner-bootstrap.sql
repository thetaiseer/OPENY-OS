-- Ensure workspace_members uses normalized roles expected by the UI.
UPDATE public.workspace_members
SET role = 'member'
WHERE role NOT IN ('owner', 'admin', 'member');

ALTER TABLE public.workspace_members
  DROP CONSTRAINT IF EXISTS workspace_members_role_check;

ALTER TABLE public.workspace_members
  ADD CONSTRAINT workspace_members_role_check
  CHECK (role IN ('owner', 'admin', 'member'));

-- Auto-link workspace creator as owner in workspace_members.
CREATE OR REPLACE FUNCTION public.handle_workspace_owner_membership()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE LOG '[workspace_members] workspace created: workspace_id=% owner_id=% name=% slug=%',
    NEW.id, NEW.owner_id, NEW.name, NEW.slug;

  IF NEW.owner_id IS NULL THEN
    RAISE LOG '[workspace_members] skipped owner membership insert because owner_id is null for workspace_id=%', NEW.id;
    RETURN NEW;
  END IF;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner')
  ON CONFLICT (workspace_id, user_id)
  DO UPDATE SET role = 'owner';

  RAISE LOG '[workspace_members] member inserted: workspace_id=% user_id=% role=%',
    NEW.id, NEW.owner_id, 'owner';

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_workspace_owner_membership ON public.workspaces;
CREATE TRIGGER trg_workspace_owner_membership
  AFTER INSERT ON public.workspaces
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_workspace_owner_membership();

-- Backfill existing workspaces that already have owner_id.
INSERT INTO public.workspace_members (workspace_id, user_id, role)
SELECT w.id, w.owner_id, 'owner'
FROM public.workspaces w
WHERE w.owner_id IS NOT NULL
ON CONFLICT (workspace_id, user_id)
DO UPDATE SET role = 'owner';
