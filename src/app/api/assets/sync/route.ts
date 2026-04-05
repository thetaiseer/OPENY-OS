import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { scanDriveForSync, setFilePublicReadable, checkDriveFileExists, buildPreviewUrl, buildThumbnailUrl } from '@/lib/google-drive';
import type { DriveFileMeta } from '@/lib/google-drive';
import { requireRole } from '@/lib/api-auth';
import { insertWithColumnFallback } from '@/lib/asset-db';

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
  is_deleted: boolean | null;
}

interface SyncResult {
  success: boolean;
  files_added: number;
  files_updated: number;
  files_removed: number;
  errors_count: number;
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
    return { success: false, files_added: 0, files_updated: 0, files_removed: 0, errors_count: errors, error_details: errorDetails, duration_ms: duration, triggered_by: triggeredBy };
  }

  // ── 2. Load DB assets ────────────────────────────────────────────────────
  // Try with is_deleted in SELECT; fall back without it if the column is
  // missing (error code 42703 = undefined_column).  The root fix is to run
  // supabase-migration-missing-columns.sql.
  let hasIsDeleted = true;

  const primaryFetch = await supabase
    .from('assets')
    .select('id, name, drive_file_id, file_size, file_type, view_url, client_folder_name, content_type, month_key, is_deleted')
    .eq('storage_provider', 'google_drive')
    .not('drive_file_id', 'is', null);

  let dbRows: DbAsset[] | null = null;
  let fetchError = primaryFetch.error;

  if (primaryFetch.error?.code === '42703') {
    console.warn('[sync] Column "is_deleted" (or another sync column) missing — retrying without it. Run supabase-migration-missing-columns.sql.');
    hasIsDeleted = false;
    const fallback = await supabase
      .from('assets')
      .select('id, name, drive_file_id, file_size, file_type, view_url, client_folder_name, content_type, month_key')
      .eq('storage_provider', 'google_drive')
      .not('drive_file_id', 'is', null);
    dbRows = (fallback.data ?? []) as DbAsset[];
    fetchError = fallback.error;
  } else {
    dbRows = (primaryFetch.data ?? []) as DbAsset[];
  }

  if (fetchError) {
    recordError('DB fetch failed', fetchError);
    const duration = Date.now() - start;
    await logSyncResult(supabase, { added: 0, updated: 0, removed: 0, errors, error_details: errorDetails, duration_ms: duration, triggered_by: triggeredBy });
    return { success: false, files_added: 0, files_updated: 0, files_removed: 0, errors_count: errors, error_details: errorDetails, duration_ms: duration, triggered_by: triggeredBy };
  }

  const dbAssets = dbRows ?? [];

  // Single timestamp for this entire sync pass — all touched records share it.
  const syncNow = new Date().toISOString();

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

      // Build preview/thumbnail URLs from the Drive file ID (no extra API calls needed)
      const previewUrl   = buildPreviewUrl(driveId);
      const thumbnailUrl = buildThumbnailUrl(driveId, meta.thumbnail_link);

      // Use insertWithColumnFallback so missing columns (e.g. is_deleted,
      // last_synced_at) are stripped automatically and the insert still succeeds.
      const insertRow: Record<string, unknown> = {
        name:               meta.name,
        file_path:          null,
        file_url:           webViewLink,
        view_url:           webViewLink,
        download_url:       webContentLink,
        file_type:          meta.mime_type,
        mime_type:          meta.mime_type,
        file_size:          meta.file_size,
        bucket_name:        null,
        storage_provider:   'google_drive',
        drive_file_id:      driveId,
        drive_folder_id:    meta.drive_folder_id,
        client_name:        meta.client_folder_name,
        client_folder_name: meta.client_folder_name,
        content_type:       meta.content_type,
        month_key:          meta.month_key,
        preview_url:        previewUrl,
        thumbnail_url:      thumbnailUrl,
        web_view_link:      webViewLink,
        ...(hasIsDeleted ? { is_deleted: false } : {}),
        last_synced_at:     syncNow,
        source_updated_at:  meta.modified_time ?? null,
      };

      const { error: insertError } = await insertWithColumnFallback(
        (row) => supabase.from('assets').insert(row).select().single(),
        insertRow,
        '[sync:insert]',
      );

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

    // Only include last_synced_at if the column is known to exist
    if (hasIsDeleted) {
      updates.last_synced_at = syncNow;
      // Always refresh preview/thumbnail URLs and permissions metadata on each
      // sync pass so stale or missing values are repaired automatically.
      updates.preview_url   = buildPreviewUrl(driveId);
      updates.thumbnail_url = buildThumbnailUrl(driveId, meta.thumbnail_link);
    }

    // Always refresh canonical Drive URLs when we have them from the scan.
    // All three target different DB columns: view_url, file_url, and web_view_link.
    if (meta.web_view_link) {
      updates.view_url      = meta.web_view_link;  // legacy view_url column
      updates.file_url      = meta.web_view_link;  // primary file_url column
      updates.web_view_link = meta.web_view_link;  // dedicated web_view_link column
    }
    if (meta.web_content_link) {
      updates.download_url = meta.web_content_link;
    }

    let hasDataChanges = false;

    if (dbAsset.name !== meta.name) {
      updates.name = meta.name;
      hasDataChanges = true;
    }
    if (meta.file_size !== null && dbAsset.file_size !== meta.file_size) {
      updates.file_size = meta.file_size;
      hasDataChanges = true;
    }
    if (meta.mime_type && dbAsset.file_type !== meta.mime_type) {
      updates.file_type = meta.mime_type;
      updates.mime_type = meta.mime_type;
      hasDataChanges = true;
    }
    // source_updated_at is added by the same migration as is_deleted
    if (hasIsDeleted && meta.modified_time) {
      updates.source_updated_at = meta.modified_time;
    }
    // Re-activate a previously soft-deleted record that has reappeared in Drive
    if (hasIsDeleted && dbAsset.is_deleted) {
      updates.is_deleted = false;
      hasDataChanges = true;
    }

    // Skip update if there is nothing to write
    if (Object.keys(updates).length === 0) continue;

    try {
      const { error: updateError } = await supabase
        .from('assets')
        .update(updates)
        .eq('id', dbAsset.id);

      if (updateError) {
        // If the update fails because a migration column is still missing,
        // strip all migration-added columns and retry with the safe subset.
        if (updateError.code === '42703') {
          const migrationColumns = new Set([
            'is_deleted', 'last_synced_at', 'source_updated_at',
            'preview_url', 'thumbnail_url', 'mime_type', 'web_view_link',
          ]);
          const safeUpdates: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(updates)) {
            if (!migrationColumns.has(k)) safeUpdates[k] = v;
          }
          if (Object.keys(safeUpdates).length > 0) {
            const { error: retryError } = await supabase.from('assets').update(safeUpdates).eq('id', dbAsset.id);
            if (retryError) {
              recordError(`Update "${meta.name}"`, retryError);
            } else if (hasDataChanges) {
              updated++;
            }
          }
        } else {
          recordError(`Update "${meta.name}"`, updateError);
        }
      } else {
        if (hasDataChanges) {
          updated++;
          console.log('[sync] updated:', meta.name, '| driveId:', driveId, '| fields:', Object.keys(updates).join(', '));
        } else {
          console.debug('[sync] last_synced_at refreshed (no data change):', meta.name, '| driveId:', driveId);
        }
      }
    } catch (err: unknown) {
      recordError(`Update "${meta.name}"`, err);
    }
  }

  // ── 5. REMOVE: DB assets not found in Drive scan ─────────────────────────
  for (const [driveId, dbAsset] of dbMap) {
    if (driveMap.has(driveId)) continue;
    // Already soft-deleted — nothing more to do.
    if (hasIsDeleted && dbAsset.is_deleted) continue;

    // Verify by calling Drive directly — avoids false positives if the scan
    // missed a file (e.g. a path edge-case or transient API error).
    try {
      const exists = await checkDriveFileExists(driveId);
      if (exists) {
        // File still exists in Drive — just not under the expected path.
        // Do not remove from DB; it may have been moved.
        console.log('[sync] skipping removal — file still exists in Drive (possibly moved):', dbAsset.name);
        continue;
      }

      if (hasIsDeleted) {
        // Soft-delete: mark as deleted rather than hard-removing the DB record.
        const { error: softDeleteError } = await supabase
          .from('assets')
          .update({ is_deleted: true, last_synced_at: syncNow })
          .eq('id', dbAsset.id);

        if (softDeleteError) {
          recordError(`Remove "${dbAsset.name}"`, softDeleteError);
        } else {
          removed++;
          console.log('[sync] soft-deleted:', dbAsset.name, '| driveId:', driveId);
        }
      } else {
        // is_deleted column not available — hard-delete as fallback
        const { error: hardDeleteError } = await supabase
          .from('assets')
          .delete()
          .eq('id', dbAsset.id);

        if (hardDeleteError) {
          recordError(`Remove "${dbAsset.name}"`, hardDeleteError);
        } else {
          removed++;
          console.log('[sync] hard-deleted (is_deleted unavailable):', dbAsset.name, '| driveId:', driveId);
        }
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

  return { success: true, files_added: added, files_updated: updated, files_removed: removed, errors_count: errors, ...(errorDetails.length > 0 ? { error_details: errorDetails } : {}), duration_ms: duration, triggered_by: triggeredBy };
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
 * Admin only.
 */
export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ['admin']);
  if (auth instanceof NextResponse) return auth;

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
 * Triggers a manual Google Drive → DB sync. Admin only.
 */
export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ['admin']);
  if (auth instanceof NextResponse) return auth;

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
