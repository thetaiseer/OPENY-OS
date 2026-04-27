/**
 * DELETE /api/clients/[id]
 *
 * Permanently removes a client in the current workspace.
 * Auth: workspace owner/admin/manager.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { requireRole } from '@/lib/api-auth';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRole(request, ['owner', 'admin', 'manager']);
    if (auth instanceof NextResponse) return auth;

    const { id: clientId } = await ctx.params;
    if (!clientId || !UUID_RE.test(clientId)) {
      return NextResponse.json({ success: false, error: 'Invalid client id' }, { status: 400 });
    }

    const db = getServiceClient();

    const { data: existing, error: fetchErr } = await db
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .maybeSingle();

    if (fetchErr) {
      return NextResponse.json({ success: false, error: fetchErr.message }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Client not found' }, { status: 404 });
    }

    // Defensive cleanup: if some environments still have strict FK constraints
    // (instead of ON DELETE SET NULL), detach child rows before deleting the client.
    const nullableClientRefs = [
      'tasks',
      'assets',
      'content_items',
      'projects',
      'publishing_schedules',
      'calendar_events',
      'time_entries',
      'activities',
      'notifications',
    ] as const;
    for (const table of nullableClientRefs) {
      const { error } = await db.from(table).update({ client_id: null }).eq('client_id', clientId);
      if (error) {
        // Ignore missing-table/column schema drift; hard errors still surface on final delete.
        const msg = error.message?.toLowerCase?.() ?? '';
        if (!msg.includes('does not exist')) {
          console.warn(
            `[DELETE /api/clients/${clientId}] pre-clean failed on ${table}:`,
            error.message,
          );
        }
      }
    }

    const { error: delErr } = await db.from('clients').delete().eq('id', clientId);

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
