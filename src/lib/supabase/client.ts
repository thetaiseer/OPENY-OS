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
    // Return a fully-recursive callable proxy so deep chains like
    // supabase.auth.onAuthStateChange(...) and supabase.from('x').select()
    // never throw at module load time.
    const makeNoOp = (): ReturnType<typeof createBrowserClient> => {
      // Use a function as the target so the proxy is both callable and
      // supports arbitrary property access at any depth.
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      const handler: ProxyHandler<object> = {
        get: () => makeNoOp(),
        apply: () => Promise.resolve({ data: null, error: null }),
      };
      return new Proxy(
        function () {} as unknown as ReturnType<typeof createBrowserClient>,
        handler,
      );
    };
    return makeNoOp();
  }
  return createBrowserClient(supabaseUrl, supabaseAnonKey, {
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}
