import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { finalizeFileAfterUpload, buildPreviewUrl, buildThumbnailUrl } from '@/lib/google-drive';
import { requireRole } from '@/lib/api-auth';

// ── Supabase service-role client (server only) ────────────────────────────────
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
  if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key);
}

/**
 * Extract the column name from a PostgreSQL 42703 "undefined_column" error.
 * The message typically reads: column "xyz" of relation "table" does not exist
 */
function extractMissingColumn(err: { message?: string; details?: string }): string | null {
  const text = `${err.message ?? ''} ${err.details ?? ''}`;
  const m = text.match(/column "([^"]+)"/);
  return m?.[1] ?? null;
}

/**
 * Insert a row into the assets table, automatically retrying without any
 * column that PostgreSQL reports as undefined (error code 42703).
 * This makes uploads robust against schema migrations not yet applied to the DB.
 */
const MAX_COLUMN_RETRIES = 10;

async function insertWithColumnFallback(
  supabase: ReturnType<typeof getSupabase>,
  row: Record<string, unknown>,
  logPrefix: string,
): Promise<{ data: Record<string, unknown> | null; error: { message: string; code: string; details?: string; hint?: string } | null; finalRow: Record<string, unknown> }> {
  let currentRow = { ...row };
  let result = await supabase.from('assets').insert(currentRow).select().single();
  let attempts = 0;

  while (result.error?.code === '42703' && attempts < MAX_COLUMN_RETRIES) {
    const col = extractMissingColumn(result.error as { message?: string; details?: string });
    if (!col || !(col in currentRow)) break;
    console.warn(
      `${logPrefix} ⚠️  Column "${col}" does not exist in the assets table — ` +
      'removing from insert payload and retrying. ' +
      'Run supabase-migration-missing-columns.sql to add the missing column.',
    );
    const stripped = { ...currentRow };
    delete stripped[col];
    currentRow = stripped;
    result = await supabase.from('assets').insert(currentRow).select().single();
    attempts++;
  }

  return {
    data:     result.data as Record<string, unknown> | null,
    error:    result.error as { message: string; code: string; details?: string; hint?: string } | null,
    finalRow: currentRow,
  };
}

/**
 * POST /api/assets/upload-complete
 *
 * Called by the browser after it has finished uploading a file directly to
 * Google Drive via the resumable upload URL.  This endpoint:
 *   1. Grants public read access to the uploaded file.
 *   2. Fetches the canonical view / download URLs from Drive.
 *   3. Inserts an asset record in the Supabase `assets` table.
 *   4. Logs an activity entry (fire-and-forget).
 *
 * Request body (JSON):
 *   driveFileId       – Google Drive file ID returned by the upload
 *   driveFolderId     – Drive folder ID (month folder from upload-session)
 *   clientFolderName  – normalised client folder name
 *   fileName          – original file name
 *   fileType          – MIME type (nullable)
 *   fileSize          – file size in bytes (nullable)
 *   contentType       – content type label (e.g. "VIDEOS")
 *   monthKey          – "YYYY-MM"
 *   clientName        – client display name
 *   clientId          – (optional) Supabase client UUID
 */
