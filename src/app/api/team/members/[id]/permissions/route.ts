/**
 * GET  /api/team/members/[id]/permissions
 *   Returns the resolved effective permissions for a team member.
 *   Response: { permissions: MemberPermissions }
 *
 * PATCH /api/team/members/[id]/permissions
 *   Updates module-level permission overrides for a member.
 *   Body: { os?: Record<OsModule, ModuleAccess>; docs?: Record<DocsModule, ModuleAccess> }
 *   Auth: owner or admin only (can never change owner's permissions)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { requireRole } from '@/lib/api-auth';
import {
  resolveEffectivePermissions,
  normalizePlatformRole,
  OS_MODULES,
  DOCS_MODULES,
} from '@/lib/permissions';
import type { ModuleAccess, OsModule, DocsModule, MemberPermissionRow } from '@/lib/types';
import { processEvent } from '@/lib/event-engine';
import { EVENT } from '@/lib/workspace-events';

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRole(request, ['owner', 'admin', 'manager', 'team_member']);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Member ID is required' }, { status: 400 });

  const db = getServiceClient();

  const { data: member, error: memberError } = await db
    .from('team_members')
    .select('id, role, platform_role')
    .eq('id', id)
    .maybeSingle();

  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 500 });
  }
  if (!member) {
    return NextResponse.json({ error: 'Team member not found' }, { status: 404 });
  }

  const role = normalizePlatformRole(member.platform_role ?? member.role);

  const { data: overrides } = await db
    .from('member_permissions')
    .select('id, team_member_id, workspace, module, access_level, created_at, updated_at')
    .eq('team_member_id', id);

  const permissions = resolveEffectivePermissions(role, (overrides ?? []) as MemberPermissionRow[]);

  return NextResponse.json({ permissions });
}

// ── PATCH ─────────────────────────────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRole(request, ['owner', 'admin']);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Member ID is required' }, { status: 400 });

  const db = getServiceClient();

  const { data: member, error: memberError } = await db
    .from('team_members')
    .select('id, full_name, role, platform_role')
    .eq('id', id)
    .maybeSingle();

  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 500 });
  }
  if (!member) {
    return NextResponse.json({ error: 'Team member not found' }, { status: 404 });
  }

  // Prevent modifying the owner's permissions.
  const memberRole = normalizePlatformRole(member.platform_role ?? member.role);
  if (memberRole === 'owner') {
    return NextResponse.json({ error: 'Owner permissions cannot be changed.' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Build upsert rows from request body
  const rows: Array<{
    team_member_id: string;
    workspace: 'os' | 'docs';
    module: string;
    access_level: ModuleAccess;
  }> = [];

  const VALID_ACCESS: ModuleAccess[] = ['full', 'read', 'none'];

  if (body.os && typeof body.os === 'object' && !Array.isArray(body.os)) {
    for (const module of OS_MODULES) {
      const raw = (body.os as Record<string, unknown>)[module];
      if (raw !== undefined) {
        const access = String(raw) as ModuleAccess;
        if (!VALID_ACCESS.includes(access)) {
          return NextResponse.json({ error: `Invalid access level "${raw}" for os.${module}` }, { status: 400 });
        }
        rows.push({ team_member_id: id, workspace: 'os', module: module as OsModule, access_level: access });
      }
    }
  }

  if (body.docs && typeof body.docs === 'object' && !Array.isArray(body.docs)) {
    for (const module of DOCS_MODULES) {
      const raw = (body.docs as Record<string, unknown>)[module];
      if (raw !== undefined) {
        const access = String(raw) as ModuleAccess;
        if (!VALID_ACCESS.includes(access)) {
          return NextResponse.json({ error: `Invalid access level "${raw}" for docs.${module}` }, { status: 400 });
        }
        rows.push({ team_member_id: id, workspace: 'docs', module: module as DocsModule, access_level: access });
      }
    }
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: 'No permission updates provided' }, { status: 400 });
  }

  const { error: upsertError } = await db
    .from('member_permissions')
    .upsert(rows, { onConflict: 'team_member_id,workspace,module' });

  if (upsertError) {
    console.error('[permissions/patch] upsert failed:', upsertError.message);
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  // Re-fetch and return updated permissions
  const { data: overrides } = await db
    .from('member_permissions')
    .select('id, team_member_id, workspace, module, access_level, created_at, updated_at')
    .eq('team_member_id', id);

  const permissions = resolveEffectivePermissions(memberRole, (overrides ?? []) as MemberPermissionRow[]);

  // Activity log — fire and forget
  void processEvent({
    event_type:  EVENT.ROLE_CHANGED,
    actor_id:    auth.profile.id,
    entity_type: 'team_member',
    entity_id:   id,
    payload: {
      memberName:  member.full_name,
      actorName:   auth.profile.name,
      changeType:  'permissions',
      modulesUpdated: rows.map(r => `${r.workspace}.${r.module}`),
    },
  });

  return NextResponse.json({ success: true, permissions });
}
