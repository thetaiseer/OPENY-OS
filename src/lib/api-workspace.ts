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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function userBelongsToWorkspace(
  db: SupabaseClient,
  userId: string,
  workspaceId: string,
): Promise<boolean> {
  const row = await db
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', userId)
    .eq('workspace_id', workspaceId)
    .maybeSingle();
  return !row.error && Boolean(row.data?.workspace_id);
}

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
  if (!bySlug.error && bySlug.data?.id) return bySlug.data.id as string;

  const byName = await db
    .from('workspaces')
    .select('id')
    .ilike('name', `OPENY ${workspaceKey.toUpperCase()}`)
    .limit(1)
    .maybeSingle();
  if (!byName.error && byName.data?.id) return byName.data.id as string;

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

type WorkspaceRow = { id: string; slug: string | null; name: string | null };

function scoreWorkspaceForKey(row: WorkspaceRow, preferredKey: WorkspaceKey): number {
  const slug = (row.slug ?? '').toLowerCase();
  const name = (row.name ?? '').toUpperCase();
  if (slug === preferredKey) return 100;
  if (name.includes(`OPENY ${preferredKey.toUpperCase()}`)) return 90;
  if (preferredKey === 'os') {
    if (row.id === LEGACY_DEFAULT_WORKSPACE_ID) return 85;
    if (name.includes('DEFAULT') && name.includes('WORKSPACE')) return 80;
    if (name.includes('OPENY') && name.includes('OS')) return 75;
  }
  if (preferredKey === 'docs' && (name.includes('DOCS') || slug === 'docs')) return 75;
  return 0;
}

/** Pick the best workspace row for this surface among rows the user belongs to. */
function pickWorkspaceForPreferredKey(
  rows: WorkspaceRow[],
  preferredKey: WorkspaceKey,
): WorkspaceRow | null {
  if (!rows.length) return null;
  let best = rows[0];
  let bestScore = scoreWorkspaceForKey(best, preferredKey);
  for (let i = 1; i < rows.length; i++) {
    const s = scoreWorkspaceForKey(rows[i], preferredKey);
    if (s > bestScore) {
      best = rows[i];
      bestScore = s;
    }
  }
  return best;
}

async function resolveWorkspaceIdFromSession(
  db: SupabaseClient,
  userId: string,
  preferredKey: WorkspaceKey,
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

  const allMembers = await db
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', userId);
  if (allMembers.error || !allMembers.data?.length) {
    return { workspaceId: null, workspaceKey: null };
  }

  const ids = [
    ...new Set(allMembers.data.map((r) => (r as { workspace_id: string }).workspace_id)),
  ];
  const workspaces = await db.from('workspaces').select('id, slug, name').in('id', ids);
  if (workspaces.error || !workspaces.data?.length) {
    return { workspaceId: null, workspaceKey: null };
  }

  const rows = workspaces.data as WorkspaceRow[];
  const picked = pickWorkspaceForPreferredKey(rows, preferredKey);
  if (!picked) return { workspaceId: null, workspaceKey: null };
  return { workspaceId: picked.id, workspaceKey: preferredKey };
}

export async function resolveWorkspaceForRequest(
  request: NextRequest,
  db: SupabaseClient,
  userId?: string | null,
): Promise<WorkspaceResolution> {
  const requestedKey = resolveWorkspaceKeyFromRequest(request);
  const workspaceKey = requestedKey ?? 'os';

  const workspaceIdParam = request.nextUrl.searchParams.get('workspace_id')?.trim() ?? '';
  if (workspaceIdParam && UUID_RE.test(workspaceIdParam) && userId) {
    const allowed = await userBelongsToWorkspace(db, userId, workspaceIdParam);
    if (allowed) {
      return { workspaceKey, workspaceId: workspaceIdParam, error: null };
    }
  }

  // Prefer membership-based resolution for authenticated users (slug "os" may not exist).
  if (userId) {
    const bySession = await resolveWorkspaceIdFromSession(db, userId, workspaceKey);
    if (bySession.workspaceId) {
      return {
        workspaceKey: bySession.workspaceKey ?? workspaceKey,
        workspaceId: bySession.workspaceId,
        error: null,
      };
    }
  }

  const byKey = await resolveWorkspaceIdByKey(db, workspaceKey);
  if (byKey) return { workspaceKey, workspaceId: byKey, error: null };

  return {
    workspaceKey,
    workspaceId: null,
    error: `Unable to resolve workspace for key "${workspaceKey}"`,
  };
}
