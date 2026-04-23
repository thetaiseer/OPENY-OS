import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { abortMultipartUploadSession, R2ConfigError } from '@/lib/storage';

export const dynamic = 'force-dynamic';

/**
 * POST /api/upload/multipart-abort
 *
 * Aborts a multipart upload session and releases all partially uploaded parts
 * from R2 storage.  Call this whenever a large-file upload is cancelled or
 * fails irrecoverably.
 *
 * Request body (JSON):
 *   storageKey – R2 object key
 *   uploadId   – multipart upload session ID
 *
 * Response:
 *   { success: true }
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
  const uploadId   = (body.uploadId   as string | undefined)?.trim() ?? '';

  if (!storageKey) return NextResponse.json({ error: 'storageKey is required' }, { status: 400 });
  if (!uploadId)   return NextResponse.json({ error: 'uploadId is required' }, { status: 400 });

  try {
    await abortMultipartUploadSession(storageKey, uploadId);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg         = err instanceof Error ? err.message : String(err);
    const isConfigErr = err instanceof R2ConfigError;
    console.error('[upload/multipart-abort] failed:', msg);
    // A failed abort is not fatal for the caller; log and return the error.
    return NextResponse.json({ error: msg }, { status: isConfigErr ? 500 : 502 });
  }
}
