import { NextRequest, NextResponse } from 'next/server';
import { getInvitationByToken, normalizeInvitationToken, validateInvitationState } from '@/lib/team-invitations';

export async function GET(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  void request;
  const { token: rawToken } = await context.params;
  const token = normalizeInvitationToken(rawToken);
  const invitation = await getInvitationByToken(token);
  const validation = validateInvitationState(invitation);
  if (!validation.valid) {
    if (validation.reason === 'expired') {
      return NextResponse.json({ error: 'This invitation has expired', reason: 'expired' }, { status: 410 });
    }
    return NextResponse.json({ error: 'Invalid or already used invitation', reason: validation.reason }, { status: 404 });
  }

  const teamMember = Array.isArray(validation.invitation.team_member)
    ? validation.invitation.team_member[0]
    : validation.invitation.team_member;

  return NextResponse.json({
    invitation: {
      id: validation.invitation.id,
      email: validation.invitation.email,
      role: validation.invitation.role,
      status: validation.invitation.status,
      expires_at: validation.invitation.expires_at,
      full_name: teamMember?.full_name ?? '',
    },
  });
}
