import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { uploadToStructuredPath, buildPreviewUrl, buildThumbnailUrl } from '@/lib/google-drive';
import { clientToFolderName } from '@/lib/asset-utils';
import { requireRole } from '@/lib/api-auth';

// Fixed content type list
const VALID_CONTENT_TYPES = [
  'SOCIAL_POSTS', 'REELS', 'VIDEOS', 'LOGOS', 'BRAND_ASSETS',
  'PASSWORDS', 'DOCUMENTS', 'RAW_FILES', 'ADS_CREATIVES', 'REPORTS', 'OTHER',
] as const;

// Security: blocked file extensions (executables & scripts)
const BLOCKED_EXTENSIONS = new Set([
  'exe','bat','cmd','sh','bash','ps1','msi','vbs',
  'php','py','rb','pl','cgi','app','com','scr','pif','reg','dll','so',
]);

function getFileExtension(name: string): string {
  return name.split('.').pop()?.toLowerCase() ?? '';
}

function sanitizeFileName(name: string): string {
  return name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._\-]/g, '');
}

function generateRenamedFile(
  originalName: string,
  clientFolderName: string,
  contentType: string,
  monthKey: string,
): string {
  const [year, month] = monthKey.split('-');
  const sanitized = sanitizeFileName(originalName);
  return `${clientFolderName}-${contentType}-${year}-${month}-${Date.now()}-${sanitized}`;
}

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
 * Insert a row into `table`, automatically retrying without any column that
 * PostgreSQL reports as undefined (error code 42703).  This makes the upload
 * robust against incremental schema migrations not yet applied to the DB.
 *
 * Each missing column is logged with a hint to run the migration file, and up
 * to MAX_COLUMN_RETRIES columns can be stripped before the function gives up.
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
    if (!col || !(col in currentRow)) break; // unrecognisable error — stop retrying
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

