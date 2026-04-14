/**
 * src/lib/api-auth.ts
 *
 * Helpers for enforcing authentication and role-based access control in
 * Next.js Route Handlers (API routes).
 *
 * Role resolution uses public.team_members (matched by email).
 *
 * Role hierarchy (highest → lowest):
 *   owner > admin > manager > team > others (e.g. client)
 *
 * The "owner" role bypasses ALL role restrictions — requireRole() always
 * returns success for an owner regardless of the allowedRoles list.
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
import { getServiceClient } from '@/lib/supabase/service-client';
import type { UserRole } from './auth-context';

const supabaseUrl            = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey        = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Owner email always resolves to 'owner' role — the workspace owner.
const OWNER_EMAIL = 'thetaiseer@gmail.com';

// ── Profile cache ─────────────────────────────────────────────────────────────
// Short-lived in-memory cache that avoids a redundant Supabase round-trip on
// every API call.  The JWT is still validated on every request via getUser();
// only the secondary team_members lookup is cached.
// TTL: 60 s — role changes take effect within one minute.

const PROFILE_CACHE_TTL_MS  = 60_000;
const MAX_PROFILE_CACHE_SIZE = 500;

interface CachedProfile {
  profile:   UserProfile;
  expiresAt: number;
}

const profileCache = new Map<string, CachedProfile>();

function setCachedProfile(userId: string, profile: UserProfile): void {
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
 * and resolves the caller's role from public.team_members (matched by email).
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

  const email = user.email ?? '';

  // ── Cached result ─────────────────────────────────────────────────────────
  const cached = profileCache.get(user.id);
  if (cached && Date.now() < cached.expiresAt) {
    return { profile: cached.profile };
  }

  // ── Owner shortcut ────────────────────────────────────────────────────────
  if (email.toLowerCase() === OWNER_EMAIL) {
    const ownerProfile: UserProfile = {
      id:    user.id,
      name:  user.user_metadata?.name ?? email.split('@')[0] ?? '',
      email,
      role:  'owner',
    };
    setCachedProfile(user.id, ownerProfile);
    return { profile: ownerProfile };
  }

  // 3. Fetch role from public.team_members using the service-role key so that
  //    Row Level Security does not block the read.
  const admin = getServiceClient();

  const { data: member, error: memberError } = await admin
    .from('team_members')
    .select('id, full_name, email, role')
    .eq('email', email)
    .maybeSingle();

  console.log('[api-auth] team_members fetch — row:', member ? `email=${member.email} role=${member.role}` : 'null', '| error:', memberError ? `${memberError.code}: ${memberError.message}` : 'none');

  const resolved: UserProfile = {
    id:    user.id,
    name:  member?.full_name ?? user.user_metadata?.name ?? email.split('@')[0] ?? '',
    email,
    role:  member ? (member.role as UserRole) || 'team_member' : 'team_member',
  };

  if (!member) {
    console.warn('[api-auth] No team_member row found for email:', email, '— defaulting to team_member role');
  }

  console.log('[api-auth] resolved profile — id:', resolved.id, '| email:', resolved.email, '| role:', resolved.role);

  setCachedProfile(resolved.id, resolved);
  return { profile: resolved };
}

/**
 * Convenience helper: returns the profile if the caller has one of the
 * allowed roles, otherwise returns a 401/403 NextResponse.
 *
 * The "owner" role always passes — it bypasses all role restrictions.
 *
 * Usage:
 *   const result = await requireRole(request, ['admin', 'team_member']);
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

  // Owner has full access to all system actions — bypass all role restrictions.
  if (auth.profile.role === 'owner') {
    return auth;
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
