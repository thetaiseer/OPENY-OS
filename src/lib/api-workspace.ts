import type { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  getWorkspaceFromApiPath,
  getWorkspaceFromAppPath,
  normalizeWorkspaceKey,
  type WorkspaceKey,
} from '@/lib/workspace-access';

export type WorkspaceResolution = {
  workspaceKey: WorkspaceKey;
  workspaceId: string | null;
  error: string | null;
};

function resolveWorkspaceKeyFromRequest(request: NextRequest): WorkspaceKey | null {
  const fromQuery = normalizeWorkspaceKey(request.nextUrl.searchParams.get('workspace'));
  if (fromQuery) return fromQuery;

  const referer = request.headers.get('referer') ?? '';
  if (referer) {
    try {
      const pathname = new URL(referer).pathname;
      const fromPath = getWorkspaceFromAppPath(pathname);
      if (fromPath) return fromPath;
    } catch {}
  }

  return getWorkspaceFromApiPath(request.nextUrl.pathname);
}

/** Seeded in `supabase-migration-workspaces.sql` when slug was not set on the default row. */
const LEGACY_DEFAULT_WORKSPACE_ID = '00000000-0000-0000-0000-000000000001';

async function resolveWorkspaceIdByKey(
  db: SupabaseClient,
  workspaceKey: WorkspaceKey,
): Promise<string | null> {
  const bySlug = await db.from('workspaces').select('id').eq('slug', workspaceKey).maybeSingle();
  if (bySlug.error) return null;
  if (bySlug.data?.id) return bySlug.data.id as string;

  const byName = await db
    .from('workspaces')
    .select('id')
    .ilike('name', `OPENY ${workspaceKey.toUpperCase()}`)
    .limit(1)
    .maybeSingle();
  if (byName.error) return null;
  if (byName.data?.id) return byName.data.id as string;

  // Legacy seed: "Default Workspace" with no slug (still maps to OPENY OS app surface).
  if (workspaceKey === 'os') {
    const byKnownId = await db
      .from('workspaces')
      .select('id')
      .eq('id', LEGACY_DEFAULT_WORKSPACE_ID)
      .maybeSingle();
    if (!byKnownId.error && byKnownId.data?.id) return byKnownId.data.id as string;

    const byDefaultLabel = await db
      .from('workspaces')
      .select('id')
      .ilike('name', '%default%workspace%')
      .limit(1)
      .maybeSingle();
    if (!byDefaultLabel.error && byDefaultLabel.data?.id) return byDefaultLabel.data.id as string;
  }

  if (workspaceKey === 'docs') {
    const byDocsName = await db
      .from('workspaces')
      .select('id')
      .or('name.ilike.%DOCS%,name.ilike.%docs%')
      .limit(1)
      .maybeSingle();
    if (!byDocsName.error && byDocsName.data?.id) return byDocsName.data.id as string;
  }

  // Single-tenant fallback: exactly one workspace row.
  const all = await db.from('workspaces').select('id').limit(2);
  if (!all.error && all.data?.length === 1 && (all.data[0] as { id?: string }).id) {
    return (all.data[0] as { id: string }).id;
  }

  return null;
}

async function resolveWorkspaceIdFromSession(
  db: SupabaseClient,
  userId: string,
): Promise<{ workspaceId: string | null; workspaceKey: WorkspaceKey | null }> {
  const membership = await db
    .from('workspace_memberships')
    .select('workspace_key')
    .eq('user_id', userId)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (!membership.error) {
    const key = normalizeWorkspaceKey(membership.data?.workspace_key);
    if (key) {
      const workspaceId = await resolveWorkspaceIdByKey(db, key);
      if (workspaceId) return { workspaceId, workspaceKey: key };
    }
  }

  const legacyMembership = await db
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();
  if (!legacyMembership.error && legacyMembership.data?.workspace_id) {
    return {
      workspaceId: legacyMembership.data.workspace_id as string,
      workspaceKey: null,
    };
  }

  return { workspaceId: null, workspaceKey: null };
}

export async function resolveWorkspaceForRequest(
  request: NextRequest,
  db: SupabaseClient,
  userId?: string | null,
): Promise<WorkspaceResolution> {
  const requestedKey = resolveWorkspaceKeyFromRequest(request);
  const workspaceKey = requestedKey ?? 'os';
  const byKey = await resolveWorkspaceIdByKey(db, workspaceKey);
  if (byKey) return { workspaceKey, workspaceId: byKey, error: null };

  if (userId) {
    const bySession = await resolveWorkspaceIdFromSession(db, userId);
    if (bySession.workspaceId) {
      return {
        workspaceKey: bySession.workspaceKey ?? workspaceKey,
        workspaceId: bySession.workspaceId,
        error: null,
      };
    }
  }

  return {
    workspaceKey,
    workspaceId: null,
    error: `Unable to resolve workspace for key "${workspaceKey}"`,
  };
}
