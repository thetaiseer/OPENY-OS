import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

/**
 * Returns a Supabase browser client.
 *
 * When NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not
 * set (e.g. during `next build` in a CI environment without those vars),
 * this returns a no-op proxy instead of throwing.  All real supabase calls
 * happen at runtime in the browser where the env vars are embedded in the
 * bundle by Webpack.
 */
export function createClient(): ReturnType<typeof createBrowserClient> {
  if (!supabaseUrl || !supabaseAnonKey) {
    // Build-time guard: env vars not available yet.
    // Return a proxy that satisfies type-checking without throwing.
    return new Proxy({} as ReturnType<typeof createBrowserClient>, {
      get(_target, prop) {
        // Return nested proxies so call-chains like supabase.from('x').select() don't throw.
        if (typeof prop === 'string') {
          return (..._args: unknown[]) =>
            new Proxy({} as object, {
              get(_t2, _p2) {
                return (..._a: unknown[]) => Promise.resolve({ data: null, error: null });
              },
            });
        }
        return undefined;
      },
    });
  }
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
