import { NextResponse } from 'next/server';

/**
 * POST /api/auth/google/disconnect
 *
 * This endpoint is not applicable. Google Drive is authenticated via a
 * pre-configured OAuth 2.0 refresh token. To revoke access, remove the
 * GOOGLE_OAUTH_REFRESH_TOKEN env var or revoke the token in Google Cloud Console.
 */
export async function POST() {
  return NextResponse.json(
    { error: 'Disconnect is not applicable. Google Drive uses a pre-configured OAuth refresh token — remove the env var to disconnect.' },
    { status: 410 },
  );
}
