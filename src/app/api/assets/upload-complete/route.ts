import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getStorageProvider } from '@/lib/storage';
import { requireRole } from '@/lib/api-auth';
import { insertWithColumnFallback, serializeDbError } from '@/lib/asset-db';

// ── Supabase service-role client (server only) ────────────────────────────────
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
  if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key);
}

/**
 * POST /api/assets/upload-complete
 *
 * Called by the browser after it has finished uploading a file directly to
 * Google Drive via the resumable upload URL.  This endpoint:
 *   1. Grants public read access to the uploaded file (drive_upload finalize).
 *   2. Fetches the canonical view / download URLs from Drive.
 *   3. Inserts an asset record in the Supabase `assets` table (database_insert).
 *   4. Logs an activity entry (fire-and-forget).
 *
 * NOTE: Drive upload is already complete when this endpoint is called.
 *       drive_upload failures do not originate here.
 *       If DB insert fails the Drive file is preserved (no rollback).
 *
 * Full success (stage: "completed"):
 *   { success: true, stage: "completed", file: {...}, remote: {...}, database: {...}, preview: {...} }
 *
 * Partial success (stage: "partial_success") — Drive upload OK, DB save failed:
 *   { success: true, stage: "partial_success", remote: {...}, database: { saved: false, error: {...} } }
 *
 * Failure (stage: "failed") — validation or server error before Drive completed:
 *   { success: false, stage: "failed", error: { step: "...", message: "...", code: "...", details: "..." } }
 *
 * Request body (JSON):
 *   driveFileId       – Google Drive file ID returned by the upload
 *   driveFolderId     – Drive folder ID (month folder from upload-session)
 *   clientFolderName  – normalised client folder name
 *   fileName          – renamed file name used on Drive
 *   fileType          – MIME type (nullable)
 *   fileSize          – file size in bytes (nullable)
 *   contentType       – content type label (e.g. "VIDEOS")
 *   monthKey          – "YYYY-MM"
 *   clientName        – client display name
 *   clientId          – (optional) Supabase client UUID
 *   uploadedBy        – (optional) uploader email or name
 */
