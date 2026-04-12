import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';

/**
 * /api/assets/sync
 *
 * The Google Drive → DB sync has been removed. Cloudflare R2 is now the sole
 * storage provider.  Assets are written directly to the DB during upload, so
 * no separate sync step is required.
 *
 * GET  — returns a stub "no sync available" response
 * POST — returns 410 Gone
 */

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ['admin']);
  if (auth instanceof NextResponse) return auth;

  return NextResponse.json({
    success:   true,
    last_sync: null,
    message:   'Google Drive sync has been removed. Assets are stored in Cloudflare R2 and synced to the database automatically on upload.',
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ['admin']);
  if (auth instanceof NextResponse) return auth;

  return NextResponse.json(
    { success: false, error: 'Drive sync is no longer available. Storage has migrated to Cloudflare R2.' },
    { status: 410 },
  );
}
