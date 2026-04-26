import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { getPresignedMultipartPartUploadUrl, R2ConfigError } from '@/lib/storage';
import { checkUploadHourlyLimit } from '@/lib/upload-limits';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/upload/multipart-part-url
 *
 * Small JSON body only. Returns a presigned PUT URL for one multipart part so
 * the browser uploads part bytes directly to R2 (bypasses Vercel body limits).
 */
export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'manager', 'team_member']);
  if (auth instanceof NextResponse) return auth;

  const rl = checkUploadHourlyLimit(auth.profile.id);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Upload limit exceeded. Please try again later.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
      },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const storageKey = (body.storageKey as string | undefined)?.trim() ?? '';
  const uploadId = (body.uploadId as string | undefined)?.trim() ?? '';
  const partNumber = Number(body.partNumber ?? 0);

  if (!storageKey) return NextResponse.json({ error: 'storageKey is required' }, { status: 400 });
  if (!uploadId) return NextResponse.json({ error: 'uploadId is required' }, { status: 400 });
  if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > 10000) {
    return NextResponse.json(
      { error: 'partNumber must be an integer between 1 and 10000' },
      { status: 400 },
    );
  }

  try {
    const url = await getPresignedMultipartPartUploadUrl(storageKey, uploadId, partNumber, 3600);
    return NextResponse.json({ url });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const isConfigErr = err instanceof R2ConfigError;
    console.error('[upload/multipart-part-url] failed:', msg);
    return NextResponse.json({ error: msg }, { status: isConfigErr ? 500 : 502 });
  }
}
