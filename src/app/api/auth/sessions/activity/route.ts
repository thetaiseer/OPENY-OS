import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { getApiUser } from '@/lib/api-auth';
import { PG_UNDEFINED_TABLE } from '@/lib/constants/postgres-errors';


// POST /api/auth/sessions/activity — update last_seen_at for the current session
export async function POST(request: NextRequest) {
  const auth = await getApiUser(request);
  if (!auth) return NextResponse.json({ ok: true }); // silently ignore if unauthenticated

  const currentSid = request.cookies.get('openy-sid')?.value;
  if (!currentSid) return NextResponse.json({ ok: true });

  const admin = getServiceClient();
  const { error } = await admin
    .from('user_sessions')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', currentSid)
    .eq('user_id', auth.profile.id);

  // Ignore table-not-found — migration hasn't run yet
  if (error && error.code === PG_UNDEFINED_TABLE) {
    // table not yet created, nothing to update
  } else if (error) {
    console.warn('[sessions/activity] update error:', error.message);
  } else {
    console.log('[sessions/activity] ✓ Updated last_seen_at for session:', currentSid);
  }

  return NextResponse.json({ ok: true });
}
