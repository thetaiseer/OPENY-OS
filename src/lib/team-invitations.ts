import { createServerClient } from '@supabase/ssr';
import type { NextRequest } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { INVITATION_STATUS, MEMBER_STATUS } from '@/lib/invitation-status';
import { mapAccessRoleToWorkspaceRole, normalizeWorkspaceKey, WORKSPACE_ROLES, type WorkspaceKey } from '@/lib/workspace-access';
import { upsertWorkspaceMembershipsWithFallback } from '@/lib/workspace-membership-upsert';
import { notifyMemberJoined } from '@/lib/notification-service';

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
  const { data, error } = await db
    .from('team_invitations')
    .select('id, token, email, role, status, expires_at, team_member_id, workspace_access, workspace_roles, team_member:team_members(full_name)')
    .eq('token', token)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[invitations] DB query error while fetching invitation by token:', error.message);
    return null;
  }

  if (!data) return null;
  return data as ResolvedInvitation;
}

export function validateInvitationState(
  invitation: ResolvedInvitation | null,
): { valid: true; invitation: ResolvedInvitation } | { valid: false; reason: InvitationValidationReason } {
  if (!invitation) return { valid: false, reason: 'not_found' };

  const expiresAtMs = new Date(invitation.expires_at).getTime();
  const nowMs = Date.now();
  const hasValidExpiry = !Number.isNaN(expiresAtMs);
  // Strict validity contract: invitation is valid only when expires_at > now.
  // Therefore expires_at === now is treated as expired.
  const isExpired = hasValidExpiry && expiresAtMs <= nowMs;
  const isPending = ACTIVE_INVITATION_STATUSES.includes(invitation.status as (typeof ACTIVE_INVITATION_STATUSES)[number]);

  console.log('[invitations] Expiration check result:', {
    invitationId: invitation.id,
    status: invitation.status,
    expires_at: invitation.expires_at,
    isExpired,
    isPending,
  });

  if (!hasValidExpiry) return { valid: false, reason: 'not_found' };
  if (isExpired) return { valid: false, reason: 'expired' };
  if (!isPending) return { valid: false, reason: 'used' };
  return { valid: true, invitation };
}

type WorkspaceGrant = { workspace: WorkspaceKey; role: 'owner' | 'admin' | 'member' | 'viewer' };

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
    .map(v => normalizeWorkspaceKey(v))
    .filter((v): v is WorkspaceKey => Boolean(v));

  if (keys.length === 0) return [DEFAULT_WORKSPACE_KEY];
  return [...new Set(keys)];
}

function parseWorkspaceRoles(raw: unknown): Record<string, string> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, string>;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, string>;
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

  return access.map(workspace => {
    const requestedRole = (roles[workspace] ?? '').toLowerCase();
    const role = (requestedRole && WORKSPACE_ROLES.includes(requestedRole as (typeof WORKSPACE_ROLES)[number]))
      ? requestedRole as WorkspaceGrant['role']
      : fallbackRole;
    return { workspace, role };
  });
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
  const { data: { user } } = await supabase.auth.getUser();
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
    const match = users.find(user => (user.email ?? '').toLowerCase() === email);
    if (match?.id) return { id: match.id };

    if (users.length < 200) break;
    page += 1;
  }

  if (page > MAX_USER_SCAN_PAGES) {
    console.warn('[invitations/accept] Reached auth user scan page limit while searching email:', email);
  }

  return null;
}

