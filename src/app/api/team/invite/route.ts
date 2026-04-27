/**
 * POST /api/team/invite
 *
 * Creates a pending team member + invitation record and sends the invite email.
 *
 * Body: { full_name: string; email: string; access_role: string; job_title?: string }
 * Auth: owner or admin only
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { randomBytes } from 'crypto';
import { requireRole } from '@/lib/api-auth';
import { logEmailSent } from '@/lib/email';
import { sendInviteEmail } from '@/lib/email/sendInviteEmail';
import { notifyInvitation } from '@/lib/notification-service';
import { INVITATION_STATUS, MEMBER_STATUS } from '@/lib/invitation-status';
import { processEvent } from '@/lib/event-engine';
import {
  mapAccessRoleToWorkspaceRole,
  normalizeWorkspaceKey,
  WORKSPACE_ROLES,
  type WorkspaceKey,
} from '@/lib/workspace-access';

const INVITE_EXPIRY_DAYS = 7;
const ACTIVE_INVITATION_STATUSES = [INVITATION_STATUS.PENDING, INVITATION_STATUS.INVITED] as const;

type InsertResult = {
  invitation: Record<string, unknown> | null;
  errorMessage: string | null;
  attemptedErrors: string[];
};

async function insertInvitationWithFallback(
  db: ReturnType<typeof getServiceClient>,
  payload: {
    team_member_id: string;
    email: string;
    role: string;
    token: string;
    invited_by: string;
    expires_at: string;
    full_name: string;
    workspace_access: WorkspaceKey[];
    workspace_roles: Record<WorkspaceKey, string>;
  },
): Promise<InsertResult> {
  const nowIso = new Date().toISOString();
  const commonPayload = {
    team_member_id: payload.team_member_id,
    email: payload.email,
    token: payload.token,
    invited_by: payload.invited_by,
    expires_at: payload.expires_at,
    created_at: nowIso,
  };

  // Schema-compatibility fallbacks:
  // - Some DBs still use `name`, others `full_name`, and some have neither on invitations.
  // - Some DBs support `workspace_access`/`workspace_roles`, older ones do not.
  // - Some DBs use `pending`, older constraints still allow only `invited`.
  // - A few legacy deployments used `access_role` instead of `role`.
  const variants: Array<Record<string, unknown>> = [
    {
      ...commonPayload,
      full_name: payload.full_name,
      role: payload.role,
      status: INVITATION_STATUS.PENDING,
      workspace_access: payload.workspace_access,
      workspace_roles: payload.workspace_roles,
    },
    {
      ...commonPayload,
      name: payload.full_name,
      role: payload.role,
      status: INVITATION_STATUS.PENDING,
      workspace_access: payload.workspace_access,
      workspace_roles: payload.workspace_roles,
    },
    {
      ...commonPayload,
      role: payload.role,
      status: INVITATION_STATUS.PENDING,
      workspace_access: payload.workspace_access,
      workspace_roles: payload.workspace_roles,
    },
    {
      ...commonPayload,
      role: payload.role,
      status: INVITATION_STATUS.PENDING,
    },
    {
      ...commonPayload,
      role: payload.role,
      status: INVITATION_STATUS.INVITED,
      workspace_access: payload.workspace_access,
      workspace_roles: payload.workspace_roles,
    },
    {
      ...commonPayload,
      role: payload.role,
      status: INVITATION_STATUS.INVITED,
    },
    {
      ...commonPayload,
      access_role: payload.role,
      status: INVITATION_STATUS.PENDING,
      workspace_access: payload.workspace_access,
      workspace_roles: payload.workspace_roles,
    },
    {
      ...commonPayload,
      access_role: payload.role,
      status: INVITATION_STATUS.INVITED,
    },
  ];

  const errors: string[] = [];
  for (const candidate of variants) {
    const { data: invitation, error } = await db
      .from('team_invitations')
      .insert(candidate)
      .select()
      .single();

    if (!error && invitation?.id) {
      return {
        invitation: invitation as Record<string, unknown>,
        errorMessage: null,
        attemptedErrors: [],
      };
    }

    const message =
      error?.message ??
      (!invitation
        ? 'Insert succeeded but no row was returned.'
        : 'Unknown invitation insert error.');
    errors.push(message);
    console.error('[team/invite] team_invitations insert attempt failed:', {
      message,
      code: error?.code ?? null,
      details: error?.details ?? null,
      hint: error?.hint ?? null,
      columns: Object.keys(candidate),
    });
  }

  return {
    invitation: null,
    errorMessage: errors[errors.length - 1] ?? 'Failed to create invitation',
    attemptedErrors: errors,
  };
}

export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ['owner', 'admin']);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  // body.name is accepted as a fallback for older clients; prefer body.full_name
  const full_name = (body.full_name ?? body.name ?? '').trim();
  const email = (body.email ?? '').trim().toLowerCase();
  // access_role: the system permission level (admin|manager|team|viewer)
  const access_role = (body.access_role ?? body.role ?? '').trim().toLowerCase();
  // job_title: the human-readable job description (Graphic Designer, etc.)
  const job_title = (body.job_title ?? '').trim();
  const requestedWorkspaceAccess = Array.isArray(body.workspace_access)
    ? body.workspace_access
    : ['os'];
  const requestedWorkspaceRoles =
    body.workspace_roles && typeof body.workspace_roles === 'object'
      ? (body.workspace_roles as Record<string, string>)
      : {};

  if (!full_name || !email || !access_role) {
    return NextResponse.json(
      { error: 'full_name, email, and access_role are required' },
      { status: 400 },
    );
  }

  // Validate access_role strictly.
  // 'owner' is intentionally excluded — ownership cannot be granted via invitation.
  const VALID_ACCESS_ROLES = ['admin', 'manager', 'team_member', 'viewer'];
  if (!VALID_ACCESS_ROLES.includes(access_role)) {
    return NextResponse.json(
      {
        error: `Invalid access role "${access_role}". Must be one of: ${VALID_ACCESS_ROLES.join(', ')}`,
      },
      { status: 400 },
    );
  }

  const workspace_access: WorkspaceKey[] = requestedWorkspaceAccess
    .map((v: unknown) => normalizeWorkspaceKey(v))
    .filter((v: WorkspaceKey | null): v is WorkspaceKey => Boolean(v));
  const effectiveWorkspaceAccess: WorkspaceKey[] =
    workspace_access.length > 0 ? workspace_access : ['os'];

  const workspace_roles: Record<WorkspaceKey, string> = {
    os: mapAccessRoleToWorkspaceRole(access_role),
    docs: mapAccessRoleToWorkspaceRole(access_role),
  };
  for (const key of effectiveWorkspaceAccess) {
    const requestedRole = (requestedWorkspaceRoles[key] ?? '').toLowerCase();
    if (
      requestedRole &&
      WORKSPACE_ROLES.includes(requestedRole as (typeof WORKSPACE_ROLES)[number])
    ) {
      workspace_roles[key] = requestedRole;
    }
  }

  // Invite link base: env first, then production default (https://openy-os.com/invite?token=…)
  const INVITE_BASE_URL = (
    process.env.NEXT_PUBLIC_APP_URL?.trim() || 'https://openy-os.com'
  ).replace(/\/$/, '');
  if (!process.env.NEXT_PUBLIC_APP_URL?.trim()) {
    console.warn(
      '[team/invite] NEXT_PUBLIC_APP_URL is not set — using default https://openy-os.com for invite links',
    );
  }

  const db = getServiceClient();
  const { data: inviterMembership } = await db
    .from('workspace_memberships')
    .select('workspace_id')
    .eq('user_id', auth.profile.id)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  const workspaceId = inviterMembership?.workspace_id ?? null;
  if (!workspaceId) {
    return NextResponse.json(
      { error: 'No workspace membership found for inviter.' },
      { status: 403 },
    );
  }

  // ── 1. Check for active invite already sent to this email ────────────────
  const { data: existingInvite } = await db
    .from('team_invitations')
    .select('id, status, expires_at')
    .eq('email', email)
    .in('status', [...ACTIVE_INVITATION_STATUSES])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingInvite && new Date(existingInvite.expires_at) > new Date()) {
    return NextResponse.json(
      { error: 'An active invitation has already been sent to this email address.' },
      { status: 409 },
    );
  }

  const { data: existingWorkspaceInvite } = await db
    .from('workspace_invitations')
    .select('id, status, expires_at')
    .eq('workspace_id', workspaceId)
    .eq('email', email)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingWorkspaceInvite && new Date(existingWorkspaceInvite.expires_at) > new Date()) {
    return NextResponse.json(
      { error: 'An active invitation has already been sent to this email address.' },
      { status: 409 },
    );
  }

  // ── 2. Existing auth user handling (invite-only flow) ────────────────────
  const { data: existingAuthUsers } = await db.auth.admin.listUsers();
  const existingUser = existingAuthUsers?.users?.find((u) => u.email?.toLowerCase() === email);

  // Existing auth users are allowed, but users already in a workspace are not.
  if (existingUser?.id) {
    const { data: existingMembership } = await db
      .from('workspace_memberships')
      .select('id')
      .eq('user_id', existingUser.id)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
    if (existingMembership?.id) {
      return NextResponse.json(
        { error: 'This email already belongs to a workspace member.' },
        { status: 409 },
      );
    }
  }

  // ── 3. Create team_member record with status='invited' ──────────────────
  const { data: member, error: memberError } = await db
    .from('team_members')
    .insert({
      full_name,
      email,
      role: access_role,
      job_title: job_title || null,
      status: MEMBER_STATUS.INVITED,
    })
    .select()
    .single();

  if (memberError || !member) {
    console.error('[team/invite] Failed to insert team_members row:', memberError?.message);
    return NextResponse.json(
      { error: memberError?.message ?? 'Failed to create team member' },
      { status: 500 },
    );
  }

  // ── 4. Generate secure single-use token ──────────────────────────────────
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const {
    invitation,
    errorMessage: inviteInsertError,
    attemptedErrors,
  } = await insertInvitationWithFallback(db, {
    team_member_id: member.id,
    email,
    role: access_role,
    token,
    invited_by: auth.profile.id,
    expires_at: expiresAt,
    full_name,
    workspace_access: effectiveWorkspaceAccess,
    workspace_roles,
  });

  if (!invitation) {
    console.error('[team/invite] Failed to insert team_invitations row:', inviteInsertError);
    // Roll back the team member if we can't create the invitation
    await db.from('team_members').delete().eq('id', member.id);
    return NextResponse.json(
      {
        error: inviteInsertError ?? 'Failed to create invitation',
        dbError: inviteInsertError ?? null,
        attemptedErrors,
      },
      { status: 500 },
    );
  }

  const workspaceInvitePayload = {
    workspace_id: workspaceId,
    email,
    role: access_role === 'viewer' ? 'team_member' : access_role,
    token,
    status: 'pending',
    invited_by: auth.profile.id,
    expires_at: expiresAt,
  };
  const { error: workspaceInviteInsertError } = await db
    .from('workspace_invitations')
    .insert(workspaceInvitePayload);
  if (workspaceInviteInsertError) {
    console.error(
      '[team/invite] Failed to insert workspace_invitations row:',
      workspaceInviteInsertError.message,
    );
    await db.from('team_invitations').delete().eq('id', String(invitation.id));
    await db.from('team_members').delete().eq('id', member.id);
    return NextResponse.json(
      { error: workspaceInviteInsertError.message ?? 'Failed to create workspace invitation' },
      { status: 500 },
    );
  }

  // ── 5. Send invite email (Resend SDK) ─────────────────────────────────────
  const inviteUrl = `${INVITE_BASE_URL}/invite/${encodeURIComponent(token)}`;
  const workspaceName =
    effectiveWorkspaceAccess.length === 2
      ? 'OPENY PLATFORM'
      : `OPENY ${effectiveWorkspaceAccess[0].toUpperCase()}`;

  try {
    await sendInviteEmail({
      to: email,
      inviteUrl,
      workspaceName,
      role: access_role,
      recipientName: full_name,
      inviterName: auth.profile.name,
    });

    await logEmailSent({
      to: email,
      subject: "You're invited to OPENY",
      eventType: 'team_invite',
      entityType: 'team_invitation',
      entityId: String(invitation.id),
      status: 'sent',
    });
  } catch (emailErr) {
    const errMsg = emailErr instanceof Error ? emailErr.message : String(emailErr);
    console.error('[team/invite] Invitation email send failed (rolled back invitation)', {
      to: email,
      invitationId: invitation.id,
      error: errMsg,
      inviteUrl,
    });
    await logEmailSent({
      to: email,
      subject: "You're invited to OPENY",
      eventType: 'team_invite',
      entityType: 'team_invitation',
      entityId: String(invitation.id),
      status: 'failed',
      error: errMsg,
    });
    // Roll back both records so there's no broken state
    await db.from('workspace_invitations').delete().eq('token', token);
    await db.from('team_invitations').delete().eq('id', String(invitation.id));
    await db.from('team_members').delete().eq('id', member.id);
    return NextResponse.json(
      { error: `Invitation created but email failed to send: ${errMsg}` },
      { status: 502 },
    );
  }

  // Notify team (best-effort — after successful email send)
  void processEvent({
    event_type: 'invite.sent',
    actor_id: auth.profile.id,
    entity_type: 'team_invitation',
    entity_id: String(invitation.id),
    payload: {
      inviteeName: full_name,
      role: access_role,
    },
  });

  void (async () => {
    try {
      const { data: inviteeProfile } = await db
        .from('profiles')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      await notifyInvitation({
        teamMemberId: member.id,
        inviteeName: full_name,
        inviterName: auth.profile.name ?? null,
        role: access_role,
        inviteeUserId: inviteeProfile?.id ?? null,
      });
    } catch (err) {
      console.warn(
        '[team/invite] notifyInvitation failed:',
        err instanceof Error ? err.message : String(err),
      );
    }
  })();

  return NextResponse.json(
    {
      member,
      invitation,
      emailSent: true,
      emailProvider: 'resend',
    },
    { status: 201 },
  );
}
