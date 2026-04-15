import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { OWNER_EMAIL } from '@/lib/constants/auth';

const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
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
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
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

  // IMPORTANT: always call getUser() to refresh the session token.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Routes that are always public — no auth required.
  // Note: /api/ routes are excluded from middleware because each API route
  // enforces its own authentication via getApiUser() / requireRole() helpers.
  // This avoids middleware interfering with cookie parsing in Route Handlers.
  const isPublicRoute =
    pathname.startsWith('/login') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/reset-password') ||
    pathname === '/invite' ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon');

  if (isPublicRoute) {
    return supabaseResponse;
  }

  // If there is no authenticated user, redirect to the login page.
  if (!user) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // OPENY DOCS is owner-only at route level.
  if (pathname === '/docs' || pathname.startsWith('/docs/')) {
    if ((user.email ?? '').toLowerCase() !== OWNER_EMAIL) {
      return NextResponse.redirect(new URL('/select-workspace', request.url));
    }
  }

  // Normalize legacy OPENY OS paths into the /os namespace.
  const normalized = LEGACY_OS_REDIRECTS[pathname];
  if (normalized) {
    return NextResponse.redirect(new URL(normalized, request.url));
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
