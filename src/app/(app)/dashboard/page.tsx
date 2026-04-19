'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import {
  Users2, CheckSquare, AlertTriangle, Activity, FolderOpen, CalendarDays, TrendingUp, Send, Image as ImageIcon, Plus,
} from 'lucide-react';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer, BarChart, Bar, YAxis, CartesianGrid } from 'recharts';
import Link from 'next/link';
import supabase from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { useLang } from '@/lib/lang-context';
import { useDashboardStats } from '@/lib/queries';
import StatCard from '@/components/ui/StatCard';
import { SkeletonStatGrid } from '@/components/ui/Skeleton';
import { contentTypeLabel } from '@/lib/asset-utils';
import type { Activity as ActivityType, PublishingSchedule, Asset, Client } from '@/lib/types';
const WEEK_LENGTH_DAYS = 7;
const MILLISECONDS_PER_DAY = 86_400_000;

function pluralize(count: number, singular: string, plural: string) {
  return count === 1 ? singular : plural;
}

interface Stats {
  totalClients: number;
  activeTasks: number;
  overdueTasks: number;
  tasksDueThisWeek: number;
}

function DashboardPanel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`glass glass-card relative overflow-hidden p-5 md:p-6 ${className}`}>
      <div
        className="pointer-events-none absolute inset-x-0 -top-20 h-24 opacity-75"
        style={{
          background: 'transparent',
        }}
      />
      <div className="relative z-[1]">{children}</div>
    </section>
  );
}

function SectionHead({ icon, title, subtitle }: { icon?: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <header className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {icon ? (
            <span
              className="flex h-7 w-7 items-center justify-center rounded-lg"
              style={{ background: 'var(--accent-soft)', color: 'var(--accent)', boxShadow: 'inset 0 0 0 1px var(--accent-glow)' }}
            >
              {icon}
            </span>
          ) : null}
          <h2 className="text-sm font-bold tracking-tight" style={{ color: 'var(--text)' }}>{title}</h2>
        </div>
        {subtitle ? <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>{subtitle}</p> : null}
      </div>
    </header>
  );
}

// ── Trend chart ───────────────────────────────────────────────────────────────

