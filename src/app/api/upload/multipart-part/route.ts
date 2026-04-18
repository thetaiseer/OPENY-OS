import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { createMultipartPartPresignedUrl, R2ConfigError } from '@/lib/r2';

export const dynamic = 'force-dynamic';

/**
 * POST /api/upload/multipart-part
 *
 * Returns a short-lived presigned URL so the browser can upload one multipart
 * part directly to Cloudflare R2 with HTTP PUT.
 * No file bytes pass through this API route.
 *
 * Request body (JSON):
 *   storageKey  – R2 object key (from multipart-init)
 *   uploadId    – multipart upload session ID (from multipart-init)
 *   partNumber  – 1-based part index (1..10000)
 *
 * Response:
 *   partNumber    – echoed back for client convenience
 *   presignedUrl  – URL for direct browser PUT of this chunk to R2
 *   expiresIn     – URL TTL in seconds
 */
export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'manager', 'team_member']);
  if (auth instanceof NextResponse) return auth;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const storageKey = (body.storageKey as string | undefined)?.trim() ?? '';
  const uploadId   = (body.uploadId as string | undefined)?.trim() ?? '';
  const partNumber = Number(body.partNumber ?? 0);

  if (!storageKey) return NextResponse.json({ error: 'storageKey query param is required' }, { status: 400 });
  if (!uploadId)   return NextResponse.json({ error: 'uploadId query param is required' }, { status: 400 });
  if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > 10000) {
    return NextResponse.json({ error: 'partNumber must be an integer between 1 and 10000' }, { status: 400 });
  }

  try {
    const expiresIn = 900;
    const result = await createMultipartPartPresignedUrl(storageKey, uploadId, partNumber, expiresIn);

    console.log('[upload/multipart-part] presigned URL issued:', {
      userId:     auth.profile.id,
      storageKey,
      uploadId,
      partNumber,
    });

    return NextResponse.json({
      partNumber,
      presignedUrl: result.presignedUrl,
      expiresIn,
    });
  } catch (err: unknown) {
    const msg         = err instanceof Error ? err.message : String(err);
    const isConfigErr = err instanceof R2ConfigError;
    console.error('[upload/multipart-part] failed:', msg);
    return NextResponse.json({ error: msg }, { status: isConfigErr ? 500 : 502 });
  }
}
