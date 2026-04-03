import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

/**
 * GET /api/auth/google
 *
 * Redirects the browser to the Google OAuth 2.0 consent screen.
 * After the user grants access, Google redirects to /api/auth/google/callback
 * which will display the refresh token to store in GOOGLE_OAUTH_REFRESH_TOKEN.
 *
 * Required env vars:
 *   GOOGLE_OAUTH_CLIENT_ID
 *   GOOGLE_OAUTH_CLIENT_SECRET
 *   GOOGLE_OAUTH_REDIRECT_URI  (e.g. http://localhost:3000/api/auth/google/callback)
 */
export async function GET(_req: NextRequest) {
  const clientId     = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const redirectUri  = process.env.GOOGLE_OAUTH_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.json(
      {
        error: 'Missing OAuth env vars',
        required: ['GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET', 'GOOGLE_OAUTH_REDIRECT_URI'],
      },
      { status: 500 },
    );
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    // Drive scope for file management + userinfo.email to log the account
    scope: [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
    // Always prompt for consent so a refresh_token is returned even if the
    // user previously authorized the app without offline access.
    prompt: 'consent',
  });

  console.log('[google-oauth] Redirecting to Google consent screen');
  return NextResponse.redirect(authUrl);
}
