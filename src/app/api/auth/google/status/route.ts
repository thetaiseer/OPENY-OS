import { NextResponse } from 'next/server';

/**
 * GET /api/auth/google/status
 *
 * Google Drive has been removed. Storage has migrated to Cloudflare R2.
 * This endpoint returns 410 Gone.
 */
export async function GET() {
  return NextResponse.json(
    { error: 'Google Drive integration has been removed. Storage uses Cloudflare R2.' },
    { status: 410 },
  );
}
