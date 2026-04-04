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

  // 2. Determine the appropriate role.
  const email = user.email ?? '';
  const role  = email.toLowerCase() === ADMIN_EMAIL ? 'admin' : 'client';
  const name  =
    user.user_metadata?.name ??
    user.user_metadata?.full_name ??
    email.split('@')[0] ??
    '';

  // 3. Upsert the profile row using the service-role client (bypasses RLS).
  const admin = createServiceClient(supabaseUrl, serviceRoleKey);

  const { data: profile, error: upsertError } = await admin
    .from('profiles')
    .upsert({ id: user.id, email, name, role }, { onConflict: 'id' })
    .select('id, name, email, role')
    .single();

  if (upsertError || !profile) {
    console.error('[repair-profile] Upsert failed:', upsertError?.message);
    return NextResponse.json(
      { error: upsertError?.message ?? 'Upsert failed' },
      { status: 500 },
    );
  }

  console.log('[repair-profile] Profile created/updated:', profile);
  return NextResponse.json({ profile });
}
