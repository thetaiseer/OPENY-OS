import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { uploadMultipartPart, R2ConfigError } from '@/lib/storage';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * POST /api/upload/multipart-part
 *
 * Accepts a raw binary chunk (application/octet-stream) and uploads it as a
 * multipart part to R2 server-side — no presigned or signed URLs are used.
 *
 * Metadata is passed as query parameters:
 *   storageKey  – R2 object key (from multipart-init)
 *   uploadId    – multipart upload session ID (from multipart-init)
 *   partNumber  – 1-based part index (1..10000)
 *
 * Request body:
 *   Raw binary bytes of the chunk (Content-Type: application/octet-stream)
 *
 * Response:
 *   partNumber  – echoed back for client convenience
 *   etag        – ETag returned by R2 for this part (use when completing)
 */
export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'manager', 'team_member']);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = req.nextUrl;
  const storageKey = (searchParams.get('storageKey') ?? '').trim();
  const uploadId = (searchParams.get('uploadId') ?? '').trim();
  const partNumber = Number(searchParams.get('partNumber') ?? 0);

  if (!storageKey)
    return NextResponse.json({ error: 'storageKey query param is required' }, { status: 400 });
  if (!uploadId)
    return NextResponse.json({ error: 'uploadId query param is required' }, { status: 400 });
  if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > 10000) {
    return NextResponse.json(
      { error: 'partNumber must be an integer between 1 and 10000' },
      { status: 400 },
    );
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(await req.arrayBuffer());
  } catch {
    return NextResponse.json({ error: 'Failed to read request body' }, { status: 400 });
  }

  if (buffer.byteLength === 0) {
    return NextResponse.json({ error: 'Empty chunk body' }, { status: 400 });
  }

  try {
    const result = await uploadMultipartPart(storageKey, uploadId, partNumber, buffer);

    return NextResponse.json({
      partNumber: result.partNumber,
      etag: result.etag,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const isConfigErr = err instanceof R2ConfigError;
    console.error('[upload/multipart-part] failed:', msg);
    return NextResponse.json({ error: msg }, { status: isConfigErr ? 500 : 502 });
  }
}
