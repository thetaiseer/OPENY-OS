import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { getApiUser } from '@/lib/api-auth';
import { PG_UNDEFINED_TABLE } from '@/lib/constants/postgres-errors';

const supabaseUrl            = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// POST /api/auth/sessions/logout — deactivate the current session on sign-out
export async function POST(request: NextRequest) {
  const auth = await getApiUser(request);
  if (!auth) return NextResponse.json({ ok: true }); // already logged out

  const currentSid = request.cookies.get('openy-sid')?.value;
  if (!currentSid) {
    console.log('[sessions/logout] No openy-sid cookie — nothing to deactivate');
    return NextResponse.json({ ok: true });
  }

  const admin = createServiceClient(supabaseUrl, supabaseServiceRoleKey);
  const { error } = await admin
    .from('user_sessions')
    .update({
      is_active:  false,
      revoked_at: new Date().toISOString(),
      revoked_by: 'self',
    })
    .eq('id', currentSid)
    .eq('user_id', auth.profile.id);

  if (error && error.code !== PG_UNDEFINED_TABLE) {
    console.warn('[sessions/logout] Failed to deactivate session:', error.message);
  } else if (!error) {
    console.log('[sessions/logout] Session deactivated:', currentSid, '| user:', auth.profile.email);
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.delete('openy-sid');
  return response;
}
