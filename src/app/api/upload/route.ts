import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { requireRole } from '@/lib/api-auth';
import { insertWithColumnFallback } from '@/lib/asset-db';
import { notifyAssetUploaded } from '@/lib/notification-service';
import { uploadToR2, buildR2Url, R2ConfigError } from '@/lib/r2';

// ── Runtime config ────────────────────────────────────────────────────────────
// Allow up to 5 minutes for large file uploads (requires Vercel Pro).
// On Hobby/Free plans Vercel caps this at 60 seconds.
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Maximum file size accepted by this route (250 MB). */
const MAX_FILE_SIZE = 250 * 1024 * 1024;

/** Blocked executable/script extensions — security policy. */
const BLOCKED_EXTENSIONS = new Set([
  'exe','bat','cmd','sh','bash','ps1','msi','vbs',
  'php','py','rb','pl','cgi','app','com','scr','pif','reg','dll','so',
]);

const VALID_CONTENT_TYPES = [
  'SOCIAL_POSTS','REELS','VIDEOS','LOGOS','BRAND_ASSETS',
  'PASSWORDS','DOCUMENTS','RAW_FILES','ADS_CREATIVES','REPORTS','OTHER',
] as const;
type ValidContentType = typeof VALID_CONTENT_TYPES[number];

// ── Helpers ───────────────────────────────────────────────────────────────────

function getExtension(name: string): string {
  return name.split('.').pop()?.toLowerCase() ?? '';
}

function sanitizeFileName(name: string): string {
  return name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._\-]/g, '');
}

function buildFinalFileName(
  originalName: string,
  customName: string | null,
  clientName: string,
  contentType: string,
  monthKey: string,
): string {
  if (customName && customName.trim()) {
    const base = sanitizeFileName(customName.trim());
    const ext  = originalName.includes('.') ? `.${originalName.split('.').pop()!.toLowerCase()}` : '';
    const hasExt = ext && base.toLowerCase().endsWith(ext);
    return hasExt ? base : `${base}${ext}`;
  }
  const [year, month] = monthKey.split('-');
  const sanitized = sanitizeFileName(originalName);
  const safeName  = sanitizeFileName(clientName);
  return `${safeName}-${contentType}-${year}-${month}-${Date.now()}-${sanitized}`;
}

/**
 * POST /api/upload
 *
 * Accepts a multipart form upload, uploads the file to Cloudflare R2, then
 * saves asset metadata to the Supabase `assets` table.
 *
 * Form fields:
 *   file           – the File to upload (required)
 *   clientName     – client display name (required)
 *   contentType    – one of VALID_CONTENT_TYPES (required)
 *   monthKey       – "YYYY-MM" (required)
 *   clientId       – Supabase client UUID (optional)
 *   uploadedBy     – uploader name/email (optional)
 *   customFileName – custom base name without extension (optional)
 *
 * For a failed_db retry (R2 upload already done), pass driveFileId (R2 object key)
 * and driveFileName instead of file — the R2 upload step is skipped.
 *
 * Response stages:
 *   completed    – fully succeeded (R2 + DB)
 *   failed_db    – R2 OK, DB save failed (drive_file_id/key included for retry)
 *   failed_upload – R2 upload failed
 */
