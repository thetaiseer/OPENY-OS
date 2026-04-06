import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { getApiUser } from '@/lib/api-auth';
import { PG_UNDEFINED_TABLE } from '@/lib/constants/postgres-errors';

const supabaseUrl            = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// POST /api/auth/sessions/activity — update last_seen_at for the current session
export async function POST(request: NextRequest) {
  const auth = await getApiUser(request);
  if (!auth) return NextResponse.json({ ok: true }); // silently ignore if unauthenticated

  const currentSid = request.cookies.get('openy-sid')?.value;
  if (!currentSid) return NextResponse.json({ ok: true });

  const admin = createServiceClient(supabaseUrl, supabaseServiceRoleKey);
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
  }

  return NextResponse.json({ ok: true });
}
