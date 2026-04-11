/**
 * src/lib/api-auth.ts
 *
 * Helpers for enforcing authentication and role-based access control in
 * Next.js Route Handlers (API routes).
 *
 * Identity is resolved directly from auth.users + public.team_members.
 * No dependency on public.profiles.
 *
 * Usage:
 *   const result = await getApiUser(request);
 *   if (!result) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 *
 *   const { profile } = result;
 *   if (!canManageMembers(profile.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { type UserRole, normalizeRole } from './auth-context';

const supabaseUrl            = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey        = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** Email that always resolves to the 'owner' role. Configurable via OWNER_EMAIL env var. */
const OWNER_EMAIL = (process.env.OWNER_EMAIL ?? 'thetaiseer@gmail.com').toLowerCase();

// ── Identity cache ─────────────────────────────────────────────────────────────
// Short-lived in-memory cache to avoid a DB round-trip on every API call.
// The JWT is still validated on every request via getUser();
// only the secondary team_members lookup is cached.
//
// TTL: 60 s — role changes take effect within one minute.

const PROFILE_CACHE_TTL_MS   = 60_000;
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
 * and resolves the caller's workspace identity from public.team_members.
 *
 * Returns null if the caller is not authenticated.
 */
export async function getApiUser(
  request: NextRequest,
): Promise<{ profile: UserProfile } | null> {
  // 1. Build a server-side Supabase client that reads session cookies.
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll() {
        // Route Handlers cannot set cookies on the incoming request.
      },
    },
  });

  // 2. Verify the JWT — getUser() validates the token with Supabase.
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  console.log('[api-auth] getUser result — id:', user?.id ?? 'none', '| email:', user?.email ?? 'none', '| authError:', authError?.message ?? 'none');

  if (authError || !user) {
    console.warn('[api-auth] No authenticated user — returning null');
    return null;
  }

  // Return cached identity if still fresh.
  const cached = profileCache.get(user.id);
  if (cached && Date.now() < cached.expiresAt) {
    return { profile: cached.profile };
  }

  // 3. Resolve identity from public.team_members (service-role bypasses RLS).
  if (!supabaseServiceRoleKey) {
    console.error('[api-auth] SUPABASE_SERVICE_ROLE_KEY is not set — cannot verify role');
    return null;
  }

  const admin = createServiceClient(supabaseUrl, supabaseServiceRoleKey);
  const email = user.email ?? '';

  const { data: tmRow, error: tmError } = await admin
    .from('team_members')
    .select('id, full_name, email, permission_role, status')
    .eq('email', email)
    .eq('status', 'active')
    .maybeSingle();

  console.log('[api-auth] team_members fetch — row:', tmRow ? `id=${tmRow.id} role=${tmRow.permission_role}` : 'null', '| error:', tmError ? `${tmError.code}: ${tmError.message}` : 'none');

  if (!tmRow) {
    // No active team_members row — auto-create one.
    const autoRole: UserRole = email.toLowerCase() === OWNER_EMAIL ? 'owner' : 'member';
    const autoName = (user.user_metadata?.name as string | undefined) ?? email.split('@')[0] ?? '';

    console.warn('[api-auth] No team_members row for email:', email, '| inserting with role:', autoRole);

    const { data: newRow, error: insertError } = await admin
      .from('team_members')
      .insert({
        full_name:       autoName,
        email,
        permission_role: autoRole,
        profile_id:      user.id,
        status:          'active',
      })
      .select('id, full_name, email, permission_role')
      .single();

    if (insertError && insertError.code !== '23505') {
      console.error('[api-auth] Failed to insert team_member:', insertError.message);
    }

    const fallback: UserProfile = {
      id:    user.id,
      name:  newRow?.full_name ?? autoName,
      email: newRow?.email     ?? email,
      role:  autoRole,
    };

    setCachedProfile(fallback.id, fallback);
    return { profile: fallback };
  }

  // Override role to owner for the designated owner email.
  const rawRole      = email.toLowerCase() === OWNER_EMAIL ? 'owner' : (tmRow.permission_role ?? 'member');
  const resolvedRole = normalizeRole(rawRole);

  const resolved: UserProfile = {
    id:    user.id,
    name:  (tmRow.full_name as string | null) ?? email.split('@')[0],
    email: (tmRow.email as string | null) ?? email,
    role:  resolvedRole,
  };

  console.log('[api-auth] resolved identity — id:', resolved.id, '| email:', resolved.email, '| role:', resolved.role);

  setCachedProfile(resolved.id, resolved);
  return { profile: resolved };
}

/**
 * Convenience helper: returns the profile if the caller has one of the
 * allowed roles, otherwise returns a 401/403 NextResponse.
 *
 * Accepts both new role names (owner|admin|member|viewer) and legacy names
 * (manager|team|client) — legacy names are normalised before comparison so
 * existing route handlers continue to work without modification.
 *
 * Usage:
 *   const result = await requireRole(request, ['admin', 'member']);
 *   if (result instanceof NextResponse) return result;
 *   const { profile } = result;
 */
export async function requireRole(
  request: NextRequest,
  allowedRoles: string[],
): Promise<{ profile: UserProfile } | NextResponse> {
  const auth = await getApiUser(request);

  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Normalise allowed roles so callers using legacy names still work.
  const normalised = allowedRoles.map(r => normalizeRole(r));
  if (!normalised.includes(auth.profile.role)) {
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