export async function acceptInvitationToken(request: NextRequest, tokenRaw: string, password?: string, fullName?: string) {
  const token = normalizeInvitationToken(tokenRaw);
  console.log('[invitations/accept] Token received from request:', maskInvitationToken(token));
  if (!token) return { ok: false as const, status: 400, body: { error: 'Invitation token is required' } };

  const invitation = await getInvitationByToken(token);
  console.log('[invitations/accept] DB query result:', invitation ? {
    id: invitation.id,
    email: invitation.email,
    status: invitation.status,
    expires_at: invitation.expires_at,
  } : null);

  const validation = validateInvitationState(invitation);
  if (!validation.valid) {
    return {
      ok: false as const,
      status: validation.reason === 'expired' ? 410 : 404,
      body: {
        error: validation.reason === 'expired' ? 'This invitation has expired' : 'Invalid or already used invitation',
        reason: validation.reason,
      },
    };
  }

  const validInvitation = validation.invitation;
  const db = getServiceClient();
  const invitationEmail = validInvitation.email.toLowerCase();
  const teamMember = Array.isArray(validInvitation.team_member) ? validInvitation.team_member[0] : validInvitation.team_member;
  const profileName = (fullName ?? teamMember?.full_name ?? DEFAULT_PROFILE_NAME).trim();

  const requestUserId = await getRequestUserId(request);
  const existingUser = await findAuthUserByEmail(invitationEmail);
  console.log('[invitations/accept] User lookup result:', {
    invitationEmail,
    requestUserId,
    foundExistingUser: Boolean(existingUser?.id),
  });

  let authUserId = existingUser?.id ?? null;
  let userCreated = false;

  if (!authUserId) {
    if (!password || password.length < 8) {
      return {
        ok: false as const,
        status: 400,
        body: { error: 'Set a password with at least 8 characters to create your account.', reason: 'password_required' },
      };
    }

    const { data: created, error: createError } = await db.auth.admin.createUser({
      email: invitationEmail,
      password,
      email_confirm: true,
      user_metadata: { name: profileName },
    });

    if (createError || !created.user) {
      console.error('[invitations/accept] Failed to create auth user:', createError?.message ?? 'unknown');
      return {
        ok: false as const,
        status: 500,
        body: { error: createError?.message ?? 'Failed to create user account' },
      };
    }
    authUserId = created.user.id;
    userCreated = true;
    console.log('[invitations/accept] Created auth user:', { userId: authUserId, email: invitationEmail });
  } else if (requestUserId && requestUserId !== authUserId) {
    return {
      ok: false as const,
      status: 403,
      body: { error: 'You are signed in as a different account. Sign out and use the invited email.' },
    };
  } else {
    console.log('[invitations/accept] Using existing auth user:', { userId: authUserId, email: invitationEmail });
  }

  if (!authUserId) {
    return { ok: false as const, status: 500, body: { error: 'Unable to resolve invited user account' } };
  }
  const resolvedAuthUserId = authUserId;

  const { error: profileError } = await db
    .from('profiles')
    .upsert({
      id: resolvedAuthUserId,
      email: invitationEmail,
      name: profileName,
      role: 'team_member',
    }, { onConflict: 'id' });

  if (profileError) {
    console.error('[invitations/accept] Failed to upsert profile row:', profileError.message);
    return { ok: false as const, status: 500, body: { error: profileError.message } };
  }

  const { error: memberError } = await db
    .from('team_members')
    .update({
      profile_id: resolvedAuthUserId,
      status: MEMBER_STATUS.ACTIVE,
      updated_at: new Date().toISOString(),
    })
    .eq('id', validInvitation.team_member_id);

  if (memberError) {
    console.error('[invitations/accept] Failed to update team_members row:', memberError.message);
    return { ok: false as const, status: 500, body: { error: memberError.message } };
  }

  const grants = resolveWorkspaceGrants(validInvitation);
  const memberships = grants.map(grant => ({
    user_id: resolvedAuthUserId,
    workspace_key: grant.workspace,
    role: grant.role,
    is_active: true,
    updated_at: new Date().toISOString(),
  }));

  const membershipWrite = await upsertWorkspaceMembershipsWithFallback(db, memberships, 'invitations/accept');
  if (!membershipWrite.ok) {
    console.error('[invitations/accept] Failed to upsert workspace memberships:', membershipWrite.error);
    return { ok: false as const, status: 500, body: { error: membershipWrite.error } };
  }
  console.log('[invitations/accept] Workspace memberships upserted:', {
    count: membershipWrite.upserted,
    usedFallback: membershipWrite.usedFallback,
    workspaces: grants.map(grant => `${grant.workspace}:${grant.role}`),
  });

  const { error: invitationUpdateError } = await db
    .from('team_invitations')
    .update({
      status: INVITATION_STATUS.ACCEPTED,
      accepted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', validInvitation.id)
    .in('status', [...ACTIVE_INVITATION_STATUSES]);

  if (invitationUpdateError) {
    console.error('[invitations/accept] Failed to update invitation status:', invitationUpdateError.message);
    return { ok: false as const, status: 500, body: { error: invitationUpdateError.message } };
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
      console.warn('[invitations/accept] notifyMemberJoined failed:', err instanceof Error ? err.message : String(err));
    }
  })();

  return {
    ok: true as const,
    status: 200,
    body: {
      success: true,
      user_created: userCreated,
      email: invitationEmail,
      workspaces: grants.map(grant => grant.workspace),
      workspace_roles: grants,
    },
  };
}
