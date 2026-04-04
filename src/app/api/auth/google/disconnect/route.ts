import { NextResponse } from 'next/server';

/**
 * POST /api/auth/google/disconnect
 *
 * This endpoint is no longer applicable. Google Drive is now authenticated via
 * a Service Account (GOOGLE_DRIVE_CLIENT_EMAIL + GOOGLE_DRIVE_PRIVATE_KEY).
 * There is no OAuth token to revoke.
 */
export async function POST() {
  return NextResponse.json(
    { error: 'Disconnect is not applicable. Google Drive uses a Service Account — no OAuth token to revoke.' },
    { status: 410 },
  );
}
