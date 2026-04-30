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
      return NextResponse.json({ success: false, error: 'Member ID is required' }, { status: 400 });
    }

    const db = getServiceClient();

    const {
      workspaceId,
      workspaceKey,
      error: workspaceError,
    } = await resolveWorkspaceForRequest(request, db, auth.profile.id, {
      allowWorkspaceFallbackWithoutMembership: true,
    });
    if (workspaceError) {
      return NextResponse.json({ success: false, error: workspaceError }, { status: 403 });
    }
    if (!workspaceId) {
      return NextResponse.json({ success: false, error: 'Workspace not found' }, { status: 403 });
    }
    const membershipCheck = await db
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('user_id', auth.profile.id)
      .maybeSingle();
    const membershipFound = Boolean(membershipCheck.data?.id);
    // eslint-disable-next-line no-console
    console.info('[debug-delete] route=/api/team/members/[id] step=authorized', {
      recordId: id,
      workspaceId,
      requesterUserId: auth.profile.id,
      membershipFound,
    });

    let workspaceMemberRow: { id: string; user_id: string; role: string | null } | null = null;

    // Preferred: path id is workspace_members.id (membershipId).
    const membershipById = await db
      .from('workspace_members')
      .select('id, user_id, role')
      .eq('workspace_id', workspaceId)
      .eq('id', id)
      .maybeSingle();
    if (membershipById.error) {
      return NextResponse.json(
        { success: false, error: membershipById.error.message },
        { status: 500 },
      );
    }
    workspaceMemberRow =
      (membershipById.data as { id: string; user_id: string; role: string | null } | null) ?? null;

    // Backward compatibility: if caller still sends userId/profileId/teamMemberId, resolve membership.
    if (!workspaceMemberRow && UUID_RE.test(id)) {
      const membershipByUser = await db
        .from('workspace_members')
        .select('id, user_id, role')
        .eq('workspace_id', workspaceId)
        .eq('user_id', id)
        .maybeSingle();
      if (membershipByUser.error) {
        return NextResponse.json(
          { success: false, error: membershipByUser.error.message },
          { status: 500 },
        );
      }
      workspaceMemberRow =
        (membershipByUser.data as { id: string; user_id: string; role: string | null } | null) ??
        null;
    }

    if (!workspaceMemberRow) {
      const memberByTeamId = await db
        .from('team_members')
        .select('profile_id')
        .eq('id', id)
        .maybeSingle();
      if (memberByTeamId.error) {
        return NextResponse.json(
          { success: false, error: memberByTeamId.error.message },
          { status: 500 },
        );
      }
      const profileId =
        (memberByTeamId.data as { profile_id?: string | null } | null)?.profile_id ?? null;
      if (profileId) {
        const membershipByProfile = await db
          .from('workspace_members')
          .select('id, user_id, role')
          .eq('workspace_id', workspaceId)
          .eq('user_id', profileId)
          .maybeSingle();
        if (membershipByProfile.error) {
          return NextResponse.json(
            { success: false, error: membershipByProfile.error.message },
            { status: 500 },
          );
        }
        workspaceMemberRow =
          (membershipByProfile.data as {
            id: string;
            user_id: string;
            role: string | null;
          } | null) ?? null;
      }
    }

    if (!workspaceMemberRow) {
      return NextResponse.json({ success: false, error: 'Member not found' }, { status: 404 });
    }

    const membershipId = workspaceMemberRow.id;
    const userId = workspaceMemberRow.user_id;
    const membershipRole = (workspaceMemberRow.role ?? '').toLowerCase();

    const { data: workspaceRow, error: workspaceRowError } = await db
      .from('workspaces')
      .select('owner_id')
      .eq('id', workspaceId)
      .maybeSingle();
    if (workspaceRowError) {
      return NextResponse.json(
        { success: false, error: workspaceRowError.message },
        { status: 500 },
      );
    }
    const ownerId = (workspaceRow as { owner_id?: string | null } | null)?.owner_id ?? null;

    const { count: ownerCount, error: ownerCountError } = await db
      .from('workspace_members')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('role', 'owner');
    if (ownerCountError) {
      return NextResponse.json({ success: false, error: ownerCountError.message }, { status: 500 });
    }

    const isOwnerMembership =
      membershipRole === 'owner' || (ownerId !== null && ownerId === userId);
    if (isOwnerMembership && (ownerCount ?? 0) <= 1) {
      return NextResponse.json(
        { success: false, error: 'Cannot remove the last owner' },
        { status: 403 },
      );
    }
    if (auth.profile.id === userId && isOwnerMembership && (ownerCount ?? 0) <= 1) {
      return NextResponse.json(
        { success: false, error: 'Cannot remove yourself as the last owner' },
        { status: 403 },
      );
    }

    // eslint-disable-next-line no-console
    console.info('[team/members/delete] removing membership', {
      workspaceId,
      membershipId,
      requesterRole: auth.profile.role,
      requesterId: auth.profile.id,
    });

    const { error: wmDeleteError } = await db
      .from('workspace_members')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('id', membershipId);
    if (wmDeleteError) {
      return NextResponse.json({ success: false, error: wmDeleteError.message }, { status: 500 });
    }
    // eslint-disable-next-line no-console
    console.info('[debug-delete] route=/api/team/members/[id] step=deleted', {
      recordId: membershipId,
      workspaceId,
      requesterUserId: auth.profile.id,
      membershipFound,
      deleteResult: 'success',
    });

    if (workspaceKey) {
      const { error: legacyMembershipDeleteError } = await db
        .from('workspace_memberships')
        .delete()
        .eq('workspace_key', workspaceKey)
        .eq('user_id', userId);
      if (legacyMembershipDeleteError) {
        console.warn('[team/members/delete] failed to remove workspace_memberships row', {
          workspaceId,
          userId,
          error: legacyMembershipDeleteError.message,
        });
      }
    }

    const { data: memberRecord } = await db
      .from('team_members')
      .select('id, full_name')
      .eq('profile_id', userId)
      .maybeSingle();
    const memberId = (memberRecord as { id?: string } | null)?.id ?? membershipId;
    const memberName =
      (memberRecord as { full_name?: string | null } | null)?.full_name ?? 'Team member';

    void processEvent({
      event_type: EVENT.MEMBER_REMOVED,
      actor_id: auth.profile.id,
      entity_type: 'team_member',
      entity_id: memberId,
      payload: {
        memberName,
        actorName: auth.profile.name,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error:
          err instanceof Error ? err.message : 'Unexpected server error while deleting team member',
      },
      { status: 500 },
    );
  }
}
