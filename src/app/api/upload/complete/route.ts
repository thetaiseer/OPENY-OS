import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { requireRole } from '@/lib/api-auth';
import { insertWithColumnFallback, serializeDbError } from '@/lib/asset-db';
import { notifyAssetUploaded } from '@/lib/notification-service';
import { buildR2Url, R2ConfigError } from '@/lib/r2';

export const dynamic = 'force-dynamic';

function buildSupabasePublicUrl(bucketName: string, storageKey: string): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? '';
  if (!supabaseUrl) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL for Supabase Storage public URL generation');
  }
  const encodedKey = storageKey
    .split('/')
    .filter(Boolean)
    .map(segment => encodeURIComponent(segment))
    .join('/');
  return `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/${bucketName}/${encodedKey}`;
}

/**
 * POST /api/upload/complete
 *
 * Called by the frontend after a successful server-side upload to R2.
 * This endpoint only saves asset metadata to the database — no file
 * bytes are accepted or processed here.
 *
 * Request body (JSON):
 *   storageKey           – R2 object key returned by /api/upload/presign (required)
 *   displayName          – display name for the asset (required)
 *   clientName           – client display name (required)
 *   clientId             – Supabase client UUID (optional)
 *   fileType             – MIME type (required)
 *   fileSize             – file size in bytes (required)
 *   mainCategory         – main category slug (required)
 *   subCategory          – subcategory slug (optional)
 *   monthKey             – "YYYY-MM" (required)
 *   uploadedBy           – uploader name/email for activity log (optional)
 *   thumbnailStorageKey  – R2 key of the pre-uploaded thumbnail image (optional)
 *
 * Response:
 *   { success: true,  stage: 'completed', asset }
 *   { success: false, stage: 'failed_db', error }
 */
