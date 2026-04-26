import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { getServiceClient } from '@/lib/supabase/service-client';

/**
 * GET /api/dashboard/trends
 * Query: period=YYYY-MM (optional). Defaults to current calendar month.
 * Returns task completion counts grouped by date for each day in that month.
 */
export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'manager', 'team_member']);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const raw = searchParams.get('period') ?? '';
    const now = new Date();
    const defaultYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const period = /^\d{4}-(0[1-9]|1[0-2])$/.test(raw) ? raw : defaultYm;
    const [py, pm] = period.split('-').map(Number);
    const monthStart = new Date(py, pm - 1, 1);
    const monthEnd = new Date(py, pm, 0);
    const sinceStr = monthStart.toISOString().slice(0, 10);
    const untilStr = monthEnd.toISOString().slice(0, 10);

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
    for (let day = 1; day <= monthEnd.getDate(); day++) {
      const d = new Date(py, pm - 1, day);
      const key = d.toISOString().slice(0, 10);
      result.push({ date: key, completed: counts[key] ?? 0 });
    }

    return NextResponse.json({ success: true, trends: result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
