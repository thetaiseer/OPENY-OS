import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';

/**
 * POST /api/auth/google/disconnect
 *
 * Admin only. Google Drive is authenticated via a pre-configured OAuth 2.0
 * refresh token. To revoke access, remove the GOOGLE_OAUTH_REFRESH_TOKEN env
 * var or revoke the token in Google Cloud Console.
 */
export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ['admin']);
  if (auth instanceof NextResponse) return auth;

  return NextResponse.json(
    { error: 'Disconnect is not applicable. Google Drive uses a pre-configured OAuth refresh token — remove the env var to disconnect.' },
    { status: 410 },
  );
}
