// ============================================================
// OPENY OS – Supabase Service: client_notes
// Single source of truth: public.client_notes
// ============================================================
import { getSupabaseClient } from "./client";
import { rowToCamel, objToSnake, dbLog, dbError } from "./helpers";

const TABLE = "client_notes";
const LOG = "clientNotes";

async function fetchAll(callback: (rows: unknown[]) => void, onError?: (err: unknown) => void) {
  const sb = getSupabaseClient();
  const { data, error } = await sb.from(TABLE).select("*").order("created_at", { ascending: false });
  if (error) { dbError(LOG, "fetch error:", error); onError?.(error); return; }
  callback((data ?? []).map(rowToCamel));
}

export function subscribeToClientNotes(
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

export async function createClientNote(data: Record<string, unknown>): Promise<string> {
  const sb = getSupabaseClient();
  const now = new Date().toISOString();
  const payload = {
    client_id: data.clientId ?? null,
    content: data.content,
    created_by: data.createdBy ?? "",
    created_at: now,
    updated_at: now,
  };
  dbLog(LOG, "createClientNote", payload);
  const { data: row, error } = await sb.from(TABLE).insert(payload).select("id").single();
  if (error) { dbError(LOG, "createClientNote error:", error); throw error; }
  return row.id as string;
}

export async function updateClientNote(id: string, data: Record<string, unknown>): Promise<void> {
  const sb = getSupabaseClient();
  const payload = { ...objToSnake(data), updated_at: new Date().toISOString() };
  dbLog(LOG, "updateClientNote", id, payload);
  const { error } = await sb.from(TABLE).update(payload).eq("id", id);
  if (error) { dbError(LOG, "updateClientNote error:", error); throw error; }
}

export async function deleteClientNote(id: string): Promise<void> {
  const sb = getSupabaseClient();
  dbLog(LOG, "deleteClientNote", id);
  const { error } = await sb.from(TABLE).delete().eq("id", id);
  if (error) { dbError(LOG, "deleteClientNote error:", error); throw error; }
}
