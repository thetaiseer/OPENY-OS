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
    .select('email')
    .not('email', 'is', null);

  const users = await db.auth.admin.listUsers();
  const idByEmail = new Map(
    (users.data.users ?? [])
      .filter(u => !!u.email)
      .map(u => [u.email!.toLowerCase(), u.id]),
  );

  const userIds = (members ?? [])
    .map(member => (member.email ?? '').toLowerCase())
    .map(email => idByEmail.get(email))
    .filter((id): id is string => Boolean(id));

  const { data: memberships } = userIds.length
    ? await db
        .from('workspace_memberships')
        .select('user_id, workspace_key, role, is_active')
        .in('user_id', userIds)
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

    const email = [...idByEmail.entries()].find(([, id]) => id === membership.user_id)?.[0];
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