export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const auth = await requireRole(req, ['admin', 'manager', 'team']);
  if (auth instanceof NextResponse) return auth;

  // ── Rate limit: 60 uploads per hour per user ──────────────────────────────
  const { checkRateLimit } = await import('@/lib/rate-limit');
  const rl = checkRateLimit(`upload:user:${auth.profile.id}`, { limit: 60, windowMs: 60 * 60_000 });
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, stage: 'failed_upload', error: { step: 'rate_limit', message: 'Upload limit exceeded. Please try again later.' } },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
    );
  }

  // ── Parse form data ───────────────────────────────────────────────────────
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, stage: 'failed_upload', error: { step: 'parse', message: `Failed to parse upload: ${msg}` } },
      { status: 400 },
    );
  }

  // ── Extract fields ────────────────────────────────────────────────────────
  const file         = formData.get('file') as File | null;
  const clientName   = (formData.get('clientName')   as string | null)?.trim() ?? '';
  const contentType  = (formData.get('contentType')  as string | null)?.trim() ?? '';
  const monthKey     = (formData.get('monthKey')     as string | null)?.trim() ?? '';
  const clientId     = (formData.get('clientId')     as string | null)?.trim() || null;
  const uploadedBy   = (formData.get('uploadedBy')   as string | null)?.trim() || null;
  const customName   = (formData.get('customFileName') as string | null)?.trim() || null;

  // Fields used for failed_db retry (R2 upload already done).
  // driveFileId repurposed as the R2 object key.
  // driveFileName is the display file name.
  const existingR2Key    = (formData.get('driveFileId')   as string | null)?.trim() || null;
  const existingFileName = (formData.get('driveFileName') as string | null)?.trim() || null;

  const isRetryDbSave = !!(existingR2Key && existingFileName);

  // ── Validation ─────────────────────────────────────────────────────────────
  const validationError = (message: string, step = 'validation') =>
    NextResponse.json(
      { success: false, stage: 'failed_upload', error: { step, message } },
      { status: 400 },
    );

  if (!clientName) return validationError('clientName is required');
  if (!contentType) return validationError('contentType is required');
  if (!VALID_CONTENT_TYPES.includes(contentType as ValidContentType)) {
    return validationError(`Invalid contentType. Must be one of: ${VALID_CONTENT_TYPES.join(', ')}`);
  }
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) {
    return validationError('monthKey must be in YYYY-MM format');
  }

  let supabase: ReturnType<typeof getServiceClient>;
  try {
    supabase = getServiceClient();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Supabase configuration error';
    console.error('[upload] Supabase client initialisation failed:', msg);
    return NextResponse.json(
      { success: false, stage: 'failed_upload', error: { step: 'config', message: msg } },
      { status: 500 },
    );
  }

  let r2Key:        string;
  let displayName:  string;
  let fileMimeType: string;
  let fileSize:     number | null;
  let publicUrl:    string;

  // ── R2 upload (or skip if retrying DB save) ───────────────────────────────
  if (isRetryDbSave) {
    // R2 upload already done — skip upload, go straight to DB save.
    r2Key        = existingR2Key!;
    displayName  = existingFileName!;
    fileMimeType = (formData.get('fileMimeType') as string | null) ?? 'application/octet-stream';
    fileSize     = parseInt((formData.get('fileSize') as string | null) ?? '0', 10) || null;
    publicUrl    = buildR2Url(r2Key);
  } else {
    // Normal upload path — file is required.
    if (!file || !(file instanceof File)) {
      return validationError('file is required');
    }

    // Security: block dangerous file extensions.
    const ext = getExtension(file.name);
    if (BLOCKED_EXTENSIONS.has(ext)) {
      return validationError('File type not allowed: executable and script files are blocked');
    }

    // Size limit check.
    if (file.size > MAX_FILE_SIZE) {
      return validationError(
        `File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum allowed size is ${MAX_FILE_SIZE / 1024 / 1024} MB.`,
        'size_limit',
      );
    }

    if (file.size === 0) {
      return validationError('File is empty');
    }

    // Build display name and R2 key.
    displayName  = buildFinalFileName(file.name, customName, clientName, contentType, monthKey);
    fileMimeType = file.type || 'application/octet-stream';
    fileSize     = file.size;
    // Key: {clientName}/{contentType}/{monthKey}/{displayName}
    const safeClient = sanitizeFileName(clientName);
    r2Key = `${safeClient}/${contentType}/${monthKey}/${displayName}`;

    // ── Upload file to Cloudflare R2 ─────────────────────────────────────────
    try {
      const fileBuffer = Buffer.from(await file.arrayBuffer());

      console.log('[upload] ── R2 upload ────────────────────────────────────────');
      console.log('[upload] user_id     :', auth.profile.id);
      console.log('[upload] r2_key      :', r2Key);
      console.log('[upload] mime_type   :', fileMimeType);
      console.log('[upload] file_size   :', fileSize, 'bytes');
      console.log('[upload] ─────────────────────────────────────────────────────');

      const result = await uploadToR2(r2Key, fileBuffer, fileMimeType);
      publicUrl    = result.publicUrl;

      console.log('[upload] R2 upload succeeded. key:', r2Key, '| url:', publicUrl);
    } catch (err: unknown) {
      const msg         = err instanceof Error ? err.message : String(err);
      const isConfigErr = err instanceof R2ConfigError;
      console.error('[upload] ── R2 upload FAILED ──────────────────────────────');
      console.error('[upload] r2_key    :', r2Key);
      console.error('[upload] error     :', msg);
      console.error('[upload] ──────────────────────────────────────────────────');
      return NextResponse.json(
        {
          success: false,
          stage:   'failed_upload',
          when:    'during_upload',
          error: {
            step:    isConfigErr ? 'config' : 'r2_upload',
            message: msg,
          },
        },
        { status: isConfigErr ? 500 : 502 },
      );
    }
  }

  // ── Step 2: Deduplication check ──────────────────────────────────────────
  {
    const { data: existing } = await supabase
      .from('assets')
      .select('*')
      .eq('file_path', r2Key)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { success: true, stage: 'completed', asset: existing, drive_file_id: r2Key },
        { status: 200 },
      );
    }
  }

  // ── Step 3: Save metadata to database ─────────────────────────────────────
  const [year, monthNum] = monthKey.split('-');
  const monthName = new Date(Date.UTC(parseInt(year, 10), parseInt(monthNum, 10) - 1, 1))
    .toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });

  const insertRow: Record<string, unknown> = {
    name:             displayName,
    file_path:        r2Key,
    file_url:         publicUrl,
    view_url:         publicUrl,
    download_url:     publicUrl,
    file_type:        fileMimeType,
    mime_type:        fileMimeType,
    file_size:        fileSize,
    bucket_name:      process.env.R2_BUCKET_NAME ?? 'client-assets',
    storage_provider: 'r2',
    drive_file_id:    null,
    drive_folder_id:  null,
    client_name:        clientName,
    client_folder_name: clientName,
    content_type:     contentType,
    month_key:        monthKey,
    preview_url:      publicUrl,
    thumbnail_url:    publicUrl,
    web_view_link:    publicUrl,
    ...(clientId   ? { client_id:   clientId   } : {}),
    ...(uploadedBy ? { uploaded_by: uploadedBy } : {}),
  };

  const { data: inserted, error: dbError } = await insertWithColumnFallback(
    (row) => supabase.from('assets').insert(row).select().single(),
    insertRow,
    '[upload]',
  );

  if (dbError) {
    console.error('[upload] ── DB insert FAILED (after R2 upload) ───────────');
    console.error('[upload] db_error    :', JSON.stringify(dbError, null, 2));
    console.error('[upload] r2_key      :', r2Key);
    console.error('[upload] ─────────────────────────────────────────────────');
    // R2 file exists — return failed_db so the client can retry DB save.
    return NextResponse.json(
      {
        success:         true,
        stage:           'failed_db',
        when:            'after_upload',
        location:        publicUrl,
        drive_file_id:   r2Key,
        drive_folder_id: process.env.R2_BUCKET_NAME ?? 'client-assets',
        drive_file_name: displayName,
        error:           dbError,
      },
      { status: 200 },
    );
  }

  // ── Step 4: Log activity (fire-and-forget) ────────────────────────────────
  void supabase.from('activities').insert({
    type:        'asset',
    description: `Asset "${displayName}" uploaded (${clientName}/${year}/${monthName})${uploadedBy ? ` by ${uploadedBy}` : ''}`,
    ...(clientId ? { client_id: clientId } : {}),
  }).then(({ error }) => {
    if (error) console.warn('[upload] activity log failed:', error.message);
  });

  // ── Step 5: Notify (fire-and-forget) ─────────────────────────────────────
  if (inserted) {
    void notifyAssetUploaded({
      assetId:      inserted.id as string,
      assetName:    displayName,
      clientId:     clientId ?? null,
      uploadedById: auth.profile.id,
    });
  }

  console.log('[upload] completed:', displayName, '| r2_key:', r2Key, '| url:', publicUrl);

  return NextResponse.json(
    {
      success:         true,
      stage:           'completed',
      when:            'after_upload',
      location:        publicUrl,
      asset:           inserted,
      drive_file_id:   r2Key,
      drive_folder_id: process.env.R2_BUCKET_NAME ?? 'client-assets',
    },
    { status: 201 },
  );
}
