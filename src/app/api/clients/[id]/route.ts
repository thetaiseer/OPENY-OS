/**
 * DELETE /api/clients/[id]
 *
 * Permanently removes a client in the current workspace.
 * Auth: workspace owner/admin/manager.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { requireRole } from '@/lib/api-auth';
import { resolveWorkspaceForRequest } from '@/lib/api-workspace';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function countClientDependencies(
  db: ReturnType<typeof getServiceClient>,
  table: string,
  clientId: string,
  workspaceId: string,
): Promise<number> {
  const primary = await db
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('client_id', clientId)
    .eq('workspace_id', workspaceId);
  if (!primary.error) return primary.count ?? 0;
  if (primary.error.code === '42703') {
    const fallback = await db.from(table).select('id', { count: 'exact', head: true }).eq('client_id', clientId);
    if (!fallback.error) return fallback.count ?? 0;
    if (fallback.error.code === '42P01' || fallback.error.code === '42703') return 0;
    throw new Error(fallback.error.message);
  }
  if (primary.error.code === '42P01') return 0;
  throw new Error(primary.error.message);
}

async function clearClientReference(
  db: ReturnType<typeof getServiceClient>,
  table: string,
  clientId: string,
  workspaceId: string,
): Promise<void> {
  const primary = await db
    .from(table)
    .update({ client_id: null })
    .eq('client_id', clientId)
    .eq('workspace_id', workspaceId);
  if (!primary.error) return;
  if (primary.error.code === '42703') {
    const fallback = await db.from(table).update({ client_id: null }).eq('client_id', clientId);
    if (!fallback.error || fallback.error.code === '42P01' || fallback.error.code === '42703') return;
    throw new Error(fallback.error.message);
  }
  if (primary.error.code === '42P01') return;
  throw new Error(primary.error.message);
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRole(request, ['owner', 'admin', 'manager']);
    if (auth instanceof NextResponse) return auth;

    const { id: clientId } = await ctx.params;
    if (!clientId || !UUID_RE.test(clientId)) {
      return NextResponse.json({ success: false, error: 'Invalid client id' }, { status: 400 });
    }

    const db = getServiceClient();
    const { workspaceId, error: workspaceError } = await resolveWorkspaceForRequest(
      request,
      db,
      auth.profile.id,
      { allowWorkspaceFallbackWithoutMembership: true },
    );
    if (!workspaceId) {
      return NextResponse.json(
        { success: false, error: workspaceError ?? 'Workspace not found' },
        { status: 403 },
      );
    }

    const { data: existing, error: fetchErr } = await db
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    if (fetchErr) return NextResponse.json({ success: false, error: fetchErr.message }, { status: 500 });
    if (!existing) return NextResponse.json({ success: false, error: 'Client not found' }, { status: 404 });

    const dependencyTables = [
      'assets',
      'projects',
      'tasks',
      'content_items',
      'publishing_schedules',
      'invoices',
      'quotations',
      'client_contracts',
      'activities',
    ] as const;

    const dependencyCounts: Record<string, number> = {};
    for (const table of dependencyTables) {
      dependencyCounts[table] = await countClientDependencies(db, table, clientId, workspaceId);
    }

    // Keep related records/files, but remove the client_id relation first so FK constraints do not block deletion.
    for (const table of dependencyTables) {
      if (dependencyCounts[table] > 0) await clearClientReference(db, table, clientId, workspaceId);
    }

    const { error: delErr } = await db
      .from('clients')
      .delete()
      .eq('id', clientId)
      .eq('workspace_id', workspaceId);

    if (delErr) return NextResponse.json({ success: false, error: delErr.message }, { status: 500 });

    return NextResponse.json({ success: true, unlinked: dependencyCounts });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Unexpected delete error' },
      { status: 500 },
    );
  }
}
