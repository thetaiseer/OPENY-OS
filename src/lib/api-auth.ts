/**
 * src/lib/api-auth.ts
 *
 * Helpers for enforcing authentication and role-based access control in
 * Next.js Route Handlers (API routes).
 *
 * Usage:
 *   const result = await getApiUser(request);
 *   if (!result) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 *
 *   const { profile } = result;
 *   if (profile.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import type { UserRole } from './auth-context';

const supabaseUrl            = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey        = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Admin email: a profile row created via the fallback path receives 'admin'
// role if the auth user's email matches this value.
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? process.env.GOOGLE_ADMIN_EMAIL ?? '').toLowerCase();

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  client_id: string | null;
}

/**
 * Reads the session from the request cookies, validates it with Supabase,
 * and fetches the caller's profile row (role, client_id) from `public.users`.
 *
 * Returns null if the caller is not authenticated.
 */
export async function getApiUser(
  request: NextRequest,
): Promise<{ profile: UserProfile } | null> {
  // 1. Build a server-side Supabase client that reads session cookies from the request.
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll() {
        // Route Handlers cannot set cookies on the incoming request; refreshed
        // session cookies are written by the middleware on the next request.
      },
    },
  });

  // 2. Verify the JWT — getUser() makes a network call to validate the token.
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  console.log('[api-auth] getUser result — id:', user?.id ?? 'none', '| email:', user?.email ?? 'none', '| authError:', authError?.message ?? 'none');

  if (authError || !user) {
    console.warn('[api-auth] No authenticated user — returning null');
    return null;
  }

  // 3. Fetch the role from public.users using the service-role key so that
  //    Row Level Security does not block the read.
  if (!supabaseServiceRoleKey) {
    console.error('[api-auth] SUPABASE_SERVICE_ROLE_KEY is not set — cannot verify role');
    return null;
  }

  const admin = createServiceClient(supabaseUrl, supabaseServiceRoleKey);

  const { data: profile, error: profileError } = await admin
    .from('users')
    .select('id, name, email, role, client_id')
    .eq('id', user.id)
    .single();

  console.log('[api-auth] profile fetch — row:', profile ? `id=${profile.id} role=${profile.role}` : 'null', '| error:', profileError ? `${profileError.code}: ${profileError.message}` : 'none');

  if (profileError || !profile) {
    // Profile row missing — auto-create it with appropriate role.
    // Use INSERT ... on conflict do nothing to avoid overwriting an existing
    // row whose role may have been set by an admin after the initial sign-up.
    const email = user.email ?? '';
    const autoRole: UserRole = ADMIN_EMAIL && email.toLowerCase() === ADMIN_EMAIL ? 'admin' : 'client';
    const fallback: UserProfile = {
      id:        user.id,
      name:      user.user_metadata?.name ?? email.split('@')[0] ?? '',
      email,
      role:      autoRole,
      client_id: null,
    };

    console.warn('[api-auth] Profile row not found for user', user.id, '| email:', email, '| inserting fallback with role:', autoRole);

    // INSERT only — never update if the row already exists.
    const { error: insertError } = await admin.from('users').insert({
      id:    fallback.id,
      name:  fallback.name,
      email: fallback.email,
      role:  fallback.role,
    });

    if (insertError && insertError.code !== '23505') {
      // 23505 = unique_violation — row was inserted by a concurrent request; safe to ignore.
      console.error('[api-auth] Failed to insert fallback profile:', insertError.message);
    }

    return { profile: fallback };
  }

  const resolved: UserProfile = {
    id:        profile.id,
    name:      profile.name,
    email:     profile.email,
    role:      profile.role as UserRole,
    client_id: profile.client_id ?? null,
  };

  console.log('[api-auth] resolved profile — id:', resolved.id, '| email:', resolved.email, '| role:', resolved.role);

  return { profile: resolved };
}

/**
 * Convenience helper: returns the profile if the caller has one of the
 * allowed roles, otherwise returns a 401/403 NextResponse.
 *
 * Usage:
 *   const result = await requireRole(request, ['admin', 'team']);
 *   if (result instanceof NextResponse) return result;
 *   const { profile } = result;
 */
export async function requireRole(
  request: NextRequest,
  allowedRoles: UserRole[],
): Promise<{ profile: UserProfile } | NextResponse> {
  const auth = await getApiUser(request);

  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!allowedRoles.includes(auth.profile.role)) {
    console.warn(
      '[api-auth] requireRole denied — user:', auth.profile.email,
      '| role:', auth.profile.role,
      '| required one of:', allowedRoles.join(', '),
    );
    return NextResponse.json(
      {
        error: `Forbidden — your role is "${auth.profile.role}" but this action requires: ${allowedRoles.join(' or ')}`,
      },
      { status: 403 },
    );
  }

  return auth;
}
