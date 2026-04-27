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
    const fallback = await db
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clientId);
    if (!fallback.error) return fallback.count ?? 0;
    if (fallback.error.code === '42P01' || fallback.error.code === '42703') return 0;
    throw new Error(fallback.error.message);
  }
  if (primary.error.code === '42P01') return 0;
  throw new Error(primary.error.message);
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    // TODO: restore role-based delete permissions after debugging.
    const auth = await requireRole(request, ['owner', 'admin', 'manager', 'team_member']);
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
    const membershipCheck = await db
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('user_id', auth.profile.id)
      .maybeSingle();
    const membershipFound = Boolean(membershipCheck.data?.id);
    // eslint-disable-next-line no-console
    console.info('[debug-delete] route=/api/clients/[id] step=authorized', {
      recordId: clientId,
      workspaceId,
      requesterUserId: auth.profile.id,
      membershipFound,
    });

    const { data: existing, error: fetchErr } = await db
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    if (fetchErr) {
      return NextResponse.json({ success: false, error: fetchErr.message }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Client not found' }, { status: 404 });
    }

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
    const hasBlockingDependencies = Object.values(dependencyCounts).some((count) => count > 0);
    if (hasBlockingDependencies) {
      // eslint-disable-next-line no-console
      console.info('[debug-delete] route=/api/clients/[id] step=blocked_dependencies', {
        recordId: clientId,
        workspaceId,
        requesterUserId: auth.profile.id,
        membershipFound,
        deleteResult: 'blocked',
      });
      return NextResponse.json(
        {
          success: false,
          code: 'CLIENT_HAS_DEPENDENCIES',
          error: 'This client has related data. Remove related projects/tasks/assets first.',
          dependencies: dependencyCounts,
        },
        { status: 409 },
      );
    }

    const { error: delErr } = await db
      .from('clients')
      .delete()
      .eq('id', clientId)
      .eq('workspace_id', workspaceId);

    if (delErr) {
      return NextResponse.json({ success: false, error: delErr.message }, { status: 500 });
    }
    // eslint-disable-next-line no-console
    console.info('[debug-delete] route=/api/clients/[id] step=deleted', {
      recordId: clientId,
      workspaceId,
      requesterUserId: auth.profile.id,
      membershipFound,
      deleteResult: 'success',
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Unexpected delete error' },
      { status: 500 },
    );
  }
}
