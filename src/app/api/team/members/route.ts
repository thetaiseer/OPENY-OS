/**
 * GET /api/team/members
 *
 * Returns the list of team members with their permission roles.
 * Auth: owner or admin only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { getApiUser } from '@/lib/api-auth';
import { canManageMembers } from '@/lib/rbac';

export async function GET(request: NextRequest) {
  const auth = await getApiUser(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!canManageMembers(auth.profile.role)) {
    return NextResponse.json({ error: 'Forbidden — owner or admin role required' }, { status: 403 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const db = createServiceClient(url, key);

  const { data, error } = await db
    .from('team_members')
    .select('*')
    .order('full_name');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ members: data ?? [] });
}
