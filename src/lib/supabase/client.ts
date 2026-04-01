// ============================================================
// OPENY OS – Supabase Browser Client
// Single source of truth for all client-side Supabase access.
// Uses NEXT_PUBLIC_* env vars (safe to expose to the browser).
// DO NOT import server.ts from here or any client component.
// ============================================================
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Singleton – one client per browser tab.
let _client: ReturnType<typeof createSupabaseClient> | null = null;

export function getSupabaseClient() {
  if (!_client) {
    if (!url || !anonKey) {
      console.error(
        "[OPENY:supabase] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
      );
    }
    _client = createSupabaseClient(url ?? "", anonKey ?? "");
  }
  return _client;
}
