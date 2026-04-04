import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';

/**
 * GET /api/auth/google/status
 *
 * Returns the configuration status of the Google Drive OAuth connection.
 * Admin only.
 */
export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ['admin']);
  if (auth instanceof NextResponse) return auth;

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
