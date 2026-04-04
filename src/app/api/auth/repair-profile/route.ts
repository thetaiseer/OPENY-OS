/**
 * POST /api/auth/repair-profile
 *
 * Creates or upserts a profile row in public.profiles for the currently
 * authenticated user. Called automatically by the client when no profile
 * row is found (e.g. the user was created before the trigger existed, or
 * the trigger failed for another reason).
 *
 * Uses the service-role key so that Row Level Security does not block the
 * insert — the trigger already creates rows with SECURITY DEFINER, so this
 * is intentional and safe for self-repair.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient as createServiceClient } from '@supabase/supabase-js';

const supabaseUrl    = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnon   = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Admin email: when a profile row is created via this endpoint, a user whose
// email matches ADMIN_EMAIL receives the 'admin' role instead of 'client'.
// Checks ADMIN_EMAIL first, then GOOGLE_ADMIN_EMAIL as a fallback (matching
// the same precedence used in src/lib/api-auth.ts). Intentionally has no
// hardcoded default — if neither env var is set, no automatic admin promotion
// occurs.
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? process.env.GOOGLE_ADMIN_EMAIL ?? '').toLowerCase();

export async function POST(request: NextRequest) {
  // Guard: ensure required environment variables are configured.
  if (!supabaseUrl || !supabaseAnon || !serviceRoleKey) {
    console.error('[repair-profile] Missing required environment variables');
    return NextResponse.json(
      { error: 'Server configuration error — Supabase env vars not set' },
      { status: 500 },
    );
  }

  // 1. Verify the caller is authenticated via session cookies.
  const supabase = createServerClient(supabaseUrl, supabaseAnon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll() {
        // Route Handlers cannot mutate the incoming request cookies.
      },
    },
  });

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    console.warn('[repair-profile] Unauthenticated request');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[repair-profile] Repairing profile for auth user:', user.id, user.email);

  // 2. Determine the appropriate role for a NEW profile row only.
  //    An existing row's role is NEVER overwritten — we preserve whatever is
  //    already in the database (e.g. 'admin' set by a previous migration).
  const email = user.email ?? '';
  const newRole = (ADMIN_EMAIL.trim().length > 0 && email.toLowerCase() === ADMIN_EMAIL) ? 'admin' : 'client';
  const name  =
    user.user_metadata?.name ??
    user.user_metadata?.full_name ??
    email.split('@')[0] ??
    '';

  // 3. Use the service-role client (bypasses RLS) so the operation always works.
  const admin = createServiceClient(supabaseUrl, serviceRoleKey);

  // INSERT only — never update if the row already exists.
  // This ensures an existing role (e.g. 'admin') is never downgraded to 'client'.
  const { error: insertError } = await admin
    .from('profiles')
    .insert({ id: user.id, email, name, role: newRole });

  if (insertError && insertError.code !== '23505') {
    // 23505 = unique_violation — row already exists, which is fine.
    console.error('[repair-profile] Insert failed:', insertError.message);
    return NextResponse.json(
      { error: insertError.message },
      { status: 500 },
    );
  }

  // Return the actual profile row from the database (may differ from newRole
  // if the row already existed with a different role, e.g. 'admin').
  const { data: profile, error: selectError } = await admin
    .from('profiles')
    .select('id, name, email, role')
    .eq('id', user.id)
    .single();

  if (selectError || !profile) {
    console.error('[repair-profile] Select after insert failed:', selectError?.message);
    return NextResponse.json(
      { error: selectError?.message ?? 'Profile not found after insert' },
      { status: 500 },
    );
  }

  console.log('[repair-profile] Profile resolved — id:', profile.id, '| role:', profile.role);
  return NextResponse.json({ profile });
}
