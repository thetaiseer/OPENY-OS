// ============================================================
// OPENY OS – Supabase Service: tasks
// Single source of truth: public.tasks
// ============================================================
import { getSupabaseClient } from "./client";
import { rowToCamel, objToSnake, dbLog, dbError } from "./helpers";

const TABLE = "tasks";
const LOG = "tasks";

async function fetchAll(callback: (rows: unknown[]) => void, onError?: (err: unknown) => void) {
  const sb = getSupabaseClient();
  const { data, error } = await sb.from(TABLE).select("*").order("created_at", { ascending: false });
  if (error) { dbError(LOG, "fetch error:", error); onError?.(error); return; }
  callback((data ?? []).map(rowToCamel));
}

export function subscribeToTasks(
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

export async function createTask(payload: Record<string, unknown>): Promise<string> {
  const sb = getSupabaseClient();
  dbLog(LOG, "createTask", payload);
  const { data, error } = await sb.from(TABLE).insert(objToSnake(payload)).select("id").single();
  if (error) { dbError(LOG, "createTask error:", error); throw error; }
  return data.id as string;
}

export async function updateTask(id: string, payload: Record<string, unknown>): Promise<void> {
  const sb = getSupabaseClient();
  dbLog(LOG, "updateTask", id, payload);
  const { error } = await sb.from(TABLE).update(objToSnake(payload)).eq("id", id);
  if (error) { dbError(LOG, "updateTask error:", error); throw error; }
}

export async function deleteTask(id: string): Promise<void> {
  const sb = getSupabaseClient();
  dbLog(LOG, "deleteTask", id);
  const { error } = await sb.from(TABLE).delete().eq("id", id);
  if (error) { dbError(LOG, "deleteTask error:", error); throw error; }
}
