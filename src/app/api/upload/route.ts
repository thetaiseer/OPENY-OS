import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireRole } from '@/lib/api-auth';
import {
  createFolderHierarchy,
  uploadFileToDrive,
  buildPreviewUrl,
  buildDownloadUrl,
  buildThumbnailUrl,
  monthKeyToYear,
  monthKeyToMonthName,
} from '@/lib/google-drive';
import { insertWithColumnFallback } from '@/lib/asset-db';
import { notifyAssetUploaded } from '@/lib/notification-service';

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

// ── Supabase client ───────────────────────────────────────────────────────────

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
  if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key);
}

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
 * Accepts a multipart form upload, uploads the file to Google Drive under:
 *   Clients/{clientName}/{year}/{monthName}/
 * then saves asset metadata to the Supabase `assets` table.
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
 * For a failed_db retry (Drive already done), pass driveFileId, driveFolderId,
 * and driveFileName instead of file — the Drive upload step is skipped.
 *
 * Response stages:
 *   completed    – fully succeeded (Drive + DB)
 *   failed_db    – Drive OK, DB save failed (drive_file_id included for retry)
 *   failed_upload – Drive upload failed
 */
export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const auth = await requireRole(req, ['admin', 'manager', 'team']);
  if (auth instanceof NextResponse) return auth;

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

  // Fields used for failed_db retry (Drive already done)
  const existingDriveFileId    = (formData.get('driveFileId')    as string | null)?.trim() || null;
  const existingDriveFolderId  = (formData.get('driveFolderId')  as string | null)?.trim() || null;
  const existingDriveFileName  = (formData.get('driveFileName')  as string | null)?.trim() || null;

  const isRetryDbSave = !!(existingDriveFileId && existingDriveFolderId && existingDriveFileName);

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

  let driveFileId:   string;
  let driveFolderId: string;
  let driveFileName: string;
  let fileMimeType:  string;
  let fileSize:      number | null;
  let thumbnailLink: string | null = null;
  let webViewLink:   string;
  let webContentLink: string;

  // ── Drive upload (or skip if retrying DB save) ─────────────────────────────
  if (isRetryDbSave) {
    // Drive already done — skip upload, go straight to DB save
    driveFileId    = existingDriveFileId!;
    driveFolderId  = existingDriveFolderId!;
    driveFileName  = existingDriveFileName!;
    fileMimeType   = (formData.get('fileMimeType') as string | null) ?? 'application/octet-stream';
    fileSize       = parseInt((formData.get('fileSize') as string | null) ?? '0', 10) || null;
    webViewLink    = `https://drive.google.com/file/d/${driveFileId}/view`;
    webContentLink = `https://drive.google.com/uc?id=${driveFileId}&export=download`;
  } else {
    // Normal upload path — file is required
    if (!file || !(file instanceof File)) {
      return validationError('file is required');
    }

    // Security: block dangerous file extensions
    const ext = getExtension(file.name);
    if (BLOCKED_EXTENSIONS.has(ext)) {
      return validationError('File type not allowed: executable and script files are blocked');
    }

    // Size limit check
    if (file.size > MAX_FILE_SIZE) {
      return validationError(
        `File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum allowed size is ${MAX_FILE_SIZE / 1024 / 1024} MB.`,
        'size_limit',
      );
    }

    if (file.size === 0) {
      return validationError('File is empty');
    }

    // Build final file name
    driveFileName = buildFinalFileName(file.name, customName, clientName, contentType, monthKey);
    fileMimeType  = file.type || 'application/octet-stream';
    fileSize      = file.size;

    // ── Step 1: Create folder hierarchy ─────────────────────────────────────
    try {
      driveFolderId = await createFolderHierarchy(clientName, monthKey);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(JSON.stringify({ step: 'folder_creation_failed', clientName, monthKey, error: msg }));
      return NextResponse.json(
        { success: false, stage: 'failed_upload', error: { step: 'folder_creation', message: msg } },
        { status: 500 },
      );
    }

    // ── Step 2: Upload file to Drive ─────────────────────────────────────────
    let uploadResult;
    try {
      const fileBuffer = Buffer.from(await file.arrayBuffer());
      uploadResult = await uploadFileToDrive(driveFolderId, driveFileName, fileMimeType, fileBuffer);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(JSON.stringify({ step: 'drive_upload_failed', fileName: driveFileName, error: msg }));
      return NextResponse.json(
        { success: false, stage: 'failed_upload', error: { step: 'drive_upload', message: msg } },
        { status: 500 },
      );
    }

    driveFileId    = uploadResult.fileId;
    webViewLink    = uploadResult.webViewLink;
    webContentLink = uploadResult.webContentLink;
    thumbnailLink  = uploadResult.thumbnailLink;
    if (uploadResult.mimeType) fileMimeType = uploadResult.mimeType;
    if (uploadResult.fileSize) fileSize = uploadResult.fileSize;
  }

  // ── Step 3: Deduplication check ──────────────────────────────────────────
  const supabase = getSupabase();
  {
    const { data: existing } = await supabase
      .from('assets')
      .select('*')
      .eq('drive_file_id', driveFileId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { success: true, stage: 'completed', asset: existing, drive_file_id: driveFileId },
        { status: 200 },
      );
    }
  }

  // ── Step 4: Save metadata to database ─────────────────────────────────────
  const year      = monthKeyToYear(monthKey);
  const monthName = monthKeyToMonthName(monthKey);

  const insertRow: Record<string, unknown> = {
    name:               driveFileName,
    file_path:          null,
    file_url:           webViewLink,
    view_url:           webViewLink,
    download_url:       webContentLink,
    file_type:          fileMimeType,
    mime_type:          fileMimeType,
    file_size:          fileSize,
    bucket_name:        null,
    storage_provider:   'google_drive',
    drive_file_id:      driveFileId,
    drive_folder_id:    driveFolderId,
    client_name:        clientName,
    client_folder_name: clientName,
    content_type:       contentType,
    month_key:          monthKey,
    preview_url:        buildPreviewUrl(driveFileId),
    thumbnail_url:      buildThumbnailUrl(driveFileId, thumbnailLink),
    web_view_link:      webViewLink,
    ...(clientId    ? { client_id:   clientId    } : {}),
    ...(uploadedBy  ? { uploaded_by: uploadedBy  } : {}),
  };

  const { data: inserted, error: dbError } = await insertWithColumnFallback(
    (row) => supabase.from('assets').insert(row).select().single(),
    insertRow,
    '[upload]',
  );

  if (dbError) {
    console.error('[upload] DB insert failed:', dbError.message);
    // Drive file exists — return failed_db so the client can retry DB save
    return NextResponse.json(
      {
        success:      true,
        stage:        'failed_db',
        drive_file_id:   driveFileId,
        drive_folder_id: driveFolderId,
        drive_file_name: driveFileName,
        error: {
          step:    'database_insert',
          message: dbError.message,
          code:    dbError.code    ?? null,
          details: dbError.details ?? null,
        },
      },
      { status: 200 },
    );
  }

  // ── Step 5: Log activity (fire-and-forget) ────────────────────────────────
  void supabase.from('activities').insert({
    type:        'asset',
    description: `Asset "${driveFileName}" uploaded to Google Drive (${clientName}/${year}/${monthName})${uploadedBy ? ` by ${uploadedBy}` : ''}`,
    ...(clientId ? { client_id: clientId } : {}),
  }).then(({ error }) => {
    if (error) console.warn('[upload] activity log failed:', error.message);
  });

  // ── Step 6: Notify (fire-and-forget) ─────────────────────────────────────
  if (inserted) {
    void notifyAssetUploaded({
      assetId:      inserted.id as string,
      assetName:    driveFileName,
      clientId:     clientId ?? null,
      uploadedById: auth.profile.id,
    });
  }

  console.log('[upload] completed:', driveFileName, '| drive_file_id:', driveFileId);

  return NextResponse.json(
    {
      success:  true,
      stage:    'completed',
      asset:    inserted,
      drive_file_id:   driveFileId,
      drive_folder_id: driveFolderId,
    },
    { status: 201 },
  );
}
