import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { getServiceClient } from '@/lib/supabase/service-client';
import { resolveFromToParams } from '@/lib/url-date';

/**
 * GET /api/dashboard/team-performance
 * Query: from=YYYY-MM-DD&to=YYYY-MM-DD (optional). Falls back to period=YYYY-MM
 * and then to current calendar month.
 * Returns tasks completed per team member in the selected window.
 */
export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'manager', 'team_member']);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const { fromYmd, toYmd } = resolveFromToParams(searchParams);
    const rangeStartIso = `${fromYmd}T00:00:00.000Z`;
    const rangeEndIso = `${toYmd}T23:59:59.999Z`;

    const sb = getServiceClient();

    const { data: tasks, error: tErr } = await sb
      .from('tasks')
      .select('assigned_to, status, updated_at')
      .in('status', ['done', 'delivered'])
      .gte('updated_at', rangeStartIso)
      .lte('updated_at', rangeEndIso);

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
    console.error('[GET /api/dashboard/team-performance] failed', err);
    return NextResponse.json({ success: false, error: 'Something went wrong' }, { status: 500 });
  }
}
