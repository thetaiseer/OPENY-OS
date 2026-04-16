import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getWorkspaceFromPathname } from '@/lib/workspace-navigation';
import { isGlobalOwnerEmail, type WorkspaceKey, type WorkspaceRole } from '@/lib/workspace-access';
import { getWorkspaceHomeHref } from '@/lib/auth-workspace';

export interface WorkspaceMembershipInfo {
  key: WorkspaceKey;
  label: 'OPENY OS' | 'OPENY DOCS';
  workspaceName: string;
  role: WorkspaceRole | null;
  hasMembership: boolean;
  homeHref: '/os/dashboard' | '/docs/dashboard';
}

const WORKSPACE_DEFS: Array<{ key: WorkspaceKey; label: 'OPENY OS' | 'OPENY DOCS' }> = [
  { key: 'os', label: 'OPENY OS' },
  { key: 'docs', label: 'OPENY DOCS' },
];

export function getCurrentWorkspace(pathname: string): WorkspaceKey {
  return getWorkspaceFromPathname(pathname);
}

export async function getUserWorkspaceMemberships(
  supabase: SupabaseClient,
  userId: string,
): Promise<WorkspaceMembershipInfo[]> {
  const [{ data: membershipRows }, { data: workspaceRows }] = await Promise.all([
    supabase
      .from('workspace_memberships')
      .select('workspace_key, role, is_active')
      .eq('user_id', userId)
      .eq('is_active', true),
    supabase
      .from('workspaces')
      .select('slug, name')
      .in('slug', WORKSPACE_DEFS.map(workspace => workspace.key)),
  ]);

  const membershipByKey = new Map<string, { role: WorkspaceRole | null }>();
  for (const row of membershipRows ?? []) {
    membershipByKey.set(row.workspace_key, { role: (row.role as WorkspaceRole) ?? null });
  }

  const workspaceNameByKey = new Map<WorkspaceKey, string>();
  for (const row of workspaceRows ?? []) {
    const key = row.slug === 'docs' ? 'docs' : row.slug === 'os' ? 'os' : null;
    if (!key) continue;
    workspaceNameByKey.set(key, row.name || (key === 'docs' ? 'OPENY DOCS' : 'OPENY OS'));
  }

  return WORKSPACE_DEFS.map(workspace => {
    const membership = membershipByKey.get(workspace.key);
    return {
      key: workspace.key,
      label: workspace.label,
      workspaceName: workspaceNameByKey.get(workspace.key) ?? workspace.label,
      role: membership?.role ?? null,
      hasMembership: Boolean(membership),
      homeHref: getWorkspaceHomeHref(workspace.key),
    };
  });
}

export function canShowWorkspaceSwitcher(
  userEmail: string | null | undefined,
  memberships: WorkspaceMembershipInfo[],
): boolean {
  if (isGlobalOwnerEmail(userEmail)) return true;
  return memberships.some(membership => membership.role === 'owner');
}

export function switchWorkspace(
  router: AppRouterInstance,
  targetWorkspaceKey: WorkspaceKey,
): void {
  router.push(getWorkspaceHomeHref(targetWorkspaceKey));
  router.refresh();
}
