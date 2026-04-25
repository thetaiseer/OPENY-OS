/**
 * /api/team/members/[id]
 *
 * PATCH  — Update a team member's profile fields (name, email, role, job_title).
 * DELETE — Remove a team member.
 *          Hard rule: the owner (role === 'owner') can NEVER be deleted.
 *
 * Both routes emit activity events for audit logging.
 *
 * Auth: owner or admin only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { requireRole } from '@/lib/api-auth';
import { processEvent } from '@/lib/event-engine';
import { EVENT } from '@/lib/workspace-events';

const VALID_ROLES = ['owner', 'admin', 'manager', 'team_member', 'viewer', 'client'] as const;
type ValidRole = (typeof VALID_ROLES)[number];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeRole(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  return String(value).trim().toLowerCase();
}

function isValidRole(value: string): value is ValidRole {
  return VALID_ROLES.includes(value as ValidRole);
}

function normalizeEmail(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  return String(value).trim().toLowerCase();
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(request, ['owner', 'admin']);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Member ID is required' }, { status: 400 });
  }

  const bodyRaw = await request.json().catch(() => null);
  if (!bodyRaw || typeof bodyRaw !== 'object' || Array.isArray(bodyRaw)) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const body = bodyRaw as Record<string, unknown>;

  const db = getServiceClient();

  const { data: member, error: fetchError } = await db
    .from('workspace_members')
    .select('id, role')
    .eq('id', id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }
  if (!member) {
    return NextResponse.json({ error: 'Team member not found' }, { status: 404 });
  }

  const nextRole = normalizeRole(body.role);
  if (nextRole !== undefined && nextRole !== '' && !isValidRole(nextRole)) {
    return NextResponse.json({ error: `Invalid role "${nextRole}"` }, { status: 400 });
  }
  if (member.role === 'owner' && auth.profile.role !== 'owner') {
    return NextResponse.json(
      { error: 'Only the owner can edit owner profile data.' },
      { status: 403 },
    );
  }
  if (nextRole === 'owner' && auth.profile.role !== 'owner') {
    return NextResponse.json(
      { error: 'Only the owner can assign the owner role.' },
      { status: 403 },
    );
  }

  const nextFullName = body.full_name === undefined ? undefined : String(body.full_name).trim();
  if (nextFullName !== undefined && nextFullName.length === 0) {
    return NextResponse.json({ error: 'Full name cannot be empty' }, { status: 400 });
  }

  const nextEmail = normalizeEmail(body.email);
  if (typeof nextEmail === 'string' && !EMAIL_PATTERN.test(nextEmail)) {
    return NextResponse.json(
      { error: 'Invalid email format. Example: name@company.com' },
      { status: 400 },
    );
  }

  const payloadRaw = {
    full_name: nextFullName,
    email: nextEmail,
    role: nextRole === undefined ? undefined : nextRole === '' ? null : nextRole,
    job_title:
      body.job_title === undefined
        ? undefined
        : body.job_title
          ? String(body.job_title).trim()
          : null,
  };
  const payload = Object.fromEntries(
    Object.entries(payloadRaw).filter(([, value]) => value !== undefined),
  );

  const { error: updateError } = await db.from('workspace_members').update(payload).eq('id', id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Emit activity event for role changes
  if (payload.role && payload.role !== member.role) {
    void processEvent({
      event_type: EVENT.ROLE_CHANGED,
      actor_id: auth.profile.id,
      entity_type: 'team_member',
      entity_id: id,
      payload: {
        memberName: payload.full_name ?? String(member.id),
        oldRole: member.role,
        newRole: payload.role,
        actorName: auth.profile.name,
      },
    });
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
    .from('workspace_members')
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

  const { error: deleteError } = await db.from('workspace_members').delete().eq('id', id);

  if (deleteError) {
    console.error('[team/members/delete] Delete error:', deleteError.message);
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  // Emit activity event for audit log
  void processEvent({
    event_type: EVENT.MEMBER_REMOVED,
    actor_id: auth.profile.id,
    entity_type: 'team_member',
    entity_id: id,
    payload: {
      memberName: member.full_name,
      actorName: auth.profile.name,
    },
  });

  return NextResponse.json({ success: true });
}
