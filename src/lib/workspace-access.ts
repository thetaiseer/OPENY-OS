import type { SupabaseClient } from '@supabase/supabase-js';
import { OWNER_EMAIL } from '@/lib/constants/auth';

export const WORKSPACE_KEYS = ['os', 'docs'] as const;
export type WorkspaceKey = (typeof WORKSPACE_KEYS)[number];
export const WORKSPACE_LABELS: Record<WorkspaceKey, 'OPENY OS' | 'OPENY DOCS'> = {
  os: 'OPENY OS',
  docs: 'OPENY DOCS',
};

export const WORKSPACE_ROLES = ['owner', 'admin', 'member', 'viewer'] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export function normalizeWorkspaceKey(value: unknown): WorkspaceKey | null {
  if (typeof value !== 'string') return null;
  const lower = value.toLowerCase();
  if (lower === 'os' || lower === 'docs') return lower;
  return null;
}

export function getWorkspaceLabel(workspace: WorkspaceKey): 'OPENY OS' | 'OPENY DOCS' {
  return WORKSPACE_LABELS[workspace];
}

export function isGlobalOwnerEmail(email?: string | null): boolean {
  return (email ?? '').toLowerCase() === OWNER_EMAIL;
}

export function getWorkspaceFromAppPath(pathname: string): WorkspaceKey | null {
  if (pathname === '/docs' || pathname.startsWith('/docs/')) return 'docs';
  if (pathname === '/docs-legacy' || pathname.startsWith('/docs-legacy/')) return 'docs';
  if (pathname === '/invoice' || pathname === '/quotation' || pathname === '/client-contract'
    || pathname === '/hr-contract' || pathname === '/employees' || pathname === '/accounting') return 'docs';
  if (pathname === '/os' || pathname.startsWith('/os/')) return 'os';
  return null;
}

export function getWorkspaceFromApiPath(pathname: string): WorkspaceKey | null {
  if (pathname === '/api/docs' || pathname.startsWith('/api/docs/')) return 'docs';
  if (pathname.startsWith('/api/auth/')) return null;
  return 'os';
}

export function mapWorkspaceRoleToUserRole(role: WorkspaceRole | null): 'owner' | 'admin' | 'team_member' | 'viewer' {
  if (role === 'owner') return 'owner';
  if (role === 'admin') return 'admin';
  if (role === 'viewer') return 'viewer';
  return 'team_member';
}

export function mapAccessRoleToWorkspaceRole(value: string): 'admin' | 'member' | 'viewer' {
  if (value === 'admin' || value === 'manager') return 'admin';
  if (value === 'viewer') return 'viewer';
  return 'member';
}

export async function getWorkspaceMembership(
  supabase: SupabaseClient,
  userId: string,
  workspace: WorkspaceKey,
): Promise<{ role: WorkspaceRole; is_active: boolean } | null> {
  const { data } = await supabase
    .from('workspace_memberships')
    .select('role, is_active')
    .eq('user_id', userId)
    .eq('workspace_key', workspace)
    .eq('is_active', true)
    .maybeSingle();

  if (!data) return null;
  return data as { role: WorkspaceRole; is_active: boolean };
}
