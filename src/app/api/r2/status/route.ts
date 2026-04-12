import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { checkR2Config } from '@/lib/r2';

/**
 * GET /api/r2/status
 *
 * Returns Cloudflare R2 configuration status.
 * Admin only.
 */
export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ['admin']);
  if (auth instanceof NextResponse) return auth;

  const { configured, missingVars } = checkR2Config();

  return NextResponse.json({ configured, missingVars });
}
