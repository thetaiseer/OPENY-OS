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

// Owner email always resolves to 'owner' role — the workspace owner.
const OWNER_EMAIL = 'thetaiseer@gmail.com';

// ── Profile cache ─────────────────────────────────────────────────────────────
// Short-lived in-memory cache that avoids a redundant Supabase round-trip on
// every API call.  The JWT is still validated on every request via getUser();
// only the secondary profile table lookup is cached.
//
// Limitations:
//  • In serverless/edge environments (Vercel) each worker is a separate Node.js
//    process so the cache is per-worker, not global.  Warm workers benefit from
//    the cache; cold starts do not.  In the worst case this is a no-op.
//  • To prevent unbounded growth in long-running servers the cache is capped at
//    MAX_PROFILE_CACHE_SIZE entries.  LRU eviction is approximated by deleting
//    the oldest entry when the cap is reached.
// TTL: 60 s — role changes take effect within one minute.

const PROFILE_CACHE_TTL_MS  = 60_000;
const MAX_PROFILE_CACHE_SIZE = 500;

interface CachedProfile {
  profile:   UserProfile;
  expiresAt: number;
}

const profileCache = new Map<string, CachedProfile>();

function setCachedProfile(userId: string, profile: UserProfile): void {
  // Evict expired entries first; if still at cap, remove the oldest.
  const now = Date.now();
  for (const [key, entry] of profileCache) {
    if (entry.expiresAt <= now) profileCache.delete(key);
  }
  if (profileCache.size >= MAX_PROFILE_CACHE_SIZE) {
    const oldestKey = profileCache.keys().next().value;
    if (oldestKey) profileCache.delete(oldestKey);
  }
  profileCache.set(userId, { profile, expiresAt: now + PROFILE_CACHE_TTL_MS });
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

/**
 * Reads the session from the request cookies, validates it with Supabase,
 * and fetches the caller's profile row (role) from `public.profiles`.
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

  // ── Profile lookup (with short-lived cache) ───────────────────────────────

  // Return cached profile if still fresh — saves one Supabase round-trip per
  // request.  The JWT validation above already ran so the identity is verified.
  const cached = profileCache.get(user.id);
  if (cached && Date.now() < cached.expiresAt) {
    return { profile: cached.profile };
  }

  // 3. Fetch the role from public.profiles using the service-role key so that
  //    Row Level Security does not block the read.
  if (!supabaseServiceRoleKey) {
    console.error('[api-auth] SUPABASE_SERVICE_ROLE_KEY is not set — cannot verify role');
    return null;
  }

  const admin = createServiceClient(supabaseUrl, supabaseServiceRoleKey);

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id, name, email, role')
    .eq('id', user.id)
    .single();

  console.log('[api-auth] profile fetch — row:', profile ? `id=${profile.id} role=${profile.role}` : 'null', '| error:', profileError ? `${profileError.code}: ${profileError.message}` : 'none');

  if (profileError || !profile) {
    // Profile row missing — auto-create it with appropriate role.
    // Use INSERT ... on conflict do nothing to avoid overwriting an existing
    // row whose role may have been set by an admin after the initial sign-up.
    const email = user.email ?? '';
    const lowerEmail = email.toLowerCase();
    const autoRole: UserRole =
      lowerEmail === OWNER_EMAIL
        ? 'owner'
        : (ADMIN_EMAIL && lowerEmail === ADMIN_EMAIL ? 'admin' : 'team');
    const fallback: UserProfile = {
      id:    user.id,
      name:  user.user_metadata?.name ?? email.split('@')[0] ?? '',
      email,
      role:  autoRole,
    };

    console.warn('[api-auth] Profile row not found for user', user.id, '| email:', email, '| inserting fallback with role:', autoRole);

    // INSERT only — never update if the row already exists.
    const { error: insertError } = await admin.from('profiles').insert({
      id:    fallback.id,
      name:  fallback.name,
      email: fallback.email,
      role:  fallback.role,
    });

    if (insertError && insertError.code !== '23505') {
      // 23505 = unique_violation — row was inserted by a concurrent request; safe to ignore.
      console.error('[api-auth] Failed to insert fallback profile:', insertError.message);
    }

    // Cache the fallback profile too.
    setCachedProfile(fallback.id, fallback);
    return { profile: fallback };
  }

  const resolved: UserProfile = {
    id:    profile.id,
    name:  profile.name,
    email: profile.email,
    // thetaiseer@gmail.com is always the workspace owner regardless of what
    // the profiles row says.
    role:  profile.email?.toLowerCase() === OWNER_EMAIL
      ? 'owner'
      : (profile.role as UserRole),
  };

  console.log('[api-auth] resolved profile — id:', resolved.id, '| email:', resolved.email, '| role:', resolved.role);

  // Populate cache for subsequent requests from the same user.
  setCachedProfile(resolved.id, resolved);

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
