import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { requireRole } from '@/lib/api-auth';
import { resolveWorkspaceForRequest } from '@/lib/api-workspace';
import { getServiceClient } from '@/lib/supabase/service-client';
import { logEmailSent } from '@/lib/email';
import { sendInviteEmail } from '@/lib/email/sendInviteEmail';

const INVITE_EXPIRY_DAYS = 7;

function normalizeJobTitle(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  const lowered = trimmed.toLowerCase();
  // Guard against placeholder text being sent as a value from UI dropdowns.
  if (
    lowered === 'select role' ||
    lowered === 'select role…' ||
    lowered === 'اختر الدور' ||
    lowered === 'اختر الدور…'
  ) {
    return null;
  }

  return trimmed;
}

function normalizeInviteRole(input: string): 'admin' | 'manager' | 'team' | 'viewer' | null {
  if (input === 'admin' || input === 'manager' || input === 'viewer') return input;
  if (input === 'member' || input === 'team_member' || input === 'team') return 'team';
  return null;
}

export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ['owner', 'admin']);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  // body.name is accepted as a fallback for older clients; prefer body.full_name
  const fullNameRaw =
    typeof body.full_name === 'string'
      ? body.full_name
      : typeof body.fullName === 'string'
        ? body.fullName
        : typeof body.name === 'string'
          ? body.name
          : '';
  const emailRaw = typeof body.email === 'string' ? body.email : '';
  const full_name = fullNameRaw.trim();
  const email = emailRaw.trim().toLowerCase();
  // access_role: the system permission level (admin|manager|team|viewer)
  const access_role_raw = (body.access_role ?? body.accessRole ?? body.role ?? '')
    .trim()
    .toLowerCase();
  const access_role = normalizeInviteRole(access_role_raw);
  // job_title: the human-readable job description (Graphic Designer, etc.)
  const job_title = normalizeJobTitle(body.job_title ?? body.jobTitle);
  if (!full_name || !email || !access_role_raw) {
    return NextResponse.json(
      { error: 'full_name, email, and access_role are required' },
      { status: 400 },
    );
  }

  // Validate access_role strictly.
  // 'owner' is intentionally excluded — ownership cannot be granted via invitation.
  const VALID_ACCESS_ROLES = ['admin', 'manager', 'member', 'team_member', 'viewer'];
  if (!access_role) {
    return NextResponse.json(
      {
        error: `Invalid access role "${access_role_raw}". Must be one of: ${VALID_ACCESS_ROLES.join(', ')}`,
      },
      { status: 400 },
    );
  }

  const INVITE_BASE_URL = (
    process.env.NEXT_PUBLIC_APP_URL?.trim() || 'https://openy-os.com'
  ).replace(/\/$/, '');
  if (!process.env.NEXT_PUBLIC_APP_URL?.trim()) {
    console.warn(
      '[team/invite] NEXT_PUBLIC_APP_URL is not set — using default https://openy-os.com for invite links',
    );
  }

  const db = getServiceClient();
  const workspaceResolution = await resolveWorkspaceForRequest(request, db, auth.profile.id, {
    allowWorkspaceFallbackWithoutMembership: true,
  });
  let workspaceId = workspaceResolution.workspaceId;

  if (!workspaceId) {
    // Backward compatibility: some environments have workspace_members rows
    // but missing/unsynced workspace_memberships rows.
    const { data: memberRow } = await db
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', auth.profile.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    workspaceId = memberRow?.workspace_id ?? null;
  }

  const { data: inviterWorkspaceMember, error: inviterWorkspaceMemberError } = await db
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', auth.profile.id)
    .limit(1)
    .maybeSingle();
  const inviterRole = (inviterWorkspaceMember?.role ?? '').toLowerCase();
  if (inviterWorkspaceMemberError || (inviterRole !== 'owner' && inviterRole !== 'admin')) {
    return NextResponse.json(
      { error: 'Only workspace owners/admins can invite team members.' },
      { status: 403 },
    );
  }

  if (!workspaceId) {
    return NextResponse.json(
      {
        error:
          workspaceResolution.error ??
          'No workspace membership found for inviter. Ask an owner to restore your workspace access.',
      },
      { status: 403 },
    );
  }

  const { data: existingInvite } = await db
    .from('invitations')
    .select('id, status, expires_at')
    .eq('workspace_id', workspaceId)
    .eq('email', email)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const regenerateExistingInvite = Boolean(
    existingInvite && new Date(existingInvite.expires_at) > new Date(),
  );

  // ── 2. Existing auth user handling (invite-only flow) ────────────────────
  const { data: existingAuthUsers } = await db.auth.admin.listUsers();
  const existingUser = existingAuthUsers?.users?.find((u) => u.email?.toLowerCase() === email);

  // Existing auth users are allowed, but users already in a workspace are not.
  if (existingUser?.id) {
    const { data: existingMembership } = await db
      .from('workspace_members')
      .select('id')
      .eq('user_id', existingUser.id)
      .eq('workspace_id', workspaceId)
      .limit(1)
      .maybeSingle();
    if (existingMembership?.id) {
      return NextResponse.json(
        {
          success: false,
          code: 'ALREADY_MEMBER',
          error: 'This email is already a member of this workspace.',
        },
        { status: 409 },
      );
    }
    const { data: wsForMembership } = await db
      .from('workspaces')
      .select('slug')
      .eq('id', workspaceId)
      .maybeSingle();
    const slug = ((wsForMembership?.slug as string | null) ?? '').toLowerCase();
    const membershipWorkspaceKey: 'os' | 'docs' = slug === 'docs' ? 'docs' : 'os';
    void membershipWorkspaceKey;
  }

  // ── 3. Generate secure single-use token ──────────────────────────────────
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const workspaceName = 'OPENY OS';
  const inviteUrl = `${INVITE_BASE_URL}/invite/accept?token=${encodeURIComponent(token)}`;

  if (regenerateExistingInvite && existingInvite) {
    const { error: regenInviteError } = await db
      .from('invitations')
      .update({ token, expires_at: expiresAt, status: 'pending', role: access_role })
      .eq('id', existingInvite.id);
    if (regenInviteError) {
      return NextResponse.json(
        { error: regenInviteError.message ?? 'Failed to regenerate existing invitation' },
        { status: 500 },
      );
    }
    try {
      await sendInviteEmail({
        to: email,
        inviteUrl,
        workspaceName,
        role: access_role,
        inviterName: auth.profile.name,
      });
      return NextResponse.json(
        { success: true, regenerated: true, emailSent: true, emailProvider: 'resend' },
        { status: 200 },
      );
    } catch (emailErr) {
      const errMsg = emailErr instanceof Error ? emailErr.message : String(emailErr);
      console.error('[team/invite] Regenerated invite DB updated but email send failed:', {
        to: email,
        error: errMsg,
        inviteUrl,
      });
      await logEmailSent({
        to: email,
        subject: "You're invited to join OPENY OS",
        eventType: 'team_invite',
        entityType: 'invitation',
        entityId: String(existingInvite.id),
        status: 'failed',
        error: errMsg,
      });
      return NextResponse.json(
        {
          success: true,
          regenerated: true,
          emailSent: false,
          emailSkippedReason: errMsg,
        },
        { status: 200 },
      );
    }
  }

  const { data: member, error: memberError } = await db
    .from('team_members')
    .upsert(
      {
        full_name,
        email,
        role: access_role,
        job_title,
        status: 'invited',
        workspace_id: workspaceId,
      },
      { onConflict: 'workspace_id,email' },
    )
    .select()
    .single();

  if (memberError || !member) {
    console.error('[team/invite] Failed to insert team_members row:', memberError?.message);
    return NextResponse.json(
      { error: memberError?.message ?? 'Failed to create team member' },
      { status: 500 },
    );
  }

  const { data: invitation, error: inviteError } = await db
    .from('invitations')
    .insert({
      workspace_id: workspaceId,
      email,
      role: access_role,
      access_role: access_role,
      token,
      invited_by: auth.profile.id,
      expires_at: expiresAt,
      status: 'pending',
      team_member_id: member.id,
    })
    .select()
    .single();
  if (inviteError || !invitation) {
    return NextResponse.json(
      { error: inviteError?.message ?? 'Failed to create invitation' },
      { status: 500 },
    );
  }

  let emailSent = false;
  let emailErrorMessage: string | null = null;
  try {
    await sendInviteEmail({
      to: email,
      inviteUrl,
      workspaceName,
      role: access_role,
      inviterName: auth.profile.name,
    });
    emailSent = true;
    await logEmailSent({
      to: email,
      subject: "You're invited to join OPENY OS",
      eventType: 'team_invite',
      entityType: 'invitation',
      entityId: String(invitation.id),
      status: 'sent',
    });
  } catch (emailErr) {
    const errMsg = emailErr instanceof Error ? emailErr.message : String(emailErr);
    emailErrorMessage = errMsg;
    console.error('[team/invite] Invitation email send failed — keeping DB invitation rows', {
      to: email,
      invitationId: invitation.id,
      memberId: member.id,
      error: errMsg,
      inviteUrl,
    });
    await logEmailSent({
      to: email,
      subject: "You're invited to join OPENY OS",
      eventType: 'team_invite',
      entityType: 'invitation',
      entityId: String(invitation.id),
      status: 'failed',
      error: errMsg,
    });
  }

  return NextResponse.json(
    {
      member,
      invitation,
      emailSent,
      emailProvider: emailSent ? 'resend' : null,
      emailSkippedReason: emailSent ? null : emailErrorMessage,
    },
    { status: 201 },
  );
}
