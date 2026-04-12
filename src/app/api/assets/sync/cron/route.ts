import { NextResponse } from 'next/server';

/**
 * GET /api/assets/sync/cron
 *
 * Google Drive background sync has been removed. Cloudflare R2 is now the
 * sole storage provider. Assets are written directly to the DB on upload,
 * so no scheduled sync is required.
 *
 * Returns 410 Gone.
 */
export async function GET() {
  return NextResponse.json(
    {
      success: false,
      error:   'Google Drive sync has been removed. Assets are stored in Cloudflare R2 and synced to the database automatically on upload.',
    },
    { status: 410 },
  );
}
