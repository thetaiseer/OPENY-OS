import { NextRequest, NextResponse } from 'next/server';
import { createFolderHierarchy, initiateResumableSession } from '@/lib/google-drive';
import { clientToFolderName } from '@/lib/asset-utils';

// Fixed content type list — must stay in sync with upload-session and upload-complete routes
// (consider moving to a shared constants module if the list changes frequently)
const VALID_CONTENT_TYPES = [
  'SOCIAL_POSTS', 'REELS', 'VIDEOS', 'LOGOS', 'BRAND_ASSETS',
  'PASSWORDS', 'DOCUMENTS', 'RAW_FILES', 'ADS_CREATIVES', 'REPORTS', 'OTHER',
] as const;

/**
 * POST /api/assets/upload-session
 *
 * Creates a Google Drive resumable upload session for a file that will be
 * uploaded directly from the browser (never through this server).
 *
 * Request body (JSON):
 *   fileName    – original file name
 *   fileType    – MIME type (e.g. "video/mp4")
 *   fileSize    – file size in bytes
 *   clientName  – client display name
 *   contentType – one of VALID_CONTENT_TYPES
 *   monthKey    – "YYYY-MM"
 *   clientId    – (optional) Supabase client UUID
 *
 * Response (JSON):
 *   uploadUrl         – pre-authenticated Google Drive resumable upload URL
 *   drive_folder_id   – Drive ID of the month folder (leaf of hierarchy)
 *   client_folder_name – normalised client folder name stored in Drive
 */
export async function POST(req: NextRequest) {
  console.log('[upload-session] POST /api/assets/upload-session');
  try {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 });
    }

    const { fileName, fileType, fileSize, clientName, contentType, monthKey } = body;

    // ── Validate ──────────────────────────────────────────────────────────────
    if (!fileName || typeof fileName !== 'string') {
      return NextResponse.json({ error: 'fileName is required' }, { status: 400 });
    }
    if (!fileType || typeof fileType !== 'string') {
      return NextResponse.json({ error: 'fileType is required' }, { status: 400 });
    }
    if (typeof fileSize !== 'number' || fileSize <= 0) {
      return NextResponse.json({ error: 'fileSize must be a positive number' }, { status: 400 });
    }
    if (!clientName || typeof clientName !== 'string' || !clientName.trim()) {
      return NextResponse.json({ error: 'clientName is required' }, { status: 400 });
    }
    if (!contentType || typeof contentType !== 'string') {
      return NextResponse.json({ error: 'contentType is required' }, { status: 400 });
    }
    if (!VALID_CONTENT_TYPES.includes(contentType as typeof VALID_CONTENT_TYPES[number])) {
      return NextResponse.json(
        { error: `Invalid contentType. Must be one of: ${VALID_CONTENT_TYPES.join(', ')}` },
        { status: 400 },
      );
    }
    if (!monthKey || typeof monthKey !== 'string' || !/^\d{4}-\d{2}$/.test(monthKey)) {
      return NextResponse.json(
        { error: 'monthKey is required and must be in YYYY-MM format' },
        { status: 400 },
      );
    }

    const clientFolderName = clientToFolderName(clientName.trim());
    console.log('[upload-session] client:', clientName.trim(), '→ folder:', clientFolderName, '| type:', contentType, '| month:', monthKey, '| size:', fileSize);

    // ── Build folder hierarchy ─────────────────────────────────────────────────
    const { monthFolderId } = await createFolderHierarchy(clientFolderName, contentType, monthKey);

    // ── Initiate resumable upload session ─────────────────────────────────────
    const mimeType = fileType || 'application/octet-stream';
    const uploadUrl = await initiateResumableSession(fileName.trim(), mimeType, fileSize, monthFolderId);

    console.log('[upload-session] ✅ session created — folder:', monthFolderId);

    return NextResponse.json({
      uploadUrl,
      drive_folder_id: monthFolderId,
      client_folder_name: clientFolderName,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[upload-session] ❌', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
