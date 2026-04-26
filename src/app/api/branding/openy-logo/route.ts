import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { OPENY_LOGO_DARK_FILE, OPENY_LOGO_LIGHT_FILE } from '@/lib/openy-brand';

const LOGO_CACHE_SECONDS = 60 * 60 * 24;
const LOGO_STALE_SECONDS = 60 * 60 * 24 * 7;

function fallbackSvg(variant: 'light' | 'dark') {
  const dark = variant === 'dark';
  const bg = dark ? '#020617' : '#ffffff';
  const text = dark ? '#ffffff' : '#000000';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="80" viewBox="0 0 300 80"><rect width="300" height="80" fill="${bg}"/><text x="24" y="51" font-family="Arial, sans-serif" font-size="38" font-weight="700" fill="${text}">OPENY</text></svg>`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const variant = searchParams.get('variant') === 'dark' ? 'dark' : 'light';
  const fileName = variant === 'dark' ? OPENY_LOGO_DARK_FILE : OPENY_LOGO_LIGHT_FILE;
  const filePath = path.join(process.cwd(), 'public', 'branding', fileName);

  try {
    const bytes = await readFile(filePath);
    return new NextResponse(bytes, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': `public, max-age=${LOGO_CACHE_SECONDS}, stale-while-revalidate=${LOGO_STALE_SECONDS}`,
      },
    });
  } catch (error) {
    console.error('[branding] failed to read OPENY logo file', filePath, error);
    return new NextResponse(fallbackSvg(variant), {
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=600',
      },
    });
  }
}
