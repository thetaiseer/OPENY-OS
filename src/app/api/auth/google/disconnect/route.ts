import { NextResponse } from 'next/server';
import { google } from 'googleapis';

/**
 * POST /api/auth/google/disconnect
 *
 * Revokes the stored OAuth refresh token so the admin Drive account is
 * disconnected from the application.
 *
 * Note: After calling this, the admin must remove GOOGLE_OAUTH_REFRESH_TOKEN
 * from the environment and restart the server.  The env var is read-only at
 * runtime — this endpoint only revokes the token on Google's side.
 */
export async function POST() {
  const clientId     = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;

  if (!refreshToken) {
    return NextResponse.json({ ok: true, message: 'No token to revoke.' });
  }
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'Missing OAuth env vars.' }, { status: 500 });
  }

  try {
    const auth = new google.auth.OAuth2(clientId, clientSecret);
    auth.setCredentials({ refresh_token: refreshToken });
    await auth.revokeToken(refreshToken);
    console.log('[google-oauth] Refresh token revoked by admin.');
    return NextResponse.json({
      ok: true,
      message:
        'Token revoked on Google side. To fully disconnect, remove GOOGLE_OAUTH_REFRESH_TOKEN from your environment variables and restart the server.',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[google-oauth] Token revocation failed:', msg);
    return NextResponse.json({ error: `Revocation failed: ${msg}` }, { status: 500 });
  }
}
