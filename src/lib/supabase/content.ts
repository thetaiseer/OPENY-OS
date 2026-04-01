// ============================================================
// OPENY OS – Supabase Service: content_items
// Single source of truth: public.content_items
// ============================================================
import { getSupabaseClient } from "./client";
import { rowToCamel, objToSnake, dbLog, dbError } from "./helpers";

const TABLE = "content_items";
const LOG = "contentItems";

async function fetchAll(callback: (rows: unknown[]) => void, onError?: (err: unknown) => void) {
  const sb = getSupabaseClient();
  const { data, error } = await sb.from(TABLE).select("*").order("created_at", { ascending: false });
  if (error) { dbError(LOG, "fetch error:", error); onError?.(error); return; }
  callback((data ?? []).map(rowToCamel));
}

export function subscribeToContentItems(
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

export async function createContentItem(data: Record<string, unknown>): Promise<string> {
  const sb = getSupabaseClient();
  const now = new Date().toISOString();
  const payload = {
    client_id: data.clientId ?? null,
    title: data.title,
    description: data.description ?? "",
    caption: data.caption ?? "",
    hashtags: data.hashtags ?? [],
    platform: data.platform ?? null,
    content_type: data.contentType ?? null,
    status: data.status ?? "idea",
    priority: data.priority ?? "medium",
    assigned_to: data.assignedTo ?? "",
    scheduled_date: data.scheduledDate ?? "",
    scheduled_time: data.scheduledTime ?? "",
    published_at: null,
    approval_status: data.approvalStatus ?? "pending_internal",
    attachments: data.attachments ?? [],
    comments: [],
    created_at: now,
    updated_at: now,
  };
  dbLog(LOG, "createContentItem", payload);
  const { data: row, error } = await sb.from(TABLE).insert(payload).select("id").single();
  if (error) { dbError(LOG, "createContentItem error:", error); throw error; }
  return row.id as string;
}

export async function updateContentItem(id: string, data: Record<string, unknown>): Promise<void> {
  const sb = getSupabaseClient();
  const payload = { ...objToSnake(data), updated_at: new Date().toISOString() };
  dbLog(LOG, "updateContentItem", id, payload);
  const { error } = await sb.from(TABLE).update(payload).eq("id", id);
  if (error) { dbError(LOG, "updateContentItem error:", error); throw error; }
}

export async function addContentComment(id: string, comment: Record<string, unknown>): Promise<void> {
  const sb = getSupabaseClient();
  const newComment = { ...comment, id: crypto.randomUUID() };
  dbLog(LOG, "addContentComment", id, newComment);
  // Fetch current comments, append, then update
  const { data: row, error: fetchErr } = await sb.from(TABLE).select("comments").eq("id", id).single();
  if (fetchErr) { dbError(LOG, "addContentComment fetch error:", fetchErr); throw fetchErr; }
  const existing = Array.isArray(row.comments) ? row.comments : [];
  const { error } = await sb
    .from(TABLE)
    .update({ comments: [...existing, newComment], updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) { dbError(LOG, "addContentComment error:", error); throw error; }
}

export async function deleteContentItem(id: string): Promise<void> {
  const sb = getSupabaseClient();
  dbLog(LOG, "deleteContentItem", id);
  const { error } = await sb.from(TABLE).delete().eq("id", id);
  if (error) { dbError(LOG, "deleteContentItem error:", error); throw error; }
}
