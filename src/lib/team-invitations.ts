import { createServerClient } from '@supabase/ssr';
import type { NextRequest } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { INVITATION_STATUS, MEMBER_STATUS } from '@/lib/invitation-status';
import {
  mapAccessRoleToWorkspaceRole,
  normalizeWorkspaceKey,
  WORKSPACE_ROLES,
  type WorkspaceKey,
} from '@/lib/workspace-access';
import {
  upsertWorkspaceMembershipsWithFallback,
  type WorkspaceMembershipUpsertPayload,
} from '@/lib/workspace-membership-upsert';
import { notifyMemberJoined } from '@/lib/notification-service';
import { processEvent } from '@/lib/event-engine';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const ACTIVE_INVITATION_STATUSES = [INVITATION_STATUS.PENDING, INVITATION_STATUS.INVITED] as const;
const DEFAULT_WORKSPACE_KEY: WorkspaceKey = 'os';
const MAX_USER_SCAN_PAGES = 50;
const DEFAULT_PROFILE_NAME = 'Team Member';

export type InvitationValidationReason = 'expired' | 'not_found' | 'used';

export type ResolvedInvitation = {
  id: string;
  token: string;
  email: string;
  role: string | null;
  status: string;
  expires_at: string;
  team_member_id: string;
  workspace_access?: unknown;
  workspace_roles?: unknown;
  team_member?: { full_name?: string | null } | Array<{ full_name?: string | null }> | null;
};

type InvitationBaseRow = {
  id: string;
  token: string;
  email: string;
  status: string;
  expires_at: string;
  team_member_id: string;
};

type InvitationDetailRow = {
  role?: string | null;
  access_role?: string | null;
  workspace_access?: unknown;
  workspace_roles?: unknown;
};

export function normalizeInvitationToken(raw: string | null | undefined): string {
  if (!raw) return '';
  try {
    return decodeURIComponent(raw).trim();
  } catch {
    return raw.trim();
  }
}

export function maskInvitationToken(token: string): string {
  if (!token) return '';
  if (token.length <= 8) return `${token.slice(0, 2)}...${token.slice(-2)}`;
  return `${token.slice(0, 6)}...${token.slice(-4)}`;
}

export async function getInvitationByToken(token: string): Promise<ResolvedInvitation | null> {
  const db = getServiceClient();
  const { data: baseRow, error: baseError } = await db
    .from('team_invitations')
    .select('id, token, email, status, expires_at, team_member_id')
    .eq('token', token)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (baseError) {
    console.error(
      '[invitations] DB query error while fetching invitation by token:',
      baseError.message,
    );
    return null;
  }

  if (!baseRow) return null;

  const detailSelectVariants = [
    'role, workspace_access, workspace_roles',
    'role',
    'access_role, workspace_access, workspace_roles',
    'access_role',
  ];

  let detail: InvitationDetailRow = {};
  for (const selectClause of detailSelectVariants) {
    const { data, error } = await db
      .from('team_invitations')
      .select(selectClause)
      .eq('id', baseRow.id)
      .maybeSingle();

    if (!error && data) {
      detail = data as InvitationDetailRow;
      break;
    }
  }

  const memberSelectVariants = ['full_name', 'name'];

  let teamMember: { full_name?: string | null } | null = null;
  for (const selectClause of memberSelectVariants) {
    const { data, error } = await db
      .from('team_members')
      .select(selectClause)
      .eq('id', baseRow.team_member_id)
      .maybeSingle();

    if (!error && data) {
      const nameValue =
        (data as { full_name?: string | null; name?: string | null }).full_name ??
        (data as { full_name?: string | null; name?: string | null }).name ??
        null;
      teamMember = { full_name: nameValue };
      break;
    }
  }

  return {
    ...(baseRow as InvitationBaseRow),
    role: detail.role ?? detail.access_role ?? null,
    workspace_access: detail.workspace_access ?? null,
    workspace_roles: detail.workspace_roles ?? null,
    team_member: teamMember,
  } satisfies ResolvedInvitation;
}

