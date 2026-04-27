import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { requireRole } from '@/lib/api-auth';
import { syncAssetsWithR2Storage } from '@/lib/assets/sync-r2-storage';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function cronMatches(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get('authorization');
  if (auth === `Bearer ${secret}`) return true;
  const headerSecret = req.headers.get('x-cron-secret');
  const querySecret = new URL(req.url).searchParams.get('secret');
  return headerSecret === secret || querySecret === secret;
}

/**
 * POST /api/assets/sync-r2
 *
 * Admin manual sync, or automation when CRON_SECRET is supplied (same as cron route).
 */
export async function POST(req: NextRequest) {
  if (cronMatches(req)) {
    try {
      const supabase = getServiceClient();
      const result = await syncAssetsWithR2Storage(supabase, { logOrphanObjects: true });
      return NextResponse.json({ success: true, ...result });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ success: false, error: msg }, { status: 500 });
    }
  }

  const auth = await requireRole(req, ['admin']);
  if (auth instanceof NextResponse) return auth;

  try {
    const supabase = getServiceClient();
    const result = await syncAssetsWithR2Storage(supabase, { logOrphanObjects: true });
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
