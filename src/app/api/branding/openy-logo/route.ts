import { NextRequest, NextResponse } from 'next/server';
import { OPENY_LOGO_DARK_SOURCE_URL, OPENY_LOGO_LIGHT_SOURCE_URL } from '@/lib/openy-brand';

function fallbackSvg(variant: 'light' | 'dark') {
  const dark = variant === 'dark';
  const bg = dark ? '#020617' : '#ffffff';
  const text = dark ? '#ffffff' : '#000000';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="80" viewBox="0 0 300 80"><rect width="300" height="80" fill="${bg}"/><text x="24" y="51" font-family="Arial, sans-serif" font-size="38" font-weight="700" fill="${text}">OPENY</text></svg>`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const variant = searchParams.get('variant') === 'dark' ? 'dark' : 'light';
  const source = variant === 'dark' ? OPENY_LOGO_DARK_SOURCE_URL : OPENY_LOGO_LIGHT_SOURCE_URL;

  try {
    const res = await fetch(source, {
      headers: { 'User-Agent': 'OPENY-OS branding proxy' },
      cache: 'force-cache',
      next: { revalidate: 60 * 60 * 24 },
    });

    if (!res.ok) throw new Error(`Logo upstream failed: ${res.status}`);

    const bytes = await res.arrayBuffer();
    return new NextResponse(bytes, {
      headers: {
        'Content-Type': res.headers.get('content-type') ?? 'image/png',
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      },
    });
  } catch (error) {
    console.error('[branding] failed to fetch OPENY logo', error);
    return new NextResponse(fallbackSvg(variant), {
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=600',
      },
    });
  }
}
