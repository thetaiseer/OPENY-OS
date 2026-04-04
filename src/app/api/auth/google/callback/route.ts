import { NextResponse } from 'next/server';

/**
 * GET /api/auth/google/callback
 *
 * This endpoint is not used. Google Drive is authenticated via a pre-configured
 * OAuth 2.0 refresh token (GOOGLE_OAUTH_REFRESH_TOKEN env var).
 * No interactive OAuth callback is required.
 */
export async function GET() {
  return NextResponse.json(
    { error: 'OAuth callback is not available. Google Drive uses a pre-configured OAuth refresh token.' },
    { status: 410 },
  );
}
