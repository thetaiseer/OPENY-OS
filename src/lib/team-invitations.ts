import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import type { NextRequest } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { normalizeWorkspaceKey } from '@/lib/workspace-access';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const ACTIVE_STATUSES = ['pending', 'invited'] as const;

export type InvitationValidationReason = 'expired' | 'not_found' | 'used';

export type ResolvedInvitation = {
  id: string;
  token: string;
  email: string;
  role: string | null;
  status: string;
  expires_at: string;
  team_member_id: string;
  workspace_id: string;
  job_title?: string | null;
  team_member?: { full_name?: string | null } | null;
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

export async function getInvitationByToken(tokenRaw: string): Promise<ResolvedInvitation | null> {
  const token = normalizeInvitationToken(tokenRaw);
  if (!token) return null;
  const db = getServiceClient();

  const { data: invitation, error } = await db
    .from('invitations')
    .select('id, token, email, role, access_role, status, expires_at, team_member_id, workspace_id')
    .eq('token', token)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !invitation) return null;

  // Fetch team member info separately — team_member_id is stored as text with no FK,
  // so a PostgREST join would fail at the API layer.
  let teamMember: { full_name: string | null; job_title: string | null } | null = null;
  if (invitation.team_member_id) {
    const { data: tm } = await db
      .from('team_members')
      .select('full_name, job_title')
      .eq('id', invitation.team_member_id)
      .maybeSingle();
    teamMember = tm;
  }

  return {
    id: invitation.id,
    token: invitation.token,
    email: invitation.email,
    role: invitation.access_role ?? invitation.role ?? null,
    status: invitation.status,
    expires_at: invitation.expires_at,
    team_member_id: invitation.team_member_id ?? '',
    workspace_id: invitation.workspace_id,
    job_title: teamMember?.job_title ?? null,
    team_member: { full_name: teamMember?.full_name ?? null },
  };
}

