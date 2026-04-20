import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { uploadToR2, buildR2Url, R2ConfigError } from '@/lib/r2';
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
 * Accepts a multipart/form-data request containing the file to upload and
 * associated metadata.  Uploads the file server-side directly to Cloudflare
 * R2 and returns the clean public URL — no presigned or signed URLs are used.
 *
 * Form fields:
 *   file          – the binary file (required)
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
 *   storageKey  – R2 object key (clean, no signatures)
 *   publicUrl   – public CDN URL of the file (${R2_PUBLIC_URL}/{storageKey})
 *   displayName – the sanitized display name used as the file name
 */
export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'manager', 'team_member']);
  if (auth instanceof NextResponse) return auth;

  // Rate limit: 60 uploads per hour per user
  const { checkRateLimit } = await import('@/lib/rate-limit');
  const rl = checkRateLimit(`upload:user:${auth.profile.id}`, { limit: 60, windowMs: 60 * 60_000 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Upload limit exceeded. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data body' }, { status: 400 });
  }

  const fileField    = formData.get('file');
  const fileName     = ((formData.get('fileName')     as string | null) ?? '').trim();
  const fileType     = ((formData.get('fileType')     as string | null) ?? 'application/octet-stream').trim();
  const fileSize     = Number(formData.get('fileSize') ?? 0);
  const clientName   = ((formData.get('clientName')   as string | null) ?? '').trim();
  const clientId     = ((formData.get('clientId')     as string | null) ?? '').trim() || null;
  const mainCategory = ((formData.get('mainCategory') as string | null) ?? '').trim();
  const subCategory  = ((formData.get('subCategory')  as string | null) ?? '').trim();
  const monthKey     = ((formData.get('monthKey')     as string | null) ?? '').trim();
  const customName   = ((formData.get('customFileName') as string | null) ?? '').trim() || null;

  // ── Validation ─────────────────────────────────────────────────────────────
  const fail = (message: string, status = 400) =>
    NextResponse.json({ error: message }, { status });

  if (!fileField || !(fileField instanceof Blob)) return fail('file is required');
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

  let displayName: string;
  if (customName) {
    const base      = sanitizeFileName(customName);
    const dotExt    = ext ? `.${ext}` : '';
    const baseLower = base.toLowerCase();
    const extLower  = dotExt.toLowerCase();
    displayName = (dotExt && baseLower.endsWith(extLower)) ? base : `${base}${dotExt}`;
  } else {
    displayName = `${timestamp}-${sanitizedFile}`;
  }

  const bucketName = process.env.R2_BUCKET_NAME ?? 'client-assets';
  console.log('[upload/presign] upload started', {
    provider: 'r2',
    bucketName,
    storageKey,
    userId: auth.profile.id,
    clientId,
  });

  // ── Upload to R2 server-side ───────────────────────────────────────────────
  try {
    const buffer      = Buffer.from(await fileField.arrayBuffer());
    const contentType = fileType || (fileField as File).type || 'application/octet-stream';

    await uploadToR2(storageKey, buffer, contentType);

    const publicUrl = buildR2Url(storageKey);

    console.log('[upload/presign] uploaded to R2:', {
      provider: 'r2',
      bucketName,
      userId: auth.profile.id,
      clientId,
      storageKey,
      contentType,
      fileSize: buffer.byteLength,
    });

    return NextResponse.json({ storageKey, publicUrl, displayName });
  } catch (err: unknown) {
    const msg         = err instanceof Error ? err.message : String(err);
    const isConfigErr = err instanceof R2ConfigError;
    console.error('[upload/presign] upload failure', {
      provider: 'r2',
      bucketName,
      storageKey,
      error: msg,
    });
    return NextResponse.json({ error: msg }, { status: isConfigErr ? 500 : 502 });
  }
}
