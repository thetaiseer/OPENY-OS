import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { getServiceClient } from '@/lib/supabase/service-client';

/**
 * GET /api/dashboard/team-performance
 * Query: period=YYYY-MM (optional). Defaults to current calendar month.
 * Returns tasks completed per team member in that month.
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
    const monthStart = new Date(py, pm - 1, 1).toISOString();
    const monthEndDay = new Date(py, pm, 0).getDate();
    const monthEnd = `${py}-${String(pm).padStart(2, '0')}-${String(monthEndDay).padStart(2, '0')}T23:59:59.999Z`;

    const sb = getServiceClient();

    const { data: tasks, error: tErr } = await sb
      .from('tasks')
      .select('assigned_to, status, updated_at')
      .in('status', ['done', 'delivered'])
      .gte('updated_at', monthStart)
      .lte('updated_at', monthEnd);

    if (tErr) throw new Error(tErr.message);

    // Aggregate by assigned_to
    const counts: Record<string, number> = {};
    for (const t of tasks ?? []) {
      const id = (t.assigned_to as string | null) ?? 'unassigned';
      counts[id] = (counts[id] ?? 0) + 1;
    }

    // Resolve names from team_members
    const ids = Object.keys(counts).filter((id) => id !== 'unassigned');
    const nameMap: Record<string, string> = {};
    if (ids.length) {
      const { data: members } = await sb
        .from('team_members')
        .select('profile_id, full_name')
        .in('profile_id', ids);
      for (const m of members ?? []) {
        if (m.profile_id) nameMap[m.profile_id as string] = m.full_name as string;
      }
    }

    const result = Object.entries(counts)
      .map(([id, completed]) => ({
        id,
        name: nameMap[id] ?? (id === 'unassigned' ? 'Unassigned' : id),
        completed,
      }))
      .sort((a, b) => b.completed - a.completed);

    return NextResponse.json({ success: true, performance: result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
