/**
 * Legacy re-export — prefer importing from '@/lib/supabase/client' directly.
 * Kept so that existing code that imports from '@/lib/supabase' continues to work.
 *
 * The client is created lazily (on first property access) via a Proxy so that
 * importing this module at the top of a file does NOT trigger createBrowserClient()
 * at module-evaluation time.  Without this, Next.js static prerender attempts that
 * run before NEXT_PUBLIC_SUPABASE_* env vars are resolved will throw.
 */
import { createClient } from './supabase/client';

type SupabaseClientType = ReturnType<typeof createClient>;

let _client: SupabaseClientType | null = null;

function getClient(): SupabaseClientType {
  if (!_client) _client = createClient();
  return _client;
}

const lazySupabase = new Proxy({} as SupabaseClientType, {
  get(_target, prop, receiver) {
    return Reflect.get(getClient(), prop, receiver);
  },
  apply(_target, thisArg, args) {
    return Reflect.apply(getClient() as unknown as (...a: unknown[]) => unknown, thisArg, args);
  },
});

export const supabase = lazySupabase;
export default supabase;
