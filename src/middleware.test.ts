import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

afterEach(() => {
  vi.unstubAllEnvs();
});

async function loadMiddlewareWithBlankConfig() {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');
  return import('./middleware');
}

function requestFor(pathname: string) {
  return {
    url: `http://localhost:3000${pathname}`,
    nextUrl: new URL(`http://localhost:3000${pathname}`),
    cookies: {
      getAll: () => [],
      set: () => {},
    },
  } as unknown as NextRequest;
}

describe('middleware with blank Supabase config', () => {
  it('allows public files without creating a Supabase server client', async () => {
    const { middleware } = await loadMiddlewareWithBlankConfig();

    const response = await middleware(requestFor('/manifest.json'));

    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
  });

  it('redirects protected routes to login without creating a Supabase server client', async () => {
    const { middleware } = await loadMiddlewareWithBlankConfig();

    const response = await middleware(requestFor('/os/dashboard'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('http://localhost:3000/?next=%2Fos%2Fdashboard');
  });
});
