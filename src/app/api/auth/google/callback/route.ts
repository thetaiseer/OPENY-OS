import { NextResponse } from 'next/server';

/**
 * GET /api/auth/google/callback
 *
 * This endpoint is no longer used. Google Drive is now authenticated via a
 * Service Account (GOOGLE_DRIVE_CLIENT_EMAIL + GOOGLE_DRIVE_PRIVATE_KEY).
 * No OAuth callback is required.
 */
export async function GET() {
  return NextResponse.json(
    { error: 'OAuth callback is not available. Google Drive uses a Service Account — no user login required.' },
    { status: 410 },
  );
}
