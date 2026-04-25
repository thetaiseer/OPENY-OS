import { NextRequest, NextResponse } from 'next/server';
import { getApiUser, requireRole } from '@/lib/api-auth';
import { getServiceClient } from '@/lib/supabase/service-client';
import {
  normalizeWorkspaceKey,
  WORKSPACE_ROLES,
  type WorkspaceKey,
  type WorkspaceRole,
} from '@/lib/workspace-access';
import {
  upsertWorkspaceMembershipsWithFallback,
  type WorkspaceMembershipUpsertPayload,
} from '@/lib/workspace-membership-upsert';

type AccessPayload = Partial<Record<WorkspaceKey, { enabled: boolean; role: string }>>;
type WorkspaceRow = { id: string; slug: string | null; name: string | null };
type WorkspaceMemberRole = 'owner' | 'admin' | 'member';

function resolveWorkspaceKeyFromName(name: string | null | undefined): WorkspaceKey | null {
  if (!name) return null;
  const normalized = name.trim().toLowerCase();
  if (normalized === 'os' || normalized === 'openy os') return 'os';
  if (normalized === 'docs' || normalized === 'openy docs') return 'docs';
  return null;
}

function resolveWorkspaceKeyFromRow(workspace: WorkspaceRow): WorkspaceKey | null {
  return normalizeWorkspaceKey(workspace.slug) ?? resolveWorkspaceKeyFromName(workspace.name);
}

function normalizeWorkspaceRoleFromMemberRole(role: string | null | undefined): WorkspaceRole {
  if (role === 'owner') return 'owner';
  if (role === 'admin' || role === 'manager') return 'admin';
  if (role === 'viewer' || role === 'client') return 'viewer';
  return 'member';
}

function toWorkspaceMemberRole(role: WorkspaceRole): WorkspaceMemberRole {
  if (role === 'owner') return 'owner';
  if (role === 'admin') return 'admin';
  return 'member';
}

