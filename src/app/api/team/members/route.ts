import { NextRequest, NextResponse } from 'next/server';
import { getApiUser } from '@/lib/api-auth';
import { getServiceClient } from '@/lib/supabase/service-client';
import { resolveWorkspaceForRequest } from '@/lib/api-workspace';

type TeamMemberPayload = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  status: 'active';
  job_title: string | null;
  profile_id: string | null;
  created_at: string;
  updated_at: string | null;
};

type WorkspaceRow = {
  id: string;
  owner_id: string | null;
  created_at: string | null;
};

function normalizeMemberRole(role: string | null | undefined): string {
  if (role === 'owner') return 'owner';
  if (role === 'admin') return 'admin';
  if (role === 'manager') return 'manager';
  if (role === 'viewer') return 'viewer';
  if (role === 'team_member') return 'team_member';
  return 'member';
}

export async function GET(request: NextRequest) {
  const auth = await getApiUser(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getServiceClient();
  const { workspaceId, error: workspaceError } = await resolveWorkspaceForRequest(
    request,
    db,
    auth.profile.id,
  );
  if (workspaceError) {
    console.error('[team/members/get] Failed to resolve workspace:', workspaceError);
    return NextResponse.json(
      { success: false, step: 'workspace_resolution', error: workspaceError },
      { status: 500 },
    );
  }

  if (!workspaceId) {
    return NextResponse.json(
      { success: false, step: 'workspace_resolution', error: 'Workspace not found' },
      { status: 500 },
    );
  }
  const { data: workspaceRowData, error: workspaceRowError } = await db
    .from('workspaces')
    .select('id, owner_id, created_at')
    .eq('id', workspaceId)
    .maybeSingle();
  if (workspaceRowError || !workspaceRowData?.id) {
    return NextResponse.json(
      {
        success: false,
        step: 'workspace_resolution',
        error: workspaceRowError?.message ?? 'Workspace not found',
      },
      { status: 500 },
    );
  }
  const workspaceRow = workspaceRowData as WorkspaceRow;

  const { data: workspaceMembers, error: membersError } = await db
    .from('workspace_members')
    .select('id, workspace_id, user_id, role, joined_at')
    .eq('workspace_id', workspaceId);

  if (membersError) {
    console.error('[team/members/get] Failed to fetch workspace_members:', membersError.message);
    return NextResponse.json({ error: membersError.message }, { status: 500 });
  }

  const normalizedWorkspaceMembers = [...(workspaceMembers ?? [])];
  if (workspaceRow.owner_id) {
    const ownerMembershipIndex = normalizedWorkspaceMembers.findIndex(
      (member) => member.user_id === workspaceRow.owner_id,
    );
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

  const userIds = [
    ...new Set(normalizedWorkspaceMembers.map((member) => member.user_id).filter(Boolean)),
  ];
  const { data: profileRows, error: profileError } =
    userIds.length > 0
      ? await db.from('profiles').select('id, name, email').in('id', userIds)
      : {
          data: [] as Array<{ id: string; name: string | null; email: string | null }>,
          error: null,
        };

  if (profileError) {
    console.error('[team/members/get] Failed to fetch profiles:', profileError.message);
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  const { data: teamRows, error: teamRowsError } =
    userIds.length > 0
      ? await db
          .from('team_members')
          .select(
            'id, profile_id, email, role, full_name, job_title, status, created_at, updated_at',
          )
          .in('profile_id', userIds)
      : {
          data: [] as Array<{
            id: string;
            profile_id: string | null;
            email: string | null;
            role: string | null;
            full_name: string | null;
            job_title: string | null;
            status: string | null;
            created_at: string | null;
            updated_at: string | null;
          }>,
          error: null,
        };

  if (teamRowsError) {
    console.error('[team/members/get] Failed to fetch team_members:', teamRowsError.message);
    return NextResponse.json({ error: teamRowsError.message }, { status: 500 });
  }

  const profileById = new Map((profileRows ?? []).map((profile) => [profile.id, profile]));
  const teamByProfileId = new Map(
    (teamRows ?? [])
      .filter((row) => Boolean(row.profile_id))
      .map((row) => [row.profile_id as string, row]),
  );

  const members: TeamMemberPayload[] = normalizedWorkspaceMembers.map((member) => {
    const team = teamByProfileId.get(member.user_id);
    const profile = profileById.get(member.user_id);
    const fullName = team?.full_name ?? profile?.name ?? profile?.email ?? member.user_id;
    const email = team?.email ?? profile?.email ?? '';
    return {
      id: team?.id ?? member.user_id,
      full_name: fullName,
      email,
      role:
        member.user_id === workspaceRow.owner_id
          ? 'owner'
          : normalizeMemberRole(team?.role ?? member.role),
      status: 'active',
      job_title: team?.job_title ?? null,
      profile_id: member.user_id,
      created_at: team?.created_at ?? member.joined_at ?? new Date().toISOString(),
      updated_at: team?.updated_at ?? null,
    };
  });

  members.sort((a, b) => a.full_name.localeCompare(b.full_name));

  return NextResponse.json({ members });
}
