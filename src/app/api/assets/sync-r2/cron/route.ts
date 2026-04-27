import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { syncAssetsWithR2Storage } from '@/lib/assets/sync-r2-storage';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function isAuthorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = req.headers.get('authorization');
  if (auth === `Bearer ${secret}`) return true;
  const headerSecret = req.headers.get('x-cron-secret');
  const querySecret = new URL(req.url).searchParams.get('secret');
  return headerSecret === secret || querySecret === secret;
}

/**
 * GET /api/assets/sync-r2/cron
 *
 * Vercel Cron: verifies DB asset rows still exist in R2; marks missing rows.
 * Protected by CRON_SECRET (same pattern as /api/reminders/cron).
 */
export async function GET(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = getServiceClient();
    const result = await syncAssetsWithR2Storage(supabase, { logOrphanObjects: true });
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[assets/sync-r2/cron]', msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