export async function POST(req: NextRequest) {
  console.log('[upload-complete] POST /api/assets/upload-complete — start');
  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const auth = await requireRole(req, ['admin', 'team']);
    if (auth instanceof NextResponse) return auth;

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, stage: 'failed', error: { step: 'validation', message: 'Request body must be valid JSON', code: 'INVALID_JSON', details: null } },
        { status: 400 },
      );
    }

    const {
      driveFileId, driveFolderId, clientFolderName,
      fileName, fileType, fileSize,
      contentType, monthKey, clientName, clientId, uploadedBy,
    } = body;

    // ── Validate required fields ──────────────────────────────────────────────
    const validationError = (msg: string) => NextResponse.json(
      { success: false, stage: 'failed', error: { step: 'validation', message: msg, code: 'VALIDATION_ERROR', details: null } },
      { status: 400 },
    );

    if (!driveFileId || typeof driveFileId !== 'string') return validationError('driveFileId is required');
    if (!driveFolderId || typeof driveFolderId !== 'string') return validationError('driveFolderId is required');
    if (!clientFolderName || typeof clientFolderName !== 'string') return validationError('clientFolderName is required');
    if (!fileName || typeof fileName !== 'string') return validationError('fileName is required');
    if (!contentType || typeof contentType !== 'string') return validationError('contentType is required');
    if (!monthKey || typeof monthKey !== 'string' || !/^\d{4}-\d{2}$/.test(monthKey)) return validationError('monthKey must be in YYYY-MM format');
    if (!clientName || typeof clientName !== 'string') return validationError('clientName is required');

    const safeClientId   = clientId && typeof clientId === 'string' && clientId.trim() ? clientId.trim() : null;
    const safeUploadedBy = uploadedBy && typeof uploadedBy === 'string' && uploadedBy.trim() ? uploadedBy.trim() : null;
    const safeFileSize   = typeof fileSize === 'number' && fileSize > 0 ? fileSize : null;

    console.log('[upload-complete] file:', fileName, '| drive_file_id:', driveFileId, '| client:', clientName);

    // ── Step 1: drive_upload finalize — set permissions + fetch canonical links ─
    // If this step fails we fall back to constructed URLs and continue.
    // Preview failure must NOT mark the upload as failed.
    let webViewLink    = `https://drive.google.com/file/d/${driveFileId}/view`;
    let webContentLink = `https://drive.google.com/uc?id=${driveFileId}&export=download`;
    let thumbnailLink: string | null = null;
    let driveMimeType: string | null = null;
    let previewOk      = true;
    let previewReason: string | null = null;

    try {
      const provider = getStorageProvider();
      const finalized = await provider.finalizeUpload(driveFileId);
      webViewLink    = finalized.viewUrl;
      webContentLink = finalized.downloadUrl;
      thumbnailLink  = finalized.thumbnailLink;
      driveMimeType  = finalized.mimeType;
      console.log('[upload-complete] ✅ drive_upload finalize OK — view:', webViewLink);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[upload-complete] ⚠️ finalizeFileAfterUpload failed — using fallback URLs:', msg);
      previewOk     = false;
      previewReason = msg;
      // Fallback URLs already set; proceed to database_insert.
    }

    // ── Step 2: database_insert ───────────────────────────────────────────────
    // Drive upload already succeeded. If DB insert fails → partial_success.
    // Drive file is preserved (no rollback).
    console.log('[upload-complete] database_insert — inserting into assets table…');
    const supabase = getSupabase();

    const requiredRow: Record<string, unknown> = {
      name:               fileName,
      file_path:          null,
      file_url:           webViewLink,
      view_url:           webViewLink,
      download_url:       webContentLink,
      file_type:          typeof fileType === 'string' && fileType ? fileType : null,
      file_size:          safeFileSize,
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

    // Optional preview columns — stripped automatically on 42703 (missing column) errors
    const provider = getStorageProvider();
    const previewFields: Record<string, unknown> = {
      mime_type:     driveMimeType ?? (typeof fileType === 'string' && fileType ? fileType : null),
      preview_url:   provider.getPreviewUrl(driveFileId),
      thumbnail_url: provider.getThumbnailUrl(driveFileId, thumbnailLink),
      web_view_link: webViewLink,
    };

    let inserted: Record<string, unknown>;
    try {
      const fullRow = { ...requiredRow, ...previewFields };
      console.log('[upload-complete] insert payload keys:', Object.keys(fullRow).join(', '));

      const { data, error: dbError } = await insertWithColumnFallback(
        (row) => supabase.from('assets').insert(row).select().single(),
        fullRow,
        '[upload-complete]',
      );

      if (dbError) {
        // database_insert failed — Drive file preserved (no rollback) → partial_success.
        console.error('[upload-complete] ❌ database_insert failed — code:', dbError.code, '| msg:', dbError.message);
        console.error('[upload-complete] ❌ database_insert error details:', serializeDbError(dbError));
        console.warn('[upload-complete] ⚠️ Drive file preserved — returning partial_success for:', driveFileId);
        return NextResponse.json(
          {
            success: true,
            stage:   'partial_success',
            remote:  { uploaded: true, id: driveFileId },
            database: {
              saved: false,
              error: {
                message: dbError.message,
                code:    dbError.code    ?? null,
                details: dbError.details ?? null,
                hint:    dbError.hint    ?? null,
              },
            },
          },
          { status: 200 },
        );
      }
      inserted = data as Record<string, unknown>;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[upload-complete] ❌ database_insert exception:', msg);
      console.warn('[upload-complete] ⚠️ Drive file preserved — returning partial_success for:', driveFileId);
      return NextResponse.json(
        {
          success: true,
          stage:   'partial_success',
          remote:  { uploaded: true, id: driveFileId },
          database: {
            saved: false,
            error: {
              message: msg,
              code:    'DB_EXCEPTION',
              details: null,
              hint:    null,
            },
          },
        },
        { status: 200 },
      );
    }

    console.log('[upload-complete] ✅ database_insert OK — asset id:', inserted?.id);

    // ── Activity log (fire-and-forget) ────────────────────────────────────────
    void supabase.from('activities').insert({
      type: 'asset',
      description: `Asset "${fileName}" uploaded to Google Drive (${clientFolderName}/${contentType}/${monthKey})${safeUploadedBy ? ` by ${safeUploadedBy}` : ''}`,
      ...(safeClientId ? { client_id: safeClientId } : {}),
    }).then(({ error }) => {
      if (error) console.warn('[upload-complete] activity log insert failed:', error.message);
    });

    console.log('[upload-complete] ✅ response_return — stage: completed, assetId:', inserted?.id);
    return NextResponse.json(
      {
        success:  true,
        stage:    'completed',
        file:     { name: fileName, size: safeFileSize },
        remote:   { uploaded: true, id: driveFileId },
        database: { saved: true, id: inserted?.id ?? null },
        preview:  { ok: previewOk, reason: previewReason },
        asset:    inserted,
      },
      { status: 201 },
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[upload-complete] ❌ Unexpected error:', msg);
    return NextResponse.json(
      {
        success: false,
        stage:   'failed',
        error:   { step: 'server_error', message: `Unexpected server error: ${msg}`, code: 'SERVER_ERROR', details: null },
      },
      { status: 500 },
    );
  }
}
