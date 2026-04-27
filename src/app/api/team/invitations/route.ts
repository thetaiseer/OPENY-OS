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

// Prefer flat selects with accepted_at first: on modern DBs that have the column
// this succeeds immediately and accepted_at is preserved.  The variants without
// accepted_at are kept as fallbacks for legacy schemas that were deployed before
// that column was added; they will also succeed on those DBs.
//
// Embedded `team_member:team_members(...)` variants come last because the FK hint
// or PostgREST relationship name can differ across deployments and cause 500s.
const selectVariants = [
  'id, team_member_id, email, token, role, status, invited_by, expires_at, accepted_at, created_at, updated_at, workspace_access, workspace_roles',
  'id, team_member_id, email, token, role, status, invited_by, expires_at, accepted_at, created_at, updated_at',
  'id, team_member_id, email, token, role:access_role, status, invited_by, expires_at, accepted_at, created_at, updated_at, workspace_access, workspace_roles',
  'id, team_member_id, email, token, role:access_role, status, invited_by, expires_at, accepted_at, created_at, updated_at',
  // Legacy schemas without accepted_at:
  'id, team_member_id, email, token, role, status, invited_by, expires_at, created_at, updated_at, workspace_access, workspace_roles',
  'id, team_member_id, email, token, role, status, invited_by, expires_at, created_at, updated_at',
  'id, team_member_id, email, token, role, status, invited_by, expires_at, created_at',
  'id, team_member_id, email, token, role:access_role, status, invited_by, expires_at, created_at, updated_at, workspace_access, workspace_roles',
  'id, team_member_id, email, token, role:access_role, status, invited_by, expires_at, created_at, updated_at',
  'id, team_member_id, email, token, role:access_role, status, invited_by, expires_at, created_at',
  // Variants with embedded team_member join (last resort due to FK name variance):
  'id, team_member_id, email, token, role, status, invited_by, expires_at, accepted_at, created_at, updated_at, workspace_access, workspace_roles, team_member:team_members(full_name, job_title, role, status)',
  'id, team_member_id, email, token, role, status, invited_by, expires_at, accepted_at, created_at, updated_at, team_member:team_members(full_name, job_title, role, status)',
  'id, team_member_id, email, token, role:access_role, status, invited_by, expires_at, accepted_at, created_at, updated_at, workspace_access, workspace_roles, team_member:team_members(full_name, job_title, role, status)',
  'id, team_member_id, email, token, role:access_role, status, invited_by, expires_at, accepted_at, created_at, updated_at, team_member:team_members(full_name, job_title, role, status)',
  'id, team_member_id, email, token, role, status, invited_by, expires_at, accepted_at, created_at, updated_at, workspace_access, workspace_roles, team_member:team_members(name, role, status)',
  'id, team_member_id, email, token, role:access_role, status, invited_by, expires_at, accepted_at, created_at, updated_at, team_member:team_members(name, role, status)',
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