export function validateInvitationState(
  invitation: ResolvedInvitation | null,
):
  | { valid: true; invitation: ResolvedInvitation }
  | { valid: false; reason: InvitationValidationReason } {
  if (!invitation) return { valid: false, reason: 'not_found' };
  const expiresAt = new Date(invitation.expires_at).getTime();
  if (!Number.isFinite(expiresAt)) return { valid: false, reason: 'not_found' };
  if (expiresAt <= Date.now()) return { valid: false, reason: 'expired' };
  if (!ACTIVE_STATUSES.includes(invitation.status as (typeof ACTIVE_STATUSES)[number])) {
    return { valid: false, reason: 'used' };
  }
  return { valid: true, invitation };
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
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

async function findAuthUserByEmail(email: string): Promise<{ id: string } | null> {
  const db = getServiceClient();
  const { data, error } = await db.auth.admin.listUsers();
  if (error) return null;
  const user = (data.users ?? []).find((u) => (u.email ?? '').toLowerCase() === email);
  return user?.id ? { id: user.id } : null;
}

function toWorkspaceMemberRole(role: string | null | undefined): 'owner' | 'admin' | 'team' {
  const normalized = (role ?? '').toLowerCase();
  if (normalized === 'owner') return 'owner';
  if (normalized === 'admin') return 'admin';
  return 'team';
}

function toWorkspaceMembershipRole(role: string | null | undefined): 'owner' | 'admin' | 'member' {
  const normalized = (role ?? '').toLowerCase();
  if (normalized === 'owner') return 'owner';
  if (normalized === 'admin') return 'admin';
  return 'member';
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
      },
    };
  }

  const validInvitation = validation.invitation;
  const db = getServiceClient();
  const invitationEmail = validInvitation.email.toLowerCase();
  const profileName = (fullName ?? validInvitation.team_member?.full_name ?? 'Team Member').trim();

  const requestUserId = await getRequestUserId(request);
  const existingUser = await findAuthUserByEmail(invitationEmail);
  let authUserId = existingUser?.id ?? null;
  let userCreated = false;

  if (!authUserId) {
    if (!password || password.length < 8) {
      return {
        ok: false as const,
        status: 400,
        body: { error: 'Password must be at least 8 characters.' },
      };
    }
    const { data: created, error: createError } = await db.auth.admin.createUser({
      email: invitationEmail,
      password,
      email_confirm: true,
      user_metadata: { name: profileName },
    });
    if (createError || !created.user) {
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
  } else if (!requestUserId) {
    if (!password || password.length < 8) {
      return {
        ok: false as const,
        status: 400,
        body: { error: 'Password is required for existing users.' },
      };
    }
    const anonClient = createClient(supabaseUrl, supabaseAnonKey);
    const { error: signInError } = await anonClient.auth.signInWithPassword({
      email: invitationEmail,
      password,
    });
    if (signInError) {
      return {
        ok: false as const,
        status: 401,
        body: { error: 'Invalid credentials for invited email.' },
      };
    }
  }

  const userId = authUserId as string;

  await db.from('profiles').upsert(
    {
      id: userId,
      email: invitationEmail,
      name: profileName,
      full_name: profileName,
      role: 'team',
    },
    { onConflict: 'id' },
  );

  // Resolve workspace_key ('os' | 'docs') so the middleware can find the membership
  const { data: workspaceRow } = await db
    .from('workspaces')
    .select('slug, name')
    .eq('id', validInvitation.workspace_id)
    .maybeSingle();
  const rawSlug = (workspaceRow as { slug?: string | null } | null)?.slug ?? null;
  const rawName = (workspaceRow as { name?: string | null } | null)?.name ?? null;
  const workspaceKey =
    normalizeWorkspaceKey(rawSlug) ??
    normalizeWorkspaceKey(rawName) ??
    normalizeWorkspaceKey(rawName?.toLowerCase().replace(/^openy\s+/, '')) ??
    'os';

  const memberRole = toWorkspaceMemberRole(validInvitation.role);
  const { error: workspaceMemberError } = await db.from('workspace_members').upsert(
    {
      workspace_id: validInvitation.workspace_id,
      user_id: userId,
      role: memberRole,
      status: 'active',
      email: invitationEmail,
      full_name: profileName,
      job_title: validInvitation.job_title ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'workspace_id,user_id' },
  );
  if (workspaceMemberError) {
    return { ok: false as const, status: 500, body: { error: workspaceMemberError.message } };
  }

  const membershipRole = toWorkspaceMembershipRole(validInvitation.role);
  const { error: workspaceMembershipError } = await db.from('workspace_memberships').upsert(
    {
      user_id: userId,
      workspace_key: workspaceKey,
      role: membershipRole,
      is_active: true,
    },
    { onConflict: 'user_id,workspace_key' },
  );
  if (workspaceMembershipError) {
    return { ok: false as const, status: 500, body: { error: workspaceMembershipError.message } };
  }

  const acceptedAt = new Date().toISOString();
  const { error: invitationError } = await db
    .from('invitations')
    .update({ status: 'accepted', accepted_at: acceptedAt, updated_at: acceptedAt })
    .eq('id', validInvitation.id);
  if (invitationError) {
    return { ok: false as const, status: 500, body: { error: invitationError.message } };
  }

  await db
    .from('team_members')
    .update({
      status: 'active',
      profile_id: userId,
      user_id: userId,
      email: invitationEmail,
      full_name: profileName,
      job_title: validInvitation.job_title ?? null,
      workspace_id: validInvitation.workspace_id,
      updated_at: acceptedAt,
    })
    .eq('id', validInvitation.team_member_id);

  return {
    ok: true as const,
    status: 200,
    body: {
      success: true,
      user_created: userCreated,
      email: invitationEmail,
      workspaces: ['os'],
      workspace_roles: [{ workspace: 'os', role: memberRole }],
    },
  };
}
