import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { getStorageConfigStatus } from '@/lib/storage';

/**
 * GET /api/r2/status
 *
 * Returns Cloudflare R2 configuration status.
 * Admin only.
 */
export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ['admin']);
  if (auth instanceof NextResponse) return auth;

  const { configured, missingVars } = getStorageConfigStatus();

  return NextResponse.json({ configured, missingVars });
}
