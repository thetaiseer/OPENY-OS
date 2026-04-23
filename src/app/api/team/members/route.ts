import { NextRequest, NextResponse } from 'next/server';
import { getApiUser } from '@/lib/api-auth';
import { getServiceClient } from '@/lib/supabase/service-client';
import { getWorkspaceFromAppPath, normalizeWorkspaceKey, type WorkspaceKey } from '@/lib/workspace-access';

type TeamMemberPayload = {
  id: string;
  full_name: string;
  email: string;
  role: 'owner' | 'admin' | 'member';
  status: 'active';
  job_title: string | null;
  created_at: string;
  updated_at: string | null;
};

type WorkspaceRow = {
  id: string;
  slug: string | null;
  name: string | null;
  owner_id: string | null;
  created_at: string | null;
};

function resolveWorkspaceKey(request: NextRequest): WorkspaceKey {
  const fromQuery = normalizeWorkspaceKey(request.nextUrl.searchParams.get('workspace'));
  if (fromQuery) return fromQuery;

  const referer = request.headers.get('referer') ?? '';
  if (referer) {
    try {
      const pathname = new URL(referer).pathname;
      const fromPath = getWorkspaceFromAppPath(pathname);
      if (fromPath) return fromPath;
    } catch {}
  }

  return 'os';
}

async function resolveWorkspaceRow(
  db: ReturnType<typeof getServiceClient>,
  workspaceKey: WorkspaceKey,
): Promise<{ row: WorkspaceRow | null; error: string | null }> {
  const primary = await db
    .from('workspaces')
    .select('id, slug, name, owner_id, created_at')
    .eq('slug', workspaceKey)
    .maybeSingle();
  if (primary.error) return { row: null, error: primary.error.message };
  if (primary.data?.id) return { row: primary.data as WorkspaceRow, error: null };

  const nameMatch = await db
    .from('workspaces')
    .select('id, slug, name, owner_id, created_at')
    .ilike('name', `OPENY ${workspaceKey.toUpperCase()}`)
    .limit(1)
    .maybeSingle();
  if (nameMatch.error) return { row: null, error: nameMatch.error.message };
  if (nameMatch.data?.id) return { row: nameMatch.data as WorkspaceRow, error: null };

  const fallback = await db
    .from('workspaces')
    .select('id, slug, name, owner_id, created_at')
    .limit(2);
  if (fallback.error) return { row: null, error: fallback.error.message };
  if ((fallback.data ?? []).length === 1) {
    return { row: (fallback.data as WorkspaceRow[])[0], error: null };
  }

  return { row: null, error: null };
}

function normalizeMemberRole(role: string | null | undefined): 'owner' | 'admin' | 'member' {
  if (role === 'owner') return 'owner';
  if (role === 'admin') return 'admin';
  return 'member';
}

export async function GET(request: NextRequest) {
  const auth = await getApiUser(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspaceKey = resolveWorkspaceKey(request);
  const db = getServiceClient();

  const { row: workspaceRow, error: workspaceError } = await resolveWorkspaceRow(db, workspaceKey);
  if (workspaceError) {
    console.error('[team/members/get] Failed to resolve workspace:', workspaceError);
    return NextResponse.json({ error: workspaceError }, { status: 500 });
  }

  if (!workspaceRow?.id) {
    return NextResponse.json({ members: [] as TeamMemberPayload[] });
  }

  const { data: workspaceMembers, error: membersError } = await db
    .from('workspace_members')
    .select('id, workspace_id, user_id, role, joined_at')
    .eq('workspace_id', workspaceRow.id);

  if (membersError) {
    console.error('[team/members/get] Failed to fetch workspace_members:', membersError.message);
    return NextResponse.json({ error: membersError.message }, { status: 500 });
  }

  const normalizedWorkspaceMembers = [...(workspaceMembers ?? [])];
  if (workspaceRow.owner_id) {
    const ownerMembershipIndex = normalizedWorkspaceMembers.findIndex(member => member.user_id === workspaceRow.owner_id);
    if (ownerMembershipIndex === -1) {
      normalizedWorkspaceMembers.push({
        id: `synthetic-owner-membership-${workspaceRow.owner_id}`,
        workspace_id: workspaceRow.id,
        user_id: workspaceRow.owner_id,
        role: 'owner',
        joined_at: workspaceRow.created_at ?? new Date().toISOString(),
      });
    }
  }

  const userIds = [...new Set(normalizedWorkspaceMembers.map(member => member.user_id).filter(Boolean))];
  const { data: profileRows, error: profileError } = userIds.length > 0
    ? await db
        .from('profiles')
        .select('id, name, email')
        .in('id', userIds)
    : { data: [] as Array<{ id: string; name: string | null; email: string | null }>, error: null };

  if (profileError) {
    console.error('[team/members/get] Failed to fetch profiles:', profileError.message);
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  const { data: teamRows, error: teamRowsError } = userIds.length > 0
    ? await db
        .from('team_members')
        .select('id, profile_id, email, full_name, job_title, status, created_at, updated_at')
        .in('profile_id', userIds)
    : { data: [] as Array<{
        id: string;
        profile_id: string | null;
        email: string | null;
        full_name: string | null;
        job_title: string | null;
        status: string | null;
        created_at: string | null;
        updated_at: string | null;
      }>, error: null };

  if (teamRowsError) {
    console.error('[team/members/get] Failed to fetch team_members:', teamRowsError.message);
    return NextResponse.json({ error: teamRowsError.message }, { status: 500 });
  }

  const profileById = new Map((profileRows ?? []).map(profile => [profile.id, profile]));
  const teamByProfileId = new Map(
    (teamRows ?? [])
      .filter(row => Boolean(row.profile_id))
      .map(row => [row.profile_id as string, row]),
  );

  const members: TeamMemberPayload[] = normalizedWorkspaceMembers.map(member => {
    const team = teamByProfileId.get(member.user_id);
    const profile = profileById.get(member.user_id);
    const fullName = team?.full_name
      ?? profile?.name
      ?? profile?.email
      ?? member.user_id;
    const email = team?.email ?? profile?.email ?? '';
    return {
      id: team?.id ?? member.user_id,
      full_name: fullName,
      email,
      role: member.user_id === workspaceRow.owner_id ? 'owner' : normalizeMemberRole(member.role),
      status: 'active',
      job_title: team?.job_title ?? null,
      created_at: team?.created_at ?? member.joined_at ?? new Date().toISOString(),
      updated_at: team?.updated_at ?? null,
    };
  });

  members.sort((a, b) => a.full_name.localeCompare(b.full_name));

  return NextResponse.json({ members });
}
