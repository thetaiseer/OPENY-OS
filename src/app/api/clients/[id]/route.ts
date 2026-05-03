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
const MISSING_SCHEMA_ERROR_CODES = new Set(['42P01', '42703', 'PGRST204', 'PGRST205']);

type DbClient = ReturnType<typeof getServiceClient>;

type DbErrorLike = {
  code?: string | null;
  message?: string | null;
} | null;

type UnlinkUpdateResult = {
  error?: DbErrorLike;
};

function isMissingSchemaError(error: DbErrorLike): boolean {
  if (!error) return false;
  if (error.code && MISSING_SCHEMA_ERROR_CODES.has(error.code)) return true;
  const message = (error.message ?? '').toLowerCase();
  return (
    message.includes('could not find the table') ||
    message.includes('could not find the column') ||
    message.includes('schema cache')
  );
}

async function tableHasColumn(db: DbClient, table: string, column: string): Promise<boolean> {
  const result = await db.from(table).select(column, { head: true }).limit(1);
  if (!result.error) return true;
  if (isMissingSchemaError(result.error)) return false;
  return true;
}

async function runUnlinkUpdate(
  query: PromiseLike<UnlinkUpdateResult>,
  label: string,
): Promise<void> {
  const result = await query;
  const error = result.error ?? null;

  if (!error) return;
  if (isMissingSchemaError(error)) return;
  throw new Error(`${label}: ${error.message ?? 'Unknown database error'}`);
}

async function unlinkClientReferences(
  db: DbClient,
  table: string,
  clientId: string,
  clientName: string,
  workspaceId: string,
): Promise<void> {
  const hasClientId = await tableHasColumn(db, table, 'client_id');
  const hasWorkspaceId = await tableHasColumn(db, table, 'workspace_id');
  const hasClientName = await tableHasColumn(db, table, 'client_name');
  const hasClientFolderName = await tableHasColumn(db, table, 'client_folder_name');

  if (hasClientId) {
    let query = db.from(table).update({ client_id: null }).eq('client_id', clientId);
    if (hasWorkspaceId) query = query.eq('workspace_id', workspaceId);
    await runUnlinkUpdate(query, `${table}.client_id`);
  }

  if (hasClientName && clientName) {
    let query = db.from(table).update({ client_name: null }).eq('client_name', clientName);
    if (hasWorkspaceId) query = query.eq('workspace_id', workspaceId);
    await runUnlinkUpdate(query, `${table}.client_name`);
  }

  if (hasClientFolderName && clientName) {
    let query = db
      .from(table)
      .update({ client_folder_name: null })
      .eq('client_folder_name', clientName);
    if (hasWorkspaceId) query = query.eq('workspace_id', workspaceId);
    await runUnlinkUpdate(query, `${table}.client_folder_name`);
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
