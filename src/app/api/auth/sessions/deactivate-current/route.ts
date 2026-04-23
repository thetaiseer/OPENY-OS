import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { getApiUser } from '@/lib/api-auth';
import { PG_UNDEFINED_TABLE } from '@/lib/constants/postgres-errors';

// POST /api/auth/sessions/deactivate-current
// Called by the client before signing out to mark the current session inactive.
// Uses the openy-sid httpOnly cookie to identify the session — the client
// never needs to know the session ID directly.
export async function POST(request: NextRequest) {
  const auth = await getApiUser(request);
  if (!auth) return NextResponse.json({ ok: true }); // already signed out — nothing to do

  const currentSid = request.cookies.get('openy-sid')?.value;
  if (!currentSid) {
    // No session cookie — nothing to deactivate
    return NextResponse.json({ ok: true });
  }

  const admin = getServiceClient();
  const { error } = await admin
    .from('user_sessions')
    .update({
      is_active: false,
      revoked_at: new Date().toISOString(),
      revoked_by: auth.profile.email,
    })
    .eq('id', currentSid)
    .eq('user_id', auth.profile.id);

  if (error && error.code !== PG_UNDEFINED_TABLE) {
    console.warn('[sessions/deactivate-current] update error:', error.message);
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.delete('openy-sid');
  return response;
}
