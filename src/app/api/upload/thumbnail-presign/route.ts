import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { generatePresignedPutUrl, R2ConfigError } from '@/lib/r2';

export const dynamic = 'force-dynamic';

/**
 * POST /api/upload/thumbnail-presign
 *
 * Returns a short-lived presigned PUT URL so the browser can upload a video
 * thumbnail (JPEG) directly to Cloudflare R2 without routing the bytes through
 * the Next.js / Vercel server.
 *
 * The thumbnail is stored as a sibling of the original video inside a
 * `thumbnails/` subdirectory, preserving the organised path structure:
 *   Original:  clients/{slug}/{mainCat}/{year}/{month}/{subCat}/{ts}-video.mp4
 *   Thumbnail: clients/{slug}/{mainCat}/{year}/{month}/{subCat}/thumbnails/{ts}-video.jpg
 *
 * Request body (JSON):
 *   videoStorageKey – R2 key of the parent video file (required)
 *
 * Response:
 *   uploadUrl            – presigned PUT URL (valid for 1 hour)
 *   thumbnailStorageKey  – R2 key where the thumbnail will be stored
 *   thumbnailUrl         – final public URL of the thumbnail
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

  const videoStorageKey = (body.videoStorageKey as string | undefined)?.trim() ?? '';

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
  // Remove original extension and add .jpg
  const baseName  = filename.replace(/\.[^.]+$/, '');
  const thumbnailStorageKey = dir
    ? `${dir}/thumbnails/${baseName}.jpg`
    : `thumbnails/${baseName}.jpg`;

  try {
    const result = await generatePresignedPutUrl(thumbnailStorageKey, 'image/jpeg');

    return NextResponse.json({
      uploadUrl:           result.uploadUrl,
      thumbnailStorageKey: result.storageKey,
      thumbnailUrl:        result.publicUrl,
    });
  } catch (err: unknown) {
    const msg         = err instanceof Error ? err.message : String(err);
    const isConfigErr = err instanceof R2ConfigError;
    console.error('[upload/thumbnail-presign] failed:', msg);
    return NextResponse.json({ error: msg }, { status: isConfigErr ? 500 : 502 });
  }
}
