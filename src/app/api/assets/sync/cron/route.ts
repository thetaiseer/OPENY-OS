import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/assets/sync/cron
 *
 * Background scheduled sync endpoint.  Protected by a shared secret so only
 * authorised schedulers (e.g. Vercel Cron, GitHub Actions, cron-job.org) can
 * trigger it.
 *
 * Security:
 *   Set the env var SYNC_SECRET to a long random string, then pass it as the
 *   `x-sync-secret` request header (or `secret` query param for schedulers
 *   that cannot set headers).
 *
 * Example Vercel Cron (vercel.json):
 *   { "crons": [{ "path": "/api/assets/sync/cron", "schedule": "0 * * * *" }] }
 *
 * The route delegates all sync logic to POST /api/assets/sync so both manual
 * and scheduled syncs share the same code path.
 */
export async function GET(req: NextRequest) {
  const syncSecret = process.env.SYNC_SECRET;

  if (syncSecret) {
    const headerSecret = req.headers.get('x-sync-secret');
    const querySecret  = new URL(req.url).searchParams.get('secret');
    if (headerSecret !== syncSecret && querySecret !== syncSecret) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }
  }

  console.log('[sync/cron] scheduled sync triggered');

  // Delegate to the main sync endpoint so the logic lives in one place.
  // We call it server-side by importing and invoking the POST handler directly.
  const { POST } = await import('../route');

  // Build a synthetic request with triggered_by=cron note embedded
  const syntheticReq = new NextRequest(new URL('/api/assets/sync', req.url), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ triggered_by: 'cron' }),
  });

  return POST(syntheticReq);
}
