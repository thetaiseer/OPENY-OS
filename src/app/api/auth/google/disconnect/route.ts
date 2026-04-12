import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';

/**
 * POST /api/auth/google/disconnect
 *
 * Google Drive integration has been removed. Storage uses Cloudflare R2.
 * This endpoint returns 410 Gone.
 */
export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ['admin']);
  if (auth instanceof NextResponse) return auth;

  return NextResponse.json(
    { error: 'Google Drive integration has been removed. Storage uses Cloudflare R2.' },
    { status: 410 },
  );
}
