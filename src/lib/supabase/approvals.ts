// ============================================================
// OPENY OS – Supabase Service: approvals
// Single source of truth: public.approvals
// ============================================================
import { getSupabaseClient } from "./client";
import { rowToCamel, objToSnake, dbLog, dbError } from "./helpers";

const TABLE = "approvals";
const LOG = "approvals";

async function fetchAll(callback: (rows: unknown[]) => void, onError?: (err: unknown) => void) {
  const sb = getSupabaseClient();
  const { data, error } = await sb.from(TABLE).select("*").order("created_at", { ascending: false });
  if (error) { dbError(LOG, "fetch error:", error); onError?.(error); return; }
  callback((data ?? []).map(rowToCamel));
}

export function subscribeToApprovals(
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

export async function createApproval(data: Record<string, unknown>): Promise<string> {
  const sb = getSupabaseClient();
  const now = new Date().toISOString();
  const payload = {
    content_item_id: data.contentItemId ?? null,
    client_id: data.clientId ?? null,
    status: data.status ?? "pending_internal",
    assigned_to: data.assignedTo ?? "",
    internal_comments: [],
    client_comments: [],
    created_at: now,
    updated_at: now,
  };
  dbLog(LOG, "createApproval", payload);
  const { data: row, error } = await sb.from(TABLE).insert(payload).select("id").single();
  if (error) { dbError(LOG, "createApproval error:", error); throw error; }
  return row.id as string;
}

export async function updateApproval(id: string, data: Record<string, unknown>): Promise<void> {
  const sb = getSupabaseClient();
  const payload = { ...objToSnake(data), updated_at: new Date().toISOString() };
  dbLog(LOG, "updateApproval", id, payload);
  const { error } = await sb.from(TABLE).update(payload).eq("id", id);
  if (error) { dbError(LOG, "updateApproval error:", error); throw error; }
}

export async function updateApprovalStatus(id: string, status: string): Promise<void> {
  const sb = getSupabaseClient();
  dbLog(LOG, "updateApprovalStatus", id, status);
  const { error } = await sb
    .from(TABLE)
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) { dbError(LOG, "updateApprovalStatus error:", error); throw error; }
}

export async function addApprovalInternalComment(
  id: string,
  comment: Record<string, unknown>
): Promise<void> {
  const sb = getSupabaseClient();
  const newComment = { ...comment, id: crypto.randomUUID() };
  const { data: row, error: fetchErr } = await sb
    .from(TABLE)
    .select("internal_comments")
    .eq("id", id)
    .single();
  if (fetchErr) throw fetchErr;
  const existing = Array.isArray(row.internal_comments) ? row.internal_comments : [];
  const { error } = await sb
    .from(TABLE)
    .update({ internal_comments: [...existing, newComment], updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) { dbError(LOG, "addApprovalInternalComment error:", error); throw error; }
}

export async function addApprovalClientComment(
  id: string,
  comment: Record<string, unknown>
): Promise<void> {
  const sb = getSupabaseClient();
  const newComment = { ...comment, id: crypto.randomUUID() };
  const { data: row, error: fetchErr } = await sb
    .from(TABLE)
    .select("client_comments")
    .eq("id", id)
    .single();
  if (fetchErr) throw fetchErr;
  const existing = Array.isArray(row.client_comments) ? row.client_comments : [];
  const { error } = await sb
    .from(TABLE)
    .update({ client_comments: [...existing, newComment], updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) { dbError(LOG, "addApprovalClientComment error:", error); throw error; }
}

export async function deleteApproval(id: string): Promise<void> {
  const sb = getSupabaseClient();
  dbLog(LOG, "deleteApproval", id);
  const { error } = await sb.from(TABLE).delete().eq("id", id);
  if (error) { dbError(LOG, "deleteApproval error:", error); throw error; }
}
