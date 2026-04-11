/**
 * GET /api/reports/overview
 *
 * Returns aggregated analytics data for the reports page:
 *   - Summary stats
 *   - Client analytics: tasks per client, asset volume
 *   - Team analytics: task completion rate per team member
 *   - Content analytics: platform distribution, publishing stats
 *   - Monthly trend: completed tasks + published posts per month
 *
 * Auth: admin | manager
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireRole } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key);
}

function monthLabel(ym: string): string {
  const [year, month] = ym.split('-');
  const d = new Date(Number(year), Number(month) - 1, 1);
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function last6Months(): string[] {
  const months: string[] = [];
  const d = new Date();
  for (let i = 5; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    const ym = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`;
    months.push(ym);
  }
  return months;
}

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'manager']);
  if (auth instanceof NextResponse) return auth;

  try {
    const db = getSupabase();

    const [clientsResult, tasksResult, assetsResult, schedulesResult, approvalsResult, membersResult] =
      await Promise.allSettled([
        db.from('clients').select('id, name'),
        db.from('tasks').select('id, status, priority, due_date, client_id, assignee_id, created_at'),
        db.from('assets').select('id, client_id, content_type, created_at'),
        db.from('publishing_schedules').select('id, status, platforms, scheduled_date, client_id'),
        db.from('approvals').select('id, status, client_id, created_at, approved_at, rejected_at'),
        db.from('team_members').select('id, full_name, role').neq('status', 'invited'),
      ]);

    const clients   = clientsResult.status   === 'fulfilled' ? (clientsResult.value.data   ?? []) : [];
    const tasks     = tasksResult.status     === 'fulfilled' ? (tasksResult.value.data     ?? []) : [];
    const assets    = assetsResult.status    === 'fulfilled' ? (assetsResult.value.data    ?? []) : [];
    const schedules = schedulesResult.status === 'fulfilled' ? (schedulesResult.value.data ?? []) : [];
    const approvals = approvalsResult.status === 'fulfilled' ? (approvalsResult.value.data ?? []) : [];
    const members   = membersResult.status   === 'fulfilled' ? (membersResult.value.data   ?? []) : [];

    const today = new Date().toISOString().slice(0, 10);
    const completedStatuses = new Set(['done', 'delivered', 'completed', 'published']);

    // ── Summary ───────────────────────────────────────────────────────────────

    const completedTaskCount = tasks.filter((t: Record<string, string>) => completedStatuses.has(t.status)).length;
    const publishedCount = schedules.filter((s: Record<string, string>) => s.status === 'published').length;

    const resolvedApprovals = approvals.filter((a: Record<string, string | null>) =>
      a.status !== 'pending' && (a.approved_at || a.rejected_at),
    );
    let approvalCycleAvgDays: number | null = null;
    if (resolvedApprovals.length > 0) {
      const totalMs = resolvedApprovals.reduce((sum: number, a: Record<string, string | null>) => {
        const resolved = a.approved_at ?? a.rejected_at!;
        return sum + (new Date(resolved).getTime() - new Date(a.created_at!).getTime());
      }, 0);
      approvalCycleAvgDays = Math.round((totalMs / resolvedApprovals.length / 86400000) * 10) / 10;
    }

    // ── Client stats ──────────────────────────────────────────────────────────

    const clientStats = clients.map((c: Record<string, string>) => {
      const cTasks = tasks.filter((t: Record<string, string>) => t.client_id === c.id);
      const cAssets = assets.filter((a: Record<string, string>) => a.client_id === c.id);
      const cApprovals = approvals.filter((a: Record<string, string>) => a.client_id === c.id);
      return {
        id: c.id,
        name: c.name,
        totalTasks: cTasks.length,
        completedTasks: cTasks.filter((t: Record<string, string>) => completedStatuses.has(t.status)).length,
        pendingTasks: cTasks.filter((t: Record<string, string>) => !completedStatuses.has(t.status) && t.status !== 'cancelled').length,
        overdueTasks: cTasks.filter((t: Record<string, string>) => t.due_date && t.due_date < today && !completedStatuses.has(t.status)).length,
        totalAssets: cAssets.length,
        pendingApprovals: cApprovals.filter((a: Record<string, string>) => a.status === 'pending').length,
      };
    }).sort((a: { totalTasks: number }, b: { totalTasks: number }) => b.totalTasks - a.totalTasks).slice(0, 15);

    // ── Team stats ────────────────────────────────────────────────────────────

    const teamStats = members
      .filter((m: Record<string, string>) => m.role !== 'client')
      .map((m: Record<string, string>) => {
        const assigned = tasks.filter((t: Record<string, string>) => t.assignee_id === m.id);
        const completed = assigned.filter((t: Record<string, string>) => completedStatuses.has(t.status));
        const overdue = assigned.filter((t: Record<string, string>) => t.due_date && t.due_date < today && !completedStatuses.has(t.status));
        return {
          id: m.id,
          name: m.full_name,
          completedTasks: completed.length,
          totalAssigned: assigned.length,
          completionRate: assigned.length > 0 ? Math.round((completed.length / assigned.length) * 100) : 0,
          overdueTasks: overdue.length,
        };
      })
      .filter((s: { totalAssigned: number }) => s.totalAssigned > 0)
      .sort((a: { completedTasks: number }, b: { completedTasks: number }) => b.completedTasks - a.completedTasks)
      .slice(0, 10);

    // ── Platform stats ────────────────────────────────────────────────────────

    const platformCounts: Record<string, { published: number; scheduled: number; missed: number }> = {};
    for (const s of schedules as { status: string; platforms?: string[] }[]) {
      for (const p of (s.platforms ?? [])) {
        if (!platformCounts[p]) platformCounts[p] = { published: 0, scheduled: 0, missed: 0 };
        if (s.status === 'published')                         platformCounts[p].published++;
        else if (s.status === 'scheduled' || s.status === 'queued') platformCounts[p].scheduled++;
        else if (s.status === 'missed')                       platformCounts[p].missed++;
      }
    }
    const platformStats = Object.entries(platformCounts)
      .map(([platform, counts]) => ({ platform, ...counts }))
      .sort((a, b) => (b.published + b.scheduled) - (a.published + a.scheduled));

    // ── Monthly trends ────────────────────────────────────────────────────────

    const months = last6Months();
    const monthlyTrends = months.map(ym => {
      const [y, m] = ym.split('-');
      const start = `${y}-${m}-01`;
      const daysInMonth = new Date(Number(y), Number(m), 0).getDate();
      const end = `${y}-${m}-${String(daysInMonth).padStart(2, '0')}`;

      return {
        month: ym,
        label: monthLabel(ym),
        completedTasks: tasks.filter((t: Record<string, string>) =>
          t.created_at >= start && t.created_at <= end + 'T23:59:59Z' && completedStatuses.has(t.status),
        ).length,
        publishedPosts: schedules.filter((s: Record<string, string>) =>
          s.scheduled_date >= start && s.scheduled_date <= end && s.status === 'published',
        ).length,
        newAssets: assets.filter((a: Record<string, string>) =>
          a.created_at >= start && a.created_at <= end + 'T23:59:59Z',
        ).length,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalClients: clients.length,
          totalTasks: tasks.length,
          totalAssets: assets.length,
          totalPublished: publishedCount,
          completionRate: tasks.length > 0 ? Math.round((completedTaskCount / tasks.length) * 100) : 0,
          approvalCycleAvgDays,
        },
        clientStats,
        teamStats,
        platformStats,
        monthlyTrends,
      },
    });
  } catch (err) {
    console.error('[GET /api/reports/overview] error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ success: false, error: 'Failed to load reports' }, { status: 500 });
  }
}
