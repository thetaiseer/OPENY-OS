/**
 * PATCH /api/notifications/mark-all-read — mark all notifications as read for a user
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { requireRole } from '@/lib/api-auth';

export async function PATCH(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'manager', 'team_member', 'client']);
  if (auth instanceof NextResponse) return auth;

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    /* ignore */
  }
  const requestedUserId = typeof body.user_id === 'string' ? body.user_id : null;
  const canTargetAnyUser = auth.profile.role === 'admin' || auth.profile.role === 'owner';
  const userId = canTargetAnyUser && requestedUserId ? requestedUserId : auth.profile.id;

  const db = getServiceClient();

  let query = db.from('notifications').update({ read: true }).eq('read', false);
  query = query.or(`user_id.eq.${userId},user_id.is.null`);

  const { error } = await query;
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
