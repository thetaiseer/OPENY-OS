import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const missingConfigMessage =
  'Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local, then restart the dev server.';

type BrowserClient = ReturnType<typeof createBrowserClient>;

function createNoopQuery() {
  const result = Promise.resolve({ data: null, error: null });
  const query = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'then') return result.then.bind(result);
        if (prop === 'catch') return result.catch.bind(result);
        if (prop === 'finally') return result.finally.bind(result);
        return () => query;
      },
    },
  );
  return query;
}

function createMissingConfigError() {
  return { message: missingConfigMessage, name: 'SupabaseConfigurationError' };
}

function createNoopClient(): BrowserClient {
  const authResponse = () => Promise.resolve({ data: { user: null, session: null }, error: null });
  const authErrorResponse = () =>
    Promise.resolve({ data: null, error: createMissingConfigError() });

  return {
    auth: {
      getSession: authResponse,
      getUser: authResponse,
      onAuthStateChange: () => ({
        data: {
          subscription: {
            id: 'noop',
            callback: () => {},
            unsubscribe: () => {},
          },
        },
      }),
      signInWithPassword: authErrorResponse,
      signOut: () => Promise.resolve({ error: null }),
      resetPasswordForEmail: authErrorResponse,
      exchangeCodeForSession: authErrorResponse,
      updateUser: authErrorResponse,
    },
    from: () => createNoopQuery(),
    channel: () => ({
      on: () => ({ subscribe: () => ({ unsubscribe: () => {} }) }),
      subscribe: () => ({ unsubscribe: () => {} }),
      unsubscribe: () => {},
    }),
    removeChannel: () => Promise.resolve('ok'),
    storage: {
      from: () => ({
        upload: authErrorResponse,
        download: authErrorResponse,
        remove: authErrorResponse,
        getPublicUrl: () => ({ data: { publicUrl: '' } }),
      }),
    },
  } as unknown as BrowserClient;
}

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
    return createNoopClient();
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