export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'manager', 'team_member']);
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

  const storageKey          = (body.storageKey          as string | undefined)?.trim() ?? '';
  const displayName         = (body.displayName         as string | undefined)?.trim() ?? '';
  const clientName          = (body.clientName          as string | undefined)?.trim() ?? '';
  const clientId            = (body.clientId            as string | undefined)?.trim() || null;
  const fileType            = (body.fileType            as string | undefined)?.trim() ?? 'application/octet-stream';
  const fileSize            = Number(body.fileSize ?? 0) || null;
  const mainCategory        = (body.mainCategory        as string | undefined)?.trim() || null;
  const subCategory         = (body.subCategory         as string | undefined)?.trim() || null;
  const monthKey            = (body.monthKey            as string | undefined)?.trim() ?? '';
  const uploadedBy          = (body.uploadedBy          as string | undefined)?.trim() || null;
  const thumbnailStorageKey = (body.thumbnailStorageKey as string | undefined)?.trim() || null;
  const previewStorageKey   = (body.previewStorageKey   as string | undefined)?.trim() || null;
  const providedPublicUrl   = (body.publicUrl           as string | undefined)?.trim() || '';
  const requestedProvider   = (body.storageProvider     as string | undefined)?.trim().toLowerCase() || 'r2';
  const storageProvider     = requestedProvider === 'supabase' ? 'supabase' : 'r2';
  const providedBucket      = (body.storageBucket       as string | undefined)?.trim() || '';
  const bucketName = providedBucket
    || (storageProvider === 'supabase'
      ? (process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ?? 'client-assets')
      : (process.env.R2_BUCKET_NAME ?? 'client-assets'));
  const durationSeconds     = typeof body.durationSeconds === 'number' && isFinite(body.durationSeconds as number)
    ? (body.durationSeconds as number)
    : null;

  if (!storageKey)  return NextResponse.json({ success: false, stage: 'failed_db', error: 'storageKey is required' }, { status: 400 });
  if (!displayName) return NextResponse.json({ success: false, stage: 'failed_db', error: 'displayName is required' }, { status: 400 });
  if (!clientName)  return NextResponse.json({ success: false, stage: 'failed_db', error: 'clientName is required' }, { status: 400 });
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) {
    return NextResponse.json({ success: false, stage: 'failed_db', error: 'monthKey must be in YYYY-MM format' }, { status: 400 });
  }

  let publicUrl = providedPublicUrl;
  if (!publicUrl) {
    try {
      publicUrl = storageProvider === 'supabase'
        ? buildSupabasePublicUrl(bucketName, storageKey)
        : buildR2Url(storageKey);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const isConfigErr = err instanceof R2ConfigError;
      return NextResponse.json(
        { success: false, stage: 'failed_db', error: msg },
        { status: isConfigErr ? 500 : 502 },
      );
    }
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

  // ── Resolve thumbnail and preview URLs ────────────────────────────────────
  // thumbnail_url — the card thumbnail image:
  //   Images  → the file itself
  //   Videos  → the separately-uploaded frame grab (thumbnailStorageKey)
  //   Others  → null
  // preview_url — the larger preview / cover image:
  //   Images  → the file itself
  //   PDFs    → the separately-uploaded first-page render (previewStorageKey)
  //   Others  → null
  const isImage = fileType.startsWith('image/');
  let thumbnailUrl: string | null = null;
  let resolvedPreviewUrl: string | null = null;
  if (thumbnailStorageKey) {
    try { thumbnailUrl = buildR2Url(thumbnailStorageKey); } catch { /* ignore */ }
  } else if (isImage) {
    thumbnailUrl = publicUrl;
  }
  if (previewStorageKey) {
    try { resolvedPreviewUrl = buildR2Url(previewStorageKey); } catch { /* ignore */ }
  } else if (isImage) {
    resolvedPreviewUrl = publicUrl;
  }

  // ── Insert metadata ────────────────────────────────────────────────────────
  const insertRow: Record<string, unknown> = {
    name:             displayName,
    file_name:        displayName,
    file_path:        storageKey,
    storage_path:     storageKey,
    storage_key:      storageKey,
    file_key:         storageKey,
    file_url:         publicUrl,
    public_url:       publicUrl,
    view_url:         publicUrl,
    download_url:     publicUrl,
    file_type:        fileType,
    mime_type:        fileType,
    file_size:        fileSize,
    bucket_name:      bucketName,
    storage_bucket:   bucketName,
    storage_provider: storageProvider,
    client_name:        clientName,
    client_folder_name: clientName,
    month_key:        monthKey,
    main_category:    mainCategory,
    sub_category:     subCategory,
    preview_url:      resolvedPreviewUrl,
    thumbnail_url:    thumbnailUrl,
    web_view_link:    publicUrl,
    ...(durationSeconds !== null ? { duration_seconds: durationSeconds } : {}),
    ...(clientId   ? { client_id:   clientId   } : {}),
    // Canonical uploader identity for DB relations/auditing (UUID from auth profile).
    ...(auth.profile.id ? { uploaded_by: auth.profile.id } : {}),
    // Optional display label from client UI; kept separate from the canonical UUID above.
    ...(uploadedBy ? { uploaded_by_name: uploadedBy } : {}),
  };

  const { data: inserted, error: dbError, finalRow } = await insertWithColumnFallback(
    (row) => supabase.from('assets').insert(row).select().single(),
    insertRow,
    '[upload/complete]',
  );

  if (dbError) {
    console.error(
      '[upload/complete] DB insert failed:',
      serializeDbError(dbError),
      '| key:',
      storageKey,
      '| attemptedRow:',
      JSON.stringify(finalRow, null, 2),
    );
    return NextResponse.json(
      {
        success:    false,
        stage:      'failed_db',
        r2_key:     storageKey,
        r2_bucket:  bucketName,
        r2_filename: displayName,
        error:      dbError,
        attempted_payload: finalRow,
      },
      { status: 200 },
    );
  }

  // ── Activity log (fire-and-forget) ─────────────────────────────────────────
  void supabase.from('activities').insert({
    type:        'asset',
    description: `Asset "${displayName}" uploaded (${clientName}/${year}/${monthName})${uploadedBy ? ` by ${uploadedBy}` : ''}`,
    entity_type: 'asset',
    entity_id:   inserted?.id as string | undefined ?? null,
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
      r2_bucket: bucketName,
    },
    { status: 201 },
  );
}
