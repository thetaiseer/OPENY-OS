'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import {
  Users2,
  CheckSquare,
  AlertTriangle,
  Activity,
  FolderOpen,
  CalendarDays,
  TrendingUp,
  Send,
  Image as ImageIcon,
  FolderKanban,
  Sparkles,
  Zap,
} from 'lucide-react';
import {
  XAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  YAxis,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';
import Link from 'next/link';
import supabase from '@/lib/supabase';
import { useAuth } from '@/context/auth-context';
import { useLang } from '@/context/lang-context';
import { useDashboardStats } from '@/hooks/queries';
import StatCard from '@/components/ui/StatCard';
import { SkeletonStatGrid } from '@/components/ui/Skeleton';
import { contentTypeLabel } from '@/lib/asset-utils';
import type { Activity as ActivityType, PublishingSchedule, Asset, Client } from '@/lib/types';
import { useQuickActions } from '@/context/quick-actions-context';
import Button from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { PageShell, PageHeader } from '@/components/layout/PageLayout';

const DONUT_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#64748b'];

// ── Team performance ──────────────────────────────────────────────────────────

function TeamPerformance({ data }: { data: { id: string; name: string; completed: number }[] }) {
  if (!data.length)
    return (
      <p className="py-4 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
        No completions this month
      </p>
    );
  const chartData = data
    .slice(0, 6)
    .map((d) => ({ name: d.name.split(' ')[0], completed: d.completed }));
  return (
    <ResponsiveContainer width="100%" height={130}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
      >
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          width={70}
          tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            fontSize: 11,
          }}
          cursor={{ fill: 'var(--surface-2)' }}
        />
        <Bar dataKey="completed" fill="var(--accent)" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Overdue risk ──────────────────────────────────────────────────────────────

function OverdueRisk({
  tasks,
}: {
  tasks: {
    id: string;
    title: string;
    due_date?: string;
    status: string;
    client?: { name: string; slug?: string } | null;
  }[];
}) {
  if (!tasks.length)
    return (
      <p className="py-4 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
        🎉 No at-risk tasks!
      </p>
    );
  return (
    <div className="space-y-2">
      {tasks.map((t) => {
        const daysLeft = t.due_date
          ? Math.ceil((new Date(t.due_date).getTime() - Date.now()) / 86400000)
          : null;
        const isOverdue = daysLeft !== null && daysLeft < 0;
        return (
          <div
            key={t.id}
            className="flex items-center justify-between gap-2 rounded-xl px-3 py-2"
            style={{ background: isOverdue ? 'rgba(239,68,68,0.07)' : 'rgba(217,119,6,0.07)' }}
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium" style={{ color: 'var(--text)' }}>
                {t.title}
              </p>
              {t.client &&
                (t.client.slug ? (
                  <Link
                    href={`/clients/${t.client.slug}/tasks`}
                    className="text-xs hover:underline"
                    style={{ color: 'var(--accent)' }}
                  >
                    {t.client.name}
                  </Link>
                ) : (
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {t.client.name}
                  </p>
                ))}
            </div>
            {daysLeft !== null && (
              <span
                className="shrink-0 text-xs font-semibold"
                style={{ color: isOverdue ? '#ef4444' : '#d97706' }}
              >
                {isOverdue ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Predictions ───────────────────────────────────────────────────────────────

function Predictions({
  trends,
  overdueTasks,
}: {
  trends: { completed: number }[];
  overdueTasks: number;
}) {
  const recentPace = trends.slice(-7).reduce((s, d) => s + d.completed, 0) / 7;
  const olderPace = trends.slice(-14, -7).reduce((s, d) => s + d.completed, 0) / 7;
  const paceChange = olderPace > 0 ? ((recentPace - olderPace) / olderPace) * 100 : 0;
  return (
    <div className="space-y-3">
      <div className="rounded-xl px-4 py-3" style={{ background: 'var(--surface-2)' }}>
        <p className="mb-1 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
          COMPLETION PACE (7d avg)
        </p>
        <p className="text-lg font-bold" style={{ color: 'var(--text)' }}>
          {recentPace.toFixed(1)} tasks/day
        </p>
        {olderPace > 0 && (
          <p className="text-xs" style={{ color: paceChange >= 0 ? '#16a34a' : '#ef4444' }}>
            {paceChange >= 0 ? '▲' : '▼'} {Math.abs(paceChange).toFixed(0)}% vs prev week
          </p>
        )}
      </div>
      <div
        className="rounded-xl px-4 py-3"
        style={{ background: overdueTasks > 0 ? 'rgba(239,68,68,0.07)' : 'rgba(22,163,74,0.07)' }}
      >
        <p
          className="mb-1 text-xs font-semibold"
          style={{ color: overdueTasks > 0 ? '#ef4444' : '#16a34a' }}
        >
          {overdueTasks > 0 ? 'OVERDUE RISK' : 'ON TRACK'}
        </p>
        <p className="text-sm" style={{ color: 'var(--text)' }}>
          {overdueTasks > 0
            ? `${overdueTasks} overdue${recentPace > 0 ? ` — cleared in ~${Math.ceil(overdueTasks / recentPace)}d` : ''}`
            : 'No overdue tasks 🎉'}
        </p>
      </div>
    </div>
  );
}

// ── Content distribution ──────────────────────────────────────────────────────

function ContentDistribution({ items }: { items: { label: string; count: number }[] }) {
  if (!items.length) {
    return (
      <p className="py-10 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
        No assets yet
      </p>
    );
  }
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-3">
          <span
            className="w-28 shrink-0 truncate text-xs"
            title={item.label}
            style={{ color: 'var(--text-secondary)' }}
          >
            {item.label}
          </span>
          <div className="h-2 flex-1 rounded-full" style={{ background: 'var(--surface-2)' }}>
            <div
              className="h-2 rounded-full transition-all duration-500"
              style={{ width: `${(item.count / max) * 100}%`, background: 'var(--accent)' }}
            />
          </div>
          <span
            className="w-8 text-right text-xs font-semibold tabular-nums"
            style={{ color: 'var(--text)' }}
          >
            {item.count}
          </span>
        </div>
      ))}
    </div>
  );
}

function ProjectsStatusDonut({
  data,
  total,
}: {
  data: { name: string; value: number }[];
  total: number;
}) {
  if (!total) {
    return (
      <p className="py-8 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
        No projects yet
      </p>
    );
  }
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
      <div className="h-44 w-44 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={52}
              outerRadius={72}
              paddingAngle={2}
            >
              {data.map((entry, index) => (
                <Cell key={entry.name} fill={DONUT_COLORS[index % DONUT_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: 'var(--surface-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                fontSize: 12,
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="w-full max-w-xs space-y-2">
        <p className="text-center text-2xl font-bold tabular-nums" style={{ color: 'var(--text)' }}>
          {total}
          <span className="ml-1 text-sm font-semibold text-[var(--text-secondary)]">Total</span>
        </p>
        {data.map((d, i) => (
          <div key={d.name} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }}
              />
              {d.name}
            </span>
            <span className="font-semibold tabular-nums" style={{ color: 'var(--text)' }}>
              {d.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PerformanceLineChart({ data }: { data: { date: string; completed: number }[] }) {
  const chartData = data.map((d) => ({
    name: new Date(d.date).toLocaleDateString(undefined, { weekday: 'short' }),
    completed: d.completed,
  }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={chartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="perfStroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#38bdf8" />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis hide />
        <Tooltip
          contentStyle={{
            background: 'var(--surface-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            fontSize: 12,
          }}
        />
        <Line
          type="monotone"
          dataKey="completed"
          stroke="url(#perfStroke)"
          strokeWidth={3}
          dot={{ r: 3, fill: '#6366f1' }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuth();
  const { t } = useLang();
  const { triggerQuickAction } = useQuickActions();
  const firstName = user?.name?.split(' ')[0] || 'there';
  const [taskTab, setTaskTab] = useState<'upcoming' | 'overdue'>('upcoming');

  const { data: stats, isLoading: statsLoading } = useDashboardStats();

  const { data: activitiesData } = useQuery<ActivityType[]>({
    queryKey: ['activities'],
    queryFn: async () => {
      const { data } = await supabase
        .from('activities')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      return (data ?? []) as ActivityType[];
    },
    staleTime: 30_000,
  });

  const { data: assetRows } = useQuery<{ content_type: string | null }[]>({
    queryKey: ['asset-content-types'],
    queryFn: async () => {
      // Limit to 500 rows to prevent fetching potentially thousands of records
      // for the content-type distribution chart.  This is a representative
      // sample — for exact aggregation move to a server-side GROUP BY endpoint.
      const { data } = await supabase.from('assets').select('content_type').limit(500);
      return (data ?? []) as { content_type: string | null }[];
    },
    staleTime: 60_000,
  });

  // F2 fix: use publishing_schedules instead of deprecated assets.publish_date
  const { data: scheduled } = useQuery<PublishingSchedule[]>({
    queryKey: ['scheduled-posts'],
    queryFn: async () => {
      const todayStr = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from('publishing_schedules')
        .select(
          'id, scheduled_date, scheduled_time, platforms, client_id, caption, status, asset:assets(id, name, content_type, client_name)',
        )
        .in('status', ['scheduled', 'queued'])
        .gte('scheduled_date', todayStr)
        .order('scheduled_date', { ascending: true })
        .order('scheduled_time', { ascending: true })
        .limit(5);
      return (data ?? []) as unknown as PublishingSchedule[];
    },
    staleTime: 60_000,
  });

  const { data: trendsData } = useQuery<{ date: string; completed: number }[]>({
    queryKey: ['dashboard-trends'],
    queryFn: async () => {
      const res = await fetch('/api/dashboard/trends');
      if (!res.ok) return [];
      const json = (await res.json()) as {
        success: boolean;
        trends?: { date: string; completed: number }[];
      };
      return json.trends ?? [];
    },
    staleTime: 120_000,
  });

  const { data: teamPerf } = useQuery<{ id: string; name: string; completed: number }[]>({
    queryKey: ['dashboard-team-performance'],
    queryFn: async () => {
      const res = await fetch('/api/dashboard/team-performance');
      if (!res.ok) return [];
      const json = (await res.json()) as {
        success: boolean;
        performance?: { id: string; name: string; completed: number }[];
      };
      return json.performance ?? [];
    },
    staleTime: 120_000,
  });

  const { data: atRiskTasks } = useQuery({
    queryKey: ['at-risk-tasks'],
    queryFn: async () => {
      const soonStr = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
      const { data } = await supabase
        .from('tasks')
        .select('id, title, due_date, status, client:clients(id,name,slug)')
        .lte('due_date', soonStr)
        .not('status', 'in', '("done","delivered","completed","published","cancelled")')
        .order('due_date', { ascending: true })
        .limit(5);
      return (data ?? []) as unknown as Array<{
        id: string;
        title: string;
        due_date?: string;
        status: string;
        client?: { name: string; slug?: string } | null;
      }>;
    },
    staleTime: 60_000,
  });

  const { data: recentAssets } = useQuery<Asset[]>({
    queryKey: ['dashboard-recent-assets'],
    queryFn: async () => {
      const { data } = await supabase
        .from('assets')
        .select(
          'id, name, file_type, created_at, thumbnail_url, preview_url, file_url, client_name, client_id',
        )
        .order('created_at', { ascending: false })
        .limit(6);
      return (data ?? []) as Asset[];
    },
    staleTime: 60_000,
  });

  const { data: activeClients } = useQuery<Client[]>({
    queryKey: ['dashboard-active-clients'],
    queryFn: async () => {
      const { data } = await supabase
        .from('clients')
        .select('id, name, slug, status, updated_at')
        .eq('status', 'active')
        .order('updated_at', { ascending: false })
        .limit(5);
      return (data ?? []) as Client[];
    },
    staleTime: 60_000,
  });

  const contentDistItems = useMemo(() => {
    if (!assetRows) return [];
    const counts: Record<string, number> = {};
    for (const row of assetRows) {
      const key = row.content_type ?? 'OTHER';
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return Object.entries(counts)
      .map(([key, count]) => ({ label: contentTypeLabel(key), count }))
      .sort((a, b) => b.count - a.count);
  }, [assetRows]);

  const { data: projectRows = [] } = useQuery({
    queryKey: ['dashboard-projects-mini'],
    queryFn: async () => {
      const { data, error } = await supabase.from('projects').select('id,status');
      if (error) throw new Error(error.message);
      return (data ?? []) as { id: string; status: string }[];
    },
    staleTime: 60_000,
  });

  const donutData = useMemo(() => {
    let active = 0;
    let completed = 0;
    let planning = 0;
    let onHold = 0;
    for (const p of projectRows) {
      if (p.status === 'active') active += 1;
      else if (p.status === 'completed') completed += 1;
      else if (p.status === 'planning') planning += 1;
      else if (p.status === 'on_hold') onHold += 1;
    }
    return [
      { name: 'In progress', value: active },
      { name: 'Completed', value: completed },
      { name: 'Planning', value: planning },
      { name: 'On hold', value: onHold },
    ].filter((d) => d.value > 0);
  }, [projectRows]);

  const totalProjects = projectRows.length;

  type TaskRow = {
    id: string;
    title: string;
    due_date?: string;
    client?: { name: string; slug?: string } | null;
  };

  const { data: upcomingTasks = [] } = useQuery<TaskRow[]>({
    queryKey: ['dashboard-upcoming-tasks'],
    queryFn: async () => {
      const todayStr = new Date().toISOString().slice(0, 10);
      const terminal = '("done","delivered","completed","published","cancelled")';
      const { data } = await supabase
        .from('tasks')
        .select('id, title, due_date, client:clients(name, slug)')
        .gte('due_date', todayStr)
        .not('status', 'in', terminal)
        .order('due_date', { ascending: true })
        .limit(8);
      return (data ?? []) as TaskRow[];
    },
    staleTime: 45_000,
  });

  const { data: overdueTasksList = [] } = useQuery<TaskRow[]>({
    queryKey: ['dashboard-overdue-tasks'],
    queryFn: async () => {
      const todayStr = new Date().toISOString().slice(0, 10);
      const terminal = '("done","delivered","completed","published","cancelled")';
      const { data } = await supabase
        .from('tasks')
        .select('id, title, due_date, client:clients(name, slug)')
        .lt('due_date', todayStr)
        .not('status', 'in', terminal)
        .order('due_date', { ascending: true })
        .limit(8);
      return (data ?? []) as TaskRow[];
    },
    staleTime: 45_000,
  });

  const recentPace =
    (trendsData ?? []).slice(-7).reduce((s, d) => s + d.completed, 0) / Math.max(7, 1);
  const completionRate =
    stats && stats.activeTasks + stats.overdueTasks > 0
      ? Math.round(
          (100 * Math.max(0, stats.activeTasks - stats.overdueTasks)) /
            Math.max(1, stats.activeTasks + stats.overdueTasks),
        )
      : 76;

  return (
    <PageShell className="space-y-8">
      <PageHeader
        title={`Good morning, ${firstName} 👋`}
        subtitle="Here&apos;s what&apos;s happening with your projects today."
        actions={
          <>
            <Button type="button" variant="primary" onClick={() => triggerQuickAction('add-client')}>
              + New client
            </Button>
            <Button type="button" variant="secondary" onClick={() => triggerQuickAction('add-task')}>
              New task
            </Button>
          </>
        }
      />

      {statsLoading ? (
        <SkeletonStatGrid count={4} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total projects"
            value={totalProjects}
            icon={<FolderKanban size={20} />}
            color="blue"
            trend={{ value: '12%', positive: true }}
          />
          <StatCard
            label="In progress"
            value={donutData.find((d) => d.name === 'In progress')?.value ?? 0}
            icon={<TrendingUp size={20} />}
            color="mint"
            trend={{ value: '8%', positive: true }}
          />
          <StatCard
            label="Completed"
            value={donutData.find((d) => d.name === 'Completed')?.value ?? 0}
            icon={<CheckSquare size={20} />}
            color="green"
            trend={{ value: '20%', positive: true }}
          />
          <StatCard
            label="Overdue tasks"
            value={stats?.overdueTasks ?? 0}
            icon={<AlertTriangle size={20} />}
            color="rose"
            trend={{ value: '5%', positive: false }}
          />
        </div>
      )}

      <Card>
        <CardHeader className="mb-2 items-center">
          <div>
            <CardTitle className="!text-lg">Performance overview</CardTitle>
            <CardDescription>
              Task completions · last {Math.min(30, trendsData?.length ?? 0)} days
            </CardDescription>
          </div>
          <span
            className="rounded-full px-3 py-1 text-sm font-semibold"
            style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
          >
            {completionRate}% pace
          </span>
        </CardHeader>
        <CardContent>
          {trendsData && trendsData.length > 0 ? (
            <PerformanceLineChart data={trendsData} />
          ) : (
            <div
              className="h-52 animate-pulse rounded-xl"
              style={{ background: 'var(--surface-2)' }}
            />
          )}
          <div
            className="mt-4 grid grid-cols-1 gap-3 border-t pt-4 sm:grid-cols-3"
            style={{ borderColor: 'var(--border)' }}
          >
            <div>
              <p
                className="text-xs font-semibold uppercase tracking-wide"
                style={{ color: 'var(--text-tertiary)' }}
              >
                Completion rate
              </p>
              <p className="text-xl font-bold" style={{ color: 'var(--text)' }}>
                {completionRate}%
              </p>
            </div>
            <div>
              <p
                className="text-xs font-semibold uppercase tracking-wide"
                style={{ color: 'var(--text-tertiary)' }}
              >
                Tasks / day (7d avg)
              </p>
              <p className="text-xl font-bold" style={{ color: 'var(--text)' }}>
                {recentPace.toFixed(1)}
              </p>
            </div>
            <div>
              <p
                className="text-xs font-semibold uppercase tracking-wide"
                style={{ color: 'var(--text-tertiary)' }}
              >
                Team output
              </p>
              <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                {teamPerf?.length ? `${teamPerf.length} teammates tracked` : '—'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="mb-4 items-center">
            <CardTitle className="!text-lg">Tasks</CardTitle>
            <Link
              href="/tasks/all"
              className="text-xs font-semibold hover:underline"
              style={{ color: 'var(--accent)' }}
            >
              View all →
            </Link>
          </CardHeader>
          <CardContent>
          <div className="mb-4 flex rounded-xl p-1" style={{ background: 'var(--surface-2)' }}>
            <button
              type="button"
              className="flex-1 rounded-lg py-2 text-sm font-semibold transition-colors"
              style={{
                background: taskTab === 'upcoming' ? 'var(--surface-elevated)' : 'transparent',
                color: taskTab === 'upcoming' ? 'var(--text)' : 'var(--text-secondary)',
                boxShadow: taskTab === 'upcoming' ? 'var(--shadow-xs)' : 'none',
              }}
              onClick={() => setTaskTab('upcoming')}
            >
              Upcoming
            </button>
            <button
              type="button"
              className="flex-1 rounded-lg py-2 text-sm font-semibold transition-colors"
              style={{
                background: taskTab === 'overdue' ? 'var(--surface-elevated)' : 'transparent',
                color: taskTab === 'overdue' ? 'var(--text)' : 'var(--text-secondary)',
                boxShadow: taskTab === 'overdue' ? 'var(--shadow-xs)' : 'none',
              }}
              onClick={() => setTaskTab('overdue')}
            >
              Overdue ({overdueTasksList.length})
            </button>
          </div>
          <div className="space-y-2">
            {(taskTab === 'upcoming' ? upcomingTasks : overdueTasksList).length === 0 ? (
              <p className="py-6 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
                Nothing here
              </p>
            ) : (
              (taskTab === 'upcoming' ? upcomingTasks : overdueTasksList).map((task) => (
                <div
                  key={task.id}
                  className="flex items-start gap-3 rounded-xl border px-3 py-2.5"
                  style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
                >
                  <span
                    className="mt-1.5 h-3.5 w-3.5 shrink-0 rounded-full border-2"
                    style={{ borderColor: 'var(--accent)' }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                      {task.title}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {task.client?.name ?? 'No client'}
                      {task.due_date
                        ? ` · ${new Date(task.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
                        : ''}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="mb-4">
            <CardTitle className="!text-lg">{t('recentActivity')}</CardTitle>
          </CardHeader>
          <CardContent>
          {!activitiesData ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="h-10 animate-pulse rounded-lg"
                  style={{ background: 'var(--surface-2)' }}
                />
              ))}
            </div>
          ) : activitiesData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Activity
                size={28}
                className="mb-3 opacity-40"
                style={{ color: 'var(--text-secondary)' }}
              />
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                No recent activity
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {activitiesData.map((a) => (
                <div key={a.id} className="flex gap-3">
                  <div
                    className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                    style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
                  >
                    <Zap size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                      {a.description}
                    </p>
                    <p className="mt-0.5 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      {new Date(a.created_at).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="mb-4">
          <CardTitle className="!text-lg">Insights &amp; predictions</CardTitle>
        </CardHeader>
        <CardContent>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div
            className="flex flex-col justify-center rounded-xl border p-5 sm:flex-row sm:items-center sm:gap-5"
            style={{
              borderColor: 'var(--border)',
              background:
                'linear-gradient(135deg, rgba(99,102,241,0.2) 0%, rgba(17,24,39,0.4) 100%)',
            }}
          >
            <div
              className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl sm:mx-0 sm:mb-0"
              style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
            >
              <Sparkles size={28} />
            </div>
            <p
              className="text-center text-base font-semibold sm:text-left"
              style={{ color: 'var(--text)' }}
            >
              You&apos;re on track to clear {Math.max(stats?.overdueTasks ?? 0, 0)} overdue items if
              you keep today&apos;s pace.
            </p>
          </div>
          <Predictions trends={trendsData ?? []} overdueTasks={stats?.overdueTasks ?? 0} />
        </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="mb-4">
            <CardTitle className="!text-lg">Projects by status</CardTitle>
          </CardHeader>
          <CardContent>
          <ProjectsStatusDonut data={donutData} total={totalProjects} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="mb-4">
            <CardTitle className="!text-lg">Quick actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {[
              { id: 'add-client' as const, label: 'New client', icon: Users2 },
              { id: 'add-task' as const, label: 'New task', icon: CheckSquare },
              { id: 'add-content' as const, label: 'New content', icon: FolderOpen },
              { id: 'add-asset' as const, label: 'Upload asset', icon: ImageIcon },
            ].map((action) => (
              <Button
                key={action.id}
                type="button"
                variant="secondary"
                className="h-auto min-h-0 justify-start py-3 text-left"
                onClick={() => triggerQuickAction(action.id)}
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                  style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
                >
                  <action.icon size={18} />
                </span>
                {action.label}
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="mb-4">
          <CardTitle className="!text-lg">Team performance (month)</CardTitle>
        </CardHeader>
        <CardContent>
        {teamPerf ? (
          <TeamPerformance data={teamPerf} />
        ) : (
          <div
            className="h-32 animate-pulse rounded-xl"
            style={{ background: 'var(--surface-2)' }}
          />
        )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} style={{ color: 'var(--color-warning)' }} />
            <CardTitle className="!text-lg">At-risk (next 3 days)</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
        <OverdueRisk tasks={atRiskTasks ?? []} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="mb-4">
          <CardTitle className="!text-lg">{t('contentDistribution')}</CardTitle>
        </CardHeader>
        <CardContent>
        <ContentDistribution items={contentDistItems} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="mb-4">
          <div className="flex items-center gap-2">
            <CalendarDays size={18} style={{ color: 'var(--accent)' }} />
            <CardTitle className="!text-lg">Upcoming Scheduled Posts</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
        {!scheduled ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-12 animate-pulse rounded-xl"
                style={{ background: 'var(--surface-2)' }}
              />
            ))}
          </div>
        ) : scheduled.length === 0 ? (
          <p className="py-4 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
            No scheduled posts coming up
          </p>
        ) : (
          <div className="space-y-3">
            {scheduled.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-4 rounded-xl px-4 py-3"
                style={{ background: 'var(--surface-2)' }}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Send size={16} style={{ color: 'var(--accent)' }} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium" style={{ color: 'var(--text)' }}>
                      {s.asset?.name ?? s.caption ?? 'Publishing schedule'}
                    </p>
                    {s.asset?.client_name && (
                      <p className="truncate text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {s.asset.client_name}
                      </p>
                    )}
                    {s.platforms?.length > 0 && (
                      <p className="truncate text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {s.platforms.join(', ')}
                      </p>
                    )}
                  </div>
                </div>
                <div className="shrink-0 text-xs font-medium" style={{ color: 'var(--accent)' }}>
                  {new Date(s.scheduled_date).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                  })}
                  {s.scheduled_time ? ` · ${s.scheduled_time.slice(0, 5)}` : ''}
                </div>
              </div>
            ))}
          </div>
        )}
        </CardContent>
      </Card>

      {/* ── Recent Assets + Active Clients ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Assets */}
        <Card>
          <CardHeader className="mb-4 items-center">
            <div className="flex items-center gap-2">
              <ImageIcon size={16} style={{ color: 'var(--accent)' }} />
              <CardTitle className="!text-base !font-semibold">Recent Assets</CardTitle>
            </div>
            <Link
              href="/assets"
              className="text-xs transition-opacity hover:opacity-70"
              style={{ color: 'var(--accent)' }}
            >
              View all
            </Link>
          </CardHeader>
          <CardContent>
          {!recentAssets ? (
            <div className="grid grid-cols-3 gap-2">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="aspect-square animate-pulse rounded-lg"
                  style={{ background: 'var(--surface-2)' }}
                />
              ))}
            </div>
          ) : recentAssets.length === 0 ? (
            <p className="py-4 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
              No assets yet
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {recentAssets.map((asset) => (
                <div
                  key={asset.id}
                  className="overflow-hidden rounded-xl border"
                  style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}
                >
                  {(asset.thumbnail_url ??
                  asset.preview_url ??
                  (asset.file_type?.startsWith('image/') ? asset.file_url : null)) ? (
                    <img
                      src={asset.thumbnail_url ?? asset.preview_url ?? asset.file_url}
                      alt={asset.name}
                      className="aspect-square w-full object-cover"
                    />
                  ) : (
                    <div
                      className="flex aspect-square w-full items-center justify-center"
                      style={{ background: 'var(--surface)' }}
                    >
                      <FolderOpen size={18} style={{ color: 'var(--text-secondary)' }} />
                    </div>
                  )}
                  <div className="px-2 py-1">
                    <p
                      className="truncate text-[10px] font-medium"
                      style={{ color: 'var(--text)' }}
                    >
                      {asset.name}
                    </p>
                    {asset.client_name && (
                      <p
                        className="truncate text-[10px]"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {asset.client_name}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          </CardContent>
        </Card>

        {/* Active Clients */}
        <Card>
          <CardHeader className="mb-4 items-center">
            <div className="flex items-center gap-2">
              <Users2 size={16} style={{ color: 'var(--accent)' }} />
              <CardTitle className="!text-base !font-semibold">Active Clients</CardTitle>
            </div>
            <Link
              href="/clients"
              className="text-xs transition-opacity hover:opacity-70"
              style={{ color: 'var(--accent)' }}
            >
              View all
            </Link>
          </CardHeader>
          <CardContent>
          {!activeClients ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="h-10 animate-pulse rounded-lg"
                  style={{ background: 'var(--surface-2)' }}
                />
              ))}
            </div>
          ) : activeClients.length === 0 ? (
            <p className="py-4 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
              No active clients
            </p>
          ) : (
            <div className="space-y-2">
              {activeClients.map((client) => (
                <Link
                  key={client.id}
                  href={`/clients/${client.slug ?? client.id}/overview`}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-opacity hover:opacity-80"
                  style={{ background: 'var(--surface-2)' }}
                >
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
                    style={{ background: 'var(--accent)' }}
                  >
                    {client.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium" style={{ color: 'var(--text)' }}>
                      {client.name}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      Updated{' '}
                      {new Date(client.updated_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                  <span
                    className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium"
                    style={{ background: 'rgba(22,163,74,0.1)', color: '#16a34a' }}
                  >
                    active
                  </span>
                </Link>
              ))}
            </div>
          )}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
