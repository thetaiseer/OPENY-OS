import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { getApiUser } from '@/lib/api-auth';

const supabaseUrl            = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// POST /api/auth/sessions/revoke-others — revoke all sessions except the current one
export async function POST(request: NextRequest) {
  const auth = await getApiUser(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createServiceClient(supabaseUrl, supabaseServiceRoleKey);
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
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
