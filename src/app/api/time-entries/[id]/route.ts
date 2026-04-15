/**
 * PATCH  /api/time-entries/[id]  — stop timer / update entry
 * DELETE /api/time-entries/[id]  — delete entry
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { requireRole } from '@/lib/api-auth';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(req, ['admin', 'manager', 'team_member']);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const db = getServiceClient();

  // Fetch current entry to compute duration if stopping
  const { data: existing } = await db.from('time_entries').select('started_at, is_running').eq('id', id).single();

  const allowed: Record<string, unknown> = {};
  if (typeof body.description      === 'string')  allowed.description = body.description.trim();
  if (typeof body.billable         === 'boolean') allowed.billable    = body.billable;
  if (typeof body.ended_at         === 'string')  allowed.ended_at    = body.ended_at;
  if (typeof body.duration_seconds === 'number')  allowed.duration_seconds = Math.round(body.duration_seconds);

  // Stopping a running timer
  if (body.is_running === false && existing?.is_running) {
    const endedAt = typeof body.ended_at === 'string' ? body.ended_at : new Date().toISOString();
    allowed.is_running = false;
    allowed.ended_at   = endedAt;
    if (!allowed.duration_seconds && existing?.started_at) {
      allowed.duration_seconds = Math.round(
        (new Date(endedAt).getTime() - new Date(existing.started_at).getTime()) / 1000,
      );
    }
  }
  allowed.updated_at = new Date().toISOString();

  const { data, error } = await db
    .from('time_entries')
    .update(allowed)
    .eq('id', id)
    .select('*, task:tasks(id, title), client:clients(id, name)')
    .single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, entry: data });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(req, ['admin', 'manager', 'team_member']);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const db = getServiceClient();
  const { error } = await db.from('time_entries').delete().eq('id', id);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
