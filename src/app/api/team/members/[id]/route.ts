/**
 * /api/team/members/[id]
 *
 * DELETE — Remove a team member.
 *          Hard rule: the owner (role === 'owner') can NEVER be deleted.
 *
 * Auth: owner or admin only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { requireRole } from '@/lib/api-auth';

const VALID_ROLES = ['owner', 'admin', 'manager', 'team_member', 'viewer', 'client'] as const;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRole(request, ['owner', 'admin']);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Member ID is required' }, { status: 400 });
  }

  const body = await request.json().catch(() => null) as
    | { full_name?: string; email?: string | null; role?: string | null; job_title?: string | null }
    | null;

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const db = getServiceClient();

  const { data: member, error: fetchError } = await db
    .from('team_members')
    .select('id, role')
    .eq('id', id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }
  if (!member) {
    return NextResponse.json({ error: 'Team member not found' }, { status: 404 });
  }

  if (member.role === 'owner' && auth.profile.role !== 'owner') {
    return NextResponse.json({ error: 'Only the owner can edit owner profile data.' }, { status: 403 });
  }

  const nextRole = body.role === null || body.role === undefined ? undefined : String(body.role).trim().toLowerCase();
  if (nextRole !== undefined && nextRole !== '' && !VALID_ROLES.includes(nextRole as (typeof VALID_ROLES)[number])) {
    return NextResponse.json({ error: `Invalid role "${nextRole}"` }, { status: 400 });
  }
  if (nextRole === 'owner' && auth.profile.role !== 'owner') {
    return NextResponse.json({ error: 'Only the owner can assign the owner role.' }, { status: 403 });
  }

  const payload = {
    full_name: body.full_name === undefined ? undefined : String(body.full_name).trim(),
    email: body.email === undefined ? undefined : (body.email ? String(body.email).trim().toLowerCase() : null),
    role: nextRole === undefined ? undefined : (nextRole || null),
    job_title: body.job_title === undefined ? undefined : (body.job_title ? String(body.job_title).trim() : null),
  };

  const { error: updateError } = await db
    .from('team_members')
    .update(payload)
    .eq('id', id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRole(request, ['owner', 'admin']);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Member ID is required' }, { status: 400 });
  }

  const db = getServiceClient();

  // Fetch the member to verify they exist and check their role.
  const { data: member, error: fetchError } = await db
    .from('team_members')
    .select('id, full_name, role')
    .eq('id', id)
    .maybeSingle();

  if (fetchError) {
    console.error('[team/members/delete] Fetch error:', fetchError.message);
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!member) {
    return NextResponse.json({ error: 'Team member not found' }, { status: 404 });
  }

  // Hard protection: owner cannot be deleted under any circumstances.
  if (member.role === 'owner') {
    return NextResponse.json(
      { error: 'The workspace owner cannot be removed from the team.' },
      { status: 403 },
    );
  }

  const { error: deleteError } = await db
    .from('team_members')
    .delete()
    .eq('id', id);

  if (deleteError) {
    console.error('[team/members/delete] Delete error:', deleteError.message);
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
