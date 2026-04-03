import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { uploadToDrive, ALLOWED_CONTENT_TYPES } from '@/lib/google-drive';

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
  console.log('[upload] POST /api/assets/upload — storage provider: google_drive');
  try {
    // ── 1. Parse multipart form data ─────────────────────────────────────────
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[upload] ❌ Failed while parsing multipart form data:', msg);
      return NextResponse.json(
        { error: `Failed while parsing multipart form data: ${msg}` },
        { status: 400 },
      );
    }

    const rawFile = formData.get('file');
    if (!rawFile || typeof rawFile === 'string') {
      return NextResponse.json({ error: 'No file provided in request' }, { status: 400 });
    }
    const file = rawFile as File;

    // ── 2. Read and log all form fields ──────────────────────────────────────
    const clientId    = (formData.get('client_id')    as string | null) ?? null;
    const clientName  = (formData.get('client_name')  as string | null) ?? null;
    const rawMonth    = (formData.get('month')         as string | null) ?? null;
    const rawCType    = (formData.get('content_type')  as string | null) ?? null;

    console.log('[upload] ── selected file name      :', file.name);
    console.log('[upload] ── selected client_id      :', clientId ?? '(none)');
    console.log('[upload] ── selected client_name    :', clientName ?? '(none)');
    console.log('[upload] ── selected month          :', rawMonth ?? '(none)');
    console.log('[upload] ── selected content_type   :', rawCType ?? '(none)');
    console.log('[upload] ── file mime type          :', file.type);
    console.log('[upload] ── file size (bytes)       :', file.size);
    console.log('[upload] ── GOOGLE_DRIVE_FOLDER_ID  :', process.env.GOOGLE_DRIVE_FOLDER_ID ?? '(missing)');

    // ── 3. Validate month ─────────────────────────────────────────────────────
    const month = rawMonth?.trim() || new Date().toISOString().slice(0, 7);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      console.error('[upload] ❌ Failed while validating month: invalid value:', month);
      return NextResponse.json(
        { error: `Failed while validating month: "${month}" must be YYYY-MM` },
        { status: 400 },
      );
    }

    // ── 4. Validate content_type ──────────────────────────────────────────────
    const contentType = rawCType?.trim().toUpperCase() ?? '';
    if (contentType && !(ALLOWED_CONTENT_TYPES as readonly string[]).includes(contentType)) {
      console.error('[upload] ❌ Failed while validating content_type:', contentType);
      return NextResponse.json(
        {
          error: `Failed while validating content_type: "${contentType}" must be one of: ${ALLOWED_CONTENT_TYPES.join(', ')}`,
        },
        { status: 400 },
      );
    }

    // ── 5. Validate client_id ─────────────────────────────────────────────────
    const safeClientId = clientId && clientId.trim() ? clientId.trim() : null;
    if (clientId !== null && !safeClientId) {
      // client_id was explicitly sent but is empty/whitespace — reject to prevent orphaned assets
      return NextResponse.json({ error: 'client_id is required when uploading to a client workspace' }, { status: 400 });
    }

    // ── 6. Read file into buffer ──────────────────────────────────────────────
    let buffer: Buffer;
    try {
      const arrayBuffer = await file.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
      console.log('[upload] buffer length:', buffer.length);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[upload] ❌ Failed while reading file into buffer:', msg);
      return NextResponse.json(
        { error: `Failed while reading file into buffer: ${msg}` },
        { status: 500 },
      );
    }

    // ── 7. Upload to Google Drive (all sub-stages handled inside uploadToDrive) ──
    console.log('[upload] starting Google Drive upload…');
    let driveResult;
    try {
      driveResult = await uploadToDrive(
        buffer,
        file.type || 'application/octet-stream',
        file.name,
        {
          clientName:  clientName ?? undefined,
          contentType: contentType || undefined,
          month,
        },
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[upload] ❌', msg);
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    const { drive_file_id, drive_folder_id, client_folder_name, webViewLink, webContentLink, folderPath } = driveResult;
    console.log('[upload] ✅ Google Drive upload success');
    console.log('[upload] ── drive_file_id   :', drive_file_id);
    console.log('[upload] ── drive_folder_id :', drive_folder_id);
    console.log('[upload] ── webViewLink     :', webViewLink);
    console.log('[upload] ── webContentLink  :', webContentLink);
    console.log('[upload] ── folderPath      :', folderPath);

    // ── 8. Insert metadata into assets table ──────────────────────────────────
    console.log('[upload] ── STAGE: insert asset metadata ════════════════════');
    const supabase = getSupabase();
    const row: Record<string, unknown> = {
      name:               file.name,
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
      client_folder_name: client_folder_name ?? null,
      content_type:       contentType || null,
      month_key:          month,
    };
    if (safeClientId) row.client_id = safeClientId;

    console.log('[upload] payload inserted into assets table:', JSON.stringify(row));

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
          { error: `Failed while inserting asset metadata: ${dbError.message}${dbError.details ? ` — ${dbError.details}` : ''}${dbError.hint ? ` (hint: ${dbError.hint})` : ''}` },
          { status: 500 },
        );
      }
      inserted = data as Record<string, unknown>;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[upload] ❌ Failed while inserting asset metadata (exception):', msg);
      return NextResponse.json(
        { error: `Failed while inserting asset metadata: ${msg}` },
        { status: 500 },
      );
    }

    console.log('[upload] ✅ DB insert success — asset id:', inserted?.id);

    // ── 9. Log activity (fire and forget) ────────────────────────────────────
    void supabase.from('activities').insert({
      type: 'asset',
      description: `Asset "${file.name}" uploaded to Google Drive (${folderPath})`,
      ...(safeClientId ? { client_id: safeClientId } : {}),
    });

    return NextResponse.json({ asset: inserted }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[upload] ❌ Unexpected server error:', msg);
    return NextResponse.json({ error: `Unexpected server error: ${msg}` }, { status: 500 });
  }
}
