/**
 * POST /api/team/invite/[token]/accept
 *
 * Accepts a team invitation:
 *   1. Validates token
 *   2. Creates Supabase auth user with the given password
 *   3. Marks team_member as active (profile_id = new auth user id)
 *   4. Marks invitation as accepted
 *
 * Public route — no auth required.
 *
 * Body: { password: string; displayName?: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { INVITATION_STATUS, MEMBER_STATUS } from '@/lib/invitation-status';
import { mapAccessRoleToWorkspaceRole, normalizeWorkspaceKey, WORKSPACE_ROLES, type WorkspaceKey } from '@/lib/workspace-access';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const password    = (body.password    ?? '').trim();
  const displayName = (body.displayName ?? '').trim();

  if (!password || password.length < 8) {
    return NextResponse.json(
      { error: 'Password must be at least 8 characters.' },
      { status: 400 },
    );
  }

  const db = getServiceClient();

  // ── 1. Validate token ────────────────────────────────────────────────────
  const { data: invitation, error: invErr } = await db
    .from('team_invitations')
    .select('id, email, role, status, expires_at, team_member_id, workspace_access, workspace_roles, team_member:team_members(full_name, role)')
    .eq('token', token)
    .maybeSingle();

  if (invErr || !invitation) {
    return NextResponse.json({ error: 'Invitation not found.' }, { status: 404 });
  }

  // Resolve full_name from the team_member join
  const memberData = Array.isArray(invitation.team_member)
    ? invitation.team_member[0]
    : invitation.team_member;
  const invitationFullName = (memberData as { full_name?: string } | null)?.full_name ?? '';

  if (invitation.status === INVITATION_STATUS.ACCEPTED) {
    return NextResponse.json({ error: 'This invitation has already been accepted.' }, { status: 410 });
  }
  if (invitation.status === INVITATION_STATUS.REVOKED) {
    return NextResponse.json({ error: 'This invitation has been revoked.' }, { status: 410 });
  }
  if (invitation.status === INVITATION_STATUS.EXPIRED || new Date(invitation.expires_at) <= new Date()) {
    await db
      .from('team_invitations')
      .update({ status: INVITATION_STATUS.EXPIRED, updated_at: new Date().toISOString() })
      .eq('id', invitation.id)
      .eq('status', INVITATION_STATUS.INVITED); // only update if still active
    return NextResponse.json({ error: 'This invitation has expired.' }, { status: 410 });
  }

  const finalName = displayName || invitationFullName;

  // ── 2. Create Supabase auth user ─────────────────────────────────────────
  const { data: authData, error: authError } = await db.auth.admin.createUser({
    email:          invitation.email,
    password,
    email_confirm:  true,
    user_metadata:  { name: finalName },
  });

  if (authError || !authData.user) {
    // Ignore unique violation — user already exists (e.g. retry after partial failure)
    if (authError && authError.message?.includes('already')) {
      // Continue — team_member activation below will still succeed
    } else {
      return NextResponse.json(
        { error: authError?.message ?? 'Failed to create user account.' },
        { status: 500 },
      );
    }
  }

  const authUserId = authData?.user?.id ?? null;
  let finalUserId = authUserId;
  if (!finalUserId) {
    const { data: memberProfile } = await db
      .from('team_members')
      .select('profile_id')
      .eq('id', invitation.team_member_id)
      .maybeSingle();
    finalUserId = (memberProfile as { profile_id?: string | null } | null)?.profile_id ?? null;
  }

  // ── 3. Activate team member ──────────────────────────────────────────────
  const updatePayload: Record<string, unknown> = {
    status:     MEMBER_STATUS.ACTIVE,
    updated_at: new Date().toISOString(),
  };
  if (authUserId) updatePayload.profile_id = authUserId;

  await db
    .from('team_members')
    .update(updatePayload)
    .eq('id', invitation.team_member_id);

  // ── 4. Mark invitation accepted ──────────────────────────────────────────
  await db
    .from('team_invitations')
    .update({
      status:      INVITATION_STATUS.ACCEPTED,
      accepted_at: new Date().toISOString(),
      updated_at:  new Date().toISOString(),
    })
    .eq('id', invitation.id);

  // ── 5. Apply workspace memberships from invitation metadata ───────────────
  if (finalUserId) {
    const rawWorkspaceAccess = Array.isArray(invitation.workspace_access) ? invitation.workspace_access : ['os'];
    const workspaceAccess = rawWorkspaceAccess
      .map(v => normalizeWorkspaceKey(v))
      .filter((v): v is WorkspaceKey => Boolean(v));
    const effectiveWorkspaceAccess = workspaceAccess.length > 0 ? workspaceAccess : ['os'];
    const workspaceRolesRaw = invitation.workspace_roles && typeof invitation.workspace_roles === 'object'
      ? invitation.workspace_roles as Record<string, string>
      : {};

    for (const workspace of effectiveWorkspaceAccess) {
      const rawRole = (workspaceRolesRaw[workspace] ?? '').toLowerCase();
      const role = WORKSPACE_ROLES.includes(rawRole as (typeof WORKSPACE_ROLES)[number])
        ? rawRole
        : mapAccessRoleToWorkspaceRole(invitation.role ?? '');

      await db
        .from('workspace_memberships')
        .upsert({
          user_id: finalUserId,
          workspace_key: workspace,
          role,
          is_active: true,
        }, { onConflict: 'user_id,workspace_key' });
    }
  }

  return NextResponse.json({ success: true, email: invitation.email });
}