function TrendChart({ data }: { data: { date: string; completed: number }[] }) {
  if (!data.length) {
    return (
      <div className="rounded-2xl border px-4 py-8 text-center" style={{ borderColor: 'var(--border-2)', background: 'var(--surface-2)' }}>
        <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>No completion data yet</p>
        <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>Complete tasks to unlock trend intelligence.</p>
      </div>
    );
  }

  const chartData = data.map(d => ({
    name: new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    completed: d.completed,
  }));
  const total = data.reduce((s, d) => s + d.completed, 0);
  const firstHalf  = data.slice(0, 15).reduce((s, d) => s + d.completed, 0);
  const secondHalf = data.slice(15).reduce((s, d) => s + d.completed, 0);
  const up = secondHalf >= firstHalf;
  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="type-metric" style={{ color: 'var(--text)' }}>{total}</p>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Completed tasks in last 30 days</p>
        </div>
        <span
          className="rounded-full px-2.5 py-1 text-xs font-semibold"
          style={{
            background: up ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
            border: `1px solid ${up ? 'var(--color-success-border)' : 'var(--color-danger-border)'}`,
            color: up ? 'var(--color-success)' : 'var(--color-danger)',
          }}
        >
          {up ? '▲ Momentum up' : '▼ Momentum down'}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={170}>
        <AreaChart data={chartData} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="dashboardTrendGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.46} />
              <stop offset="95%" stopColor="var(--accent)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border-2)" strokeDasharray="3 5" />
          <XAxis dataKey="name" tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={18} />
          <Tooltip
            contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 11, boxShadow: 'var(--shadow-sm)' }}
            labelStyle={{ color: 'var(--text-secondary)' }}
            itemStyle={{ color: 'var(--text)' }}
            cursor={{ stroke: 'var(--accent)', strokeOpacity: 0.3 }}
          />
          <Area type="monotone" dataKey="completed" stroke="var(--accent)" fill="url(#dashboardTrendGradient)" strokeWidth={2.4} dot={false} activeDot={{ r: 4, stroke: 'var(--accent)', strokeWidth: 2 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Team performance ──────────────────────────────────────────────────────────

function TeamPerformance({ data }: { data: { id: string; name: string; completed: number }[] }) {
  if (!data.length) {
    return (
      <div className="rounded-2xl border px-4 py-8 text-center" style={{ borderColor: 'var(--border-2)', background: 'var(--surface-2)' }}>
        <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>No team completions this month</p>
        <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>Performance bars appear once tasks are completed.</p>
      </div>
    );
  }
  const chartData = data.slice(0, 6).map(d => ({ name: d.name.split(' ')[0], completed: d.completed }));
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="var(--border-2)" strokeDasharray="3 6" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="name" width={76} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 11, boxShadow: 'var(--shadow-sm)' }} cursor={{ fill: 'var(--surface-2)' }} />
        <Bar dataKey="completed" fill="var(--accent)" radius={[0, 8, 8, 0]} maxBarSize={14} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Overdue risk ──────────────────────────────────────────────────────────────

function OverdueRisk({ tasks }: { tasks: { id: string; title: string; due_date?: string; status: string; client?: { name: string; slug?: string } | null }[] }) {
  if (!tasks.length) {
    return (
      <div className="rounded-2xl border px-4 py-8 text-center" style={{ borderColor: 'var(--border-2)', background: 'var(--surface-2)' }}>
        <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>No at-risk tasks</p>
        <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>Excellent execution across this week.</p>
      </div>
    );
  }
  return (
    <div className="space-y-2.5">
      {tasks.map(t => {
        const daysLeft = t.due_date ? Math.ceil((new Date(t.due_date).getTime() - Date.now()) / 86400000) : null;
        const isOverdue = daysLeft !== null && daysLeft < 0;
        return (
          <div
            key={t.id}
            className="flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5"
            style={{
              background: isOverdue ? 'var(--color-danger-bg)' : 'var(--color-warning-bg)',
              borderColor: isOverdue ? 'var(--color-danger-border)' : 'var(--color-warning-border)',
            }}
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold" style={{ color: 'var(--text)' }}>{t.title}</p>
              {t.client && (
                t.client.slug
                  ? <Link href={`/clients/${t.client.slug}/tasks`} className="text-xs hover:underline" style={{ color: 'var(--accent)' }}>{t.client.name}</Link>
                  : <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t.client.name}</p>
              )}
            </div>
            {daysLeft !== null && (
              <span
                className="shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold"
                style={{
                  color: isOverdue ? 'var(--color-danger)' : 'var(--color-warning)',
                  background: isOverdue ? 'rgba(239,68,68,0.14)' : 'rgba(245,158,11,0.14)',
                }}
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

function Predictions({ trends, overdueTasks }: { trends: { completed: number }[]; overdueTasks: number }) {
  const recentPace = trends.slice(-7).reduce((s, d) => s + d.completed, 0) / 7;
  const olderPace  = trends.slice(-14, -7).reduce((s, d) => s + d.completed, 0) / 7;
  const paceChange = olderPace > 0 ? ((recentPace - olderPace) / olderPace) * 100 : 0;
  return (
    <div className="space-y-3">
      <div className="rounded-xl border px-4 py-3" style={{ background: 'var(--surface-2)', borderColor: 'var(--border-2)' }}>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--text-secondary)' }}>Completion Pace</p>
        <p className="text-xl font-extrabold tabular-nums" style={{ color: 'var(--text)' }}>{recentPace.toFixed(1)} tasks/day</p>
        {olderPace > 0 ? (
          <p className="mt-1 text-xs font-semibold" style={{ color: paceChange >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
            {paceChange >= 0 ? '▲' : '▼'} {Math.abs(paceChange).toFixed(0)}% vs previous week
          </p>
        ) : (
          <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>Gathering baseline trend data</p>
        )}
      </div>
      <div
        className="rounded-xl border px-4 py-3"
        style={{
          background: overdueTasks > 0 ? 'var(--color-danger-bg)' : 'var(--color-success-bg)',
          borderColor: overdueTasks > 0 ? 'var(--color-danger-border)' : 'var(--color-success-border)',
        }}
      >
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: overdueTasks > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
          {overdueTasks > 0 ? 'Risk Forecast' : 'Operational Health'}
        </p>
        <p className="text-sm" style={{ color: 'var(--text)' }}>
          {overdueTasks > 0
            ? `${overdueTasks} overdue${recentPace > 0 ? ` — clear in ~${Math.ceil(overdueTasks / recentPace)} days at current pace.` : ' — prioritize high-impact items.'}`
            : 'No overdue tasks. Team delivery pipeline is healthy.'}
        </p>
      </div>
    </div>
  );
}

// ── Content distribution ──────────────────────────────────────────────────────

function ContentDistribution({ items }: { items: { label: string; count: number }[] }) {
  if (!items.length) {
    return (
      <div className="rounded-2xl border px-4 py-8 text-center" style={{ borderColor: 'var(--border-2)', background: 'var(--surface-2)' }}>
        <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>No assets yet</p>
        <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>Upload assets to track portfolio mix.</p>
      </div>
    );
  }
  const max = Math.max(...items.map(i => i.count), 1);
  return (
    <div className="space-y-3">
      {items.map(item => (
        <div key={item.label} className="grid grid-cols-[minmax(0,120px)_1fr_auto] items-center gap-2 sm:gap-3">
          <span className="truncate text-xs" title={item.label} style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
          <div className="h-2.5 rounded-full" style={{ background: 'var(--surface-2)' }}>
            <div
              className="h-2.5 rounded-full transition-all duration-500"
              style={{
                width: `${(item.count / max) * 100}%`,
                background: 'var(--accent)',
                boxShadow: 'none',
              }}
            />
          </div>
          <span className="w-8 text-right text-xs font-semibold tabular-nums" style={{ color: 'var(--text)' }}>{item.count}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuth();
  const { t } = useLang();
  const firstName = user?.name?.split(' ')[0] || 'there';

  const { data: stats, isLoading: statsLoading } = useDashboardStats();

  const { data: activitiesData } = useQuery<ActivityType[]>({
    queryKey: ['activities'],
    queryFn: async () => {
      const { data } = await supabase.from('activities').select('*').order('created_at', { ascending: false }).limit(10);
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
        .select('id, scheduled_date, scheduled_time, platforms, client_id, caption, status, asset:assets(id, name, content_type, client_name)')
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
      const json = await res.json() as { success: boolean; trends?: { date: string; completed: number }[] };
      return json.trends ?? [];
    },
    staleTime: 120_000,
  });

  const { data: teamPerf } = useQuery<{ id: string; name: string; completed: number }[]>({
    queryKey: ['dashboard-team-performance'],
    queryFn: async () => {
      const res = await fetch('/api/dashboard/team-performance');
      if (!res.ok) return [];
      const json = await res.json() as { success: boolean; performance?: { id: string; name: string; completed: number }[] };
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
      return (data ?? []) as unknown as Array<{ id: string; title: string; due_date?: string; status: string; client?: { name: string; slug?: string } | null }>;
    },
    staleTime: 60_000,
  });

  const { data: recentAssets } = useQuery<Asset[]>({
    queryKey: ['dashboard-recent-assets'],
    queryFn: async () => {
      const { data } = await supabase
        .from('assets')
        .select('id, name, file_type, created_at, thumbnail_url, preview_url, file_url, client_name, client_id')
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

  const lightInsights = useMemo(() => {
    const trendRows = trendsData ?? [];
    let completedThisWeek = 0;
    for (let i = Math.max(0, trendRows.length - WEEK_LENGTH_DAYS); i < trendRows.length; i += 1) {
      completedThisWeek += trendRows[i]?.completed ?? 0;
    }
    const overdue = stats?.overdueTasks ?? 0;
    const assetsThisWeek = (recentAssets ?? []).filter(asset => {
      if (!asset.created_at) return false;
      return Date.now() - new Date(asset.created_at).getTime() <= WEEK_LENGTH_DAYS * MILLISECONDS_PER_DAY;
    }).length;

    return [
      `You completed ${completedThisWeek} ${pluralize(completedThisWeek, 'task', 'tasks')} this week`,
      overdue > 0
        ? `${overdue} ${pluralize(overdue, 'task', 'tasks')} ${overdue === 1 ? 'is' : 'are'} overdue`
        : 'No overdue tasks right now',
      assetsThisWeek > 0
        ? `${assetsThisWeek} ${pluralize(assetsThisWeek, 'asset', 'assets')} added this week`
        : 'No activity in assets this week',
    ];
  }, [trendsData, stats?.overdueTasks, recentAssets]);

  return (
    <div className="openy-page-shell max-w-[1500px] mx-auto animate-openy-fade-in">
      <div className="openy-page-header">
        <div>
          <h1 className="openy-page-header-title">
          {t('welcomeBack')}, {firstName} 👋
          </h1>
          <p className="openy-page-header-description">
          Here&apos;s what&apos;s happening today
          </p>
        </div>
      </div>

      {/* ── Stat cards ── */}
      {statsLoading ? <SkeletonStatGrid count={5} /> : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4 md:gap-4">
          <StatCard label={t('totalClients')}     value={stats?.totalClients     ?? 0} icon={<Users2 size={20} />}        color="blue"   />
          <StatCard label={t('activeTasks')}      value={stats?.activeTasks      ?? 0} icon={<CheckSquare size={20} />}   color="mint"   />
          <StatCard label={t('overdueTasks')}     value={stats?.overdueTasks     ?? 0} icon={<AlertTriangle size={20} />} color="rose"   />
          <StatCard label={t('tasksDueThisWeek')} value={stats?.tasksDueThisWeek ?? 0} icon={<CalendarDays size={20} />}  color="violet" />
          <StatCard label="Total Assets"          value={stats?.totalAssets      ?? 0} icon={<FolderOpen size={20} />}    color="cyan"   />
        </div>
      )}

      {/* ── Trend + Team performance ── */}
      <div className="glass glass-card p-4">
        <SectionHead title="Activity Insights" icon={<Activity size={14} />} subtitle="Lightweight signals to guide your next move" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          {lightInsights.map((text) => (
            <div key={text} className="rounded-xl border px-3.5 py-3 text-sm" style={{ background: 'var(--surface-2)', borderColor: 'var(--border-2)', color: 'var(--text)' }}>
              {text}
            </div>
          ))}
        </div>
      </div>

      {/* ── Trend + Team performance ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="glass glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={16} style={{ color: 'var(--accent)' }} />
            <h2 className="text-sm font-bold tracking-tight" style={{ color: 'var(--text)' }}>Completion Trend (30d)</h2>
          </div>
          {trendsData ? <TrendChart data={trendsData} /> : <div className="h-24 rounded-xl skeleton-shimmer" />}
        </div>
        <div className="glass glass-card p-5">
          <h2 className="text-sm font-bold tracking-tight mb-4" style={{ color: 'var(--text)' }}>Team Performance (this month)</h2>
          {teamPerf ? <TeamPerformance data={teamPerf} /> : <div className="h-24 rounded-xl skeleton-shimmer" />}
        </div>
      </div>

      {/* ── At-risk + Predictions ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="glass glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={16} style={{ color: 'var(--color-warning)' }} />
            <h2 className="text-sm font-bold tracking-tight" style={{ color: 'var(--text)' }}>At-Risk Tasks (next 3 days)</h2>
          </div>
          <OverdueRisk tasks={atRiskTasks ?? []} />
        </div>
        <div className="glass glass-card p-5">
          <h2 className="text-sm font-bold tracking-tight mb-4" style={{ color: 'var(--text)' }}>Predictions</h2>
          <Predictions trends={trendsData ?? []} overdueTasks={stats?.overdueTasks ?? 0} />
        </div>
      </div>

      {/* ── Activity + Content distribution ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="glass glass-card p-5">
          <h2 className="text-sm font-bold tracking-tight mb-4" style={{ color: 'var(--text)' }}>{t('recentActivity')}</h2>
          {!activitiesData ? (
            <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-10 rounded-xl skeleton-shimmer" />)}</div>
          ) : activitiesData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Activity size={28} className="mb-3 opacity-40" style={{ color: 'var(--text-secondary)' }} />
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No recent activity</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activitiesData.map(a => (
                <div key={a.id} className="flex gap-3">
                  <div className="w-2 h-2 rounded-full mt-2 shrink-0" style={{ background: 'var(--accent)' }} />
                  <div>
                    <p className="text-sm" style={{ color: 'var(--text)' }}>{a.description}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{new Date(a.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="glass glass-card p-5">
          <h2 className="text-sm font-bold tracking-tight mb-4" style={{ color: 'var(--text)' }}>{t('contentDistribution')}</h2>
          <ContentDistribution items={contentDistItems} />
        </div>
      </div>

      {/* ── Upcoming scheduled posts ── */}
      <div className="glass glass-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <CalendarDays size={16} style={{ color: 'var(--accent)' }} />
          <h2 className="text-sm font-bold tracking-tight" style={{ color: 'var(--text)' }}>Upcoming Scheduled Posts</h2>
        </div>
        {!scheduled ? (
          <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-12 rounded-xl skeleton-shimmer" />)}</div>
        ) : scheduled.length === 0 ? (
          <p className="text-sm py-4 text-center" style={{ color: 'var(--text-secondary)' }}>No scheduled posts coming up</p>
        ) : (
          <div className="space-y-3">
            {scheduled.map(s => (
              <div key={s.id} className="flex items-center justify-between gap-4 rounded-xl px-4 py-3 border" style={{ background: 'var(--surface-2)', borderColor: 'var(--border-2)' }}>
                <div className="flex items-center gap-3 min-w-0">
                  <Send size={15} style={{ color: 'var(--accent)' }} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
                      {s.asset?.name ?? s.caption ?? 'Publishing schedule'}
                    </p>
                    {s.asset?.client_name && (
                      <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{s.asset.client_name}</p>
                    )}
                    {s.platforms?.length > 0 && (
                      <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{s.platforms.join(', ')}</p>
                    )}
                  </div>
                </div>
                <div className="shrink-0 text-xs font-semibold" style={{ color: 'var(--accent)' }}>
                  {new Date(s.scheduled_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  {s.scheduled_time ? ` · ${s.scheduled_time.slice(0, 5)}` : ''}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Recent Assets + Active Clients ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recent Assets */}
        <div className="glass glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ImageIcon size={15} style={{ color: 'var(--accent)' }} />
              <h2 className="text-sm font-bold tracking-tight" style={{ color: 'var(--text)' }}>Recent Assets</h2>
            </div>
            <Link href="/assets" className="text-xs font-semibold hover:opacity-70 transition-opacity" style={{ color: 'var(--accent)' }}>
              View all
            </Link>
          </div>
          {!recentAssets ? (
            <div className="grid grid-cols-3 gap-2">
              {[...Array(6)].map((_, i) => <div key={i} className="aspect-square rounded-xl skeleton-shimmer" />)}
            </div>
          ) : recentAssets.length === 0 ? (
            <p className="text-sm py-4 text-center" style={{ color: 'var(--text-secondary)' }}>No assets yet</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {recentAssets.map(asset => (
                <div key={asset.id} className="rounded-xl overflow-hidden border"
                  style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
                  {(asset.thumbnail_url ?? asset.preview_url ?? (asset.file_type?.startsWith('image/') ? asset.file_url : null)) ? (
                    <img
                      src={asset.thumbnail_url ?? asset.preview_url ?? asset.file_url}
                      alt={asset.name}
                      className="w-full aspect-square object-cover"
                    />
                  ) : (
                    <div className="w-full aspect-square flex items-center justify-center"
                      style={{ background: 'var(--surface)' }}>
                      <FolderOpen size={18} style={{ color: 'var(--text-secondary)' }} />
                    </div>
                  )}
                  <div className="px-2 py-1">
                    <p className="text-[10px] font-medium truncate" style={{ color: 'var(--text)' }}>{asset.name}</p>
                    {asset.client_name && (
                      <p className="text-[10px] truncate" style={{ color: 'var(--text-secondary)' }}>{asset.client_name}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Active Clients */}
        <div className="glass glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users2 size={15} style={{ color: 'var(--accent)' }} />
              <h2 className="text-sm font-bold tracking-tight" style={{ color: 'var(--text)' }}>Active Clients</h2>
            </div>
            <Link href="/clients" className="text-xs font-semibold hover:opacity-70 transition-opacity" style={{ color: 'var(--accent)' }}>
              View all
            </Link>
          </div>
          {!activeClients ? (
            <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-10 rounded-xl skeleton-shimmer" />)}</div>
          ) : activeClients.length === 0 ? (
            <p className="text-sm py-4 text-center" style={{ color: 'var(--text-secondary)' }}>No active clients</p>
          ) : (
            <div className="space-y-2">
              {activeClients.map(client => (
                <Link
                  key={client.id}
                  href={`/clients/${client.slug ?? client.id}/overview`}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-opacity hover:opacity-80"
                  style={{ background: 'var(--surface-2)' }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white shrink-0"
                    style={{ background: 'var(--accent)' }}
                  >
                    {client.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{client.name}</p>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      Updated {new Date(client.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0"
                    style={{ background: 'rgba(22,163,74,0.1)', color: '#16a34a' }}>
                    active
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
