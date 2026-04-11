/**
 * POST /api/team/invite/[token]/accept
 *
 * Accepts a team invitation:
 *   1. Validates token
 *   2. Creates Supabase auth user with the given password
 *   3. Activates team_member row with the assigned permission_role
 *   4. Marks invitation as accepted
 *
 * Public route — no auth required.
 *
 * Body: { password: string; displayName?: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

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

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const db = createServiceClient(url, key);

  // ── 1. Validate token ────────────────────────────────────────────────────
  const { data: invitation, error: invErr } = await db
    .from('team_invitations')
    .select('id, email, role, status, expires_at, team_member_id, team_member:team_members(full_name, role)')
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
  const invitationRole     = (memberData as { role?: string } | null)?.role
    // Fallback to invitation.role while `role` still exists on team_invitations
    // for backward compatibility with rows created before the schema migration.
    ?? (invitation as { role?: string }).role ?? '';

  if (invitation.status === 'accepted') {
    return NextResponse.json({ error: 'This invitation has already been accepted.' }, { status: 410 });
  }
  if (invitation.status === 'revoked') {
    return NextResponse.json({ error: 'This invitation has been revoked.' }, { status: 410 });
  }
  if (invitation.status === 'expired' || new Date(invitation.expires_at) <= new Date()) {
    await db
      .from('team_invitations')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('id', invitation.id)
      .eq('status', 'invited'); // only update if still in invited state
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
    return NextResponse.json(
      { error: authError?.message ?? 'Failed to create user account.' },
      { status: 500 },
    );
  }

  const authUserId = authData.user.id;

  // Resolve permission_role from the linked team_member row.
  const memberDataForRole = Array.isArray(invitation.team_member)
    ? invitation.team_member[0]
    : invitation.team_member;
  const invitationPermissionRole =
    (memberDataForRole as { permission_role?: string } | null)?.permission_role ?? 'member';

  const allowedRoles = ['owner', 'admin', 'member', 'viewer'];
  const permissionRole = allowedRoles.includes(invitationPermissionRole)
    ? invitationPermissionRole
    : 'member';

  // ── 3. Activate team member ──────────────────────────────────────────────
  await db
    .from('team_members')
    .update({
      status:          'active',
      profile_id:      authUserId,
      permission_role: permissionRole,
      updated_at:      new Date().toISOString(),
    })
    .eq('id', invitation.team_member_id);

  // ── 5. Mark invitation accepted ──────────────────────────────────────────
  await db
    .from('team_invitations')
    .update({
      status:      'accepted',
      accepted_at: new Date().toISOString(),
      updated_at:  new Date().toISOString(),
    })
    .eq('id', invitation.id);

  return NextResponse.json({ success: true, email: invitation.email });
}
