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
import { resolveWorkspaceForRequest } from '@/lib/api-workspace';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

  const { error: updateError } = await db.from('team_members').update(payload).eq('id', id);

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
  try {
    const auth = await requireRole(request, ['owner', 'admin']);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Member ID is required' }, { status: 400 });
    }

    const db = getServiceClient();

    const {
      workspaceId,
      workspaceKey,
      error: workspaceError,
    } = await resolveWorkspaceForRequest(request, db, auth.profile.id);
    if (workspaceError) {
      return NextResponse.json({ error: workspaceError }, { status: 500 });
    }
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 500 });
    }

    const byId = await db
      .from('team_members')
      .select('id, full_name, role, profile_id, email')
      .eq('id', id)
      .maybeSingle();

    if (byId.error) {
      return NextResponse.json({ error: byId.error.message }, { status: 500 });
    }

    let member = byId.data;
    if (!member && UUID_RE.test(id)) {
      const byProfile = await db
        .from('team_members')
        .select('id, full_name, role, profile_id, email')
        .eq('profile_id', id)
        .maybeSingle();
      if (byProfile.error) {
        return NextResponse.json({ error: byProfile.error.message }, { status: 500 });
      }
      member = byProfile.data;
    }

    if (!member) {
      return NextResponse.json({ error: 'Team member not found' }, { status: 404 });
    }

    const memberId = member.id as string;
    if (member.profile_id && workspaceKey) {
      const membership = await db
        .from('workspace_memberships')
        .select('user_id')
        .eq('user_id', member.profile_id)
        .eq('workspace_key', workspaceKey)
        .eq('is_active', true)
        .maybeSingle();
      if (membership.error) {
        return NextResponse.json({ error: membership.error.message }, { status: 500 });
      }
      if (!membership.data) {
        return NextResponse.json(
          { error: 'Team member not found in this workspace' },
          { status: 404 },
        );
      }
    }

    if (member.role === 'owner') {
      return NextResponse.json(
        { error: 'The workspace owner cannot be removed from the team.' },
        { status: 403 },
      );
    }

    const { data: workspaceRow } = await db
      .from('workspaces')
      .select('owner_id')
      .eq('id', workspaceId)
      .maybeSingle();
    const ownerId = (workspaceRow as { owner_id?: string | null } | null)?.owner_id ?? null;
    if (ownerId && member.profile_id && ownerId === member.profile_id) {
      return NextResponse.json(
        { error: 'The workspace owner cannot be removed from the team.' },
        { status: 403 },
      );
    }

    let workspaceUserId = (member.profile_id as string | null) ?? null;
    if (!workspaceUserId && UUID_RE.test(id)) workspaceUserId = id;
    if (!workspaceUserId && member.email) {
      const emailLower = String(member.email).toLowerCase();
      const { data: profile } = await db
        .from('profiles')
        .select('id')
        .eq('email', emailLower)
        .maybeSingle();
      workspaceUserId = (profile as { id?: string } | null)?.id ?? null;
    }

    let workspaceMemberRow: { id: string; user_id: string } | null = null;
    if (workspaceUserId) {
      const lookup = await db
        .from('workspace_members')
        .select('id, user_id')
        .eq('workspace_id', workspaceId)
        .eq('user_id', workspaceUserId)
        .maybeSingle();
      if (lookup.error) {
        return NextResponse.json({ error: lookup.error.message }, { status: 500 });
      }
      workspaceMemberRow = (lookup.data as { id: string; user_id: string } | null) ?? null;
      if (workspaceMemberRow) {
        const { error: wmError } = await db
          .from('workspace_members')
          .delete()
          .eq('workspace_id', workspaceId)
          .eq('user_id', workspaceUserId);
        if (wmError) {
          return NextResponse.json(
            { error: `Could not remove workspace membership: ${wmError.message}` },
            { status: 500 },
          );
        }
      }
    }

    const { error: deleteError } = await db.from('team_members').delete().eq('id', memberId);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    void processEvent({
      event_type: EVENT.MEMBER_REMOVED,
      actor_id: auth.profile.id,
      entity_type: 'team_member',
      entity_id: memberId,
      payload: {
        memberName: member.full_name,
        actorName: auth.profile.name,
      },
    });

    return NextResponse.json({
      success: true,
      deleted: {
        team_member_id: memberId,
        workspace_id: workspaceId,
        user_id: workspaceUserId,
        workspace_member_existed: Boolean(workspaceMemberRow),
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : 'Unexpected server error while deleting team member',
      },
      { status: 500 },
    );
  }
}
