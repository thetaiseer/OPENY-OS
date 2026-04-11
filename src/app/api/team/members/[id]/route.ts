/**
 * PATCH /api/team/members/[id]   — update a team member's details or role
 * DELETE /api/team/members/[id]  — remove a team member
 *
 * Auth rules:
 *  - caller must be owner or admin
 *  - caller cannot change their own role (self-promotion prevention)
 *  - only owner can set permission_role to 'owner' or 'admin'
 *  - admin can only set permission_role to 'member' or 'viewer'
 *  - never trust permission_role from frontend; re-validate server-side
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { getApiUser } from '@/lib/api-auth';
import { canManageMembers, canAssignRole, canChangeRoleOf, isValidPermissionRole } from '@/lib/rbac';
import type { UserRole } from '@/lib/auth-context';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getApiUser(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!canManageMembers(auth.profile.role)) {
    return NextResponse.json({ error: 'Forbidden — owner or admin role required' }, { status: 403 });
  }

  const { id: memberId } = await params;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const db = createServiceClient(url, key);

  // Fetch the target member to check their current role and identity
  const { data: targetMember, error: fetchError } = await db
    .from('team_members')
    .select('id, profile_id, permission_role, full_name')
    .eq('id', memberId)
    .maybeSingle();

  if (fetchError || !targetMember) {
    return NextResponse.json({ error: 'Team member not found' }, { status: 404 });
  }

  // Prevent self-role update
  if (targetMember.profile_id && targetMember.profile_id === auth.profile.id) {
    return NextResponse.json(
      { error: 'You cannot change your own role' },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const updates: Record<string, string | null> = {};

  // Allow updating display fields
  if (typeof body.full_name === 'string') updates.full_name = body.full_name.trim() || null;
  if (typeof body.email === 'string')     updates.email     = body.email.trim()     || null;
  // Note: body.role (job title) is allowed to change freely
  if (typeof body.role === 'string')      updates.role      = body.role.trim()      || null;

  // permission_role requires strict validation
  if (body.permission_role !== undefined) {
    const newRole = String(body.permission_role);

    if (!isValidPermissionRole(newRole)) {
      return NextResponse.json(
        { error: `Invalid permission_role "${newRole}". Must be one of: owner, admin, member, viewer` },
        { status: 400 },
      );
    }

    // Caller must be allowed to change this member's current role
    if (!canChangeRoleOf(auth.profile.role, targetMember.permission_role)) {
      return NextResponse.json(
        { error: 'Forbidden — you cannot change the role of a user with equal or higher privilege' },
        { status: 403 },
      );
    }

    // Caller must be allowed to assign the requested new role
    if (!canAssignRole(auth.profile.role, newRole as UserRole)) {
      return NextResponse.json(
        { error: `Forbidden — your role cannot assign the "${newRole}" permission level` },
        { status: 403 },
      );
    }

    updates.permission_role = newRole;

    // Keep profiles.role in sync when the linked profile exists
    if (targetMember.profile_id) {
      await db
        .from('profiles')
        .update({ role: newRole, updated_at: new Date().toISOString() })
        .eq('id', targetMember.profile_id);
    }
  }

  updates.updated_at = new Date().toISOString();

  const { data: updated, error: updateError } = await db
    .from('team_members')
    .update(updates)
    .eq('id', memberId)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ member: updated });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getApiUser(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!canManageMembers(auth.profile.role)) {
    return NextResponse.json({ error: 'Forbidden — owner or admin role required' }, { status: 403 });
  }

  const { id: memberId } = await params;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const db = createServiceClient(url, key);

  // Fetch target to check if it's the caller themselves
  const { data: targetMember, error: fetchError } = await db
    .from('team_members')
    .select('id, profile_id, permission_role')
    .eq('id', memberId)
    .maybeSingle();

  if (fetchError || !targetMember) {
    return NextResponse.json({ error: 'Team member not found' }, { status: 404 });
  }

  // Prevent self-removal
  if (targetMember.profile_id && targetMember.profile_id === auth.profile.id) {
    return NextResponse.json(
      { error: 'You cannot remove yourself from the team' },
      { status: 403 },
    );
  }

  // Only owner can remove another owner or admin
  if (!canChangeRoleOf(auth.profile.role, targetMember.permission_role)) {
    return NextResponse.json(
      { error: 'Forbidden — you cannot remove a user with equal or higher privilege' },
      { status: 403 },
    );
  }

  const { error: deleteError } = await db
    .from('team_members')
    .delete()
    .eq('id', memberId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
