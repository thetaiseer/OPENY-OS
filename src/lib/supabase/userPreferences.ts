// ============================================================
// OPENY OS – Supabase Service: user_ui_preferences
// Stores per-user UI preferences (theme, language) so they
// sync across all devices automatically.
// Single source of truth: public.user_ui_preferences
// ============================================================
import { getSupabaseClient } from "./client";
import { dbLog, dbError } from "./helpers";

const TABLE = "user_ui_preferences";
const LOG = "userPrefs";

export function subscribeToUserPreferences(
  userId: string,
  callback: (row: Record<string, unknown> | null) => void,
  onError?: (err: unknown) => void
): () => void {
  dbLog(LOG, "subscribing for userId:", userId);

  const sb = getSupabaseClient();

  const fetch = async () => {
    const { data, error } = await sb.from(TABLE).select("*").eq("user_id", userId).limit(1);
    if (error) { dbError(LOG, "fetch error:", error); onError?.(error); return; }
    if (data && data.length > 0) {
      // Return the flat preferences object (theme, language, etc.)
      callback((data[0].preferences as Record<string, unknown>) ?? null);
    } else {
      callback(null);
    }
  };

  fetch();

  const channel = sb
    .channel(`${TABLE}-${userId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: TABLE }, fetch)
    .subscribe();

  return () => { sb.removeChannel(channel); };
}

export async function upsertUserPreferences(
  userId: string,
  prefs: Record<string, unknown>
): Promise<string> {
  const sb = getSupabaseClient();
  const { data: existing } = await sb
    .from(TABLE)
    .select("id")
    .eq("user_id", userId)
    .limit(1);

  if (existing && existing.length > 0) {
    const { error } = await sb
      .from(TABLE)
      .update({ preferences: prefs, updated_at: new Date().toISOString() })
      .eq("user_id", userId);
    if (error) throw error;
    return existing[0].id as string;
  } else {
    const { data, error } = await sb
      .from(TABLE)
      .insert({
        user_id: userId,
        preferences: prefs,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) throw error;
    return data.id as string;
  }
}
