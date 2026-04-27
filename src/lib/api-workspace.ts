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
  const workspaceRow = await db
    .from('workspaces')
    .select('slug, name')
    .eq('id', workspaceId)
    .maybeSingle();
  if (workspaceRow.error || !workspaceRow.data) return false;
  const slug = (workspaceRow.data.slug ?? '').toLowerCase();
  const name = (workspaceRow.data.name ?? '').toUpperCase();
  const workspaceKey: WorkspaceKey = slug === 'docs' || name.includes('DOCS') ? 'docs' : 'os';
  const membership = await db
    .from('workspace_memberships')
    .select('user_id')
    .eq('user_id', userId)
    .eq('workspace_key', workspaceKey)
    .eq('is_active', true)
    .maybeSingle();
  return !membership.error && Boolean(membership.data?.user_id);
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

/**
 * Resolve a workspace UUID for an authenticated user.
 *
 * Resolves from `workspace_memberships` (workspace_key + is_active) then maps
 * that key to a workspace UUID row.
 */
async function resolveWorkspaceIdFromSession(
  db: SupabaseClient,
  userId: string,
  preferredKey: WorkspaceKey,
): Promise<{ workspaceId: string | null; workspaceKey: WorkspaceKey | null }> {
  const allMemberships = await db
    .from('workspace_memberships')
    .select('workspace_key, is_active')
    .eq('user_id', userId);
  if (allMemberships.error || !allMemberships.data?.length) {
    // Owner-repair fallback: if the authenticated user owns a workspace row but
    // has no workspace_memberships record, re-create an active owner membership.
    const owned = await db
      .from('workspaces')
      .select('id, slug, name')
      .eq('owner_id', userId)
      .limit(5);
    if (owned.error || !owned.data?.length) {
      return { workspaceId: null, workspaceKey: null };
    }
    const ownedRows = owned.data as WorkspaceRow[];
    const preferredOwned = pickWorkspaceForPreferredKey(ownedRows, preferredKey) ?? ownedRows[0];
    const pickedKey: WorkspaceKey =
      (preferredOwned?.slug ?? '').toLowerCase() === 'docs' ||
      (preferredOwned?.name ?? '').toUpperCase().includes('DOCS')
        ? 'docs'
        : 'os';

    await db.from('workspace_memberships').upsert(
      {
        user_id: userId,
        workspace_key: pickedKey,
        role: 'owner',
        is_active: true,
      },
      { onConflict: 'user_id,workspace_key' },
    );

    return { workspaceId: preferredOwned?.id ?? null, workspaceKey: pickedKey };
  }

  const activeKeys = new Set(
    allMemberships.data
      .filter((r) => Boolean((r as { is_active?: boolean }).is_active ?? true))
      .map((r) => normalizeWorkspaceKey((r as { workspace_key?: string }).workspace_key))
      .filter((k): k is WorkspaceKey => k === 'os' || k === 'docs'),
  );
  if (!activeKeys.size) {
    return { workspaceId: null, workspaceKey: null };
  }
  const chosenKey = activeKeys.has(preferredKey)
    ? preferredKey
    : activeKeys.has('os')
      ? 'os'
      : 'docs';
  const byKey = await resolveWorkspaceIdByKey(db, chosenKey);
  if (byKey) {
    return { workspaceId: byKey, workspaceKey: chosenKey };
  }
  const workspaces = await db.from('workspaces').select('id, slug, name');
  if (workspaces.error || !workspaces.data?.length) {
    return { workspaceId: null, workspaceKey: null };
  }
  const rows = workspaces.data as WorkspaceRow[];
  const allowedRows = rows.filter((row) => {
    const slug = (row.slug ?? '').toLowerCase();
    const name = (row.name ?? '').toUpperCase();
    const key: WorkspaceKey = slug === 'docs' || name.includes('DOCS') ? 'docs' : 'os';
    return activeKeys.has(key);
  });
  const picked = pickWorkspaceForPreferredKey(allowedRows.length ? allowedRows : rows, chosenKey);
  return {
    workspaceId: picked?.id ?? null,
    workspaceKey: picked ? chosenKey : null,
  };
}

export async function resolveWorkspaceForRequest(
  request: NextRequest,
  db: SupabaseClient,
  userId?: string | null,
  options?: { allowWorkspaceFallbackWithoutMembership?: boolean },
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

  // Authenticated routes: workspace_id must match active workspace membership.
  if (userId) {
    const bySession = await resolveWorkspaceIdFromSession(db, userId, workspaceKey);
    if (bySession.workspaceId) {
      return {
        workspaceKey: bySession.workspaceKey ?? workspaceKey,
        workspaceId: bySession.workspaceId,
        error: null,
      };
    }
    if (options?.allowWorkspaceFallbackWithoutMembership) {
      const byKey = await resolveWorkspaceIdByKey(db, workspaceKey);
      if (byKey) {
        return { workspaceKey, workspaceId: byKey, error: null };
      }
    }
    return {
      workspaceKey,
      workspaceId: null,
      error: `No workspace membership found for this account (requested key "${workspaceKey}")`,
    };
  }

  const byKey = await resolveWorkspaceIdByKey(db, workspaceKey);
  if (byKey) return { workspaceKey, workspaceId: byKey, error: null };

  return {
    workspaceKey,
    workspaceId: null,
    error: `Unable to resolve workspace for key "${workspaceKey}"`,
  };
}
