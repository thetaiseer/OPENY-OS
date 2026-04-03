import { NextResponse } from 'next/server';
import { google } from 'googleapis';

/**
 * GET /api/auth/google/status
 *
 * Returns the connection status of the admin Google Drive OAuth account.
 * Checks for a stored refresh token and resolves the authenticated email.
 *
 * Response shape:
 *   { connected: boolean; email: string | null; isAdminAccount: boolean }
 */
export async function GET() {
  const clientId     = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;

  const ADMIN_EMAIL = process.env.GOOGLE_ADMIN_EMAIL ?? 'thetaiseer@gmail.com';

  if (!clientId || !clientSecret || !refreshToken) {
    return NextResponse.json({ connected: false, email: null, isAdminAccount: false });
  }

  try {
    const auth = new google.auth.OAuth2(clientId, clientSecret);
    auth.setCredentials({ refresh_token: refreshToken });

    const oauth2 = google.oauth2({ version: 'v2', auth });
    const info   = await oauth2.userinfo.get();
    const email  = info.data.email ?? null;

    return NextResponse.json({
      connected:      true,
      email,
      isAdminAccount: email?.toLowerCase() === ADMIN_EMAIL.toLowerCase(),
    });
  } catch {
    return NextResponse.json({ connected: false, email: null, isAdminAccount: false });
  }
}
