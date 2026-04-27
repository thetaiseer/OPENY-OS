import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { getServiceClient } from '@/lib/supabase/service-client';
import { resolveFromToParams } from '@/lib/url-date';

/**
 * GET /api/dashboard/trends
 * Query: from=YYYY-MM-DD&to=YYYY-MM-DD (optional). Falls back to period=YYYY-MM
 * and then to current calendar month.
 * Returns task completion counts grouped by date for each day in the range.
 */
export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'manager', 'team_member']);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const {
      fromDate: start,
      toDate: end,
      fromYmd: sinceStr,
      toYmd: untilStr,
    } = resolveFromToParams(searchParams);

    const sb = getServiceClient();
    const { data, error } = await sb
      .from('tasks')
      .select('updated_at, status')
      .in('status', ['done', 'delivered'])
      .gte('updated_at', `${sinceStr}T00:00:00`)
      .lte('updated_at', `${untilStr}T23:59:59.999`)
      .order('updated_at', { ascending: true });

    if (error) throw new Error(error.message);

    const counts: Record<string, number> = {};
    for (const row of data ?? []) {
      const d = (row.updated_at as string).slice(0, 10);
      counts[d] = (counts[d] ?? 0) + 1;
    }

    const result: { date: string; completed: number }[] = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      const d = new Date(cursor);
      const key = d.toISOString().slice(0, 10);
      result.push({ date: key, completed: counts[key] ?? 0 });
      cursor.setDate(cursor.getDate() + 1);
    }

    return NextResponse.json({ success: true, trends: result });
  } catch (err) {
    console.error('[GET /api/dashboard/trends] failed', err);
    return NextResponse.json({ success: false, error: 'Something went wrong' }, { status: 500 });
  }
}
