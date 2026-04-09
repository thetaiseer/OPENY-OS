/**
 * POST /api/team/invite/[token]/accept
 *
 * Accepts a team invitation:
 *   1. Validates token
 *   2. Creates Supabase auth user with the given password
 *   3. Creates profile record with the assigned role
 *   4. Marks team_member as active
 *   5. Marks invitation as accepted
 *
 * Public route — no auth required.
 *
 * Body: { password: string; displayName?: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { PG_UNIQUE_VIOLATION } from '@/lib/constants/postgres-errors';

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
    .select('id, email, full_name, role, status, expires_at, team_member_id')
    .eq('token', token)
    .maybeSingle();

  if (invErr || !invitation) {
    return NextResponse.json({ error: 'Invitation not found.' }, { status: 404 });
  }

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
      .eq('id', invitation.id);
    return NextResponse.json({ error: 'This invitation has expired.' }, { status: 410 });
  }

  const finalName = displayName || invitation.full_name;

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

  // ── 3. Create profile record ─────────────────────────────────────────────
  // Map invitation role to a UserRole (admin/manager/team/client)
  const roleMap: Record<string, string> = {
    admin:   'admin',
    manager: 'manager',
    team:    'team',
    client:  'client',
  };
  const profileRole = roleMap[invitation.role.toLowerCase()] ?? 'team';

  const { error: profileError } = await db.from('profiles').insert({
    id:    authUserId,
    name:  finalName,
    email: invitation.email,
    role:  profileRole,
  });

  if (profileError && profileError.code !== PG_UNIQUE_VIOLATION) {
    // Roll back auth user creation
    await db.auth.admin.deleteUser(authUserId);
    return NextResponse.json(
      { error: `Failed to create profile: ${profileError.message}` },
      { status: 500 },
    );
  }

  // ── 4. Activate team member ──────────────────────────────────────────────
  await db
    .from('team_members')
    .update({ status: 'active', profile_id: authUserId, updated_at: new Date().toISOString() })
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