export function validateInvitationState(
  invitation: ResolvedInvitation | null,
):
  | { valid: true; invitation: ResolvedInvitation }
  | { valid: false; reason: InvitationValidationReason } {
  if (!invitation) return { valid: false, reason: 'not_found' };

  const expiresAtMs = new Date(invitation.expires_at).getTime();
  const nowMs = Date.now();
  const hasValidExpiry = !Number.isNaN(expiresAtMs);
  // Strict validity contract: invitation is valid only when expires_at > now.
  // Therefore expires_at === now is treated as expired.
  const isExpired = hasValidExpiry && expiresAtMs <= nowMs;
  const isPending = ACTIVE_INVITATION_STATUSES.includes(
    invitation.status as (typeof ACTIVE_INVITATION_STATUSES)[number],
  );

  if (!hasValidExpiry) return { valid: false, reason: 'not_found' };
  if (isExpired) return { valid: false, reason: 'expired' };
  if (!isPending) return { valid: false, reason: 'used' };
  return { valid: true, invitation };
}

type WorkspaceGrant = { workspace: WorkspaceKey; role: 'owner' | 'admin' | 'member' | 'viewer' };
type WorkspaceMemberInsertRow = {
  workspace_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
};
type WorkspaceRow = { id: string; slug: string | null; name: string | null };

function normalizeWorkspaceMemberRole(role: string): 'owner' | 'admin' | 'member' {
  if (role === 'owner') return 'owner';
  if (role === 'admin') return 'admin';
  return 'member';
}

function parseWorkspaceAccess(raw: unknown): WorkspaceKey[] {
  const values = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
      ? (() => {
          try {
            const parsed = JSON.parse(raw) as unknown;
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        })()
      : [];

  const keys = values
    .map((v) => normalizeWorkspaceKey(v))
    .filter((v): v is WorkspaceKey => Boolean(v));

  if (keys.length === 0) return [DEFAULT_WORKSPACE_KEY];
  return [...new Set(keys)];
}

function parseWorkspaceRoles(raw: unknown): Record<string, string> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, string>;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed))
        return parsed as Record<string, string>;
    } catch {
      return {};
    }
  }
  return {};
}

function resolveWorkspaceGrants(invitation: ResolvedInvitation): WorkspaceGrant[] {
  const access = parseWorkspaceAccess(invitation.workspace_access);
  const roles = parseWorkspaceRoles(invitation.workspace_roles);
  const fallbackRole = mapAccessRoleToWorkspaceRole((invitation.role ?? '').toLowerCase());

  return access.map((workspace) => {
    const requestedRole = (roles[workspace] ?? '').toLowerCase();
    const role =
      requestedRole && WORKSPACE_ROLES.includes(requestedRole as (typeof WORKSPACE_ROLES)[number])
        ? (requestedRole as WorkspaceGrant['role'])
        : fallbackRole;
    return { workspace, role };
  });
}

function resolveWorkspaceKeyFromName(name: string | null | undefined): WorkspaceKey | null {
  if (!name) return null;
  const normalized = name.trim().toLowerCase();
  if (normalized === 'os' || normalized === 'openy os') return 'os';
  if (normalized === 'docs' || normalized === 'openy docs') return 'docs';
  return null;
}

function resolveWorkspaceIdByKey(
  workspaces: WorkspaceRow[],
  workspaceKey: WorkspaceKey,
): string | null {
  const slugMatch = workspaces.find(
    (workspace) => normalizeWorkspaceKey(workspace.slug) === workspaceKey,
  );
  if (slugMatch?.id) return slugMatch.id;

  const nameMatch = workspaces.find(
    (workspace) => resolveWorkspaceKeyFromName(workspace.name) === workspaceKey,
  );
  if (nameMatch?.id) return nameMatch.id;

  if (workspaces.length === 1) return workspaces[0].id;
  return null;
}

function workspaceMemberRoleRank(role: WorkspaceMemberInsertRow['role']): number {
  if (role === 'owner') return 3;
  if (role === 'admin') return 2;
  return 1;
}

function toLegacyWorkspaceMemberRole(
  role: WorkspaceMemberInsertRow['role'],
): 'admin' | 'manager' | 'team_member' {
  if (role === 'owner') return 'admin';
  if (role === 'admin') return 'admin';
  return 'team_member';
}

function shouldRetryWorkspaceMemberInsertWithLegacyRoles(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('workspace_members_role_check') || lower.includes('violates check constraint')
  );
}

