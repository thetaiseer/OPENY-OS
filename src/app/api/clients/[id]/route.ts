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

async function tableHasColumn(
  db: ReturnType<typeof getServiceClient>,
  table: string,
  column: string,
): Promise<boolean> {
  const result = await db.from(table).select(column, { head: true }).limit(1);
  if (!result.error) return true;
  if (result.error.code === '42P01' || result.error.code === '42703' || result.error.code === 'PGRST204') {
    return false;
  }
  return true;
}

async function unlinkClientReferences(
  db: ReturnType<typeof getServiceClient>,
  table: string,
  clientId: string,
  clientName: string,
  workspaceId: string,
): Promise<void> {
  const hasClientId = await tableHasColumn(db, table, 'client_id');
  const hasWorkspaceId = await tableHasColumn(db, table, 'workspace_id');
  const hasClientName = await tableHasColumn(db, table, 'client_name');
  const hasClientFolderName = await tableHasColumn(db, table, 'client_folder_name');

  const applyWorkspace = <T>(query: T): T => {
    if (!hasWorkspaceId) return query;
    return (query as { eq: (column: string, value: string) => T }).eq('workspace_id', workspaceId);
  };

  if (hasClientId) {
    const update = applyWorkspace(db.from(table).update({ client_id: null }).eq('client_id', clientId));
    const { error } = await update;
    if (error && error.code !== '42P01' && error.code !== '42703' && error.code !== 'PGRST204') {
      throw new Error(`${table}.client_id: ${error.message}`);
    }
  }

  if (hasClientName && clientName) {
    const update = applyWorkspace(db.from(table).update({ client_name: null }).eq('client_name', clientName));
    const { error } = await update;
    if (error && error.code !== '42P01' && error.code !== '42703' && error.code !== 'PGRST204') {
      throw new Error(`${table}.client_name: ${error.message}`);
    }
  }

  if (hasClientFolderName && clientName) {
    const update = applyWorkspace(
      db.from(table).update({ client_folder_name: null }).eq('client_folder_name', clientName),
    );
    const { error } = await update;
    if (error && error.code !== '42P01' && error.code !== '42703' && error.code !== 'PGRST204') {
      throw new Error(`${table}.client_folder_name: ${error.message}`);
    }
  }
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
      .select('id, name')
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

    for (const table of dependencyTables) {
      await unlinkClientReferences(db, table, clientId, existing.name ?? '', workspaceId);
    }

    const { error: delErr } = await db
      .from('clients')
      .delete()
      .eq('id', clientId)
      .eq('workspace_id', workspaceId);

    if (delErr) {
      return NextResponse.json({ success: false, error: delErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Unexpected delete error' },
      { status: 500 },
    );
  }
}
