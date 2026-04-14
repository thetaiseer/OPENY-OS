/**
 * /api/team/members/[id]
 *
 * DELETE — Remove a team member.
 *          Hard rule: the owner (role === 'owner') can NEVER be deleted.
 *
 * Auth: owner, admin, or manager only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { requireRole } from '@/lib/api-auth';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireRole(request, ['owner', 'admin', 'manager']);
  if (auth instanceof NextResponse) return auth;

  const { id } = params;
  if (!id) {
    return NextResponse.json({ error: 'Member ID is required' }, { status: 400 });
  }

  const db = getServiceClient();

  // Fetch the member to verify they exist and check their role.
  const { data: member, error: fetchError } = await db
    .from('team_members')
    .select('id, full_name, role')
    .eq('id', id)
    .maybeSingle();

  if (fetchError) {
    console.error('[team/members/delete] Fetch error:', fetchError.message);
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!member) {
    return NextResponse.json({ error: 'Team member not found' }, { status: 404 });
  }

  // Hard protection: owner cannot be deleted under any circumstances.
  if (member.role === 'owner') {
    return NextResponse.json(
      { error: 'The workspace owner cannot be removed from the team.' },
      { status: 403 },
    );
  }

  const { error: deleteError } = await db
    .from('team_members')
    .delete()
    .eq('id', id);

  if (deleteError) {
    console.error('[team/members/delete] Delete error:', deleteError.message);
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
