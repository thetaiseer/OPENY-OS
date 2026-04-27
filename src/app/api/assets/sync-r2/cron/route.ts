/**
 * GET /api/assets/sync-r2/cron
 *
 * Vercel cron trigger for the R2 sync job.
 * Secured by CRON_SECRET environment variable.
 *
 * Schedule (vercel.json):
 *   "0 0 * * *"   — daily at midnight UTC
 *   "0 6,12,18 * * *" — every 6 hours
 */

import { NextRequest, NextResponse } from 'next/server';

const CRON_SECRET = process.env.CRON_SECRET ?? '';

export async function GET(req: NextRequest) {
  // Validate cron secret.
  if (CRON_SECRET) {
    const auth = req.headers.get('authorization') ?? '';
    if (auth !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  // Delegate to the sync endpoint by calling it internally.
  const baseUrl =
    (process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL)
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000';

  const syncUrl = `${baseUrl}/api/assets/sync-r2`;

  try {
    const res = await fetch(syncUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(CRON_SECRET ? { Authorization: `Bearer ${CRON_SECRET}` } : {}),
      },
    });

    const body = (await res.json()) as Record<string, unknown>;

    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.error('[sync-r2/cron] sync-r2 responded with error', { status: res.status, body });
      return NextResponse.json(
        { success: false, error: 'Sync job failed', details: body },
        { status: 502 },
      );
    }

    // eslint-disable-next-line no-console
    console.info('[sync-r2/cron] sync completed', body);
    return NextResponse.json({ success: true, ...body });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.error('[sync-r2/cron] unexpected error', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
