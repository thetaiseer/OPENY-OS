-- Ensure workspace_memberships RLS SELECT policy exists and backfill missing rows.
-- Safe to run multiple times (idempotent).

-- 1. Enable RLS if not already enabled.
ALTER TABLE IF EXISTS public.workspace_memberships ENABLE ROW LEVEL SECURITY;

-- 2. Recreate the SELECT policy so users can read their own membership
--    (required for the middleware access check to work with the anon key).
DROP POLICY IF EXISTS "workspace_memberships_select_own" ON public.workspace_memberships;
CREATE POLICY "workspace_memberships_select_own"
  ON public.workspace_memberships
  FOR SELECT
  USING (auth.uid() = user_id);

-- 3. Backfill workspace_memberships from workspace_members for any user who
--    accepted an invitation but whose membership row is missing.
INSERT INTO public.workspace_memberships (user_id, workspace_key, role, is_active)
SELECT DISTINCT
  wm.user_id,
  'os',
  CASE
    WHEN lower(wm.role) IN ('owner') THEN 'owner'
    WHEN lower(wm.role) IN ('admin', 'manager') THEN 'admin'
    ELSE 'member'
  END,
  true
FROM public.workspace_members wm
WHERE wm.user_id IS NOT NULL
  AND wm.status = 'active'
  AND NOT EXISTS (
    SELECT 1
    FROM public.workspace_memberships wms
    WHERE wms.user_id = wm.user_id
      AND wms.workspace_key = 'os'
  )
ON CONFLICT DO NOTHING;
