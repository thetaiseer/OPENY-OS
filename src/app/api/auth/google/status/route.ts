import { NextResponse } from 'next/server';

/**
 * GET /api/auth/google/status
 *
 * Returns the configuration status of the Google Drive Service Account.
 * Checks that GOOGLE_DRIVE_CLIENT_EMAIL and GOOGLE_DRIVE_PRIVATE_KEY_BASE64 are set.
 *
 * Response shape:
 *   { connected: boolean; email: string | null; isAdminAccount: boolean }
 */
export async function GET() {
  const clientEmail  = process.env.GOOGLE_DRIVE_CLIENT_EMAIL;
  const privateKeyB64 = process.env.GOOGLE_DRIVE_PRIVATE_KEY_BASE64;

  const ADMIN_EMAIL = process.env.GOOGLE_ADMIN_EMAIL ?? 'thetaiseer@gmail.com';

  const connected = !!(clientEmail && privateKeyB64);
  const email = clientEmail ?? null;

  return NextResponse.json({
    connected,
    email,
    isAdminAccount: connected && !!email && email.toLowerCase() === ADMIN_EMAIL.toLowerCase(),
  });
}
