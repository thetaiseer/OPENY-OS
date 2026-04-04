import { NextRequest, NextResponse } from 'next/server';
import { createFolderHierarchy, initiateResumableSession } from '@/lib/google-drive';
import { clientToFolderName } from '@/lib/asset-utils';

// Fixed content type list — must stay in sync with upload-session and upload-complete routes
// (consider moving to a shared constants module if the list changes frequently)
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

/**
 * Resolve the final upload file name from an optional user-supplied name or
 * fall back to the auto-generated rename.
 *
 * - If `customFileName` is provided (non-empty after trim), it is sanitized and
 *   the original file extension is appended if the user did not include one.
 * - Otherwise the existing auto-rename logic is used.
 */
function resolveFileName(
  originalName: string,
  customFileName: string | null | undefined,
  clientFolderName: string,
  contentType: string,
  monthKey: string,
): string {
  if (customFileName && customFileName.trim()) {
    const base = sanitizeFileName(customFileName.trim());
    const ext  = originalName.includes('.')
      ? `.${originalName.split('.').pop()!.toLowerCase()}`
      : '';
    const hasExt = ext && base.toLowerCase().endsWith(ext);
    return hasExt ? base : `${base}${ext}`;
  }
  return generateRenamedFile(originalName, clientFolderName, contentType, monthKey);
}

// Simple in-memory rate limiter: 30 requests per 60 seconds per IP
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || entry.resetAt < now) {
    // Opportunistically prune a few expired entries to prevent unbounded growth
    if (rateLimitMap.size > 1000) {
      for (const [k, v] of rateLimitMap.entries()) {
        if (v.resetAt < now) rateLimitMap.delete(k);
        if (rateLimitMap.size <= 800) break;
      }
    }
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 30) return false;
  entry.count++;
  return true;
}

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

  // ── Rate limiting ───────────────────────────────────────────────────────────
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim()
    ?? req.headers.get('x-real-ip')
    ?? 'unknown';
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Too many uploads. Please wait a minute before uploading again.' },
      { status: 429 },
    );
  }

  try {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Request body must be valid JSON' }, { status: 400 });
    }

    const { fileName, fileType, fileSize, clientName, contentType, monthKey, uploadedBy, customFileName } = body;

    // ── Validate ──────────────────────────────────────────────────────────────
    if (!fileName || typeof fileName !== 'string') {
      return NextResponse.json({ success: false, error: 'fileName is required' }, { status: 400 });
    }

    // ── Security: block dangerous file types ──────────────────────────────────
    const ext = getFileExtension(fileName);
    if (BLOCKED_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        { success: false, error: 'File type not allowed: security policy blocks executable and script files' },
        { status: 400 },
      );
    }

    if (!fileType || typeof fileType !== 'string') {
      return NextResponse.json({ success: false, error: 'fileType is required' }, { status: 400 });
    }
    if (typeof fileSize !== 'number' || fileSize <= 0) {
      return NextResponse.json({ success: false, error: 'fileSize must be a positive number' }, { status: 400 });
    }
    if (!clientName || typeof clientName !== 'string' || !clientName.trim()) {
      return NextResponse.json({ success: false, error: 'clientName is required' }, { status: 400 });
    }
    if (!contentType || typeof contentType !== 'string') {
      return NextResponse.json({ success: false, error: 'contentType is required' }, { status: 400 });
    }
    if (!VALID_CONTENT_TYPES.includes(contentType as typeof VALID_CONTENT_TYPES[number])) {
      return NextResponse.json(
        { success: false, error: `Invalid contentType. Must be one of: ${VALID_CONTENT_TYPES.join(', ')}` },
        { status: 400 },
      );
    }
    if (!monthKey || typeof monthKey !== 'string' || !/^\d{4}-\d{2}$/.test(monthKey)) {
      return NextResponse.json(
        { success: false, error: 'monthKey is required and must be in YYYY-MM format' },
        { status: 400 },
      );
    }

    const clientFolderName = clientToFolderName(clientName.trim());
    const safeCustomName   = customFileName && typeof customFileName === 'string' ? customFileName.trim() : null;
    const renamedFileName  = resolveFileName(fileName.trim(), safeCustomName, clientFolderName, contentType as string, monthKey as string);
    const safeUploadedBy   = uploadedBy && typeof uploadedBy === 'string' ? uploadedBy.trim() : null;
    console.log('[upload-session] client:', clientName.trim(), '→ folder:', clientFolderName, '| type:', contentType, '| month:', monthKey, '| size:', fileSize, '| renamed:', renamedFileName);

    // ── Build folder hierarchy ─────────────────────────────────────────────────
    const { monthFolderId } = await createFolderHierarchy(clientFolderName, contentType, monthKey);

    // ── Initiate resumable upload session ─────────────────────────────────────
    const mimeType = fileType || 'application/octet-stream';
    const uploadUrl = await initiateResumableSession(renamedFileName, mimeType, fileSize as number, monthFolderId);

    console.log('[upload-session] ✅ session created — folder:', monthFolderId);

    return NextResponse.json({
      success: true,
      uploadUrl,
      drive_folder_id:    monthFolderId,
      client_folder_name: clientFolderName,
      renamedFileName,
      ...(safeUploadedBy ? { uploadedBy: safeUploadedBy } : {}),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[upload-session] UPLOAD ERROR:', err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
