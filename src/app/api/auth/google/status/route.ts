import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { checkDriveConnection } from '@/lib/google-drive';

/**
 * GET /api/auth/google/status
 *
 * Returns the configuration and connectivity status of the Google Drive OAuth
 * connection.  Performs a lightweight Drive API call when all env vars are
 * present to verify the credentials actually work.
 *
 * Admin only.
 */
export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ['admin']);
  if (auth instanceof NextResponse) return auth;

  const ADMIN_EMAIL = process.env.GOOGLE_ADMIN_EMAIL ?? 'thetaiseer@gmail.com';

  try {
    const result = await checkDriveConnection();

    return NextResponse.json({
      // Granular status for precise diagnostics
      status:      result.status,
      // Legacy boolean fields kept for backward compatibility with the settings page
      connected:   result.connected,
      configured:  result.missingVars.length === 0,
      // Which env vars are missing (empty array when fully configured)
      missingVars: result.missingVars,
      // Auth/API error detail when status is 'auth_failed'
      error:       result.error,
      // Account email (only meaningful when connected)
      email:          result.connected ? ADMIN_EMAIL : null,
      isAdminAccount: result.connected,
    });
  } catch (err: unknown) {
    // Should not reach here — checkDriveConnection never throws — but guard anyway
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[google/status] unexpected error:', msg);
    return NextResponse.json(
      {
        status:      'auth_failed' as const,
        connected:   false,
        configured:  false,
        missingVars: [],
        error:       `Unexpected error checking Drive status: ${msg}`,
        email:          null,
        isAdminAccount: false,
      },
      { status: 500 },
    );
  }
}
