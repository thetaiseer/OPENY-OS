import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

/**
 * GET /api/auth/google/callback
 *
 * Google redirects here after the user completes the OAuth consent screen.
 * This handler exchanges the authorization code for access + refresh tokens,
 * then displays the refresh token so you can store it in the env var
 * GOOGLE_OAUTH_REFRESH_TOKEN and restart the server.
 *
 * Required env vars:
 *   GOOGLE_OAUTH_CLIENT_ID
 *   GOOGLE_OAUTH_CLIENT_SECRET
 *   GOOGLE_OAUTH_REDIRECT_URI  (must match exactly what was used in /api/auth/google)
 */
export async function GET(req: NextRequest) {
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

  const { searchParams } = req.nextUrl;
  const code  = searchParams.get('code');
  const error = searchParams.get('error');

  // User denied access or another OAuth error occurred
  if (error) {
    console.error('[google-oauth] OAuth callback error:', error);
    return NextResponse.json({ error: `Google OAuth error: ${error}` }, { status: 400 });
  }

  if (!code) {
    return NextResponse.json({ error: 'Missing authorization code in callback' }, { status: 400 });
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  let tokens: { access_token?: string | null; refresh_token?: string | null };
  let email = '(unknown)';

  try {
    const response = await oauth2Client.getToken(code);
    tokens = response.tokens;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[google-oauth] Token exchange failed:', msg);
    return NextResponse.json({ error: `Token exchange failed: ${msg}` }, { status: 500 });
  }

  // Try to resolve the authenticated user's email for confirmation
  try {
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const info = await oauth2.userinfo.get();
    email = info.data.email ?? '(unknown)';
  } catch {
    // Non-fatal — email is just for display
  }

  console.log('[google-oauth] Authenticated as:', email);
  console.log('[google-oauth] refresh_token present:', !!tokens.refresh_token);

  if (!tokens.refresh_token) {
    // This can happen when the app was already authorized without prompt:'consent'.
    // The /api/auth/google route uses prompt:'consent' to force a new token.
    return new NextResponse(
      buildHtml('⚠️ No refresh token returned', email, null, [
        'Google did not return a refresh token.',
        'This usually happens when the app was already authorized.',
        'Revoke access at https://myaccount.google.com/permissions and try again,',
        'or make sure /api/auth/google is called with prompt=consent (it already is by default).',
      ]),
      { status: 200, headers: { 'Content-Type': 'text/html' } },
    );
  }

  return new NextResponse(
    buildHtml('✅ Google OAuth Success', email, tokens.refresh_token, []),
    { status: 200, headers: { 'Content-Type': 'text/html' } },
  );
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildHtml(title: string, email: string, refreshToken: string | null, notes: string[]): string {
  const safeEmail = escapeHtml(email);
  const safeTitle = escapeHtml(title);
  const tokenSection = refreshToken
    ? `<p>Copy the refresh token below and set it as the <code>GOOGLE_OAUTH_REFRESH_TOKEN</code> env var, then restart the server.</p>
       <textarea rows="3" cols="80" style="font-family:monospace;padding:8px;border:1px solid #ccc;border-radius:4px;width:100%;box-sizing:border-box;">${escapeHtml(refreshToken)}</textarea>
       <p><strong>Next steps:</strong></p>
       <ol>
         <li>Add <code>GOOGLE_OAUTH_REFRESH_TOKEN=&lt;token above&gt;</code> to your <code>.env.local</code> / deployment env vars.</li>
         <li>Remove or leave unset: <code>GOOGLE_DRIVE_CLIENT_EMAIL</code>, <code>GOOGLE_DRIVE_PRIVATE_KEY</code>, <code>GOOGLE_DRIVE_PRIVATE_KEY_BASE64</code>.</li>
         <li>Restart the Next.js server.</li>
         <li>Try uploading a file — it will be owned by <strong>${safeEmail}</strong> in your personal My Drive.</li>
       </ol>`
    : notes.map(n => `<p>⚠️ ${escapeHtml(n)}</p>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>${safeTitle}</title>
<style>body{font-family:sans-serif;max-width:720px;margin:40px auto;padding:0 16px;}code{background:#f4f4f4;padding:2px 4px;border-radius:3px;}</style>
</head>
<body>
  <h1>${safeTitle}</h1>
  <p><strong>Authenticated Google account:</strong> ${safeEmail}</p>
  ${tokenSection}
</body>
</html>`;
}
