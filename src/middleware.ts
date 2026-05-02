import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { User } from '@supabase/supabase-js';
import {
  getWorkspaceFromAppPath,
  isGlobalOwnerEmail,
  type WorkspaceKey,
} from '@/lib/workspace-access';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const LEGACY_OS_REDIRECTS: Record<string, string> = {
  '/dashboard': '/os/dashboard',
  '/clients': '/os/clients',
  '/projects': '/os/projects',
  '/tasks/all': '/os/tasks',
  '/content': '/os/content',
  '/calendar': '/os/calendar',
  '/assets': '/os/assets',
  '/reports': '/os/reports',
  '/reports/overview': '/os/reports',
  '/team': '/os/team',
  '/security': '/os/security',
  '/security/sessions': '/os/security',
  '/settings': '/os/settings',
  '/settings/profile': '/os/settings',
};

/** Short TTL cache for auth.getUser() — reduces duplicate Auth API calls during rapid navigations. */
const MW_USER_CACHE_MS = 12_000;

type MwAuthCache = { key: string; user: User | null; expiresAt: number };

function readMwAuthCache(): MwAuthCache | undefined {
  return (globalThis as typeof globalThis & { __OPENY_MW_AUTH?: MwAuthCache }).__OPENY_MW_AUTH;
}

function writeMwAuthCache(entry: MwAuthCache | undefined) {
  (globalThis as typeof globalThis & { __OPENY_MW_AUTH?: MwAuthCache }).__OPENY_MW_AUTH = entry;
}

function authCookieSignature(request: NextRequest): string {
  return request.cookies
    .getAll()
    .filter((c) => c.name.startsWith('sb-'))
    .map((c) => `${c.name}:${c.value.length}:${c.value.slice(0, 32)}`)
    .join('|');
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // OPENY is invite-only: block any manual/public signup entry points.
  if (pathname === '/signup' || pathname.startsWith('/signup/')) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  const normalizedLegacyPath = LEGACY_OS_REDIRECTS[pathname];
  const requiredWorkspaceFromPath =
    getWorkspaceFromAppPath(pathname) ?? (normalizedLegacyPath ? 'os' : null);

  const isPublicRoute =
    pathname === '/' ||
    pathname === '/choose-workspace' ||
    pathname === '/select-workspace' ||
    pathname === '/access-denied' ||
    pathname === '/os/login' ||
    pathname === '/docs/login' ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/reset-password') ||
    pathname === '/invite' ||
    pathname.startsWith('/invite/') ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon');

  if (pathname === '/choose-workspace') {
    return NextResponse.redirect(new URL('/?switch=1', request.url));
  }

  if (pathname === '/select-workspace') {
    return NextResponse.redirect(new URL('/?switch=1', request.url));
  }

  // Public routes: skip Supabase client + getUser() — saves an Auth round-trip per hit.
  if (isPublicRoute) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  const cookieKey = authCookieSignature(request);
  const now = Date.now();
  const cached = readMwAuthCache();
  let user: User | null =
    cached && cached.key === cookieKey && cached.expiresAt > now ? cached.user : null;

  if (!cached || cached.key !== cookieKey || cached.expiresAt <= now) {
    let freshUser: User | null = null;
    try {
      const result = await Promise.race([
        supabase.auth.getUser(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('mw-getuser-timeout')), 5_000),
        ),
      ]);
      freshUser = result.data.user;
    } catch {
      // Auth lookup timed out or failed — pass through and let client-side auth handle it.
      return supabaseResponse;
    }
    user = freshUser;
    writeMwAuthCache({ key: cookieKey, user: freshUser, expiresAt: now + MW_USER_CACHE_MS });
  }

  const loginRouteForWorkspace = (workspace: WorkspaceKey | null) => {
    if (workspace === 'docs') return '/?workspace=docs';
    if (workspace === 'os') return '/?workspace=os';
    return '/';
  };

  if (!user) {
    const loginUrl = new URL(loginRouteForWorkspace(requiredWorkspaceFromPath), request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (requiredWorkspaceFromPath && !isGlobalOwnerEmail(user.email)) {
    // null = no record; undefined = timed out (fail-open to avoid locking users out)
    let hasAccess: boolean | null = null;
    try {
      const result = await Promise.race([
        supabase
          .from('workspace_memberships')
          .select('id')
          .eq('user_id', user.id)
          .eq('workspace_key', requiredWorkspaceFromPath)
          .eq('is_active', true)
          .maybeSingle(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('mw-membership-timeout')), 5_000),
        ),
      ]);
      // Fail-open on DB errors (table missing, RLS, network) to avoid locking out
      // users due to infrastructure issues. Empty result (no row) is still a deny.
      hasAccess = result.error ? true : result.data !== null;
    } catch {
      // Membership lookup timed out — fail-open.
      hasAccess = true;
    }

    if (!hasAccess) {
      const deniedUrl = new URL('/access-denied', request.url);
      deniedUrl.searchParams.set('workspace', requiredWorkspaceFromPath);
      return NextResponse.redirect(deniedUrl);
    }
  }

  if (normalizedLegacyPath) {
    return NextResponse.redirect(new URL(normalizedLegacyPath, request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
