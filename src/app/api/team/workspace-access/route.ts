import { NextRequest, NextResponse } from 'next/server';
import { getApiUser, requireRole } from '@/lib/api-auth';
import { getServiceClient } from '@/lib/supabase/service-client';
import { normalizeWorkspaceKey, WORKSPACE_ROLES, type WorkspaceKey } from '@/lib/workspace-access';

type AccessPayload = Partial<Record<WorkspaceKey, { enabled: boolean; role: string }>>;

export async function GET(request: NextRequest) {
  const auth = await getApiUser(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getServiceClient();
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
    .map(member => (member.email ?? '').toLowerCase())
    .filter(email => email && !idByEmail.has(email));

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
  const { data: memberships } = userIdList.length
    ? await db
        .from('workspace_memberships')
        .select('user_id, workspace_key, role, is_active')
        .in('user_id', userIdList)
    : { data: [] as Array<{ user_id: string; workspace_key: string; role: string; is_active: boolean }> };

  const byEmail: Record<string, Partial<Record<WorkspaceKey, { enabled: boolean; role: string }>>> = {};
  for (const member of members ?? []) {
    const email = (member.email ?? '').toLowerCase();
    if (!email) continue;
    byEmail[email] = {};
  }

  for (const membership of memberships ?? []) {
    const workspace = normalizeWorkspaceKey(membership.workspace_key);
    if (!workspace) continue;

    const email = emailByUserId.get(membership.user_id);
    if (!email) continue;

    if (!byEmail[email]) byEmail[email] = {};
    byEmail[email][workspace] = {
      enabled: membership.is_active,
      role: membership.role,
    };
  }

  return NextResponse.json({ access: byEmail });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireRole(request, ['owner', 'admin']);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => null) as { email?: string; access?: AccessPayload } | null;
  const email = (body?.email ?? '').trim().toLowerCase();
  const access = body?.access ?? {};

  if (!email) return NextResponse.json({ error: 'email is required' }, { status: 400 });

  const db = getServiceClient();
  const users = await db.auth.admin.listUsers();
  const user = (users.data.users ?? []).find(u => u.email?.toLowerCase() === email);
  if (!user) {
    return NextResponse.json({ error: 'User account not found for this email' }, { status: 404 });
  }

  for (const [workspaceKeyRaw, config] of Object.entries(access)) {
    const workspace = normalizeWorkspaceKey(workspaceKeyRaw);
    if (!workspace) continue;
    if (!config) continue;

    const role = (config.role ?? 'member').toLowerCase();
    if (!WORKSPACE_ROLES.includes(role as (typeof WORKSPACE_ROLES)[number])) {
      return NextResponse.json({ error: `Invalid role for ${workspace}: ${role}` }, { status: 400 });
    }

    const payload = {
      user_id: user.id,
      workspace_key: workspace,
      role,
      is_active: Boolean(config.enabled),
    };

    const { error } = await db
      .from('workspace_memberships')
      .upsert(payload, { onConflict: 'user_id,workspace_key' });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
