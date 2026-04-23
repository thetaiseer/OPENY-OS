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
import {
  getWorkspaceFromApiPath,
  isGlobalOwnerEmail,
  mapWorkspaceRoleToUserRole,
  type WorkspaceRole,
} from './workspace-access';
import {
  normalizePlatformRole,
  fetchMemberPermissions,
  hasModuleAccess,
  resolveEffectivePermissions,
} from './permissions';
import type { ModuleAccess, OsModule, DocsModule } from './types';

const supabaseUrl            = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey        = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

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
  const requiredWorkspace = getWorkspaceFromApiPath(request.nextUrl.pathname);

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
    console.warn('[api-auth] No authenticated user — returning null');
    return null;
  }

  const email = user.email ?? '';

  // ── Owner shortcut ────────────────────────────────────────────────────────
  if (isGlobalOwnerEmail(email)) {
    const ownerProfile: UserProfile = {
      id:    user.id,
      name:  user.user_metadata?.name ?? email.split('@')[0] ?? '',
      email,
      role:  'owner',
    };
    setCachedProfile(user.id, ownerProfile);
    return { profile: ownerProfile };
  }

  const admin = getServiceClient();

  // Enforce workspace membership authorization for API routes.
  let membershipRole: WorkspaceRole | null = null;
  if (requiredWorkspace) {
    const { data: membership } = await admin
      .from('workspace_memberships')
      .select('role')
      .eq('user_id', user.id)
      .eq('workspace_key', requiredWorkspace)
      .eq('is_active', true)
      .maybeSingle();

    membershipRole = (membership?.role as WorkspaceRole | undefined) ?? null;
    if (!membershipRole) {
      console.warn('[api-auth] workspace membership denied — email:', email, '| workspace:', requiredWorkspace);
      return null;
    }
  }

  // 3. Fetch role from public.team_members using the service-role key so that
  //    Row Level Security does not block the read.
  const { data: member, error: memberError } = await admin
    .from('team_members')
    .select('id, full_name, email, role')
    .eq('email', email)
    .maybeSingle();

  const fallbackWorkspaceRole = mapWorkspaceRoleToUserRole(membershipRole);
  const teamRole = member ? ((member.role as UserRole) || 'team_member') : fallbackWorkspaceRole;
  const resolvedRole = requiredWorkspace === 'docs' ? fallbackWorkspaceRole : teamRole;

  const resolved: UserProfile = {
    id:    user.id,
    name:  member?.full_name ?? user.user_metadata?.name ?? email.split('@')[0] ?? '',
    email,
    role:  resolvedRole,
  };

  if (!member) {
    console.warn('[api-auth] No team_member row found for email:', email, '— using workspace role fallback:', fallbackWorkspaceRole);
  }

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

// ── Module-level permission guard ─────────────────────────────────────────────

export type { ModuleAccess, OsModule, DocsModule };

/**
 * Validates that the caller has at least the required access level for a
 * specific workspace module.
 *
 * Owner and admin bypass all module restrictions.
 * Members are checked against their stored permission overrides.
 *
 * Returns the profile + resolved permissions on success, or a 401/403
 * NextResponse on failure.
 *
 * Usage:
 *   const result = await requireModulePermission(req, 'os', 'clients', 'full');
 *   if (result instanceof NextResponse) return result;
 *   const { profile, permissions } = result;
 */
export async function requireModulePermission(
  request: NextRequest,
  workspace: 'os' | 'docs',
  module: OsModule | DocsModule | string,
  required: ModuleAccess,
): Promise<{ profile: UserProfile; permissions: import('./types').MemberPermissions } | NextResponse> {
  const auth = await getApiUser(request);

  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Owner and admin always pass module checks.
  const platformRole = normalizePlatformRole(auth.profile.role);
  if (platformRole === 'owner' || platformRole === 'admin') {
    const permissions = resolveEffectivePermissions(platformRole, []);
    return { profile: auth.profile, permissions };
  }

  // Resolve team_member_id for this user to load stored overrides.
  const db = getServiceClient();
  const { data: memberRow } = await db
    .from('team_members')
    .select('id, role, platform_role')
    .eq('email', auth.profile.email)
    .maybeSingle();

  const teamMemberId = memberRow?.id ?? '';
  const memberPlatformRole = normalizePlatformRole(memberRow?.platform_role ?? memberRow?.role ?? auth.profile.role);
  const permissions = await fetchMemberPermissions(db, teamMemberId, memberPlatformRole);

  if (!hasModuleAccess(permissions, workspace, module, required)) {
    console.warn(
      '[api-auth] requireModulePermission denied — user:', auth.profile.email,
      '| workspace:', workspace,
      '| module:', module,
      '| required:', required,
    );
    return NextResponse.json(
      {
        error: `Forbidden — you do not have ${required} access to ${workspace}.${module}`,
        workspace,
        module,
        required,
      },
      { status: 403 },
    );
  }

  return { profile: auth.profile, permissions };
}
