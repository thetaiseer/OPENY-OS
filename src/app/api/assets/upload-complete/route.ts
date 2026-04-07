import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { finalizeFileAfterUpload, buildPreviewUrl, buildThumbnailUrl } from '@/lib/google-drive';
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
 * Full success:    { success: true, driveUploaded: true, dbSaved: true,  asset: {...} }
 * Partial success: { success: true, driveUploaded: true, dbSaved: false, warning: "..." }
 * Failure:         { success: false, step: "validation"|"finalize", error: "..." }
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
        { success: false, step: 'validation', error: 'Request body must be valid JSON' },
        { status: 400 },
      );
    }

    const {
      driveFileId, driveFolderId, clientFolderName,
      fileName, fileType, fileSize,
      contentType, monthKey, clientName, clientId, uploadedBy,
    } = body;

    // ── Validate required fields ──────────────────────────────────────────────
    if (!driveFileId || typeof driveFileId !== 'string')
      return NextResponse.json({ success: false, step: 'validation', error: 'driveFileId is required' }, { status: 400 });
    if (!driveFolderId || typeof driveFolderId !== 'string')
      return NextResponse.json({ success: false, step: 'validation', error: 'driveFolderId is required' }, { status: 400 });
    if (!clientFolderName || typeof clientFolderName !== 'string')
      return NextResponse.json({ success: false, step: 'validation', error: 'clientFolderName is required' }, { status: 400 });
    if (!fileName || typeof fileName !== 'string')
      return NextResponse.json({ success: false, step: 'validation', error: 'fileName is required' }, { status: 400 });
    if (!contentType || typeof contentType !== 'string')
      return NextResponse.json({ success: false, step: 'validation', error: 'contentType is required' }, { status: 400 });
    if (!monthKey || typeof monthKey !== 'string' || !/^\d{4}-\d{2}$/.test(monthKey))
      return NextResponse.json({ success: false, step: 'validation', error: 'monthKey must be in YYYY-MM format' }, { status: 400 });
    if (!clientName || typeof clientName !== 'string')
      return NextResponse.json({ success: false, step: 'validation', error: 'clientName is required' }, { status: 400 });

    const safeClientId   = clientId && typeof clientId === 'string' && clientId.trim() ? clientId.trim() : null;
    const safeUploadedBy = uploadedBy && typeof uploadedBy === 'string' && uploadedBy.trim() ? uploadedBy.trim() : null;

    console.log('[upload-complete] file:', fileName, '| drive_file_id:', driveFileId, '| client:', clientName);

    // ── Step 1: drive_upload finalize — set permissions + fetch canonical links ─
    // If this step fails we fall back to constructed URLs and continue.
    let webViewLink    = `https://drive.google.com/file/d/${driveFileId}/view`;
    let webContentLink = `https://drive.google.com/uc?id=${driveFileId}&export=download`;
    let thumbnailLink: string | null = null;
    let driveMimeType: string | null = null;
    try {
      ({ webViewLink, webContentLink, thumbnailLink, mimeType: driveMimeType } =
        await finalizeFileAfterUpload(driveFileId));
      console.log('[upload-complete] ✅ drive_upload finalize OK — view:', webViewLink);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[upload-complete] ⚠️ finalizeFileAfterUpload failed — using fallback URLs:', msg);
      // Fallback URLs are already set above; proceed to database_insert.
    }

    // ── Step 2: database_insert ───────────────────────────────────────────────
    // Drive upload already succeeded. If DB insert fails we return partial
    // success — the Drive file is preserved (no rollback).
    console.log('[upload-complete] database_insert — inserting into assets table…');
    const supabase = getSupabase();

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

    // Optional preview columns — stripped automatically on 42703 (missing column) errors
    const previewFields: Record<string, unknown> = {
      mime_type:     driveMimeType ?? (typeof fileType === 'string' && fileType ? fileType : null),
      preview_url:   buildPreviewUrl(driveFileId),
      thumbnail_url: buildThumbnailUrl(driveFileId, thumbnailLink),
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
        // database_insert failed — Drive file is preserved (no rollback).
        console.error('[upload-complete] ❌ database_insert failed — code:', dbError.code, '| msg:', dbError.message);
        console.error('[upload-complete] ❌ database_insert error details:', serializeDbError(dbError));
        console.warn('[upload-complete] ⚠️ Drive file preserved — returning partial success for:', driveFileId);
        return NextResponse.json(
          {
            success: true,
            driveUploaded: true,
            dbSaved: false,
            warning: 'File uploaded but metadata not saved',
            dbErrorMessage: dbError.message,
            dbErrorCode:    dbError.code,
            dbErrorDetails: dbError.details ?? null,
            dbErrorHint:    dbError.hint    ?? null,
          },
          { status: 200 },
        );
      }
      inserted = data as Record<string, unknown>;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[upload-complete] ❌ database_insert exception:', msg);
      console.warn('[upload-complete] ⚠️ Drive file preserved — returning partial success for:', driveFileId);
      return NextResponse.json(
        {
          success: true,
          driveUploaded: true,
          dbSaved: false,
          warning: 'File uploaded but metadata not saved',
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

    console.log('[upload-complete] ✅ response_return — driveUploaded: true, dbSaved: true, assetId:', inserted?.id);
    return NextResponse.json({ success: true, driveUploaded: true, dbSaved: true, asset: inserted }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[upload-complete] ❌ Unexpected error:', msg);
    return NextResponse.json(
      { success: false, step: 'server_error', error: `Unexpected server error: ${msg}` },
      { status: 500 },
    );
  }
}
