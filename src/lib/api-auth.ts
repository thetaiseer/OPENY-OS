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

const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

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

  if (authError || !user) {
    return null;
  }

  // 3. Fetch the role from public.users using the service-role key so that
  //    Row Level Security does not block the read.
  const admin = createServiceClient(supabaseUrl, serviceRoleKey);

  const { data: profile, error: profileError } = await admin
    .from('users')
    .select('id, name, email, role, client_id')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    // If no profile row exists yet (e.g., migration ran after the sign-up),
    // auto-create it with the default 'client' role.
    const fallback: UserProfile = {
      id:        user.id,
      name:      user.user_metadata?.name ?? user.email?.split('@')[0] ?? '',
      email:     user.email ?? '',
      role:      'client',
      client_id: null,
    };

    await admin.from('users').upsert({
      id:    fallback.id,
      name:  fallback.name,
      email: fallback.email,
      role:  fallback.role,
    });

    return { profile: fallback };
  }

  return {
    profile: {
      id:        profile.id,
      name:      profile.name,
      email:     profile.email,
      role:      profile.role as UserRole,
      client_id: profile.client_id ?? null,
    },
  };
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
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return auth;
}
