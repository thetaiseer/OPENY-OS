import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { scanDriveForSync, setFilePublicReadable, checkDriveFileExists } from '@/lib/google-drive';
import type { DriveFileMeta } from '@/lib/google-drive';

// ── Supabase service-role client ──────────────────────────────────────────────

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
  if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key);
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface DbAsset {
  id: string;
  name: string;
  drive_file_id: string | null;
  file_size: number | null;
  file_type: string | null;
  view_url: string | null;
  client_folder_name: string | null;
  content_type: string | null;
  month_key: string | null;
}

interface SyncResult {
  success: boolean;
  added: number;
  updated: number;
  removed: number;
  errors: number;
  error_details?: string[];
  duration_ms: number;
  triggered_by: 'manual' | 'cron';
}

// ── Core sync logic ───────────────────────────────────────────────────────────

const MAX_ERROR_DETAILS = 30;

/**
 * Perform a full Google Drive → Supabase sync.
 *
 * Reconciliation rules:
 *  - File in Drive but not in DB  → INSERT  (+ grant public read access)
 *  - File in Drive and in DB      → UPDATE  metadata if name / size changed
 *  - File in DB but not in Drive  → verify via Drive.files.get; DELETE if confirmed 404
 */
async function runSync(triggeredBy: 'manual' | 'cron'): Promise<SyncResult> {
  const start = Date.now();
  const supabase = getSupabase();

  let added = 0, updated = 0, removed = 0, errors = 0;
  const errorDetails: string[] = [];

  function recordError(label: string, err: unknown) {
    errors++;
    const msg = err instanceof Error ? err.message : String(err);
    const entry = `${label}: ${msg}`;
    console.error('[sync]', entry);
    if (errorDetails.length < MAX_ERROR_DETAILS) errorDetails.push(entry);
  }

  // ── 1. Scan Drive ────────────────────────────────────────────────────────
  let driveFiles: DriveFileMeta[];
  try {
    driveFiles = await scanDriveForSync();
  } catch (err: unknown) {
    recordError('Drive scan failed', err);
    const duration = Date.now() - start;
    await logSyncResult(supabase, { added: 0, updated: 0, removed: 0, errors, error_details: errorDetails, duration_ms: duration, triggered_by: triggeredBy });
    return { success: false, added: 0, updated: 0, removed: 0, errors, error_details: errorDetails, duration_ms: duration, triggered_by: triggeredBy };
  }

  // ── 2. Load DB assets ────────────────────────────────────────────────────
  const { data: dbRows, error: fetchError } = await supabase
    .from('assets')
    .select('id, name, drive_file_id, file_size, file_type, view_url, client_folder_name, content_type, month_key')
    .eq('storage_provider', 'google_drive')
    .not('drive_file_id', 'is', null);

  if (fetchError) {
    recordError('DB fetch failed', fetchError);
    const duration = Date.now() - start;
    await logSyncResult(supabase, { added: 0, updated: 0, removed: 0, errors, error_details: errorDetails, duration_ms: duration, triggered_by: triggeredBy });
    return { success: false, added: 0, updated: 0, removed: 0, errors, error_details: errorDetails, duration_ms: duration, triggered_by: triggeredBy };
  }

  const dbAssets = (dbRows ?? []) as DbAsset[];

  // Build lookup maps
  const driveMap = new Map<string, DriveFileMeta>();
  for (const f of driveFiles) driveMap.set(f.drive_file_id, f);

  const dbMap = new Map<string, DbAsset>();
  for (const a of dbAssets) {
    if (a.drive_file_id) dbMap.set(a.drive_file_id, a);
  }

  // ── 3. INSERT: files in Drive but not in DB ──────────────────────────────
  for (const [driveId, meta] of driveMap) {
    if (dbMap.has(driveId)) continue;

    try {
      // Grant public read access so the file is viewable in the UI
      const { webViewLink, webContentLink } = await setFilePublicReadable(driveId);

      const { error: insertError } = await supabase.from('assets').insert({
        name:               meta.name,
        file_path:          null,
        file_url:           webViewLink,
        view_url:           webViewLink,
        download_url:       webContentLink,
        file_type:          meta.mime_type,
        file_size:          meta.file_size,
        bucket_name:        null,
        storage_provider:   'google_drive',
        drive_file_id:      driveId,
        drive_folder_id:    meta.drive_folder_id,
        client_name:        meta.client_folder_name,
        client_folder_name: meta.client_folder_name,
        content_type:       meta.content_type,
        month_key:          meta.month_key,
      });

      if (insertError) {
        recordError(`Insert "${meta.name}"`, insertError);
      } else {
        added++;
        console.log('[sync] inserted:', meta.name, '| driveId:', driveId);
      }
    } catch (err: unknown) {
      recordError(`Insert "${meta.name}"`, err);
    }
  }

  // ── 4. UPDATE: files in both Drive and DB — patch changed metadata ───────
  for (const [driveId, meta] of driveMap) {
    const dbAsset = dbMap.get(driveId);
    if (!dbAsset) continue;

    const updates: Record<string, unknown> = {};

    if (dbAsset.name !== meta.name) {
      updates.name = meta.name;
    }
    if (meta.file_size !== null && dbAsset.file_size !== meta.file_size) {
      updates.file_size = meta.file_size;
    }
    if (meta.mime_type && dbAsset.file_type !== meta.mime_type) {
      updates.file_type = meta.mime_type;
    }

    if (Object.keys(updates).length === 0) continue;

    try {
      const { error: updateError } = await supabase
        .from('assets')
        .update(updates)
        .eq('id', dbAsset.id);

      if (updateError) {
        recordError(`Update "${meta.name}"`, updateError);
      } else {
        updated++;
        console.log('[sync] updated:', meta.name, '| driveId:', driveId, '| fields:', Object.keys(updates).join(', '));
      }
    } catch (err: unknown) {
      recordError(`Update "${meta.name}"`, err);
    }
  }

  // ── 5. REMOVE: DB assets not found in Drive scan ─────────────────────────
  for (const [driveId, dbAsset] of dbMap) {
    if (driveMap.has(driveId)) continue;

    // Verify by calling Drive directly — avoids false positives if the scan
    // missed a file (e.g. a path edge-case or transient API error).
    try {
      const exists = await checkDriveFileExists(driveId);
      if (exists) {
        // File still exists in Drive — just not under the expected path.
        // Do not delete from DB; it may have been moved.
        console.log('[sync] skipping removal — file still exists in Drive (possibly moved):', dbAsset.name);
        continue;
      }

      const { error: deleteError } = await supabase
        .from('assets')
        .delete()
        .eq('id', dbAsset.id);

      if (deleteError) {
        recordError(`Remove "${dbAsset.name}"`, deleteError);
      } else {
        removed++;
        console.log('[sync] removed:', dbAsset.name, '| driveId:', driveId);
      }
    } catch (err: unknown) {
      // Transient Drive API error — skip to avoid accidental data loss
      console.warn('[sync] skipping removal due to Drive check error for', dbAsset.name, err);
    }
  }

  const duration = Date.now() - start;

  // ── 6. Persist sync log ──────────────────────────────────────────────────
  await logSyncResult(supabase, { added, updated, removed, errors, error_details: errorDetails, duration_ms: duration, triggered_by: triggeredBy });

  console.log(`[sync] ✅ done — added:${added} updated:${updated} removed:${removed} errors:${errors} (${duration}ms)`);

  return { success: true, added, updated, removed, errors, ...(errorDetails.length > 0 ? { error_details: errorDetails } : {}), duration_ms: duration, triggered_by: triggeredBy };
}

