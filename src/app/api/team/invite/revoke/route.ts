/**
 * POST /api/team/invite/revoke
 *
 * Revokes a pending team invitation and removes the team member record.
 *
 * Body: { team_member_id: string }
 * Auth: admin or manager only
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { requireRole } from '@/lib/api-auth';
import { INVITATION_STATUS } from '@/lib/invitation-status';

export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ['admin', 'manager']);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => null);
  const teamMemberId = body?.team_member_id;

  if (!teamMemberId) {
    return NextResponse.json({ error: 'team_member_id is required' }, { status: 400 });
  }

  const db = getServiceClient();

  // Mark all active invitations for this member as revoked.
  const { error: revokeError } = await db
    .from('team_invitations')
    .update({ status: INVITATION_STATUS.REVOKED, updated_at: new Date().toISOString() })
    .eq('team_member_id', teamMemberId)
    .in('status', [INVITATION_STATUS.INVITED]);

  if (revokeError) {
    return NextResponse.json({ error: revokeError.message }, { status: 500 });
  }

  // Remove the invited team member record
  const { error: deleteError } = await db
    .from('team_members')
    .delete()
    .eq('id', teamMemberId)
    .eq('status', INVITATION_STATUS.INVITED);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
