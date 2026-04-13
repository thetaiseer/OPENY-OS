import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { requireRole } from '@/lib/api-auth';
import { insertWithColumnFallback } from '@/lib/asset-db';
import { notifyAssetUploaded } from '@/lib/notification-service';
import { buildR2Url, R2ConfigError } from '@/lib/r2';

export const dynamic = 'force-dynamic';

/**
 * POST /api/upload/complete
 *
 * Called by the frontend after a successful direct PUT to R2 via a presigned
 * URL.  This endpoint only saves asset metadata to the database — no file
 * bytes are accepted or processed here.
 *
 * Request body (JSON):
 *   storageKey    – R2 object key returned by /api/upload/presign (required)
 *   displayName   – display name for the asset (required)
 *   clientName    – client display name (required)
 *   clientId      – Supabase client UUID (optional)
 *   fileType      – MIME type (required)
 *   fileSize      – file size in bytes (required)
 *   mainCategory  – main category slug (required)
 *   subCategory   – subcategory slug (optional)
 *   monthKey      – "YYYY-MM" (required)
 *   uploadedBy    – uploader name/email for activity log (optional)
 *
 * Response:
 *   { success: true,  stage: 'completed', asset }
 *   { success: false, stage: 'failed_db', error }
 */
export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'manager', 'team']);
  if (auth instanceof NextResponse) return auth;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, stage: 'failed_db', error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  const storageKey   = (body.storageKey   as string | undefined)?.trim() ?? '';
  const displayName  = (body.displayName  as string | undefined)?.trim() ?? '';
  const clientName   = (body.clientName   as string | undefined)?.trim() ?? '';
  const clientId     = (body.clientId     as string | undefined)?.trim() || null;
  const fileType     = (body.fileType     as string | undefined)?.trim() ?? 'application/octet-stream';
  const fileSize     = Number(body.fileSize ?? 0) || null;
  const mainCategory = (body.mainCategory as string | undefined)?.trim() || null;
  const subCategory  = (body.subCategory  as string | undefined)?.trim() || null;
  const monthKey     = (body.monthKey     as string | undefined)?.trim() ?? '';
  const uploadedBy   = (body.uploadedBy   as string | undefined)?.trim() || null;

  if (!storageKey)  return NextResponse.json({ success: false, stage: 'failed_db', error: 'storageKey is required' }, { status: 400 });
  if (!displayName) return NextResponse.json({ success: false, stage: 'failed_db', error: 'displayName is required' }, { status: 400 });
  if (!clientName)  return NextResponse.json({ success: false, stage: 'failed_db', error: 'clientName is required' }, { status: 400 });
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) {
    return NextResponse.json({ success: false, stage: 'failed_db', error: 'monthKey must be in YYYY-MM format' }, { status: 400 });
  }

  let publicUrl: string;
  try {
    publicUrl = buildR2Url(storageKey);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const isConfigErr = err instanceof R2ConfigError;
    return NextResponse.json(
      { success: false, stage: 'failed_db', error: msg },
      { status: isConfigErr ? 500 : 502 },
    );
  }

  let supabase: ReturnType<typeof getServiceClient>;
  try {
    supabase = getServiceClient();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Supabase configuration error';
    return NextResponse.json({ success: false, stage: 'failed_db', error: msg }, { status: 500 });
  }

  // ── Deduplication check ────────────────────────────────────────────────────
  {
    const { data: existing } = await supabase
      .from('assets')
      .select('*')
      .eq('file_path', storageKey)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { success: true, stage: 'completed', asset: existing, r2_key: storageKey },
        { status: 200 },
      );
    }
  }

  // ── Parse month/year ───────────────────────────────────────────────────────
  const [year, monthNum] = monthKey.split('-');
  const monthName = new Date(Date.UTC(parseInt(year, 10), parseInt(monthNum, 10) - 1, 1))
    .toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });

  // ── Insert metadata ────────────────────────────────────────────────────────
  const insertRow: Record<string, unknown> = {
    name:             displayName,
    file_path:        storageKey,
    file_url:         publicUrl,
    view_url:         publicUrl,
    download_url:     publicUrl,
    file_type:        fileType,
    mime_type:        fileType,
    file_size:        fileSize,
    bucket_name:      process.env.R2_BUCKET_NAME ?? 'client-assets',
    storage_provider: 'r2',
    client_name:        clientName,
    client_folder_name: clientName,
    month_key:        monthKey,
    main_category:    mainCategory,
    sub_category:     subCategory,
    storage_key:      storageKey,
    preview_url:      publicUrl,
    thumbnail_url:    publicUrl,
    web_view_link:    publicUrl,
    ...(clientId   ? { client_id:   clientId   } : {}),
    ...(uploadedBy ? { uploaded_by: uploadedBy } : {}),
  };

  const { data: inserted, error: dbError } = await insertWithColumnFallback(
    (row) => supabase.from('assets').insert(row).select().single(),
    insertRow,
    '[upload/complete]',
  );

  if (dbError) {
    console.error('[upload/complete] DB insert failed:', JSON.stringify(dbError, null, 2), '| key:', storageKey);
    return NextResponse.json(
      {
        success:    false,
        stage:      'failed_db',
        r2_key:     storageKey,
        r2_bucket:  process.env.R2_BUCKET_NAME ?? 'client-assets',
        r2_filename: displayName,
        error:      dbError,
      },
      { status: 200 },
    );
  }

  // ── Activity log (fire-and-forget) ─────────────────────────────────────────
  void supabase.from('activities').insert({
    type:        'asset',
    description: `Asset "${displayName}" uploaded (${clientName}/${year}/${monthName})${uploadedBy ? ` by ${uploadedBy}` : ''}`,
    ...(clientId ? { client_id: clientId } : {}),
  }).then(({ error }) => {
    if (error) console.warn('[upload/complete] activity log failed:', error.message);
  });

  // ── Notify (fire-and-forget) ───────────────────────────────────────────────
  if (inserted) {
    void notifyAssetUploaded({
      assetId:      inserted.id as string,
      assetName:    displayName,
      clientId:     clientId ?? null,
      uploadedById: auth.profile.id,
    });
  }

  console.log('[upload/complete] completed:', displayName, '| key:', storageKey, '| url:', publicUrl);

  return NextResponse.json(
    {
      success:  true,
      stage:    'completed',
      location: publicUrl,
      asset:    inserted,
      r2_key:   storageKey,
      r2_bucket: process.env.R2_BUCKET_NAME ?? 'client-assets',
    },
    { status: 201 },
  );
}
