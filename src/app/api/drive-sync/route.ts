import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/drive-sync
 *
 * Google Drive sync has been removed. Cloudflare R2 is now the sole storage
 * provider. This endpoint is no longer needed and returns 410 Gone.
 */
export async function POST() {
  return NextResponse.json(
    { success: false, error: 'Google Drive sync has been removed. Storage has migrated to Cloudflare R2.' },
    { status: 410 },
  );
}
