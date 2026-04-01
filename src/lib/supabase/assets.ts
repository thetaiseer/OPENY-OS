// ============================================================
// OPENY OS – Supabase Service: assets
// Single source of truth: public.assets
// ============================================================
import { getSupabaseClient } from "./client";
import { rowToCamel, objToSnake, dbLog, dbError } from "./helpers";

const TABLE = "assets";
const LOG = "assets";

async function fetchAll(callback: (rows: unknown[]) => void, onError?: (err: unknown) => void) {
  const sb = getSupabaseClient();
  const { data, error } = await sb.from(TABLE).select("*").order("created_at", { ascending: false });
  if (error) { dbError(LOG, "fetch error:", error); onError?.(error); return; }
  callback((data ?? []).map(rowToCamel));
}

export function subscribeToAssets(
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

export async function createAsset(data: Record<string, unknown>): Promise<string> {
  const sb = getSupabaseClient();
  const now = new Date().toISOString();
  const payload = {
    client_id: data.clientId ?? null,
    name: data.name,
    type: data.type ?? null,
    file_url: data.fileUrl ?? "",
    thumbnail_url: data.thumbnailUrl ?? "",
    file_size: data.fileSize ?? 0,
    format: data.format ?? "",
    tags: data.tags ?? [],
    folder: data.folder ?? "",
    uploaded_by: data.uploadedBy ?? "",
    created_at: now,
    updated_at: now,
  };
  dbLog(LOG, "createAsset", payload);
  const { data: row, error } = await sb.from(TABLE).insert(payload).select("id").single();
  if (error) { dbError(LOG, "createAsset error:", error); throw error; }
  return row.id as string;
}

export async function updateAsset(id: string, data: Record<string, unknown>): Promise<void> {
  const sb = getSupabaseClient();
  const payload = { ...objToSnake(data), updated_at: new Date().toISOString() };
  dbLog(LOG, "updateAsset", id, payload);
  const { error } = await sb.from(TABLE).update(payload).eq("id", id);
  if (error) { dbError(LOG, "updateAsset error:", error); throw error; }
}

export async function deleteAsset(id: string): Promise<void> {
  const sb = getSupabaseClient();
  dbLog(LOG, "deleteAsset", id);
  const { error } = await sb.from(TABLE).delete().eq("id", id);
  if (error) { dbError(LOG, "deleteAsset error:", error); throw error; }
}

// ── Supabase Storage helpers ──────────────────────────────────

const STORAGE_BUCKET = "assets";

/**
 * Upload a file to Supabase Storage and return its public URL.
 * The returned URL can be stored in the `fileUrl` field of an asset record.
 */
export async function uploadAssetFile(
  clientId: string,
  file: File
): Promise<string> {
  const sb = getSupabaseClient();
  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${clientId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await sb.storage.from(STORAGE_BUCKET).upload(path, file);
  if (error) { dbError(LOG, "uploadAssetFile error:", error); throw error; }
  const { data } = sb.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Delete a file from Supabase Storage by its public URL.
 */
export async function deleteAssetFile(fileUrl: string): Promise<void> {
  const sb = getSupabaseClient();
  // Extract the storage path from the public URL
  const parts = fileUrl.split(`/storage/v1/object/public/${STORAGE_BUCKET}/`);
  if (parts.length < 2) return; // Not a Supabase Storage URL
  const path = parts[1];
  const { error } = await sb.storage.from(STORAGE_BUCKET).remove([path]);
  if (error) { dbError(LOG, "deleteAssetFile error:", error); throw error; }
}
