import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { uploadToR2, buildR2Url, R2ConfigError } from '@/lib/r2';

export const dynamic = 'force-dynamic';

/**
 * POST /api/upload/preview-presign
 *
 * Accepts a JPEG preview image as multipart/form-data and uploads it
 * server-side directly to Cloudflare R2 — no presigned or signed URLs are used.
 *
 * Used for PDF first-page previews and other document cover images.
 *
 * The preview is stored as a sibling of the original file inside a `previews/`
 * subdirectory, preserving the organised path structure:
 *   Original: clients/{slug}/{mainCat}/{year}/{month}/{subCat}/{ts}-file.pdf
 *   Preview:  clients/{slug}/{mainCat}/{year}/{month}/{subCat}/previews/{ts}-file.jpg
 *
 * Form fields:
 *   file           – the JPEG preview image blob (required)
 *   fileStorageKey – R2 key of the parent file (required)
 *
 * Response:
 *   previewStorageKey  – R2 key where the preview was stored (clean, no signatures)
 *   previewUrl         – public CDN URL of the preview
 */
export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'manager', 'team_member']);
  if (auth instanceof NextResponse) return auth;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data body' }, { status: 400 });
  }

  const fileField      = formData.get('file');
  const fileStorageKey = ((formData.get('fileStorageKey') as string | null) ?? '').trim();

  if (!fileField || !(fileField instanceof Blob)) {
    return NextResponse.json({ error: 'file is required' }, { status: 400 });
  }
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
    const buffer = Buffer.from(await fileField.arrayBuffer());
    await uploadToR2(previewStorageKey, buffer, 'image/jpeg');

    const previewUrl = buildR2Url(previewStorageKey);

    return NextResponse.json({ previewStorageKey, previewUrl });
  } catch (err: unknown) {
    const msg         = err instanceof Error ? err.message : String(err);
    const isConfigErr = err instanceof R2ConfigError;
    console.error('[upload/preview-presign] failed:', msg);
    return NextResponse.json({ error: msg }, { status: isConfigErr ? 500 : 502 });
  }
}
