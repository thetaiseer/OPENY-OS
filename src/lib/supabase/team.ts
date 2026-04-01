// ============================================================
// OPENY OS – Supabase Service: team_members
// Single source of truth: public.team_members
// ============================================================
import { getSupabaseClient } from "./client";
import { rowToCamel, objToSnake, dbLog, dbError } from "./helpers";

const TABLE = "team_members";
const LOG = "team";

async function fetchAll(callback: (rows: unknown[]) => void, onError?: (err: unknown) => void) {
  const sb = getSupabaseClient();
  const { data, error } = await sb.from(TABLE).select("*").order("created_at", { ascending: false });
  if (error) { dbError(LOG, "fetch error:", error); onError?.(error); return; }
  callback((data ?? []).map(rowToCamel));
}

export function subscribeToTeam(
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

export async function createTeamMember(payload: Record<string, unknown>): Promise<string> {
  const sb = getSupabaseClient();
  dbLog(LOG, "createTeamMember", payload);
  const { data, error } = await sb.from(TABLE).insert(objToSnake(payload)).select("id").single();
  if (error) { dbError(LOG, "createTeamMember error:", error); throw error; }
  return data.id as string;
}

export async function updateTeamMember(id: string, payload: Record<string, unknown>): Promise<void> {
  const sb = getSupabaseClient();
  dbLog(LOG, "updateTeamMember", id, payload);
  const { error } = await sb.from(TABLE).update(objToSnake(payload)).eq("id", id);
  if (error) { dbError(LOG, "updateTeamMember error:", error); throw error; }
}

export async function deleteTeamMember(id: string): Promise<void> {
  const sb = getSupabaseClient();
  dbLog(LOG, "deleteTeamMember", id);
  const { error } = await sb.from(TABLE).delete().eq("id", id);
  if (error) { dbError(LOG, "deleteTeamMember error:", error); throw error; }
}

export async function getTeamMemberByEmail(email: string): Promise<Record<string, unknown> | null> {
  const sb = getSupabaseClient();
  const { data, error } = await sb.from(TABLE).select("*").eq("email", email).limit(1);
  if (error) { dbError(LOG, "getTeamMemberByEmail error:", error); return null; }
  if (!data || data.length === 0) return null;
  return rowToCamel(data[0]);
}
