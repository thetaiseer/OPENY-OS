import { NextResponse } from 'next/server';
import { OPENY_LOGO_DARK_URL, OPENY_LOGO_LIGHT_URL } from '@/lib/openy-brand';

const LOGO_CACHE_SECONDS = 60 * 60 * 24;
const LOGO_STALE_SECONDS = 60 * 60 * 24 * 7;

/**
 * GET /api/branding/openy-logo?variant=light|dark
 *
 * Redirects to the canonical CDN asset so bookmarks and older links keep working.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const variant = searchParams.get('variant') === 'dark' ? 'dark' : 'light';
  const target = variant === 'dark' ? OPENY_LOGO_DARK_URL : OPENY_LOGO_LIGHT_URL;

  return NextResponse.redirect(target, {
    status: 302,
    headers: {
      'Cache-Control': `public, max-age=${LOGO_CACHE_SECONDS}, stale-while-revalidate=${LOGO_STALE_SECONDS}`,
    },
  });
}
