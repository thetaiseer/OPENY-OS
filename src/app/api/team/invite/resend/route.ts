/**
 * POST /api/team/invite/resend
 *
 * Resends a team invitation email, regenerating the token and resetting expiry.
 *
 * Body: { team_member_id: string }
 * Auth: owner or admin only
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { randomBytes } from 'crypto';
import { requireRole } from '@/lib/api-auth';
import { logEmailSent } from '@/lib/email';
import { sendInviteEmail } from '@/lib/email/sendInviteEmail';

const INVITE_EXPIRY_DAYS = 7;

export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ['owner', 'admin']);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => null);
  const teamMemberId = body?.team_member_id;

  if (!teamMemberId) {
    return NextResponse.json({ error: 'team_member_id is required' }, { status: 400 });
  }
  const inviteBaseUrl = (process.env.NEXT_PUBLIC_APP_URL?.trim() || 'https://openy-os.com').replace(
    /\/$/,
    '',
  );
  if (!process.env.NEXT_PUBLIC_APP_URL?.trim()) {
    console.warn(
      '[team/invite/resend] NEXT_PUBLIC_APP_URL is not set — using default https://openy-os.com for invite links',
    );
  }

  const db = getServiceClient();

  // Find the most recent non-accepted invitation (with team_member join for full_name)
  const { data: invitation, error } = await db
    .from('invitations')
    .select('*')
    .eq('team_member_id', teamMemberId)
    .in('status', ['pending', 'invited', 'expired'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !invitation) {
    return NextResponse.json(
      { error: 'No pending invitation found for this member.' },
      { status: 404 },
    );
  }

  // Resolve full_name and role from the team_member join
  const memberRole =
    (invitation as { access_role?: string | null; role?: string | null }).access_role ??
    invitation.role ??
    '';

  // Generate a fresh token and extend expiry
  const newToken = randomBytes(32).toString('hex');
  const newExpiresAt = new Date(
    Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { error: updateError } = await db
    .from('invitations')
    .update({
      token: newToken,
      status: 'pending',
      expires_at: newExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', invitation.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Also reset team_member status to invited in case it was changed
  await db
    .from('team_members')
    .update({ status: 'invited', updated_at: new Date().toISOString() })
    .eq('id', teamMemberId);

  const inviteUrl = `${inviteBaseUrl}/invite/accept?token=${encodeURIComponent(newToken)}`;

  try {
    await sendInviteEmail({
      to: invitation.email,
      inviteUrl,
      workspaceName: 'OPENY OS',
      role: memberRole,
    });
    await logEmailSent({
      to: invitation.email,
      subject: "You're invited to join OPENY OS",
      eventType: 'team_invite_resend',
      entityType: 'invitation',
      entityId: invitation.id,
      status: 'sent',
    });
  } catch (emailErr) {
    const errMsg = emailErr instanceof Error ? emailErr.message : String(emailErr);
    console.error('[team/invite/resend] Resend invitation email failed', {
      to: invitation.email,
      invitationId: invitation.id,
      error: errMsg,
      inviteUrl,
    });
    await logEmailSent({
      to: invitation.email,
      subject: "You're invited to join OPENY OS",
      eventType: 'team_invite_resend',
      entityType: 'invitation',
      entityId: invitation.id,
      status: 'failed',
      error: errMsg,
    });
    return NextResponse.json(
      { error: `Failed to send invitation email: ${errMsg}` },
      { status: 502 },
    );
  }

  return NextResponse.json({ success: true, emailSent: true });
}
