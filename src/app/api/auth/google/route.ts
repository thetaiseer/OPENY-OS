import { NextResponse } from 'next/server';

/**
 * GET /api/auth/google
 *
 * This endpoint is no longer used for an interactive OAuth flow.
 * Google Drive is authenticated via OAuth 2.0 refresh token configured
 * through GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, and
 * GOOGLE_OAUTH_REFRESH_TOKEN env vars — no user login flow is required.
 */
export async function GET() {
  return NextResponse.json(
    { error: 'Interactive OAuth flow is not available. Google Drive uses a pre-configured OAuth refresh token.' },
    { status: 410 },
  );
}
