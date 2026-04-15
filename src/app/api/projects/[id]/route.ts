/**
 * GET    /api/projects/[id]   — get project
 * PATCH  /api/projects/[id]   — update project
 * DELETE /api/projects/[id]   — delete project
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { requireRole } from '@/lib/api-auth';
import { emitEvent, EVENT } from '@/lib/workspace-events';

const VALID_STATUSES = ['planning', 'active', 'on_hold', 'completed', 'cancelled'] as const;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(req, ['admin', 'manager', 'team_member']);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const db = getServiceClient();
  const { data, error } = await db
    .from('projects')
    .select('*, client:clients(id, name, slug)')
    .eq('id', id)
    .single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 404 });
  return NextResponse.json({ success: true, project: data });
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
  if (typeof body.name        === 'string') allowed.name        = body.name.trim();
  if (typeof body.description === 'string') allowed.description = body.description.trim();
  if (typeof body.start_date  === 'string') allowed.start_date  = body.start_date.trim() || null;
  if (typeof body.end_date    === 'string') allowed.end_date    = body.end_date.trim()   || null;
  if (typeof body.color       === 'string') allowed.color       = body.color.trim();
  if (typeof body.client_id   === 'string') allowed.client_id   = body.client_id.trim()  || null;
  if (typeof body.status === 'string') {
    const s = body.status;
    if ((VALID_STATUSES as readonly string[]).includes(s)) allowed.status = s;
  }

  if (Object.keys(allowed).length === 0) {
    return NextResponse.json({ success: false, error: 'No valid fields to update' }, { status: 400 });
  }
  allowed.updated_at = new Date().toISOString();

  const db = getServiceClient();
  const { data, error } = await db
    .from('projects')
    .update(allowed)
    .eq('id', id)
    .select('*, client:clients(id, name, slug)')
    .single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  void emitEvent(db, {
    event_type:  EVENT.PROJECT_UPDATED,
    entity_type: 'project',
    entity_id:   id,
    actor_id:    auth.profile.id,
    payload:     { changes: allowed },
  });

  return NextResponse.json({ success: true, project: data });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(req, ['admin', 'manager']);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const db = getServiceClient();
  const { error } = await db.from('projects').delete().eq('id', id);

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
