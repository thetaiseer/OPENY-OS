import { NextRequest, NextResponse } from 'next/server';
import { getApiUser } from '@/lib/api-auth';
import { getServiceClient } from '@/lib/supabase/service-client';
import type { TeamInvitation } from '@/lib/types';

type InvitationRow = {
  id: string;
  team_member_id: string;
  workspace_id?: string | null;
  email: string;
  token: string;
  role?: string | null;
  access_role?: string | null;
  status: string;
  invited_by?: string | null;
  expires_at: string;
  accepted_at?: string | null;
  created_at: string;
  updated_at?: string | null;
  workspace_access?: unknown;
  workspace_roles?: unknown;
  team_member?:
    | {
        full_name?: string | null;
        name?: string | null;
        job_title?: string | null;
        role?: string | null;
        status?: string | null;
      }
    | Array<{
        full_name?: string | null;
        name?: string | null;
        job_title?: string | null;
        role?: string | null;
        status?: string | null;
      }>
    | null;
};

const selectVariants = [
  'id, workspace_id, team_member_id, email, token, role, access_role, status, invited_by, expires_at, accepted_at, created_at, updated_at',
  'id, workspace_id, team_member_id, email, token, role, access_role, status, invited_by, expires_at, created_at, updated_at',
  'id, workspace_id, team_member_id, email, token, role, access_role, status, invited_by, expires_at, created_at',
  '*',
];

function normalizeInvitationRow(row: InvitationRow): TeamInvitation {
  const teamMember = Array.isArray(row.team_member) ? row.team_member[0] : row.team_member;
  const fullName = teamMember?.full_name ?? teamMember?.name ?? null;
  const fallbackExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const nowIso = new Date().toISOString();
  return {
    id: row.id,
    team_member_id: row.team_member_id,
    email: row.email,
    role: row.role ?? row.access_role ?? undefined,
    token: row.token,
    status: (row.status ?? '').toLowerCase() as TeamInvitation['status'],
    invited_by: row.invited_by ?? null,
    expires_at: row.expires_at ?? fallbackExpiry,
    accepted_at: row.accepted_at ?? null,
    created_at: row.created_at ?? nowIso,
    updated_at: row.updated_at ?? row.created_at ?? nowIso,
    workspace_access: (row.workspace_access ?? null) as TeamInvitation['workspace_access'],
    workspace_roles: (row.workspace_roles ?? null) as TeamInvitation['workspace_roles'],
    team_member: {
      full_name: fullName,
      job_title: teamMember?.job_title ?? null,
      role: teamMember?.role ?? null,
      status: teamMember?.status ?? null,
    },
  };
}

export async function GET(request: NextRequest) {
  const auth = await getApiUser(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getServiceClient();
  const { data: inviterWorkspace } = await db
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', auth.profile.id)
    .limit(1)
    .maybeSingle();

  let rows: InvitationRow[] | null = null;
  let lastErrorMessage: string | null = null;

  for (const selectClause of selectVariants) {
    const { data, error } = await db
      .from('invitations')
      .select(selectClause)
      .eq('workspace_id', inviterWorkspace?.workspace_id ?? '')
      .order('created_at', { ascending: false });

    if (!error) {
      rows = (data ?? []) as unknown as InvitationRow[];
      break;
    }
    lastErrorMessage = error.message;
  }

  if (!rows) {
    return NextResponse.json(
      { error: lastErrorMessage ?? 'Failed to load invitations' },
      { status: 500 },
    );
  }

  const teamMemberIds = rows
    .map((row) => row.team_member_id)
    .filter((value): value is string => Boolean(value));
  const { data: teamMembers } =
    teamMemberIds.length > 0
      ? await db
          .from('team_members')
          .select('id, full_name, name, job_title, role, status')
          .in('id', teamMemberIds)
      : { data: [] };
  const teamMemberById = new Map((teamMembers ?? []).map((row) => [row.id, row]));

  const invitations = rows.map((row) => {
    const tm = teamMemberById.get(row.team_member_id);
    return normalizeInvitationRow({
      ...row,
      team_member: tm
        ? {
            full_name: tm.full_name ?? tm.name ?? null,
            job_title: tm.job_title ?? null,
            role: tm.role ?? null,
            status: tm.status ?? null,
          }
        : null,
    });
  });
  return NextResponse.json({ invitations });
}
