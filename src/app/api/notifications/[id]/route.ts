/**
 * PATCH /api/notifications/[id] — mark as read / unread
 * DELETE /api/notifications/[id] — delete a notification
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { requireRole } from '@/lib/api-auth';


interface Params { id: string }

export async function PATCH(req: NextRequest, { params }: { params: Promise<Params> }) {
  const { id } = await params;
  const auth = await requireRole(req, ['admin', 'manager', 'team_member', 'client']);
  if (auth instanceof NextResponse) return auth;

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* ignore */ }

  const db = getServiceClient();
  const updateData: Record<string, unknown> = {};
  if (typeof body.read === 'boolean') updateData.read = body.read;

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ success: false, error: 'Nothing to update' }, { status: 400 });
  }

  const { data, error } = await db.from('notifications').update(updateData).eq('id', id).select().single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, notification: data });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<Params> }) {
  const { id } = await params;
  const auth = await requireRole(req, ['admin', 'manager', 'team_member', 'client']);
  if (auth instanceof NextResponse) return auth;

  const db = getServiceClient();
  const { error } = await db.from('notifications').delete().eq('id', id);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
