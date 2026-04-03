import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { finalizeFileAfterUpload } from '@/lib/google-drive';

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
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 });
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
    } = body;

    // ── Validate required fields ──────────────────────────────────────────────
    if (!driveFileId || typeof driveFileId !== 'string') {
      return NextResponse.json({ error: 'driveFileId is required' }, { status: 400 });
    }
    if (!driveFolderId || typeof driveFolderId !== 'string') {
      return NextResponse.json({ error: 'driveFolderId is required' }, { status: 400 });
    }
    if (!clientFolderName || typeof clientFolderName !== 'string') {
      return NextResponse.json({ error: 'clientFolderName is required' }, { status: 400 });
    }
    if (!fileName || typeof fileName !== 'string') {
      return NextResponse.json({ error: 'fileName is required' }, { status: 400 });
    }
    if (!contentType || typeof contentType !== 'string') {
      return NextResponse.json({ error: 'contentType is required' }, { status: 400 });
    }
    if (!monthKey || typeof monthKey !== 'string' || !/^\d{4}-\d{2}$/.test(monthKey)) {
      return NextResponse.json(
        { error: 'monthKey is required and must be in YYYY-MM format' },
        { status: 400 },
      );
    }
    if (!clientName || typeof clientName !== 'string') {
      return NextResponse.json({ error: 'clientName is required' }, { status: 400 });
    }

    const safeClientId =
      clientId && typeof clientId === 'string' && clientId.trim() ? clientId.trim() : null;

    console.log('[upload-complete] file:', fileName, '| drive_file_id:', driveFileId, '| client:', clientName);

    // ── Finalise: set permissions + fetch links ───────────────────────────────
    let webViewLink: string;
    let webContentLink: string;
    try {
      ({ webViewLink, webContentLink } = await finalizeFileAfterUpload(driveFileId));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[upload-complete] ❌ finalizeFileAfterUpload failed:', msg);
      return NextResponse.json({ error: `Failed to finalize Drive file: ${msg}` }, { status: 502 });
    }

    // ── Insert asset record in Supabase ───────────────────────────────────────
    console.log('[upload-complete] inserting into assets table…');
    const supabase = getSupabase();
    const row: Record<string, unknown> = {
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
    };
    if (safeClientId) row.client_id = safeClientId;

    let inserted: Record<string, unknown>;
    try {
      const { data, error: dbError } = await supabase
        .from('assets')
        .insert(row)
        .select()
        .single();

      if (dbError) {
        console.error('[upload-complete] ❌ DB insert failed:', dbError.message);
        return NextResponse.json(
          { error: `Failed to save asset metadata: ${dbError.message}${dbError.details ? ` — ${dbError.details}` : ''}` },
          { status: 500 },
        );
      }
      inserted = data as Record<string, unknown>;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[upload-complete] ❌ DB insert exception:', msg);
      return NextResponse.json({ error: `Failed to save asset metadata: ${msg}` }, { status: 500 });
    }

    console.log('[upload-complete] ✅ asset saved — id:', inserted?.id);

    // ── Activity log (fire-and-forget) ────────────────────────────────────────
    void supabase.from('activities').insert({
      type: 'asset',
      description: `Asset "${fileName}" uploaded to Google Drive (${clientFolderName}/${contentType}/${monthKey})`,
      ...(safeClientId ? { client_id: safeClientId } : {}),
    }).then(({ error }) => {
      if (error) console.warn('[upload-complete] activity log insert failed:', error.message);
    });

    return NextResponse.json({ asset: inserted }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[upload-complete] ❌ Unexpected error:', msg);
    return NextResponse.json({ error: `Unexpected server error: ${msg}` }, { status: 500 });
  }
}
