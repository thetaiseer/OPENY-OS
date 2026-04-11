import { NextResponse } from 'next/server';

/**
 * GET /api/google/connect
 *
 * Builds a Google OAuth 2.0 authorization URL and redirects the user to it.
 * The user grants access to Google Drive and is then sent back to
 * /api/google/callback with an authorization code.
 */
export async function GET() {
  const clientId    = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;

  if (!clientId) {
    console.error('[google/connect] Missing env var: GOOGLE_OAUTH_CLIENT_ID');
    return NextResponse.json(
      { error: 'Google OAuth is not configured: missing GOOGLE_OAUTH_CLIENT_ID' },
      { status: 500 },
    );
  }

  if (!redirectUri) {
    console.error('[google/connect] Missing env var: GOOGLE_OAUTH_REDIRECT_URI');
    return NextResponse.json(
      { error: 'Google OAuth is not configured: missing GOOGLE_OAUTH_REDIRECT_URI' },
      { status: 500 },
    );
  }

  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  redirectUri,
    response_type: 'code',
    scope:         'https://www.googleapis.com/auth/drive.file',
    access_type:   'offline',
    prompt:        'consent',
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  console.log('[google/connect] Redirecting to Google OAuth consent screen');
  return NextResponse.redirect(authUrl);
}