function shouldRetryWorkspaceMemberInsertWithoutStatus(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes('status') && (lower.includes('column') || lower.includes('schema cache'));
}

async function upsertWorkspaceMembersAsActive(
  db: ReturnType<typeof getServiceClient>,
  members: WorkspaceMemberInsertRow[],
): Promise<string | null> {
  type WorkspaceMemberUpsertRow = {
    workspace_id: string;
    user_id: string;
    role: string;
    status?: string;
    updated_at?: string;
  };

  const activePayload = members.map((member) => ({
    ...member,
    status: MEMBER_STATUS.ACTIVE,
    updated_at: new Date().toISOString(),
  })) satisfies WorkspaceMemberUpsertRow[];

  const tryUpsert = async (rows: WorkspaceMemberUpsertRow[]) =>
    db.from('workspace_members').upsert(rows, { onConflict: 'workspace_id,user_id' });

  let { error } = await tryUpsert(activePayload);
  if (!error) return null;

  if (shouldRetryWorkspaceMemberInsertWithoutStatus(error.message)) {
    ({ error } = await tryUpsert(members));
    if (!error) return null;
  }

  if (shouldRetryWorkspaceMemberInsertWithLegacyRoles(error.message)) {
    const legacyActivePayload = activePayload.map((member) => ({
      ...member,
      role: toLegacyWorkspaceMemberRole(member.role),
    }));
    ({ error } = await tryUpsert(legacyActivePayload));
    if (!error) return null;

    if (shouldRetryWorkspaceMemberInsertWithoutStatus(error.message)) {
      const legacyMembers = members.map((member) => ({
        ...member,
        role: toLegacyWorkspaceMemberRole(member.role),
      }));
      ({ error } = await tryUpsert(legacyMembers));
      if (!error) return null;
    }
  }

  return error.message;
}

async function getRequestUserId(request: NextRequest): Promise<string | null> {
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll() {},
    },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

async function findAuthUserByEmail(email: string): Promise<{ id: string } | null> {
  const db = getServiceClient();
  let page = 1;

  while (page <= MAX_USER_SCAN_PAGES) {
    const { data: usersPage, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) {
      console.error('[invitations/accept] Failed to list auth users:', error.message);
      return null;
    }

    const users = usersPage.users ?? [];
    const match = users.find((user) => (user.email ?? '').toLowerCase() === email);
    if (match?.id) return { id: match.id };

    if (users.length < 200) break;
    page += 1;
  }

  if (page > MAX_USER_SCAN_PAGES) {
    console.warn(
      '[invitations/accept] Reached auth user scan page limit while searching email:',
      email,
    );
  }

  return null;
}

