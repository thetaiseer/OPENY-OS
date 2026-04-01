// ============================================================
// OPENY OS – Supabase Service: notifications
// Single source of truth: public.notifications
// ============================================================
import { getSupabaseClient } from "./client";
import { rowToCamel, dbLog, dbError } from "./helpers";

const TABLE = "notifications";
const LOG = "notifications";

async function fetchAll(callback: (rows: unknown[]) => void, onError?: (err: unknown) => void) {
  const sb = getSupabaseClient();
  const { data, error } = await sb.from(TABLE).select("*").order("created_at", { ascending: false });
  if (error) { dbError(LOG, "fetch error:", error); onError?.(error); return; }
  callback((data ?? []).map(rowToCamel));
}

export function subscribeToNotifications(
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

export async function pushNotification(
  type: string,
  title: string,
  message: string,
  entityId?: string
): Promise<string> {
  const sb = getSupabaseClient();
  const payload = {
    type,
    title,
    message,
    entity_id: entityId ?? null,
    is_read: false,
    created_at: new Date().toISOString(),
  };
  dbLog(LOG, "pushNotification", payload);
  const { data, error } = await sb.from(TABLE).insert(payload).select("id").single();
  if (error) { dbError(LOG, "pushNotification error:", error); throw error; }
  return data.id as string;
}

export async function markNotificationRead(id: string): Promise<void> {
  const sb = getSupabaseClient();
  const { error } = await sb.from(TABLE).update({ is_read: true }).eq("id", id);
  if (error) { dbError(LOG, "markNotificationRead error:", error); throw error; }
}

export async function markAllNotificationsRead(notifications: unknown[]): Promise<void> {
  const sb = getSupabaseClient();
  const ids = (notifications as Array<{ id: string }>)
    .filter((n) => n.id)
    .map((n) => n.id);
  if (ids.length === 0) {
    // Mark all unread
    const { error } = await sb.from(TABLE).update({ is_read: true }).eq("is_read", false);
    if (error) { dbError(LOG, "markAllNotificationsRead error:", error); throw error; }
  } else {
    const { error } = await sb.from(TABLE).update({ is_read: true }).in("id", ids);
    if (error) { dbError(LOG, "markAllNotificationsRead error:", error); throw error; }
  }
}

export async function deleteNotification(id: string): Promise<void> {
  const sb = getSupabaseClient();
  const { error } = await sb.from(TABLE).delete().eq("id", id);
  if (error) { dbError(LOG, "deleteNotification error:", error); throw error; }
}
