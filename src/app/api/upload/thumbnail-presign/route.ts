import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { uploadFile, getFileUrl, R2ConfigError } from '@/lib/storage';

export const dynamic = 'force-dynamic';

/**
 * POST /api/upload/thumbnail-presign
 *
 * Accepts a JPEG video thumbnail as multipart/form-data and uploads it
 * server-side directly to Cloudflare R2 — no presigned or signed URLs are used.
 *
 * The thumbnail is stored as a sibling of the original video inside a
 * `thumbnails/` subdirectory, preserving the organised path structure:
 *   Original:  clients/{slug}/{mainCat}/{year}/{month}/{subCat}/{ts}-video.mp4
 *   Thumbnail: clients/{slug}/{mainCat}/{year}/{month}/{subCat}/thumbnails/{ts}-video.jpg
 *
 * Form fields:
 *   file            – the JPEG thumbnail image blob (required)
 *   videoStorageKey – R2 key of the parent video file (required)
 *
 * Response:
 *   thumbnailStorageKey  – R2 key where the thumbnail was stored (clean, no signatures)
 *   thumbnailUrl         – public CDN URL of the thumbnail
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

  const fileField       = formData.get('file');
  const videoStorageKey = ((formData.get('videoStorageKey') as string | null) ?? '').trim();

  if (!fileField || !(fileField instanceof Blob)) {
    return NextResponse.json({ error: 'file is required' }, { status: 400 });
  }
  if (!videoStorageKey) {
    return NextResponse.json({ error: 'videoStorageKey is required' }, { status: 400 });
  }

  // Derive a thumbnail key that is a sibling of the video inside a
  // `thumbnails/` subdirectory, stripping the original file extension and
  // replacing it with `.jpg`.
  //
  // e.g. clients/acme/social/2024/01/reels/1735000000-video.mp4
  //   →  clients/acme/social/2024/01/reels/thumbnails/1735000000-video.jpg
  const lastSlash = videoStorageKey.lastIndexOf('/');
  const dir       = lastSlash >= 0 ? videoStorageKey.slice(0, lastSlash) : '';
  const filename  = lastSlash >= 0 ? videoStorageKey.slice(lastSlash + 1) : videoStorageKey;
  const baseName  = filename.replace(/\.[^.]+$/, '');
  const thumbnailStorageKey = dir
    ? `${dir}/thumbnails/${baseName}.jpg`
    : `thumbnails/${baseName}.jpg`;

  try {
    const buffer = Buffer.from(await fileField.arrayBuffer());
    await uploadFile({ key: thumbnailStorageKey, body: buffer, contentType: 'image/jpeg' });

    const thumbnailUrl = getFileUrl(thumbnailStorageKey);

    return NextResponse.json({ thumbnailStorageKey, thumbnailUrl });
  } catch (err: unknown) {
    const msg         = err instanceof Error ? err.message : String(err);
    const isConfigErr = err instanceof R2ConfigError;
    console.error('[upload/thumbnail-presign] failed:', msg);
    return NextResponse.json({ error: msg }, { status: isConfigErr ? 500 : 502 });
  }
}
