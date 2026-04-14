import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { generatePresignedPutUrl, R2ConfigError } from '@/lib/r2';

export const dynamic = 'force-dynamic';

/**
 * POST /api/upload/preview-presign
 *
 * Returns a short-lived presigned PUT URL so the browser can upload a file
 * preview image (JPEG) directly to Cloudflare R2 without routing bytes through
 * the Next.js / Vercel server.
 *
 * Used for PDF first-page previews and other document cover images.
 *
 * The preview is stored as a sibling of the original file inside a `previews/`
 * subdirectory, preserving the organised path structure:
 *   Original: clients/{slug}/{mainCat}/{year}/{month}/{subCat}/{ts}-file.pdf
 *   Preview:  clients/{slug}/{mainCat}/{year}/{month}/{subCat}/previews/{ts}-file.jpg
 *
 * Request body (JSON):
 *   fileStorageKey – R2 key of the parent file (required)
 *
 * Response:
 *   uploadUrl          – presigned PUT URL (valid for 1 hour)
 *   previewStorageKey  – R2 key where the preview will be stored
 *   previewUrl         – final public URL of the preview
 */
export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'manager', 'team']);
  if (auth instanceof NextResponse) return auth;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const fileStorageKey = (body.fileStorageKey as string | undefined)?.trim() ?? '';

  if (!fileStorageKey) {
    return NextResponse.json({ error: 'fileStorageKey is required' }, { status: 400 });
  }

  // Derive a preview key that is a sibling of the original file inside a
  // `previews/` subdirectory, replacing the original extension with `.jpg`.
  //
  // e.g. clients/acme/docs/2024/01/reports/1735000000-report.pdf
  //   →  clients/acme/docs/2024/01/reports/previews/1735000000-report.jpg
  const lastSlash = fileStorageKey.lastIndexOf('/');
  const dir       = lastSlash >= 0 ? fileStorageKey.slice(0, lastSlash) : '';
  const filename  = lastSlash >= 0 ? fileStorageKey.slice(lastSlash + 1) : fileStorageKey;
  const baseName  = filename.replace(/\.[^.]+$/, '');
  const previewStorageKey = dir
    ? `${dir}/previews/${baseName}.jpg`
    : `previews/${baseName}.jpg`;

  try {
    const result = await generatePresignedPutUrl(previewStorageKey, 'image/jpeg');

    return NextResponse.json({
      uploadUrl:         result.uploadUrl,
      previewStorageKey: result.storageKey,
      previewUrl:        result.publicUrl,
    });
  } catch (err: unknown) {
    const msg         = err instanceof Error ? err.message : String(err);
    const isConfigErr = err instanceof R2ConfigError;
    console.error('[upload/preview-presign] failed:', msg);
    return NextResponse.json({ error: msg }, { status: isConfigErr ? 500 : 502 });
  }
}
