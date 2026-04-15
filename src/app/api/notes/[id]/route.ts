/**
 * GET    /api/notes/[id]  — get note
 * PATCH  /api/notes/[id]  — update note (title, content, is_pinned)
 * DELETE /api/notes/[id]  — delete note
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { requireRole } from '@/lib/api-auth';
import { emitEvent, EVENT } from '@/lib/workspace-events';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(req, ['admin', 'manager', 'team_member']);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const db = getServiceClient();
  const { data, error } = await db.from('notes').select('*').eq('id', id).single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 404 });
  return NextResponse.json({ success: true, note: data });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(req, ['admin', 'manager', 'team_member']);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const allowed: Record<string, unknown> = {};
  if (typeof body.title     === 'string')  allowed.title     = body.title.trim();
  if (typeof body.content   === 'string')  allowed.content   = body.content;
  if (typeof body.is_pinned === 'boolean') allowed.is_pinned = body.is_pinned;
  allowed.updated_at = new Date().toISOString();

  const db = getServiceClient();
  const { data, error } = await db.from('notes').update(allowed).eq('id', id).select().single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  void emitEvent(db, {
    event_type:  EVENT.NOTE_UPDATED,
    entity_type: 'note',
    entity_id:   id,
    actor_id:    auth.profile.id,
    payload:     { changes: allowed },
  });

  return NextResponse.json({ success: true, note: data });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(req, ['admin', 'manager', 'team_member']);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const db = getServiceClient();
  const { error } = await db.from('notes').delete().eq('id', id);

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
