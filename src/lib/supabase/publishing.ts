// ============================================================
// OPENY OS – Supabase Service: publishing_events
// Single source of truth: public.publishing_events
// ============================================================
import { getSupabaseClient } from "./client";
import { rowToCamel, objToSnake, dbLog, dbError } from "./helpers";

const TABLE = "publishing_events";
const LOG = "publishing";

async function fetchAll(callback: (rows: unknown[]) => void, onError?: (err: unknown) => void) {
  const sb = getSupabaseClient();
  const { data, error } = await sb.from(TABLE).select("*").order("created_at", { ascending: false });
  if (error) { dbError(LOG, "fetch error:", error); onError?.(error); return; }
  callback((data ?? []).map(rowToCamel));
}

export function subscribeToPublishingEvents(
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

export async function createPublishingEvent(data: Record<string, unknown>): Promise<string> {
  const sb = getSupabaseClient();
  const now = new Date().toISOString();
  const payload = {
    content_item_id: data.contentItemId ?? null,
    client_id: data.clientId ?? null,
    platform: data.platform ?? null,
    status: data.status ?? "pending",
    scheduled_at: data.scheduledAt ?? null,
    published_at: null,
    failure_reason: null,
    failure_log: [],
    retries: 0,
    created_at: now,
    updated_at: now,
  };
  dbLog(LOG, "createPublishingEvent", payload);
  const { data: row, error } = await sb.from(TABLE).insert(payload).select("id").single();
  if (error) { dbError(LOG, "createPublishingEvent error:", error); throw error; }
  return row.id as string;
}

export async function updatePublishingEvent(id: string, data: Record<string, unknown>): Promise<void> {
  const sb = getSupabaseClient();
  const payload = { ...objToSnake(data), updated_at: new Date().toISOString() };
  dbLog(LOG, "updatePublishingEvent", id, payload);
  const { error } = await sb.from(TABLE).update(payload).eq("id", id);
  if (error) { dbError(LOG, "updatePublishingEvent error:", error); throw error; }
}

export async function recordPublishingFailure(payload: Record<string, unknown>): Promise<string> {
  const sb = getSupabaseClient();
  const now = new Date().toISOString();
  const row = {
    content_item_id: (payload.contentItemId as string) ?? null,
    client_id: (payload.clientId as string) ?? null,
    platform: (payload.platform as string) ?? null,
    status: "failed",
    failure_reason: (payload.reason as string) ?? null,
    failure_log: [{ note: payload.note, reportedBy: payload.reportedBy, timestamp: now }],
    retries: 1,
    created_at: now,
    updated_at: now,
  };
  dbLog(LOG, "recordPublishingFailure", row);
  const { data, error } = await sb.from(TABLE).insert(row).select("id").single();
  if (error) { dbError(LOG, "recordPublishingFailure error:", error); throw error; }
  return data.id as string;
}
