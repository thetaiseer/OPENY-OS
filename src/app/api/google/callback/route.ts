import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens, validateGoogleOAuthEnvVars } from '@/lib/google-drive';

/**
 * GET /api/google/callback
 *
 * Receives the authorization code from Google OAuth, exchanges it for tokens,
 * then redirects the user back to /settings with a status query param.
 *
 * On success:  /settings?google=connected
 * On failure:  /settings?google=error
 */
export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://openy-os.com';
  const settingsBase = `${appUrl}/settings`;

  const { searchParams } = new URL(req.url);
  const code  = searchParams.get('code');
  const error = searchParams.get('error');

  // Google returned an error (e.g. user denied access)
  if (error) {
    console.error('[google/callback] Google returned OAuth error:', error);
    return NextResponse.redirect(`${settingsBase}?google=error`);
  }

  // No code and no error — unexpected
  if (!code) {
    console.error('[google/callback] Missing "code" query parameter');
    return NextResponse.json(
      { error: 'Missing authorization code from Google' },
      { status: 400 },
    );
  }

  // Validate required env vars before attempting token exchange
  const envCheck = validateGoogleOAuthEnvVars();
  if (!envCheck.valid) {
    console.error('[google/callback] Missing env vars:', envCheck.missing.join(', '));
    return NextResponse.redirect(`${settingsBase}?google=error`);
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    console.log(
      '[google/callback] Token exchange successful.',
      'has_refresh_token:', !!tokens.refresh_token,
    );
    // TODO: Persist tokens.refresh_token securely (e.g. encrypted DB or env var update)
    // For now, the token is available here and can be stored by extending this handler.
    return NextResponse.redirect(`${settingsBase}?google=connected`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[google/callback] Token exchange failed:', msg);
    return NextResponse.redirect(`${settingsBase}?google=error`);
  }
}
