// ============================================================
// OPENY OS – Supabase Service: activities
// Single source of truth: public.activities
// ============================================================
import { getSupabaseClient } from "./client";
import { rowToCamel, objToSnake, dbLog, dbError } from "./helpers";

const TABLE = "activities";
const LOG = "activities";

async function fetchAll(callback: (rows: unknown[]) => void, onError?: (err: unknown) => void) {
  const sb = getSupabaseClient();
  const { data, error } = await sb.from(TABLE).select("*").order("timestamp", { ascending: false });
  if (error) { dbError(LOG, "fetch error:", error); onError?.(error); return; }
  callback((data ?? []).map(rowToCamel));
}

export function subscribeToActivities(
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

export async function createActivity(
  type: string,
  message: string,
  detail: string,
  entityId?: string
): Promise<string> {
  const sb = getSupabaseClient();
  const payload = {
    type,
    message,
    detail,
    entity_id: entityId ?? null,
    timestamp: new Date().toISOString(),
  };
  dbLog(LOG, "createActivity", payload);
  const { data, error } = await sb.from(TABLE).insert(payload).select("id").single();
  if (error) { dbError(LOG, "createActivity error:", error); throw error; }
  return data.id as string;
}

export async function clearAllActivities(): Promise<void> {
  const sb = getSupabaseClient();
  dbLog(LOG, "clearAllActivities");
  const { error } = await sb.from(TABLE).delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (error) { dbError(LOG, "clearAllActivities error:", error); throw error; }
  dbLog(LOG, "clearAllActivities done");
}
