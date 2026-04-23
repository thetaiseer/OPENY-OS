import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import type { SupabaseClient } from '@supabase/supabase-js';
import { type WorkspaceKey, isGlobalOwnerEmail } from '@/lib/workspace-access';

export const AUTH_WORKSPACE_OPTIONS = [
  { value: 'OPENY OS', key: 'os' as const },
  { value: 'OPENY DOCS', key: 'docs' as const },
] as const;

const SELECTED_WORKSPACE_STORAGE_KEY = 'openy_selected_workspace';

export function resolveWorkspaceKey(value: string): WorkspaceKey | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'openy os' || normalized === 'os') return 'os';
  if (normalized === 'openy docs' || normalized === 'docs') return 'docs';
  return null;
}

export function getWorkspaceHomeHref(workspaceKey: WorkspaceKey): '/os/dashboard' | '/docs' {
  return workspaceKey === 'docs' ? '/docs' : '/os/dashboard';
}

export async function checkWorkspaceAccess(
  supabase: SupabaseClient,
  userId: string,
  userEmail: string | null | undefined,
  workspaceKey: WorkspaceKey,
): Promise<boolean> {
  if (isGlobalOwnerEmail(userEmail)) return true;

  const { data: workspaceRows, error: workspaceError } = await supabase
    .from('workspaces')
    .select('id')
    .or(`slug.eq.${workspaceKey},name.ilike.OPENY ${workspaceKey.toUpperCase()}`)
    .limit(1);
  if (!workspaceError && (workspaceRows ?? []).length === 0) return false;

  const { data: membership } = await supabase
    .from('workspace_memberships')
    .select('id')
    .eq('user_id', userId)
    .eq('workspace_key', workspaceKey)
    .eq('is_active', true)
    .maybeSingle();

  return Boolean(membership);
}

export function persistSelectedWorkspace(workspaceKey: WorkspaceKey): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(SELECTED_WORKSPACE_STORAGE_KEY, workspaceKey); } catch {}
  try { sessionStorage.setItem(SELECTED_WORKSPACE_STORAGE_KEY, workspaceKey); } catch {}
}

export function readSelectedWorkspace(): WorkspaceKey | null {
  if (typeof window === 'undefined') return null;
  try {
    const fromSession = sessionStorage.getItem(SELECTED_WORKSPACE_STORAGE_KEY);
    if (fromSession === 'os' || fromSession === 'docs') return fromSession;
  } catch {}
  try {
    const fromLocal = localStorage.getItem(SELECTED_WORKSPACE_STORAGE_KEY);
    if (fromLocal === 'os' || fromLocal === 'docs') return fromLocal;
  } catch {}
  return null;
}

export function redirectToWorkspace(
  router: AppRouterInstance,
  workspaceKey: WorkspaceKey,
  nextPath?: string | null,
): void {
  const safeNext = nextPath && nextPath.startsWith(`/${workspaceKey}`) ? nextPath : null;
  router.push(safeNext ?? getWorkspaceHomeHref(workspaceKey));
  router.refresh();
}
