import { NextResponse } from 'next/server';

/**
 * GET /api/auth/google/status
 *
 * Returns the configuration status of the Google Drive OAuth connection.
 * Checks that GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, and
 * GOOGLE_OAUTH_REFRESH_TOKEN are set.
 *
 * Response shape:
 *   { connected: boolean; email: string | null; isAdminAccount: boolean }
 */
export async function GET() {
  const clientId     = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;

  const ADMIN_EMAIL = process.env.GOOGLE_ADMIN_EMAIL ?? 'thetaiseer@gmail.com';

  const connected = !!(clientId && clientSecret && refreshToken);

  return NextResponse.json({
    connected,
    email: connected ? (ADMIN_EMAIL) : null,
    isAdminAccount: connected,
  });
}
