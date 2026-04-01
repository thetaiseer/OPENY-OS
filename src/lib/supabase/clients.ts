// ============================================================
// OPENY OS – Supabase Service: clients
// Single source of truth: public.clients
// ============================================================
import { getSupabaseClient } from "./client";
import { rowToCamel, objToSnake, dbLog, dbError } from "./helpers";

const TABLE = "clients";
const LOG = "clients";

// ── Shared re-fetch ───────────────────────────────────────────

async function fetchAll(callback: (rows: unknown[]) => void, onError?: (err: unknown) => void) {
  const sb = getSupabaseClient();
  const { data, error } = await sb.from(TABLE).select("*").order("created_at", { ascending: false });
  if (error) { dbError(LOG, "fetch error:", error); onError?.(error); return; }
  const rows = (data ?? []).map(rowToCamel);
  dbLog(LOG, "fetch – docs:", rows.length);
  callback(rows);
}

// ── Subscribe ─────────────────────────────────────────────────

export function subscribeToClients(
  callback: (rows: unknown[]) => void,
  onError?: (err: unknown) => void
): () => void {
  dbLog(LOG, "subscribing to", TABLE);
  fetchAll(callback, onError);

  const sb = getSupabaseClient();
  const channel = sb
    .channel(`${TABLE}-changes`)
    .on("postgres_changes", { event: "*", schema: "public", table: TABLE }, () =>
      fetchAll(callback)
    )
    .subscribe();

  return () => { sb.removeChannel(channel); };
}

// ── Create ────────────────────────────────────────────────────

export async function createClient(payload: Record<string, unknown>): Promise<string> {
  const sb = getSupabaseClient();
  dbLog(LOG, "createClient", payload);
  const { data, error } = await sb.from(TABLE).insert(objToSnake(payload)).select("id").single();
  if (error) { dbError(LOG, "createClient error:", error); throw error; }
  dbLog(LOG, "created id:", data.id);
  return data.id as string;
}

// ── Update ────────────────────────────────────────────────────

export async function updateClient(id: string, payload: Record<string, unknown>): Promise<void> {
  const sb = getSupabaseClient();
  dbLog(LOG, "updateClient", id, payload);
  const { error } = await sb.from(TABLE).update(objToSnake(payload)).eq("id", id);
  if (error) { dbError(LOG, "updateClient error:", error); throw error; }
  dbLog(LOG, "updated", id);
}

// ── Delete ────────────────────────────────────────────────────

export async function deleteClient(id: string): Promise<void> {
  const sb = getSupabaseClient();
  dbLog(LOG, "deleteClient", id);
  const { error } = await sb.from(TABLE).delete().eq("id", id);
  if (error) { dbError(LOG, "deleteClient error:", error); throw error; }
  dbLog(LOG, "deleted", id);
}
