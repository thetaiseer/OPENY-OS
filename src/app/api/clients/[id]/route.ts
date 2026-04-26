/**
 * DELETE /api/clients/[id]
 *
 * Permanently removes a client in the current workspace.
 * Auth: workspace owner only (not admin/manager).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { requireRole } from '@/lib/api-auth';
import { resolveWorkspaceForRequest } from '@/lib/api-workspace';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(request, ['owner']);
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
  );
  if (!workspaceId) {
    return NextResponse.json(
      { success: false, error: workspaceError ?? 'Workspace not found' },
      { status: 500 },
    );
  }

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

  const { error: delErr } = await db
    .from('clients')
    .delete()
    .eq('id', clientId)
    .eq('workspace_id', workspaceId);

  if (delErr) {
    return NextResponse.json({ success: false, error: delErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
