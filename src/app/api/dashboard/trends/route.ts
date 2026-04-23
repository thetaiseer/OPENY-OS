import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { getServiceClient } from '@/lib/supabase/service-client';

/**
 * GET /api/dashboard/trends
 * Returns task completion counts grouped by date for the last 30 days.
 */
export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'manager', 'team_member']);
  if (auth instanceof NextResponse) return auth;

  try {
    const sb = getServiceClient();
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const sinceStr = since.toISOString().slice(0, 10);

    const { data, error } = await sb
      .from('tasks')
      .select('updated_at, status')
      .in('status', ['done', 'delivered'])
      .gte('updated_at', sinceStr)
      .order('updated_at', { ascending: true });

    if (error) throw new Error(error.message);

    // Group by date
    const counts: Record<string, number> = {};
    for (const row of data ?? []) {
      const d = (row.updated_at as string).slice(0, 10);
      counts[d] = (counts[d] ?? 0) + 1;
    }

    // Fill all 30 days
    const result: { date: string; completed: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      result.push({ date: key, completed: counts[key] ?? 0 });
    }

    return NextResponse.json({ success: true, trends: result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
