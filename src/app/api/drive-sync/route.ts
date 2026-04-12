import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { requireRole } from '@/lib/api-auth';
import { createFolderHierarchy, uploadFileToDrive, DriveAuthError } from '@/lib/google-drive';

// ── Runtime config ────────────────────────────────────────────────────────────
// Allow up to 2 minutes — downloading from Storage + uploading to Drive
// can be slow for large files.
export const maxDuration = 120;
export const dynamic = 'force-dynamic';

/**
 * POST /api/drive-sync
 *
 * Downloads a file that has already been saved to Supabase Storage and syncs
 * it to Google Drive as a separate, non-blocking post-upload step.
 *
 * Body: { assetId: string }
 *
 * Response shapes:
 *   { success: true,  driveConfigured: false }                           — Drive env vars not set; skipped silently
 *   { success: true,  driveConfigured: true, alreadySynced: true }       — already has a Drive file ID; skipped
 *   { success: true,  driveConfigured: true, driveFileId, driveFolderId } — sync succeeded
 *   { success: true,  driveConfigured: true, ..., warning }               — Drive OK, DB update failed
 *   { success: false, error, driveAuthError? }                            — Drive sync failed
 *
 * Google Drive folder ID:
 *   Root folder comes from the GOOGLE_DRIVE_FOLDER_ID env var, read inside
 *   getDriveClient() in src/lib/google-drive.ts.  The folder hierarchy built
 *   on top of it is: <root>/Clients/{clientName}/{year}/{monthName}/
 */
export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const auth = await requireRole(req, ['admin', 'manager', 'team']);
  if (auth instanceof NextResponse) return auth;

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: { assetId?: string };
  try {
    body = (await req.json()) as { assetId?: string };
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const { assetId } = body;
  if (!assetId) {
    return NextResponse.json({ success: false, error: 'assetId is required' }, { status: 400 });
  }

  // ── Quick Drive config check (no API call) ────────────────────────────────
  // GOOGLE_DRIVE_FOLDER_ID is the root folder used in getDriveClient().
  // If the basic env vars are absent we skip silently — Drive is optional.
  const driveConfigured =
    !!process.env.GOOGLE_OAUTH_CLIENT_ID &&
    !!process.env.GOOGLE_OAUTH_CLIENT_SECRET &&
    !!process.env.GOOGLE_DRIVE_FOLDER_ID;

  if (!driveConfigured) {
    return NextResponse.json({ success: true, driveConfigured: false });
  }

  const supabase = getServiceClient();

  // ── Fetch asset from DB ───────────────────────────────────────────────────
  const { data: asset, error: fetchError } = await supabase
    .from('assets')
    .select('id, name, file_path, bucket_name, mime_type, file_type, client_name, month_key, drive_file_id')
    .eq('id', assetId)
    .single();

  if (fetchError || !asset) {
    return NextResponse.json(
      { success: false, error: fetchError?.message ?? 'Asset not found' },
      { status: 404 },
    );
  }

  // ── Skip if already synced ────────────────────────────────────────────────
  if (asset.drive_file_id) {
    return NextResponse.json({ success: true, driveConfigured: true, alreadySynced: true });
  }

  const storagePath = (asset.file_path as string | null) ?? null;
  const bucketName  = (asset.bucket_name as string | null) ?? 'client-assets';
  const clientName  = (asset.client_name as string | null) ?? 'Unknown';
  const monthKey    = (asset.month_key   as string | null) ?? new Date().toISOString().slice(0, 7);
  const mimeType    = ((asset.mime_type ?? asset.file_type ?? 'application/octet-stream') as string);

  if (!storagePath) {
    return NextResponse.json(
      { success: false, error: 'Asset has no storage path — cannot sync to Drive' },
      { status: 400 },
    );
  }

  // ── Download file from Supabase Storage ───────────────────────────────────
  const { data: fileBlob, error: downloadError } = await supabase.storage
    .from(bucketName)
    .download(storagePath);

  if (downloadError || !fileBlob) {
    return NextResponse.json(
      { success: false, error: `Failed to download from storage: ${downloadError?.message ?? 'no data'}` },
      { status: 500 },
    );
  }

  // ── Upload to Google Drive ─────────────────────────────────────────────────
  let driveFileId: string;
  let leafFolderId: string;
  let driveResult: Awaited<ReturnType<typeof uploadFileToDrive>>;

  try {
    // Build (or reuse) the folder path: root/Clients/{clientName}/{year}/{monthName}/
    // GOOGLE_DRIVE_FOLDER_ID (root) is read inside createFolderHierarchy → getDriveClient()
    leafFolderId = await createFolderHierarchy(clientName, monthKey);

    const fileBuffer = Buffer.from(await fileBlob.arrayBuffer());
    driveResult  = await uploadFileToDrive(leafFolderId, asset.name as string, mimeType, fileBuffer);
    driveFileId  = driveResult.fileId;
  } catch (err: unknown) {
    const msg         = err instanceof Error ? err.message : String(err);
    const isDriveAuth = err instanceof DriveAuthError;
    console.error('[drive-sync] Drive upload failed for asset', assetId, ':', msg);
    return NextResponse.json(
      { success: false, error: msg, driveAuthError: isDriveAuth },
      { status: 500 },
    );
  }

  // ── Update asset record with Drive metadata ───────────────────────────────
  const driveUpdate: Record<string, unknown> = {
    drive_file_id:   driveFileId,
    drive_folder_id: leafFolderId,
    web_view_link:   driveResult.webViewLink,
    // view_url and download_url kept in sync for backward compat with
    // older pages that reference those columns directly.
    view_url:        driveResult.webViewLink,
    download_url:    driveResult.webContentLink,
  };
  if (driveResult.thumbnailLink) {
    driveUpdate.thumbnail_url = driveResult.thumbnailLink;
    driveUpdate.preview_url   = driveResult.thumbnailLink;
  }

  const { error: updateError } = await supabase
    .from('assets')
    .update(driveUpdate)
    .eq('id', assetId);

  if (updateError) {
    // Drive file exists — DB update can be reconciled later.
    console.warn('[drive-sync] Drive upload succeeded but DB update failed:', updateError.message);
    return NextResponse.json({
      success:         true,
      driveConfigured: true,
      driveFileId,
      driveFolderId:   leafFolderId,
      warning:         'Drive upload succeeded but database update failed',
    });
  }

  console.log('[drive-sync] Synced asset', assetId, '→ Drive file', driveFileId);

  return NextResponse.json({
    success:         true,
    driveConfigured: true,
    driveFileId,
    driveFolderId:   leafFolderId,
  });
}
