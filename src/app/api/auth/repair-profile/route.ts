/**
 * POST /api/auth/repair-profile
 *
 * @deprecated This endpoint has been removed. OPENY OS no longer uses
 * public.profiles. Use /api/auth/ensure-member instead to ensure a
 * team_members row exists for the authenticated user.
 */

import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { error: 'This endpoint has been deprecated. public.profiles is no longer used.' },
    { status: 410 },
  );
}

