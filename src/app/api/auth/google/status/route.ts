import { NextResponse } from 'next/server';

/**
 * GET /api/auth/google/status
 *
 * Returns the configuration status of the Google Drive Service Account.
 * Checks that GOOGLE_DRIVE_CLIENT_EMAIL and GOOGLE_DRIVE_PRIVATE_KEY are set.
 *
 * Response shape:
 *   { connected: boolean; email: string | null; isAdminAccount: boolean }
 */
export async function GET() {
  const clientEmail = process.env.GOOGLE_DRIVE_CLIENT_EMAIL;
  const privateKey  = process.env.GOOGLE_DRIVE_PRIVATE_KEY;

  const ADMIN_EMAIL = process.env.GOOGLE_ADMIN_EMAIL ?? 'thetaiseer@gmail.com';

  const connected = !!(clientEmail && privateKey);
  const email = clientEmail ?? null;

  return NextResponse.json({
    connected,
    email,
    isAdminAccount: connected && !!email && email.toLowerCase() === ADMIN_EMAIL.toLowerCase(),
  });
}
