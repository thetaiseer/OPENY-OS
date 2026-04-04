import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { uploadToStructuredPath } from '@/lib/google-drive';
import { clientToFolderName } from '@/lib/asset-utils';

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

// ── POST /api/assets/upload ───────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  console.log('[upload] POST /api/assets/upload — structured Google Drive storage');
  try {
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

    const { drive_file_id, drive_folder_id, client_folder_name, webViewLink, webContentLink } = driveResult;
    console.log('[upload] ✅ Google Drive upload success — file_id:', drive_file_id, '| folder_id:', drive_folder_id);

    // ── 6. Insert metadata into assets table ──────────────────────────────────
    console.log('[upload] inserting into assets table…');
    const supabase = getSupabase();
    const row: Record<string, unknown> = {
      name:               renamedFileName,
      file_path:          null,
      file_url:           webViewLink,
      view_url:           webViewLink,
      download_url:       webContentLink,
      file_type:          file.type || null,
      file_size:          file.size || null,
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
      row.client_id = safeClientId;
    }

    let inserted: Record<string, unknown>;
    try {
      const { data, error: dbError } = await supabase
        .from('assets')
        .insert(row)
        .select()
        .single();

      if (dbError) {
        console.error('[upload] ❌ Failed while inserting asset metadata:', dbError.message, dbError.details ?? '');
        return NextResponse.json(
          { success: false, error: `Failed while inserting asset metadata: ${dbError.message}${dbError.details ? ` — ${dbError.details}` : ''}${dbError.hint ? ` (hint: ${dbError.hint})` : ''}` },
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
