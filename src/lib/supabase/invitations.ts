// ============================================================
// OPENY OS – Supabase Service: invitations
// Single source of truth: public.invitations
// ============================================================
import { getSupabaseClient } from "./client";
import { rowToCamel, objToSnake, dbLog, dbError } from "./helpers";

const TABLE = "invitations";
const LOG = "invitations";

async function fetchAll(callback: (rows: unknown[]) => void, onError?: (err: unknown) => void) {
  const sb = getSupabaseClient();
  const { data, error } = await sb.from(TABLE).select("*").order("created_at", { ascending: false });
  if (error) { dbError(LOG, "fetch error:", error); onError?.(error); return; }
  callback((data ?? []).map(rowToCamel));
}

export function subscribeToInvitations(
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

export async function createInvitation(data: Record<string, unknown>): Promise<string> {
  const sb = getSupabaseClient();
  const now = new Date().toISOString();
  const payload = {
    email: data.email,
    name: data.name ?? null,
    role: data.role ?? null,
    team_role: data.teamRole ?? "creative",
    token: data.token,
    status: "pending",
    invited_by: data.invitedBy ?? null,
    expires_at: data.expiresAt ?? null,
    created_at: now,
    updated_at: now,
  };
  dbLog(LOG, "createInvitation", payload);
  const { data: row, error } = await sb.from(TABLE).insert(payload).select("id").single();
  if (error) { dbError(LOG, "createInvitation error:", error); throw error; }
  return row.id as string;
}

export async function updateInvitation(id: string, data: Record<string, unknown>): Promise<void> {
  const sb = getSupabaseClient();
  const payload = { ...objToSnake(data), updated_at: new Date().toISOString() };
  dbLog(LOG, "updateInvitation", id, payload);
  const { error } = await sb.from(TABLE).update(payload).eq("id", id);
  if (error) { dbError(LOG, "updateInvitation error:", error); throw error; }
}

export async function getInvitationByToken(token: string): Promise<Record<string, unknown> | null> {
  const sb = getSupabaseClient();
  dbLog(LOG, "getInvitationByToken", token);
  const { data, error } = await sb.from(TABLE).select("*").eq("token", token).limit(1);
  if (error) { dbError(LOG, "getInvitationByToken error:", error); return null; }
  if (!data || data.length === 0) return null;
  return rowToCamel(data[0]);
}
