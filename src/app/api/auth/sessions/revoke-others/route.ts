import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { getApiUser } from '@/lib/api-auth';
import { PG_UNDEFINED_TABLE } from '@/lib/constants/postgres-errors';


// POST /api/auth/sessions/revoke-others — revoke all sessions except the current one
export async function POST(request: NextRequest) {
  const auth = await getApiUser(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = getServiceClient();
  const currentSid = request.cookies.get('openy-sid')?.value;

  let query = admin
    .from('user_sessions')
    .update({
      is_active:  false,
      revoked_at: new Date().toISOString(),
      revoked_by: auth.profile.email,
    })
    .eq('user_id', auth.profile.id)
    .eq('is_active', true);

  if (currentSid) {
    query = query.neq('id', currentSid);
  }

  const { error } = await query;

  if (error) {
    // Table not yet created — nothing to revoke
    if (error.code === PG_UNDEFINED_TABLE) {
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
