import { NextRequest, NextResponse } from 'next/server';
import { getApiUser } from '@/lib/api-auth';
import { getServiceClient } from '@/lib/supabase/service-client';
import type { TeamInvitation } from '@/lib/types';

type InvitationRow = {
  id: string;
  team_member_id: string;
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
  'id, team_member_id, email, token, role, status, invited_by, expires_at, accepted_at, created_at, updated_at, workspace_access, workspace_roles, team_member:team_members(full_name, job_title, role, status)',
  'id, team_member_id, email, token, role, status, invited_by, expires_at, accepted_at, created_at, updated_at, team_member:team_members(full_name, job_title, role, status)',
  'id, team_member_id, email, token, role:access_role, status, invited_by, expires_at, accepted_at, created_at, updated_at, workspace_access, workspace_roles, team_member:team_members(full_name, job_title, role, status)',
  'id, team_member_id, email, token, role:access_role, status, invited_by, expires_at, accepted_at, created_at, updated_at, team_member:team_members(full_name, job_title, role, status)',
  'id, team_member_id, email, token, role, status, invited_by, expires_at, accepted_at, created_at, updated_at, workspace_access, workspace_roles, team_member:team_members(name, role, status)',
  'id, team_member_id, email, token, role:access_role, status, invited_by, expires_at, accepted_at, created_at, updated_at, team_member:team_members(name, role, status)',
];

function normalizeInvitationRow(row: InvitationRow): TeamInvitation {
  const teamMember = Array.isArray(row.team_member) ? row.team_member[0] : row.team_member;
  const fullName = teamMember?.full_name ?? teamMember?.name ?? null;
  return {
    id: row.id,
    team_member_id: row.team_member_id,
    email: row.email,
    role: row.role ?? row.access_role ?? undefined,
    token: row.token,
    status: (row.status ?? '').toLowerCase() as TeamInvitation['status'],
    invited_by: row.invited_by ?? null,
    expires_at: row.expires_at,
    accepted_at: row.accepted_at ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at ?? row.created_at,
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
  let rows: InvitationRow[] | null = null;
  let lastErrorMessage: string | null = null;

  for (const selectClause of selectVariants) {
    const { data, error } = await db
      .from('team_invitations')
      .select(selectClause)
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

  const invitations = rows.map(normalizeInvitationRow);
  return NextResponse.json({ invitations });
}
