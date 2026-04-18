import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getWorkspaceFromAppPath, isGlobalOwnerEmail, type WorkspaceKey } from '@/lib/workspace-access';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const LEGACY_OS_REDIRECTS: Record<string, string> = {
  '/dashboard': '/os/dashboard',
  '/clients': '/os/clients',
  '/tasks': '/os/tasks',
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

export async function middleware(request: NextRequest) {
  const looksConfigured =
    !!supabaseUrl &&
    !!supabaseAnonKey &&
    /^https?:\/\//.test(supabaseUrl) &&
    !/your[-_ ]?supabase/i.test(supabaseUrl) &&
    !/your[-_ ]?anon/i.test(supabaseAnonKey);

  if (!looksConfigured) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  let supabase;
  try {
    supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    });
  } catch {
    return NextResponse.next({ request });
  }

  // IMPORTANT: always call getUser() to refresh the session token.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const signupModeRequested = request.nextUrl.searchParams.get('mode') === 'signup';

  if (pathname === '/' && signupModeRequested) {
    const redirectUrl = new URL('/', request.url);
    request.nextUrl.searchParams.forEach((value, key) => {
      if (key !== 'mode') redirectUrl.searchParams.set(key, value);
    });
    redirectUrl.searchParams.set('invite_only', '1');
    return NextResponse.redirect(redirectUrl);
  }

  if (pathname === '/signup' || pathname.startsWith('/signup/') || pathname === '/register' || pathname.startsWith('/register/')) {
    const redirectUrl = new URL('/', request.url);
    redirectUrl.searchParams.set('invite_only', '1');
    return NextResponse.redirect(redirectUrl);
  }

  const normalizedLegacyPath = LEGACY_OS_REDIRECTS[pathname];
  const requiredWorkspaceFromPath = getWorkspaceFromAppPath(pathname) ?? (normalizedLegacyPath ? 'os' : null);

  // Routes that are always public — no auth required.
  // Note: /api/ routes are excluded from middleware because each API route
  // enforces its own authentication via getApiUser() / requireRole() helpers.
  // This avoids middleware interfering with cookie parsing in Route Handlers.
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
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon');

  if (pathname === '/choose-workspace') {
    return NextResponse.redirect(new URL('/?switch=1', request.url));
  }

  if (pathname === '/select-workspace') {
    return NextResponse.redirect(new URL('/?switch=1', request.url));
  }

  if (isPublicRoute) {
    return supabaseResponse;
  }

  const loginRouteForWorkspace = (workspace: WorkspaceKey | null) => {
    if (workspace === 'docs') return '/?workspace=docs';
    if (workspace === 'os') return '/?workspace=os';
    return '/';
  };

  // If there is no authenticated user, redirect to the workspace login page.
  if (!user) {
    const loginUrl = new URL(loginRouteForWorkspace(requiredWorkspaceFromPath), request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Enforce workspace-level authorization for protected app routes.
  if (requiredWorkspaceFromPath && !isGlobalOwnerEmail(user.email)) {
    const { data: membership } = await supabase
      .from('workspace_memberships')
      .select('id')
      .eq('user_id', user.id)
      .eq('workspace_key', requiredWorkspaceFromPath)
      .eq('is_active', true)
      .maybeSingle();

    if (!membership) {
      const deniedUrl = new URL('/access-denied', request.url);
      deniedUrl.searchParams.set('workspace', requiredWorkspaceFromPath);
      return NextResponse.redirect(deniedUrl);
    }
  }

  // Normalize legacy OPENY OS paths into the /os namespace.
  if (normalizedLegacyPath) {
    return NextResponse.redirect(new URL(normalizedLegacyPath, request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static files and images:
     *   - _next/static (static files)
     *   - _next/image  (image optimisation)
     *   - favicon.ico  (browser icon)
     *   - public image extensions
     */
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