function toLegacyWorkspaceMemberRole(
  role: WorkspaceMemberRole,
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

export async function GET(request: NextRequest) {
  const auth = await getApiUser(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getServiceClient();
  const { data: workspaceRows, error: workspaceRowsError } = await db
    .from('workspaces')
    .select('id, slug, name');
  if (workspaceRowsError)
    return NextResponse.json({ error: workspaceRowsError.message }, { status: 500 });
  const workspaceKeyById = new Map<string, WorkspaceKey>();
  for (const workspace of (workspaceRows ?? []) as WorkspaceRow[]) {
    const key = resolveWorkspaceKeyFromRow(workspace);
    if (key) workspaceKeyById.set(workspace.id, key);
  }

  const { data: members } = await db
    .from('team_members')
    .select('email, profile_id')
    .not('email', 'is', null);

  const idByEmail = new Map<string, string>();
  const userIds = new Set<string>();

  for (const member of members ?? []) {
    const email = (member.email ?? '').toLowerCase();
    const profileId = (member as { profile_id?: string | null }).profile_id ?? null;
    if (profileId) {
      userIds.add(profileId);
      if (email) idByEmail.set(email, profileId);
    }
  }
  const emailByUserId = new Map<string, string>();
  for (const [email, userId] of idByEmail.entries()) {
    emailByUserId.set(userId, email);
  }

  const unresolvedEmails = (members ?? [])
    .map((member) => (member.email ?? '').toLowerCase())
    .filter((email) => email && !idByEmail.has(email));

  if (unresolvedEmails.length > 0) {
    const users = await db.auth.admin.listUsers();
    for (const user of users.data.users ?? []) {
      const email = (user.email ?? '').toLowerCase();
      if (!email || !unresolvedEmails.includes(email)) continue;
      idByEmail.set(email, user.id);
      userIds.add(user.id);
    }
  }

  const userIdList = [...userIds];
  const workspaceIdList = [...workspaceKeyById.keys()];
  const { data: memberships } =
    userIdList.length > 0 && workspaceIdList.length > 0
      ? await db
          .from('workspace_members')
          .select('user_id, workspace_id, role')
          .in('user_id', userIdList)
          .in('workspace_id', workspaceIdList)
      : { data: [] as Array<{ user_id: string; workspace_id: string; role: string }> };

  const byEmail: Record<
    string,
    Partial<Record<WorkspaceKey, { enabled: boolean; role: string }>>
  > = {};
  for (const member of members ?? []) {
    const email = (member.email ?? '').toLowerCase();
    if (!email) continue;
    byEmail[email] = {};
  }

  for (const membership of memberships ?? []) {
    const workspace = workspaceKeyById.get(membership.workspace_id);
    if (!workspace) continue;

    const email = emailByUserId.get(membership.user_id);
    if (!email) continue;

    if (!byEmail[email]) byEmail[email] = {};
    byEmail[email][workspace] = {
      enabled: true,
      role: normalizeWorkspaceRoleFromMemberRole(membership.role),
    };
  }

  return NextResponse.json({ access: byEmail });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireRole(request, ['owner', 'admin']);
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json().catch(() => null)) as {
    email?: string;
    access?: AccessPayload;
  } | null;
  const email = (body?.email ?? '').trim().toLowerCase();
  const access = body?.access ?? {};

  if (!email) return NextResponse.json({ error: 'email is required' }, { status: 400 });

  const db = getServiceClient();
  const users = await db.auth.admin.listUsers();
  const user = (users.data.users ?? []).find((u) => u.email?.toLowerCase() === email);
  if (!user) {
    return NextResponse.json({ error: 'User account not found for this email' }, { status: 404 });
  }

  const { data: workspaceRows, error: workspaceRowsError } = await db
    .from('workspaces')
    .select('id, slug, name');
  if (workspaceRowsError)
    return NextResponse.json({ error: workspaceRowsError.message }, { status: 500 });
  const workspaceByKey = new Map<WorkspaceKey, WorkspaceRow>();
  for (const workspace of (workspaceRows ?? []) as WorkspaceRow[]) {
    const key = resolveWorkspaceKeyFromRow(workspace);
    if (!key || workspaceByKey.has(key)) continue;
    workspaceByKey.set(key, workspace);
  }

  const updates: WorkspaceMembershipUpsertPayload[] = [];
  const workspaceMemberUpserts: Array<{
    workspace_id: string;
    user_id: string;
    role: WorkspaceMemberRole;
  }> = [];
  const workspaceMemberDeletes: string[] = [];
  for (const [workspaceKeyRaw, config] of Object.entries(access)) {
    const workspace = normalizeWorkspaceKey(workspaceKeyRaw);
    if (!workspace) continue;
    if (!config) continue;

    const role = (config.role ?? 'member').toLowerCase();
    if (!WORKSPACE_ROLES.includes(role as (typeof WORKSPACE_ROLES)[number])) {
      return NextResponse.json(
        { error: `Invalid role for ${workspace}: ${role}` },
        { status: 400 },
      );
    }

    const targetWorkspace = workspaceByKey.get(workspace);
    if (!targetWorkspace?.id) {
      return NextResponse.json(
        { error: `Workspace ${workspace} is not configured` },
        { status: 400 },
      );
    }

    updates.push({
      user_id: user.id,
      workspace_key: workspace,
      role: role as WorkspaceRole,
      is_active: Boolean(config.enabled),
    });
    if (config.enabled) {
      workspaceMemberUpserts.push({
        workspace_id: targetWorkspace.id,
        user_id: user.id,
        role: toWorkspaceMemberRole(role as WorkspaceRole),
      });
    } else {
      workspaceMemberDeletes.push(targetWorkspace.id);
    }
  }

  if (workspaceMemberUpserts.length > 0) {
    const { error: workspaceMemberError } = await db
      .from('workspace_members')
      .upsert(workspaceMemberUpserts, { onConflict: 'workspace_id,user_id' });

    if (
      workspaceMemberError &&
      shouldRetryWorkspaceMemberInsertWithLegacyRoles(workspaceMemberError.message)
    ) {
      const legacyRows = workspaceMemberUpserts.map((row) => ({
        workspace_id: row.workspace_id,
        user_id: row.user_id,
        role: toLegacyWorkspaceMemberRole(row.role),
      }));
      const { error: legacyInsertError } = await db
        .from('workspace_members')
        .upsert(legacyRows, { onConflict: 'workspace_id,user_id' });
      if (legacyInsertError) {
        return NextResponse.json({ error: legacyInsertError.message }, { status: 500 });
      }
    } else if (workspaceMemberError) {
      return NextResponse.json({ error: workspaceMemberError.message }, { status: 500 });
    }
  }

  if (workspaceMemberDeletes.length > 0) {
    const { error: deleteError } = await db
      .from('workspace_members')
      .delete()
      .eq('user_id', user.id)
      .in('workspace_id', workspaceMemberDeletes);
    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  const writeResult = await upsertWorkspaceMembershipsWithFallback(
    db,
    updates,
    'team/workspace-access',
  );
  if (!writeResult.ok) {
    return NextResponse.json({ error: writeResult.error }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    updated: updates.length,
    fallback: writeResult.usedFallback,
  });
}
