import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { uploadToDrive } from '@/lib/google-drive';

// ── Supabase service-role client (server only) ────────────────────────────────
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key);
}

// ── POST /api/assets/upload ───────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    // ── 1. Parse multipart form data ─────────────────────────────────────────
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json({ error: 'Invalid multipart form data' }, { status: 400 });
    }

    const rawFile = formData.get('file');
    if (!rawFile || typeof rawFile === 'string') {
      return NextResponse.json({ error: 'No file provided in request' }, { status: 400 });
    }
    const file = rawFile as File;

    const clientId = formData.get('client_id');

    // ── 2. Read file into buffer ──────────────────────────────────────────────
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // ── 3. Upload to Google Drive ─────────────────────────────────────────────
    let driveResult;
    try {
      driveResult = await uploadToDrive(buffer, file.type || 'application/octet-stream', file.name);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: `Google Drive upload failed: ${msg}` }, { status: 502 });
    }

    const { drive_file_id, webViewLink, webContentLink } = driveResult;

    // ── 4. Insert metadata into assets table ──────────────────────────────────
    const supabase = getSupabase();
    const row: Record<string, unknown> = {
      name: file.name,
      file_path: null,
      file_url: webViewLink,
      view_url: webViewLink,
      download_url: webContentLink,
      file_type: file.type || null,
      file_size: file.size || null,
      bucket_name: 'google_drive',
      storage_provider: 'google_drive',
      drive_file_id,
    };
    if (clientId && typeof clientId === 'string') {
      row.client_id = clientId;
    }

    const { data: inserted, error: dbError } = await supabase
      .from('assets')
      .insert(row)
      .select()
      .single();

    if (dbError) {
      return NextResponse.json(
        { error: `Database insert failed: ${dbError.message}` },
        { status: 500 },
      );
    }

    // ── 5. Log activity (fire and forget) ────────────────────────────────────
    void supabase.from('activities').insert({
      type: 'asset',
      description: `Asset "${file.name}" uploaded to Google Drive`,
    });

    return NextResponse.json({ asset: inserted }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Unexpected server error: ${msg}` }, { status: 500 });
  }
}