export async function acceptInvitationToken(
  request: NextRequest,
  tokenRaw: string,
  password?: string,
  fullName?: string,
) {
  const token = normalizeInvitationToken(tokenRaw);
  if (!token)
    return { ok: false as const, status: 400, body: { error: 'Invitation token is required' } };

  const invitation = await getInvitationByToken(token);
  const validation = validateInvitationState(invitation);
  if (!validation.valid) {
    return {
      ok: false as const,
      status: validation.reason === 'expired' ? 410 : 404,
      body: {
        error:
          validation.reason === 'expired'
            ? 'This invitation has expired'
            : 'Invalid or already used invitation',
        reason: validation.reason,
      },
    };
  }

  const validInvitation = validation.invitation;
  const db = getServiceClient();
  const invitationEmail = validInvitation.email.toLowerCase();
  const teamMember = Array.isArray(validInvitation.team_member)
    ? validInvitation.team_member[0]
    : validInvitation.team_member;
  const profileName = (fullName ?? teamMember?.full_name ?? DEFAULT_PROFILE_NAME).trim();

  const requestUserId = await getRequestUserId(request);
  const existingUser = await findAuthUserByEmail(invitationEmail);
  let authUserId = existingUser?.id ?? null;
  let userCreated = false;

  if (!authUserId) {
    if (!password || password.length < 8) {
      return {
        ok: false as const,
        status: 400,
        body: {
          error: 'Set a password with at least 8 characters to create your account.',
          reason: 'password_required',
        },
      };
    }

    const { data: created, error: createError } = await db.auth.admin.createUser({
      email: invitationEmail,
      password,
      email_confirm: true,
      user_metadata: { name: profileName },
    });

    if (createError || !created.user) {
      console.error(
        '[invitations/accept] Failed to create auth user:',
        createError?.message ?? 'unknown',
      );
      return {
        ok: false as const,
        status: 500,
        body: { error: createError?.message ?? 'Failed to create user account' },
      };
    }
    authUserId = created.user.id;
    userCreated = true;
  } else if (requestUserId && requestUserId !== authUserId) {
    return {
      ok: false as const,
      status: 403,
      body: {
        error: 'You are signed in as a different account. Sign out and use the invited email.',
      },
    };
  }

  if (!authUserId) {
    return {
      ok: false as const,
      status: 500,
      body: { error: 'Unable to resolve invited user account' },
    };
  }
  const resolvedAuthUserId = authUserId;

  const { error: profileError } = await db.from('profiles').upsert(
    {
      id: resolvedAuthUserId,
      email: invitationEmail,
      name: profileName,
      role: 'team_member',
    },
    { onConflict: 'id' },
  );

  if (profileError) {
    console.error('[invitations/accept] Failed to upsert profile row:', profileError.message);
    return { ok: false as const, status: 500, body: { error: profileError.message } };
  }

  const grants = resolveWorkspaceGrants(validInvitation);
  const workspaceKeys = [...new Set(grants.map((grant) => grant.workspace))];
  const { data: workspaceRows, error: workspaceRowsError } = await db
    .from('workspaces')
    .select('id, slug, name');

  if (workspaceRowsError) {
    console.error(
      '[invitations/accept] Failed to resolve workspace ids:',
      workspaceRowsError.message,
    );
    return { ok: false as const, status: 500, body: { error: workspaceRowsError.message } };
  }

  const workspaceIdByKey = new Map<WorkspaceKey, string>();
  for (const workspaceKey of workspaceKeys) {
    const workspaceId = resolveWorkspaceIdByKey(
      (workspaceRows ?? []) as WorkspaceRow[],
      workspaceKey,
    );
    if (workspaceId) workspaceIdByKey.set(workspaceKey, workspaceId);
  }

  const rawMembersToInsert = grants
    .map((grant) => {
      const workspaceId = workspaceIdByKey.get(grant.workspace);
      if (!workspaceId) return null;
      return {
        workspace_id: workspaceId,
        user_id: resolvedAuthUserId,
        role: normalizeWorkspaceMemberRole(grant.role),
      };
    })
    .filter((row): row is WorkspaceMemberInsertRow => Boolean(row));

  const membersByWorkspaceId = new Map<string, WorkspaceMemberInsertRow>();
  for (const row of rawMembersToInsert) {
    const existing = membersByWorkspaceId.get(row.workspace_id);
    if (!existing || workspaceMemberRoleRank(row.role) > workspaceMemberRoleRank(existing.role)) {
      membersByWorkspaceId.set(row.workspace_id, row);
    }
  }
  const membersToInsert = [...membersByWorkspaceId.values()];

  if (membersToInsert.length === 0) {
    console.error(
      '[invitations/accept] No target workspace_members rows could be resolved from invitation grants:',
      grants,
    );
    return {
      ok: false as const,
      status: 500,
      body: { error: 'Invitation workspace keys did not resolve to existing workspaces.' },
    };
  }

  const workspaceMemberInsertError = await upsertWorkspaceMembersAsActive(db, membersToInsert);
  if (workspaceMemberInsertError) {
    console.error(
      '[invitations/accept] Failed to insert workspace_members rows:',
      workspaceMemberInsertError,
    );
    return { ok: false as const, status: 500, body: { error: workspaceMemberInsertError } };
  }

  const membershipRowsByKey = new Map<WorkspaceKey, WorkspaceMembershipUpsertPayload>();
  for (const grant of grants) {
    const existing = membershipRowsByKey.get(grant.workspace);
    if (
      !existing ||
      workspaceMemberRoleRank(normalizeWorkspaceMemberRole(grant.role)) >
        workspaceMemberRoleRank(normalizeWorkspaceMemberRole(existing.role))
    ) {
      membershipRowsByKey.set(grant.workspace, {
        user_id: resolvedAuthUserId,
        workspace_key: grant.workspace,
        role: grant.role,
        is_active: true,
      });
    }
  }
  const membershipWriteResult = await upsertWorkspaceMembershipsWithFallback(
    db,
    [...membershipRowsByKey.values()],
    'invitations/accept',
  );
  if (!membershipWriteResult.ok) {
    const message = membershipWriteResult.error;
    if (/relation .*workspace_memberships.* does not exist/i.test(message)) {
      console.warn(
        '[invitations/accept] workspace_memberships table missing, skipped sync:',
        message,
      );
    } else {
      console.error('[invitations/accept] Failed to upsert workspace_memberships rows:', message);
      return { ok: false as const, status: 500, body: { error: message } };
    }
  }

  const acceptedAt = new Date().toISOString();
  let invitationWriteError: { message: string } | null = null;

  const acceptedWrite = await db
    .from('team_invitations')
    .update({
      status: INVITATION_STATUS.ACCEPTED,
      accepted_at: acceptedAt,
      updated_at: acceptedAt,
    })
    .eq('id', validInvitation.id);
  invitationWriteError = acceptedWrite.error;

  if (invitationWriteError && invitationWriteError.message.toLowerCase().includes('accepted_at')) {
    const fallbackAcceptedWrite = await db
      .from('team_invitations')
      .update({
        status: INVITATION_STATUS.ACCEPTED,
        updated_at: acceptedAt,
      })
      .eq('id', validInvitation.id);
    invitationWriteError = fallbackAcceptedWrite.error;
  }

  if (invitationWriteError) {
    console.error(
      '[invitations/accept] Failed to mark invitation as accepted:',
      invitationWriteError.message,
    );
    return { ok: false as const, status: 500, body: { error: invitationWriteError.message } };
  }

  const nowIso = new Date().toISOString();
  const memberUpdateVariants: Array<Record<string, unknown>> = [
    {
      status: MEMBER_STATUS.ACTIVE,
      profile_id: resolvedAuthUserId,
      full_name: profileName,
      email: invitationEmail,
      updated_at: nowIso,
    },
    {
      status: MEMBER_STATUS.ACTIVE,
      profile_id: resolvedAuthUserId,
      email: invitationEmail,
      updated_at: nowIso,
    },
    {
      status: MEMBER_STATUS.ACTIVE,
      full_name: profileName,
      email: invitationEmail,
      updated_at: nowIso,
    },
    {
      status: MEMBER_STATUS.ACTIVE,
      email: invitationEmail,
      updated_at: nowIso,
    },
    {
      status: MEMBER_STATUS.ACTIVE,
      updated_at: nowIso,
    },
  ];

  let memberUpdateError: { message: string } | null = null;
  for (const payload of memberUpdateVariants) {
    const { error } = await db
      .from('team_members')
      .update(payload)
      .eq('id', validInvitation.team_member_id);
    if (!error) {
      memberUpdateError = null;
      break;
    }
    memberUpdateError = error;
  }

  if (memberUpdateError) {
    console.error(
      '[invitations/accept] Failed to activate team member record:',
      memberUpdateError.message,
    );
    return { ok: false as const, status: 500, body: { error: memberUpdateError.message } };
  }

  void (async () => {
    try {
      const { data: admins } = await db
        .from('team_members')
        .select('profile_id')
        .eq('role', 'admin');
      const adminUserIds = (admins ?? [])
        .map((m: { profile_id?: string | null }) => m.profile_id)
        .filter((v): v is string => Boolean(v));
      if (adminUserIds.length === 0) return;
      await notifyMemberJoined({
        joinedUserId: resolvedAuthUserId,
        joinedName: profileName,
        adminUserIds,
      });
    } catch (err) {
      console.warn(
        '[invitations/accept] notifyMemberJoined failed:',
        err instanceof Error ? err.message : String(err),
      );
    }
  })();

  void processEvent({
    event_type: 'invite.accepted',
    actor_id: resolvedAuthUserId,
    entity_type: 'team_invitation',
    entity_id: validInvitation.id,
    payload: {
      inviteeName: profileName,
      email: invitationEmail,
    },
  });

  return {
    ok: true as const,
    status: 200,
    body: {
      success: true,
      user_created: userCreated,
      email: invitationEmail,
      workspaces: grants.map((grant) => grant.workspace),
      workspace_roles: grants,
    },
  };
}
