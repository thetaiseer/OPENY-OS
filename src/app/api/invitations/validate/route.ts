import { NextRequest, NextResponse } from 'next/server';
import { getInvitationByToken, maskInvitationToken, normalizeInvitationToken, validateInvitationState } from '@/lib/team-invitations';

export async function GET(request: NextRequest) {
  const token = normalizeInvitationToken(request.nextUrl.searchParams.get('token'));

  if (!token) {
    return NextResponse.json(
      { valid: false, reason: 'not_found', error: 'Invalid or already used invitation' },
      { status: 400 },
    );
  }

  const invitation = await getInvitationByToken(token);
  const validation = validateInvitationState(invitation);
  if (!validation.valid) {
    if (validation.reason === 'expired') {
      return NextResponse.json(
        { valid: false, reason: 'expired', error: 'This invitation has expired' },
        { status: 410 },
      );
    }

    return NextResponse.json(
      { valid: false, reason: validation.reason, error: 'Invalid or already used invitation' },
      { status: 404 },
    );
  }

  const teamMember = Array.isArray(validation.invitation.team_member)
    ? validation.invitation.team_member[0]
    : validation.invitation.team_member;

  return NextResponse.json({
    valid: true,
    invitation: {
      id: validation.invitation.id,
      email: validation.invitation.email,
      role: validation.invitation.role,
      expires_at: validation.invitation.expires_at,
      full_name: teamMember?.full_name ?? '',
    },
  });
}
