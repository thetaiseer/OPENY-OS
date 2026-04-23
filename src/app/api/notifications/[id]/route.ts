/**
 * PATCH /api/notifications/[id] — mark as read / unread / archive
 * DELETE /api/notifications/[id] — hard-delete (admin only; prefer archive for normal users)
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { requireRole } from '@/lib/api-auth';

interface Params {
  id: string;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<Params> }) {
  const { id } = await params;
  const auth = await requireRole(req, ['admin', 'manager', 'team_member', 'client']);
  if (auth instanceof NextResponse) return auth;

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    /* ignore */
  }

  const db = getServiceClient();
  const updateData: Record<string, unknown> = {};
  if (typeof body.read === 'boolean') {
    updateData.read = body.read;
    if (body.read) updateData.read_at = new Date().toISOString();
  }
  if (typeof body.is_read === 'boolean') {
    updateData.read = body.is_read;
    if (body.is_read) updateData.read_at = new Date().toISOString();
  }
  if (typeof body.is_archived === 'boolean') {
    updateData.is_archived = body.is_archived;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ success: false, error: 'Nothing to update' }, { status: 400 });
  }

  let query = db.from('notifications').update(updateData).eq('id', id);
  if (!['admin', 'owner'].includes(auth.profile.role)) {
    query = query.or(`user_id.eq.${auth.profile.id},user_id.is.null`);
  }
  const { data, error } = await query.select().single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, notification: data });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<Params> }) {
  const { id } = await params;
  const auth = await requireRole(req, ['admin', 'manager', 'team_member', 'client']);
  if (auth instanceof NextResponse) return auth;

  const db = getServiceClient();
  let query = db.from('notifications').delete().eq('id', id);
  if (!['admin', 'owner'].includes(auth.profile.role)) {
    query = query.or(`user_id.eq.${auth.profile.id},user_id.is.null`);
  }
  const { error } = await query;
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
