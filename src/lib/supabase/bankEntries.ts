// ============================================================
// OPENY OS – Supabase Service: bank_entries
// Single source of truth: public.bank_entries
// ============================================================
import { getSupabaseClient } from "./client";
import { rowToCamel, dbLog, dbError } from "./helpers";

const TABLE = "bank_entries";
const LOG = "bankEntries";

async function fetchAll(callback: (rows: unknown[]) => void, onError?: (err: unknown) => void) {
  const sb = getSupabaseClient();
  const { data, error } = await sb.from(TABLE).select("*").order("created_at", { ascending: false });
  if (error) { dbError(LOG, "fetch error:", error); onError?.(error); return; }
  callback((data ?? []).map(rowToCamel));
}

export function subscribeToBankEntries(
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

export async function createBankEntry(data: Record<string, unknown>): Promise<string> {
  const sb = getSupabaseClient();
  const payload = {
    client_id: data.clientId ?? null,
    category: data.category ?? null,
    text: data.text,
    tags: data.tags ?? [],
    platform: data.platform ?? null,
    created_at: new Date().toISOString(),
  };
  dbLog(LOG, "createBankEntry", payload);
  const { data: row, error } = await sb.from(TABLE).insert(payload).select("id").single();
  if (error) { dbError(LOG, "createBankEntry error:", error); throw error; }
  return row.id as string;
}

export async function deleteBankEntry(id: string): Promise<void> {
  const sb = getSupabaseClient();
  dbLog(LOG, "deleteBankEntry", id);
  const { error } = await sb.from(TABLE).delete().eq("id", id);
  if (error) { dbError(LOG, "deleteBankEntry error:", error); throw error; }
}
