/**
 * POST /api/team/invite/resend
 *
 * Resends a team invitation email, regenerating the token and resetting expiry.
 *
 * Body: { team_member_id: string }
 * Auth: admin or manager only
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';
import { requireRole } from '@/lib/api-auth';
import { sendEmail, teamInviteEmail, logEmailSent } from '@/lib/email';

const INVITE_EXPIRY_DAYS = 7;

export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ['admin', 'manager']);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => null);
  const teamMemberId = body?.team_member_id;

  if (!teamMemberId) {
    return NextResponse.json({ error: 'team_member_id is required' }, { status: 400 });
  }

  const url    = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key    = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '');

  if (!url || !key) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const db = createServiceClient(url, key);

  // Find the most recent non-accepted invitation (with team_member join for full_name)
  const { data: invitation, error } = await db
    .from('team_invitations')
    .select('*, team_member:team_members(full_name, role)')
    .eq('team_member_id', teamMemberId)
    .in('status', ['invited', 'expired'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !invitation) {
    return NextResponse.json({ error: 'No pending invitation found for this member.' }, { status: 404 });
  }

  // Resolve full_name and role from the team_member join
  const memberData  = Array.isArray(invitation.team_member)
    ? invitation.team_member[0]
    : invitation.team_member;
  const memberFullName = (memberData as { full_name?: string } | null)?.full_name ?? '';
  const memberRole     = (memberData as { role?: string } | null)?.role
    ?? (invitation as { role?: string }).role ?? '';

  // Generate a fresh token and extend expiry
  const newToken    = randomBytes(32).toString('hex');
  const newExpiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { error: updateError } = await db
    .from('team_invitations')
    .update({
      token:      newToken,
      status:     'invited',
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

  // Send email
  const inviteUrl = `${appUrl}/invite/${newToken}`;
  const html = teamInviteEmail({
    recipientName: memberFullName,
    inviterName:   auth.profile.name,
    workspaceName: 'OPENY OS',
    role:          memberRole,
    inviteUrl,
    expiresInDays: INVITE_EXPIRY_DAYS,
  });

  try {
    await sendEmail({
      to:      invitation.email,
      subject: "You're invited to join OPENY OS",
      html,
    });
    await logEmailSent({
      to:         invitation.email,
      subject:    "You're invited to join OPENY OS",
      eventType:  'team_invite_resend',
      entityType: 'team_invitation',
      entityId:   invitation.id,
      status:     'sent',
    });
  } catch (emailErr) {
    const errMsg = emailErr instanceof Error ? emailErr.message : String(emailErr);
    await logEmailSent({
      to:         invitation.email,
      subject:    "You're invited to join OPENY OS",
      eventType:  'team_invite_resend',
      entityType: 'team_invitation',
      entityId:   invitation.id,
      status:     'failed',
      error:      errMsg,
    });
    return NextResponse.json(
      { error: `Failed to send invitation email: ${errMsg}` },
      { status: 502 },
    );
  }

  return NextResponse.json({ success: true });
}
