/**
 * GET /api/team/members/me/permissions
 *
 * Returns the resolved effective permissions for the currently authenticated user.
 * Used by the usePermissions() client hook.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { getApiUser } from '@/lib/api-auth';
import { resolveEffectivePermissions, normalizePlatformRole } from '@/lib/permissions';
import type { MemberPermissionRow } from '@/lib/types';

export async function GET(request: NextRequest) {
  const auth = await getApiUser(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const platformRole = normalizePlatformRole(auth.profile.role);

  // Owner/admin always get full access — no DB lookup needed.
  if (platformRole === 'owner' || platformRole === 'admin') {
    const permissions = resolveEffectivePermissions(platformRole, []);
    return NextResponse.json({ permissions });
  }

  const db = getServiceClient();

  // Resolve team member row to get the member ID for permission lookup.
  const { data: memberRow } = await db
    .from('workspace_members')
    .select('id, role, platform_role')
    .eq('email', auth.profile.email)
    .maybeSingle();

  if (!memberRow) {
    // No team member row — return defaults for the resolved role.
    const permissions = resolveEffectivePermissions(platformRole, []);
    return NextResponse.json({ permissions });
  }

  const memberPlatformRole = normalizePlatformRole(memberRow.platform_role ?? memberRow.role);

  const { data: overrides } = await db
    .from('workspace_members')
    .select('id, team_member_id, workspace, module, access_level, created_at, updated_at')
    .eq('team_member_id', memberRow.id);

  const permissions = resolveEffectivePermissions(
    memberPlatformRole,
    (overrides ?? []) as MemberPermissionRow[],
  );

  return NextResponse.json({ permissions });
}