// ── POST /api/assets/upload ───────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  console.log('[upload] POST /api/assets/upload — structured Google Drive storage');
  try {
    // ── 0. Auth: only admin and team members may upload ───────────────────────
    console.log('[upload] running auth check…');
    const auth = await requireRole(req, ['admin', 'team']);
    if (auth instanceof NextResponse) {
      // Forward the exact backend reason so the client UI can surface it.
      console.warn('[upload] auth denied — forwarding 403 response');
      return auth;
    }
    console.log('[upload] auth OK — user:', auth.profile.email, '| role:', auth.profile.role);

    // ── 1. Parse multipart form data ─────────────────────────────────────────
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        { success: false, error: `Failed while parsing multipart form data: ${msg}` },
        { status: 400 },
      );
    }

    const rawFile = formData.get('file');
    if (!rawFile || typeof rawFile === 'string') {
      return NextResponse.json({ success: false, error: 'No file provided in request' }, { status: 400 });
    }
    const file = rawFile as File;

    // ── Security: block dangerous file types ──────────────────────────────────
    const ext = getFileExtension(file.name);
    if (BLOCKED_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        { success: false, error: 'File type not allowed: security policy blocks executable and script files' },
        { status: 400 },
      );
    }

    // ── 2. Validate required metadata fields ──────────────────────────────────
    const clientId    = formData.get('client_id');
    const contentType = formData.get('content_type');
    const monthKey    = formData.get('month_key');

    // Accept client_name, client, or clientId (normalize to clientName)
    const rawClientName =
      formData.get('client_name') ??
      formData.get('client') ??
      formData.get('clientId');
    const clientName = rawClientName && typeof rawClientName === 'string' ? rawClientName.trim() : '';
    const uploadedBy = formData.get('uploaded_by');
    const safeUploadedBy = uploadedBy && typeof uploadedBy === 'string' ? uploadedBy.trim() : null;

    if (!clientName) {
      return NextResponse.json({ success: false, error: 'client_name is required' }, { status: 400 });
    }
    if (!contentType || typeof contentType !== 'string') {
      return NextResponse.json({ success: false, error: 'content_type is required' }, { status: 400 });
    }
    if (!VALID_CONTENT_TYPES.includes(contentType as typeof VALID_CONTENT_TYPES[number])) {
      return NextResponse.json(
        { success: false, error: `Invalid content_type. Must be one of: ${VALID_CONTENT_TYPES.join(', ')}` },
        { status: 400 },
      );
    }
    if (!monthKey || typeof monthKey !== 'string' || !/^\d{4}-\d{2}$/.test(monthKey)) {
      return NextResponse.json(
        { success: false, error: 'month_key is required and must be in YYYY-MM format' },
        { status: 400 },
      );
    }

    // ── 3. Validate client_id ─────────────────────────────────────────────────
    const safeClientId =
      clientId && typeof clientId === 'string' && clientId.trim()
        ? clientId.trim()
        : null;
    if (clientId !== null && !safeClientId) {
      return NextResponse.json(
        { success: false, error: 'client_id is required when uploading to a client workspace' },
        { status: 400 },
      );
    }

    const clientFolderName = clientToFolderName(clientName);
    const renamedFileName  = generateRenamedFile(file.name, clientFolderName, contentType, monthKey as string);
    console.log('[upload] file:', file.name, '→ renamed:', renamedFileName, '| client:', clientName, '| folder:', clientFolderName, '| type:', contentType, '| month:', monthKey);

    // ── 4. Read file into buffer ──────────────────────────────────────────────
    let buffer: Buffer;
    try {
      const arrayBuffer = await file.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
      console.log('[upload] buffer length:', buffer.length);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        { success: false, error: `Failed while reading file into buffer: ${msg}` },
        { status: 500 },
      );
    }

    // ── 5. Upload to structured path in Google Drive ──────────────────────────
    console.log('[upload] starting structured Google Drive upload…');
    let driveResult;
    try {
      driveResult = await uploadToStructuredPath(
        buffer,
        file.type || 'application/octet-stream',
        renamedFileName,
        clientFolderName,
        contentType,
        monthKey,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[upload] ❌ Google Drive upload failed:', msg);
      return NextResponse.json({ success: false, error: `Google Drive upload failed: ${msg}` }, { status: 502 });
    }

    const { drive_file_id, drive_folder_id, client_folder_name, webViewLink, webContentLink, thumbnailLink, mimeType: driveMimeType, fileSize: driveFileSize } = driveResult;
    console.log('[upload] ✅ Google Drive upload success — file_id:', drive_file_id, '| folder_id:', drive_folder_id);

    // ── 6. Insert metadata into assets table ──────────────────────────────────
    console.log('[upload] inserting into assets table…');
    const supabase = getSupabase();

    // Required fields — upload must not succeed without these.
    const requiredRow: Record<string, unknown> = {
      name:               renamedFileName,
      file_path:          null,
      file_url:           webViewLink,
      view_url:           webViewLink,
      download_url:       webContentLink,
      file_type:          file.type || null,
      file_size:          (driveFileSize ?? file.size) || null,
      bucket_name:        null,
      storage_provider:   'google_drive',
      drive_file_id,
      drive_folder_id,
      client_name:        clientName,
      client_folder_name: client_folder_name ?? clientFolderName,
      content_type:       contentType,
      month_key:          monthKey,
      ...(safeUploadedBy ? { uploaded_by: safeUploadedBy } : {}),
    };
    if (safeClientId) {
      requiredRow.client_id = safeClientId;
    }

    // Optional preview metadata — if these columns are missing from the DB
    // schema (error code 42703) we retry without them so the upload still
    // succeeds.  Run supabase-migration-missing-columns.sql to add them.
    const previewFields: Record<string, unknown> = {
      mime_type:     (driveMimeType ?? file.type) || null,
      preview_url:   buildPreviewUrl(drive_file_id),
      thumbnail_url: buildThumbnailUrl(drive_file_id, thumbnailLink),
      web_view_link: webViewLink,
    };

    let inserted: Record<string, unknown>;
    try {
      const fullRow = { ...requiredRow, ...previewFields };
      console.log('[upload] insert payload:', JSON.stringify(fullRow, null, 2));

      const { data, error: dbError, finalRow } = await insertWithColumnFallback(
        supabase,
        fullRow,
        '[upload]',
      );

      if (dbError) {
        console.error('[upload] ❌ Supabase insert error — full error object:', JSON.stringify(dbError, null, 2));
        console.error('[upload] ❌ message:', dbError.message);
        console.error('[upload] ❌ code:', dbError.code);
        console.error('[upload] ❌ details:', dbError.details ?? '(none)');
        console.error('[upload] ❌ hint:', dbError.hint ?? '(none)');
        return NextResponse.json(
          {
            success: false,
            error: `Failed while inserting asset metadata: ${dbError.message}${dbError.details ? ` — ${dbError.details}` : ''}${dbError.hint ? ` (hint: ${dbError.hint})` : ''}`,
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
      console.error('[upload] ❌ Failed while inserting asset metadata (exception):', msg);
      return NextResponse.json(
        { success: false, error: `Failed while inserting asset metadata: ${msg}` },
        { status: 500 },
      );
    }

    console.log('[upload] ✅ DB insert success — asset id:', inserted?.id);

    // ── 7. Log activity (fire and forget) ────────────────────────────────────
    void supabase.from('activities').insert({
      type: 'asset',
      description: `Asset "${renamedFileName}" uploaded to Google Drive (${clientFolderName}/${contentType}/${monthKey})${safeUploadedBy ? ` by ${safeUploadedBy}` : ''}`,
      ...(safeClientId ? { client_id: safeClientId } : {}),
    });

    return NextResponse.json({ success: true, asset: inserted }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[upload] UPLOAD ERROR:', err);
    return NextResponse.json({ success: false, error: `Unexpected server error: ${msg}` }, { status: 500 });
  }
}