export async function POST(req: NextRequest) {
  console.log('[upload-complete] POST /api/assets/upload-complete');
  try {
    // ── Auth: only admin and team members may complete uploads ─────────────────
    const auth = await requireRole(req, ['admin', 'team']);
    if (auth instanceof NextResponse) return auth;

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Request body must be valid JSON' }, { status: 400 });
    }

    const {
      driveFileId,
      driveFolderId,
      clientFolderName,
      fileName,
      fileType,
      fileSize,
      contentType,
      monthKey,
      clientName,
      clientId,
      uploadedBy,
    } = body;

    // ── Validate required fields ──────────────────────────────────────────────
    if (!driveFileId || typeof driveFileId !== 'string') {
      return NextResponse.json({ success: false, error: 'driveFileId is required' }, { status: 400 });
    }
    if (!driveFolderId || typeof driveFolderId !== 'string') {
      return NextResponse.json({ success: false, error: 'driveFolderId is required' }, { status: 400 });
    }
    if (!clientFolderName || typeof clientFolderName !== 'string') {
      return NextResponse.json({ success: false, error: 'clientFolderName is required' }, { status: 400 });
    }
    if (!fileName || typeof fileName !== 'string') {
      return NextResponse.json({ success: false, error: 'fileName is required' }, { status: 400 });
    }
    if (!contentType || typeof contentType !== 'string') {
      return NextResponse.json({ success: false, error: 'contentType is required' }, { status: 400 });
    }
    if (!monthKey || typeof monthKey !== 'string' || !/^\d{4}-\d{2}$/.test(monthKey)) {
      return NextResponse.json(
        { success: false, error: 'monthKey is required and must be in YYYY-MM format' },
        { status: 400 },
      );
    }
    if (!clientName || typeof clientName !== 'string') {
      return NextResponse.json({ success: false, error: 'clientName is required' }, { status: 400 });
    }

    const safeClientId =
      clientId && typeof clientId === 'string' && clientId.trim() ? clientId.trim() : null;
    const safeUploadedBy =
      uploadedBy && typeof uploadedBy === 'string' && uploadedBy.trim() ? uploadedBy.trim() : null;

    console.log('[upload-complete] file:', fileName, '| drive_file_id:', driveFileId, '| client:', clientName);

    // ── Finalise: set permissions + fetch links ───────────────────────────────
    let webViewLink: string;
    let webContentLink: string;
    let thumbnailLink: string | null;
    let driveMimeType: string | null;
    try {
      ({ webViewLink, webContentLink, thumbnailLink, mimeType: driveMimeType } = await finalizeFileAfterUpload(driveFileId));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[upload-complete] ❌ finalizeFileAfterUpload failed:', msg);
      return NextResponse.json({ success: false, error: `Failed to finalize Drive file: ${msg}` }, { status: 502 });
    }

    // ── Insert asset record in Supabase ───────────────────────────────────────
    console.log('[upload-complete] inserting into assets table…');
    const supabase = getSupabase();

    // Required fields — upload must not succeed without these.
    const requiredRow: Record<string, unknown> = {
      name:               fileName,
      file_path:          null,
      file_url:           webViewLink,
      view_url:           webViewLink,
      download_url:       webContentLink,
      file_type:          typeof fileType === 'string' && fileType ? fileType : null,
      file_size:          typeof fileSize === 'number' && fileSize > 0 ? fileSize : null,
      bucket_name:        null,
      storage_provider:   'google_drive',
      drive_file_id:      driveFileId,
      drive_folder_id:    driveFolderId,
      client_name:        clientName,
      client_folder_name: clientFolderName,
      content_type:       contentType,
      month_key:          monthKey,
      ...(safeUploadedBy ? { uploaded_by: safeUploadedBy } : {}),
    };
    if (safeClientId) requiredRow.client_id = safeClientId;

    // Optional preview metadata — if these columns are missing from the DB
    // schema (error code 42703) we retry without them so the upload still
    // succeeds.  Run supabase-migration-missing-columns.sql to add them.
    const previewFields: Record<string, unknown> = {
      mime_type:     driveMimeType ?? (typeof fileType === 'string' && fileType ? fileType : null),
      preview_url:   buildPreviewUrl(driveFileId),
      thumbnail_url: buildThumbnailUrl(driveFileId, thumbnailLink),
      web_view_link: webViewLink,
    };

    let inserted: Record<string, unknown>;
    try {
      const fullRow = { ...requiredRow, ...previewFields };
      console.log('[upload-complete] insert payload:', JSON.stringify(fullRow, null, 2));

      const { data, error: dbError, finalRow } = await insertWithColumnFallback(
        supabase,
        fullRow,
        '[upload-complete]',
      );

      if (dbError) {
        console.error('[upload-complete] ❌ Supabase insert error — full error object:', JSON.stringify(dbError, null, 2));
        console.error('[upload-complete] ❌ message:', dbError.message);
        console.error('[upload-complete] ❌ code:', dbError.code);
        console.error('[upload-complete] ❌ details:', dbError.details ?? '(none)');
        console.error('[upload-complete] ❌ hint:', dbError.hint ?? '(none)');
        return NextResponse.json(
          {
            success: false,
            error: `Failed to save asset metadata: ${dbError.message}${dbError.details ? ` — ${dbError.details}` : ''}${dbError.hint ? ` (hint: ${dbError.hint})` : ''}`,
            supabase_error: {
              message: dbError.message,
              code:    dbError.code,
              details: dbError.details,
              hint:    dbError.hint,
            },
            insert_payload: finalRow,
          },
          { status: 500 },
        );
      }
      inserted = data as Record<string, unknown>;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[upload-complete] ❌ DB insert exception:', msg);
      return NextResponse.json({ success: false, error: `Failed to save asset metadata: ${msg}` }, { status: 500 });
    }

    console.log('[upload-complete] ✅ asset saved — id:', inserted?.id);

    // ── Activity log (fire-and-forget) ────────────────────────────────────────
    void supabase.from('activities').insert({
      type: 'asset',
      description: `Asset "${fileName}" uploaded to Google Drive (${clientFolderName}/${contentType}/${monthKey})${safeUploadedBy ? ` by ${safeUploadedBy}` : ''}`,
      ...(safeClientId ? { client_id: safeClientId } : {}),
    }).then(({ error }) => {
      if (error) console.warn('[upload-complete] activity log insert failed:', error.message);
    });

    return NextResponse.json({ success: true, asset: inserted }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[upload-complete] UPLOAD ERROR:', err);
    return NextResponse.json({ success: false, error: `Unexpected server error: ${msg}` }, { status: 500 });
  }
}
