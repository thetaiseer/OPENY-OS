/**
 * GET /api/team/invite/[token]
 *
 * Validates an invite token and returns the invitation details.
 * Public route — no auth required.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { INVITATION_STATUS } from '@/lib/invitation-status';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const db = getServiceClient();

  console.log('[team/invite/token] Received token:', token.slice(0, 8) + '...');

  const { data: invitation, error } = await db
    .from('team_invitations')
    .select('id, email, role, status, expires_at, accepted_at, team_member:team_members(full_name, role)')
    .eq('token', token)
    .maybeSingle();

  console.log('[team/invite/token] DB query result:', invitation ? { id: invitation.id, status: invitation.status } : null, 'error:', error?.message ?? null);

  if (error || !invitation) {
    return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
  }

  // Resolve full_name and role from the team_member join
  const memberData = Array.isArray(invitation.team_member)
    ? invitation.team_member[0]
    : invitation.team_member;
  const full_name = (memberData as { full_name?: string } | null)?.full_name ?? '';
  const rawRole   = (memberData as { role?: string } | null)?.role
    // Fallback to invitation.role while `role` still exists on team_invitations
    // for backward compatibility with rows created before the schema migration.
    ?? (invitation as { role?: string }).role ?? '';
  const role = rawRole === 'team_member' ? 'member' : rawRole;

  if (invitation.status === INVITATION_STATUS.REVOKED) {
    return NextResponse.json({ error: 'This invitation has been revoked.' }, { status: 410 });
  }

  if (invitation.status === INVITATION_STATUS.ACCEPTED) {
    return NextResponse.json({ error: 'This invitation has already been accepted.' }, { status: 410 });
  }

  if (invitation.status === INVITATION_STATUS.EXPIRED || new Date(invitation.expires_at) <= new Date()) {
    // Mark as expired in DB if not already
    if (invitation.status === INVITATION_STATUS.INVITED || invitation.status === INVITATION_STATUS.PENDING) {
      await db
        .from('team_invitations')
        .update({ status: INVITATION_STATUS.EXPIRED, updated_at: new Date().toISOString() })
        .eq('id', invitation.id);
    }
    return NextResponse.json({ error: 'This invitation has expired.' }, { status: 410 });
  }

  return NextResponse.json({
    full_name,
    email:      invitation.email,
    role,
    expires_at: invitation.expires_at,
  });
}
