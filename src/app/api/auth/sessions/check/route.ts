import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { getApiUser } from '@/lib/api-auth';

const supabaseUrl            = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// GET /api/auth/sessions/check — verify the current session is still active
// Returns 200 { ok: true } if active, 401 if revoked or missing
export async function GET(request: NextRequest) {
  const auth = await getApiUser(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const currentSid = request.cookies.get('openy-sid')?.value;
  if (!currentSid) {
    // No session cookie yet — new login path, skip revocation check
    return NextResponse.json({ ok: true });
  }

  const admin = createServiceClient(supabaseUrl, supabaseServiceRoleKey);
  const { data } = await admin
    .from('user_sessions')
    .select('is_active')
    .eq('id', currentSid)
    .eq('user_id', auth.profile.id)
    .single();

  if (data && data.is_active === false) {
    const response = NextResponse.json({ error: 'Session revoked' }, { status: 401 });
    response.cookies.delete('openy-sid');
    return response;
  }

  return NextResponse.json({ ok: true });
}
