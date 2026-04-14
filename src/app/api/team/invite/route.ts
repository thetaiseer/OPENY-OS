/**
 * POST /api/team/invite
 *
 * Creates a pending team member + invitation record and sends the invite email.
 *
 * Body: { full_name: string; email: string; access_role: string; job_title?: string }
 * Auth: owner, admin, or manager only
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { randomBytes } from 'crypto';
import { requireRole } from '@/lib/api-auth';
import { sendEmail, teamInviteEmail, logEmailSent } from '@/lib/email';
import { notifyInvitation } from '@/lib/notification-service';

const INVITE_EXPIRY_DAYS = 7;

export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ['owner', 'admin', 'manager']);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  // body.name is accepted as a fallback for older clients; prefer body.full_name
  const full_name   = (body.full_name ?? body.name ?? '').trim();
  const email       = (body.email ?? '').trim().toLowerCase();
  // access_role: the system permission level (admin|manager|team|viewer)
  const access_role = (body.access_role ?? body.role ?? '').trim().toLowerCase();
  // job_title: the human-readable job description (Graphic Designer, etc.)
  const job_title   = (body.job_title ?? '').trim();

  if (!full_name || !email || !access_role) {
    return NextResponse.json({ error: 'full_name, email, and access_role are required' }, { status: 400 });
  }

  // Validate access_role strictly.
  // 'owner' is intentionally excluded — ownership cannot be granted via invitation.
  const VALID_ACCESS_ROLES = ['admin', 'manager', 'team', 'viewer'];
  if (!VALID_ACCESS_ROLES.includes(access_role)) {
    return NextResponse.json(
      { error: `Invalid access role "${access_role}". Must be one of: ${VALID_ACCESS_ROLES.join(', ')}` },
      { status: 400 },
    );
  }

  // Domain used for invite links — prefer NEXT_PUBLIC_APP_URL so the link
  // works in all environments (staging, preview, production).
  const INVITE_DOMAIN = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://openy-os.com').replace(/\/$/, '');

  // Sender address: prefer RESEND_FROM_EMAIL, then INVITE_FROM_EMAIL, then default
  const fromEmail =
    process.env.RESEND_FROM_EMAIL ??
    process.env.INVITE_FROM_EMAIL ??
    'OPENY OS <noreply@openy-os.com>';

  const db = getServiceClient();

  // ── 1. Check for active invite already sent to this email ────────────────
  const { data: existingInvite } = await db
    .from('team_invitations')
    .select('id, status, expires_at')
    .eq('email', email)
    .in('status', ['invited', 'pending'])   // 'pending' kept for backward-compat with older rows
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingInvite && new Date(existingInvite.expires_at) > new Date()) {
    return NextResponse.json(
      { error: 'An active invitation has already been sent to this email address.' },
      { status: 409 },
    );
  }

  // ── 2. Check if an active user already exists with this email ────────────
  const { data: existingAuthUsers } = await db.auth.admin.listUsers();
  const existingUser = existingAuthUsers?.users?.find(
    u => u.email?.toLowerCase() === email,
  );
  if (existingUser) {
    return NextResponse.json(
      { error: 'A user with this email address already exists in the system.' },
      { status: 409 },
    );
  }

  // ── 3. Create team_member record with status='invited' ──────────────────
  const { data: member, error: memberError } = await db
    .from('team_members')
    .insert({ full_name, email, role: access_role, job_title: job_title || null, status: 'invited' })
    .select()
    .single();

  if (memberError || !member) {
    console.error('[team/invite] Failed to insert team_members row:', memberError?.message);
    return NextResponse.json(
      { error: memberError?.message ?? 'Failed to create team member' },
      { status: 500 },
    );
  }

  console.log('[team/invite] Created team_members row:', { id: member.id, email, access_role, status: 'invited' });

  // ── 4. Generate secure single-use token ──────────────────────────────────
  const token     = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();

  console.log('[team/invite] Generated token (prefix):', token.slice(0, 8) + '...', '— expires', expiresAt);

  const { data: invitation, error: inviteError } = await db
    .from('team_invitations')
    .insert({
      team_member_id: member.id,
      email,
      role:       access_role,   // required NOT NULL column
      token,
      status:     'invited',     // must match DB CHECK (invited|accepted|expired|revoked)
      invited_by: auth.profile.id,
      expires_at: expiresAt,
    })
    .select()
    .single();

  if (inviteError || !invitation) {
    console.error('[team/invite] Failed to insert team_invitations row:', inviteError?.message);
    // Roll back the team member if we can't create the invitation
    await db.from('team_members').delete().eq('id', member.id);
    return NextResponse.json(
      { error: inviteError?.message ?? 'Failed to create invitation' },
      { status: 500 },
    );
  }

  console.log('[team/invite] Created team_invitations row:', { id: invitation.id, email, status: 'invited' });

  // ── 5. Send invite email ──────────────────────────────────────────────────
  const inviteUrl = `${INVITE_DOMAIN}/invite?token=${token}`;
  console.log('[team/invite] Invitation URL:', inviteUrl);
  console.log('[team/invite] Sending email via sender:', fromEmail);

  const html = teamInviteEmail({
    recipientName:  full_name,
    inviterName:    auth.profile.name,
    workspaceName:  'OPENY OS',
    role:           access_role,
    inviteUrl,
    expiresInDays:  INVITE_EXPIRY_DAYS,
  });

  try {
    await sendEmail({
      to:      email,
      subject: "You're invited to join OPENY OS",
      html,
      from:    fromEmail,
    });
    console.log('[team/invite] Email sent successfully to:', email);
    await logEmailSent({
      to:         email,
      subject:    "You're invited to join OPENY OS",
      eventType:  'team_invite',
      entityType: 'team_invitation',
      entityId:   invitation.id,
      status:     'sent',
    });
  } catch (emailErr) {
    const errMsg = emailErr instanceof Error ? emailErr.message : String(emailErr);
    console.error('[team/invite] Email send failed:', errMsg);
    await logEmailSent({
      to:         email,
      subject:    "You're invited to join OPENY OS",
      eventType:  'team_invite',
      entityType: 'team_invitation',
      entityId:   invitation.id,
      status:     'failed',
      error:      errMsg,
    });
    // Roll back both records so there's no broken state
    await db.from('team_invitations').delete().eq('id', invitation.id);
    await db.from('team_members').delete().eq('id', member.id);
    return NextResponse.json(
      { error: `Invitation created but email failed to send: ${errMsg}` },
      { status: 502 },
    );
  }

  // Notify team (best-effort — after successful email send)
  void notifyInvitation({
    teamMemberId: member.id,
    inviteeName:  full_name,
    inviterName:  auth.profile.name ?? null,
    role:         access_role,
  });

  return NextResponse.json({ member, invitation: { ...invitation, token: undefined } }, { status: 201 });
}
