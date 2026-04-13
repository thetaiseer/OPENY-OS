import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { completeMultipartUpload, R2ConfigError, type CompletedPart } from '@/lib/r2';

export const dynamic = 'force-dynamic';

/**
 * POST /api/upload/multipart-complete
 *
 * Finalizes a multipart upload by instructing R2 to assemble all uploaded
 * parts into a single object.  No file bytes are accepted here.
 *
 * Request body (JSON):
 *   storageKey – R2 object key
 *   uploadId   – multipart upload session ID
 *   parts      – array of { partNumber: number, etag: string }
 *
 * Response:
 *   { success: true, publicUrl }
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

  const storageKey = (body.storageKey as string | undefined)?.trim() ?? '';
  const uploadId   = (body.uploadId   as string | undefined)?.trim() ?? '';
  const rawParts   = body.parts as unknown;

  if (!storageKey) return NextResponse.json({ error: 'storageKey is required' }, { status: 400 });
  if (!uploadId)   return NextResponse.json({ error: 'uploadId is required' }, { status: 400 });

  if (!Array.isArray(rawParts) || rawParts.length === 0) {
    return NextResponse.json({ error: 'parts must be a non-empty array' }, { status: 400 });
  }

  const parts: CompletedPart[] = [];
  for (const p of rawParts as Record<string, unknown>[]) {
    const pn   = Number(p.partNumber);
    const etag = (p.etag as string | undefined)?.trim() ?? '';
    if (!Number.isInteger(pn) || pn < 1 || pn > 10000) {
      return NextResponse.json({ error: `Invalid partNumber: ${pn}` }, { status: 400 });
    }
    if (!etag) {
      return NextResponse.json({ error: `Missing etag for part ${pn}` }, { status: 400 });
    }
    parts.push({ partNumber: pn, etag });
  }

  try {
    const result = await completeMultipartUpload(storageKey, uploadId, parts);

    console.log('[upload/multipart-complete] completed:', {
      userId:    auth.profile.id,
      storageKey,
      uploadId,
      partCount: parts.length,
      publicUrl: result.publicUrl,
    });

    return NextResponse.json({ success: true, publicUrl: result.publicUrl });
  } catch (err: unknown) {
    const msg         = err instanceof Error ? err.message : String(err);
    const isConfigErr = err instanceof R2ConfigError;
    console.error('[upload/multipart-complete] failed:', msg);
    return NextResponse.json({ error: msg }, { status: isConfigErr ? 500 : 502 });
  }
}