async function logSyncResult(
  supabase: ReturnType<typeof getSupabase>,
  data: { added: number; updated: number; removed: number; errors: number; error_details: string[]; duration_ms: number; triggered_by: 'manual' | 'cron' },
) {
  const { error } = await supabase.from('drive_sync_logs').insert({
    files_added:   data.added,
    files_updated: data.updated,
    files_removed: data.removed,
    errors_count:  data.errors,
    error_details: data.error_details,
    duration_ms:   data.duration_ms,
    triggered_by:  data.triggered_by,
  });
  if (error) {
    console.warn('[sync] failed to write sync log:', error.message);
  }
}

// ── Route handlers ────────────────────────────────────────────────────────────

/**
 * GET /api/assets/sync
 * Returns the most recent sync log entry (last sync time + summary).
 */
export async function GET(_req: NextRequest) {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('drive_sync_logs')
      .select('*')
      .order('synced_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, last_sync: data ?? null });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

/**
 * POST /api/assets/sync
 * Triggers a manual Google Drive → DB sync.
 * Accepts an optional JSON body with `{ triggered_by: "manual" | "cron" }`.
 */
export async function POST(req: NextRequest) {
  let triggeredBy: 'manual' | 'cron' = 'manual';
  try {
    const body = await req.json() as { triggered_by?: string };
    if (body?.triggered_by === 'cron') triggeredBy = 'cron';
  } catch {
    // Body absent or not JSON — default to manual
  }

  console.log(`[sync] POST /api/assets/sync — ${triggeredBy} sync triggered`);
  try {
    const result = await runSync(triggeredBy);
    return NextResponse.json(result, { status: result.success ? 200 : 500 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[sync] unexpected error:', msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
