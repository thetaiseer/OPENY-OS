/**
 * Supabase service-role client — server only.
 *
 * Uses NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 * Bypasses Row-Level Security — never import this in browser/client components.
 *
 * Import the factory function instead of creating per-route client instances:
 *   import { getServiceClient, getSupabaseUrl } from '@/lib/supabase/service-client';
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | undefined;
let _url: string | undefined;

/** Return the shared service-role Supabase client (lazy singleton). */
export function getServiceClient(): SupabaseClient {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url) throw new Error('[supabase/service-client] Missing NEXT_PUBLIC_SUPABASE_URL');
    if (!key) throw new Error('[supabase/service-client] Missing SUPABASE_SERVICE_ROLE_KEY');
    _client = createClient(url, key);
    _url    = url;
  }
  return _client;
}

/** Return the Supabase project URL (derived from the same env var as the client). */
export function getSupabaseUrl(): string {
  if (!_url) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!url) throw new Error('[supabase/service-client] Missing NEXT_PUBLIC_SUPABASE_URL');
    _url = url;
  }
  return _url;
}
