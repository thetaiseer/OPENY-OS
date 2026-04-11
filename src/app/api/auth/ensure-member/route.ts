/**
 * POST /api/auth/ensure-member
 *
 * Ensures the currently authenticated user has an active row in
 * public.team_members. Creates one with appropriate defaults if missing.
 *
 * Called automatically by the client-side auth context when no team_members
 * row is found for the user's email.
 *
 * Owner email (thetaiseer@gmail.com) receives permission_role = 'owner'.
 * All other users receive permission_role = 'member'.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { PG_UNIQUE_VIOLATION } from '@/lib/constants/postgres-errors';

const OWNER_EMAIL = 'thetaiseer@gmail.com';

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceKey) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  // Authenticate the caller.
  const browser = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll() { /* Route Handlers cannot set cookies on the incoming request */ },
    },
  });

  const { data: { user }, error: authError } = await browser.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const email = user.email ?? '';
  const admin = createServiceClient(supabaseUrl, serviceKey);

  // Check for an existing active row first.
  const { data: existing } = await admin
    .from('team_members')
    .select('id, full_name, email, permission_role, status')
    .eq('email', email)
    .eq('status', 'active')
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ member: existing });
  }

  // Create a new row with appropriate defaults.
  const autoRole = email.toLowerCase() === OWNER_EMAIL ? 'owner' : 'member';
  const autoName = (user.user_metadata?.name as string | undefined) ?? email.split('@')[0] ?? '';

  const { data: newMember, error: insertError } = await admin
    .from('team_members')
    .insert({
      full_name:       autoName,
      email,
      permission_role: autoRole,
      profile_id:      user.id,
      status:          'active',
    })
    .select('id, full_name, email, permission_role, status')
    .single();

  if (insertError) {
    if (insertError.code === PG_UNIQUE_VIOLATION) {
      // Race condition — row was created by a concurrent request; fetch it now.
      const { data: raced } = await admin
        .from('team_members')
        .select('id, full_name, email, permission_role, status')
        .eq('email', email)
        .eq('status', 'active')
        .maybeSingle();
      return NextResponse.json({ member: raced });
    }
    console.error('[ensure-member] insert error:', insertError.message);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ member: newMember });
}
