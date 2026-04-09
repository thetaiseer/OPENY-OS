/**
 * POST /api/team/invite
 *
 * Creates a pending team member + invitation record and sends the invite email.
 *
 * Body: { name: string; email: string; role: string }
 * Auth: admin or manager only
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';
import { requireRole } from '@/lib/api-auth';
import { sendEmail, teamInviteEmail, logEmailSent } from '@/lib/email';
import { notifyInvitation } from '@/lib/notification-service';

const INVITE_EXPIRY_DAYS = 7;

export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ['admin', 'manager']);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  // body.name is accepted as a fallback for older clients; prefer body.full_name
  const full_name = (body.full_name ?? body.name ?? '').trim();
  const email = (body.email ?? '').trim().toLowerCase();
  const role  = (body.role  ?? '').trim();

  if (!full_name || !email || !role) {
    return NextResponse.json({ error: 'full_name, email, and role are required' }, { status: 400 });
  }

  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '');

  if (!url || !key) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const db = createServiceClient(url, key);

  // ── 1. Check for active invite already sent to this email ────────────────
  const { data: existingInvite } = await db
    .from('team_invitations')
    .select('id, status, expires_at')
    .eq('email', email)
    .in('status', ['invited'])
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
    .insert({ full_name, email, role, status: 'invited' })
    .select()
    .single();

  if (memberError || !member) {
    return NextResponse.json(
      { error: memberError?.message ?? 'Failed to create team member' },
      { status: 500 },
    );
  }

  // ── 4. Generate secure single-use token ──────────────────────────────────
  const token     = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: invitation, error: inviteError } = await db
    .from('team_invitations')
    .insert({
      team_member_id: member.id,
      email,
      full_name,
      role,
      token,
      status: 'invited',
      invited_by: auth.profile.id,
      expires_at: expiresAt,
    })
    .select()
    .single();

  if (inviteError || !invitation) {
    // Roll back the team member if we can't create the invitation
    await db.from('team_members').delete().eq('id', member.id);
    return NextResponse.json(
      { error: inviteError?.message ?? 'Failed to create invitation' },
      { status: 500 },
    );
  }

  // ── 5. Send invite email ──────────────────────────────────────────────────
  const inviteUrl = `${appUrl}/invite/${token}`;
  const html = teamInviteEmail({
    recipientName:  full_name,
    inviterName:    auth.profile.name,
    workspaceName:  'OPENY OS',
    role,
    inviteUrl,
    expiresInDays:  INVITE_EXPIRY_DAYS,
  });

  try {
    await sendEmail({
      to:      email,
      subject: "You're invited to join OPENY OS",
      html,
    });
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
    role,
  });

  return NextResponse.json({ member, invitation: { ...invitation, token: undefined } }, { status: 201 });
}
