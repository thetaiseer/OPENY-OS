import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

/**
 * GET /api/dashboard/team-performance
 * Returns tasks completed per team member this month.
 */
export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'team', 'manager']);
  if (auth instanceof NextResponse) return auth;

  try {
    const sb = getSupabase();
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const { data: tasks, error: tErr } = await sb
      .from('tasks')
      .select('assigned_to, status, updated_at')
      .in('status', ['done', 'delivered'])
      .gte('updated_at', monthStart);

    if (tErr) throw new Error(tErr.message);

    // Aggregate by assigned_to
    const counts: Record<string, number> = {};
    for (const t of tasks ?? []) {
      const id = (t.assigned_to as string | null) ?? 'unassigned';
      counts[id] = (counts[id] ?? 0) + 1;
    }

    // Resolve names from team_members
    const ids = Object.keys(counts).filter(id => id !== 'unassigned');
    let nameMap: Record<string, string> = {};
    if (ids.length) {
      const { data: members } = await sb
        .from('team_members')
        .select('profile_id, full_name')
        .in('profile_id', ids);
      for (const member of members ?? []) {
        if (member.profile_id) nameMap[member.profile_id as string] = member.full_name as string;
      }
    }

    const result = Object.entries(counts).map(([id, completed]) => ({
      id,
      name: nameMap[id] ?? (id === 'unassigned' ? 'Unassigned' : id),
      completed,
    })).sort((a, b) => b.completed - a.completed);

    return NextResponse.json({ success: true, performance: result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
