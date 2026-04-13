import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { generatePresignedPutUrl, R2ConfigError } from '@/lib/r2';
import { buildStorageKey, MAIN_CATEGORIES, SUBCATEGORIES, type MainCategorySlug } from '@/lib/asset-utils';

export const dynamic = 'force-dynamic';

/** Blocked executable/script extensions — security policy. */
const BLOCKED_EXTENSIONS = new Set([
  'exe','bat','cmd','sh','bash','ps1','msi','vbs',
  'php','py','rb','pl','cgi','app','com','scr','pif','reg','dll','so',
]);

const VALID_MAIN_CATEGORIES: string[] = MAIN_CATEGORIES.map(c => c.slug);

function getExtension(name: string): string {
  return name.split('.').pop()?.toLowerCase() ?? '';
}

function sanitizeFileName(name: string): string {
  return name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._\-]/g, '');
}

/**
 * POST /api/upload/presign
 *
 * Validates upload parameters and returns a short-lived presigned PUT URL so
 * the browser can upload the file directly to Cloudflare R2 without routing
 * the file bytes through the Next.js / Vercel server.
 *
 * Request body (JSON):
 *   fileName      – original file name (required)
 *   fileType      – MIME type of the file (required)
 *   fileSize      – file size in bytes (required)
 *   clientName    – client display name (required)
 *   clientId      – Supabase client UUID (optional)
 *   mainCategory  – main category slug (required)
 *   subCategory   – subcategory slug (optional)
 *   monthKey      – "YYYY-MM" (required)
 *   customFileName– custom base name without extension (optional)
 *
 * Response:
 *   uploadUrl   – presigned PUT URL (valid for 1 hour)
 *   storageKey  – R2 object key
 *   publicUrl   – final public URL of the file
 *   displayName – the sanitized display name used as the file name
 */
export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'manager', 'team']);
  if (auth instanceof NextResponse) return auth;

  // Rate limit: same budget as /api/upload (60 per hour per user)
  const { checkRateLimit } = await import('@/lib/rate-limit');
  const rl = checkRateLimit(`upload:user:${auth.profile.id}`, { limit: 60, windowMs: 60 * 60_000 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Upload limit exceeded. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const fileName     = (body.fileName     as string | undefined)?.trim() ?? '';
  const fileType     = (body.fileType     as string | undefined)?.trim() ?? 'application/octet-stream';
  const fileSize     = Number(body.fileSize ?? 0);
  const clientName   = (body.clientName   as string | undefined)?.trim() ?? '';
  const clientId     = (body.clientId     as string | undefined)?.trim() || null;
  const mainCategory = (body.mainCategory as string | undefined)?.trim() ?? '';
  const subCategory  = (body.subCategory  as string | undefined)?.trim() ?? '';
  const monthKey     = (body.monthKey     as string | undefined)?.trim() ?? '';
  const customName   = (body.customFileName as string | undefined)?.trim() || null;

  // ── Validation ─────────────────────────────────────────────────────────────
  const fail = (message: string, status = 400) =>
    NextResponse.json({ error: message }, { status });

  if (!fileName)    return fail('fileName is required');
  if (!clientName)  return fail('clientName is required');
  if (!mainCategory) return fail('mainCategory is required');
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) return fail('monthKey must be YYYY-MM');

  if (!VALID_MAIN_CATEGORIES.includes(mainCategory)) {
    return fail(`Invalid mainCategory. Must be one of: ${VALID_MAIN_CATEGORIES.join(', ')}`);
  }

  if (subCategory) {
    const validSubs = (SUBCATEGORIES[mainCategory as MainCategorySlug] ?? []).map(s => s.slug);
    if (validSubs.length > 0 && !validSubs.includes(subCategory)) {
      return fail(`Invalid subCategory "${subCategory}" for mainCategory "${mainCategory}". Must be one of: ${validSubs.join(', ')}`);
    }
  }

  const ext = getExtension(fileName);
  if (BLOCKED_EXTENSIONS.has(ext)) {
    return fail('File type not allowed: executable and script files are blocked');
  }

  if (!fileSize || fileSize <= 0) return fail('fileSize must be a positive number');

  // Build the storage key and display name.
  const sanitizedFile = sanitizeFileName(fileName);
  const timestamp     = Date.now();

  const storageKey = buildStorageKey({
    clientName,
    mainCategory,
    subCategory: subCategory || 'general',
    monthKey,
    fileName:    sanitizedFile,
    timestamp,
  });

  // Determine display name (custom name takes precedence).
  let displayName: string;
  if (customName) {
    const base        = sanitizeFileName(customName);
    const dotExt      = ext ? `.${ext}` : '';
    const baseLower   = base.toLowerCase();
    const extLower    = dotExt.toLowerCase();
    displayName = (dotExt && baseLower.endsWith(extLower)) ? base : `${base}${dotExt}`;
  } else {
    displayName = `${timestamp}-${sanitizedFile}`;
  }

  // ── Generate presigned URL ─────────────────────────────────────────────────
  try {
    const result = await generatePresignedPutUrl(storageKey, fileType);

    console.log('[upload/presign] presigned URL generated:', {
      userId: auth.profile.id,
      clientId,
      storageKey,
      fileType,
      fileSize,
    });

    return NextResponse.json({
      uploadUrl:   result.uploadUrl,
      storageKey:  result.storageKey,
      publicUrl:   result.publicUrl,
      displayName,
    });
  } catch (err: unknown) {
    const msg         = err instanceof Error ? err.message : String(err);
    const isConfigErr = err instanceof R2ConfigError;
    console.error('[upload/presign] failed to generate presigned URL:', msg);
    return NextResponse.json({ error: msg }, { status: isConfigErr ? 500 : 502 });
  }
}
