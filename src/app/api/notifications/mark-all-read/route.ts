/**
 * PATCH /api/notifications/mark-all-read — mark all notifications as read for a user
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireRole } from '@/lib/api-auth';

export async function PATCH(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'manager', 'team', 'client']);
  if (auth instanceof NextResponse) return auth;

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* ignore */ }
  const userId = typeof body.user_id === 'string' ? body.user_id : null;

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  let query = db.from('notifications').update({ read: true }).eq('read', false);
  if (userId) query = query.or(`user_id.eq.${userId},user_id.is.null`);

  const { error } = await query;
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
