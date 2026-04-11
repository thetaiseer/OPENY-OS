/**
 * POST /api/team/invite/revoke
 *
 * Revokes a pending team invitation and removes the team member record.
 *
 * Body: { team_member_id: string }
 * Auth: admin or manager only
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { requireRole } from '@/lib/api-auth';

export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ['admin', 'manager']);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => null);
  const teamMemberId = body?.team_member_id;

  if (!teamMemberId) {
    return NextResponse.json({ error: 'team_member_id is required' }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const db = createServiceClient(url, key);

  // Mark all active invitations for this member as revoked
  const { error: revokeError } = await db
    .from('team_invitations')
    .update({ status: 'revoked', updated_at: new Date().toISOString() })
    .eq('team_member_id', teamMemberId)
    .eq('status', 'pending');

  if (revokeError) {
    return NextResponse.json({ error: revokeError.message }, { status: 500 });
  }

  // Remove the invited team member record
  const { error: deleteError } = await db
    .from('team_members')
    .delete()
    .eq('id', teamMemberId)
    .eq('status', 'invited');

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
