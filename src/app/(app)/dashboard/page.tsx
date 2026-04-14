'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import {
  Users2, CheckSquare, AlertTriangle, Activity, FolderOpen, CalendarDays, TrendingUp, Send, Image as ImageIcon,
} from 'lucide-react';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer, BarChart, Bar, YAxis } from 'recharts';
import Link from 'next/link';
import supabase from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { useLang } from '@/lib/lang-context';
import { useDashboardStats } from '@/lib/queries';
import StatCard from '@/components/ui/StatCard';
import { SkeletonStatGrid } from '@/components/ui/Skeleton';
import { contentTypeLabel } from '@/lib/asset-utils';
import type { Activity as ActivityType, PublishingSchedule, Asset, Client } from '@/lib/types';

interface Stats {
  totalClients: number;
  activeTasks: number;
  overdueTasks: number;
  tasksDueThisWeek: number;
}

// ── Trend chart ───────────────────────────────────────────────────────────────

function TrendChart({ data }: { data: { date: string; completed: number }[] }) {
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
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{total}</p>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>tasks completed (30d)</p>
        </div>
        <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{ background: up ? 'rgba(22,163,74,0.1)' : 'rgba(239,68,68,0.1)', color: up ? '#16a34a' : '#ef4444' }}>
          {up ? '▲' : '▼'} vs prev 15d
        </span>
      </div>
      <ResponsiveContainer width="100%" height={80}>
        <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="name" hide />
          <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }} labelStyle={{ color: 'var(--text-secondary)' }} itemStyle={{ color: 'var(--text)' }} />
          <Area type="monotone" dataKey="completed" stroke="var(--accent)" fill="url(#tg)" strokeWidth={2} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Team performance ──────────────────────────────────────────────────────────

function TeamPerformance({ data }: { data: { id: string; name: string; completed: number }[] }) {
  if (!data.length) return <p className="text-sm py-4 text-center" style={{ color: 'var(--text-secondary)' }}>No completions this month</p>;
  const chartData = data.slice(0, 6).map(d => ({ name: d.name.split(' ')[0], completed: d.completed }));
  return (
    <ResponsiveContainer width="100%" height={130}>
      <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }} cursor={{ fill: 'var(--surface-2)' }} />
        <Bar dataKey="completed" fill="var(--accent)" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Overdue risk ──────────────────────────────────────────────────────────────

function OverdueRisk({ tasks }: { tasks: { id: string; title: string; due_date?: string; status: string; client?: { name: string; slug?: string } | null }[] }) {
  if (!tasks.length) return <p className="text-sm py-4 text-center" style={{ color: 'var(--text-secondary)' }}>🎉 No at-risk tasks!</p>;
  return (
    <div className="space-y-2">
      {tasks.map(t => {
        const daysLeft = t.due_date ? Math.ceil((new Date(t.due_date).getTime() - Date.now()) / 86400000) : null;
        const isOverdue = daysLeft !== null && daysLeft < 0;
        return (
          <div key={t.id} className="flex items-center justify-between gap-2 rounded-xl px-3 py-2" style={{ background: isOverdue ? 'rgba(239,68,68,0.07)' : 'rgba(217,119,6,0.07)' }}>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{t.title}</p>
              {t.client && (
                t.client.slug
                  ? <Link href={`/clients/${t.client.slug}/tasks`} className="text-xs hover:underline" style={{ color: 'var(--accent)' }}>{t.client.name}</Link>
                  : <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t.client.name}</p>
              )}
            </div>
            {daysLeft !== null && (
              <span className="text-xs font-semibold shrink-0" style={{ color: isOverdue ? '#ef4444' : '#d97706' }}>
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
      <div className="rounded-xl px-4 py-3" style={{ background: 'var(--surface-2)' }}>
        <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>COMPLETION PACE (7d avg)</p>
        <p className="text-lg font-bold" style={{ color: 'var(--text)' }}>{recentPace.toFixed(1)} tasks/day</p>
        {olderPace > 0 && (
          <p className="text-xs" style={{ color: paceChange >= 0 ? '#16a34a' : '#ef4444' }}>
            {paceChange >= 0 ? '▲' : '▼'} {Math.abs(paceChange).toFixed(0)}% vs prev week
          </p>
        )}
      </div>
      <div className="rounded-xl px-4 py-3" style={{ background: overdueTasks > 0 ? 'rgba(239,68,68,0.07)' : 'rgba(22,163,74,0.07)' }}>
        <p className="text-xs font-semibold mb-1" style={{ color: overdueTasks > 0 ? '#ef4444' : '#16a34a' }}>
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
    return <p className="text-sm py-10 text-center" style={{ color: 'var(--text-secondary)' }}>No assets yet</p>;
  }
  const max = Math.max(...items.map(i => i.count), 1);
  return (
    <div className="space-y-3">
      {items.map(item => (
        <div key={item.label} className="flex items-center gap-3">
          <span className="text-xs w-28 shrink-0 truncate" title={item.label} style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
          <div className="flex-1 h-2 rounded-full" style={{ background: 'var(--surface-2)' }}>
            <div
              className="h-2 rounded-full transition-all duration-500"
              style={{ width: `${(item.count / max) * 100}%`, background: 'var(--accent)' }}
            />
          </div>
          <span className="text-xs font-semibold tabular-nums w-8 text-right" style={{ color: 'var(--text)' }}>{item.count}</span>
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

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
          {t('welcomeBack')}, {firstName} 👋
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Here&apos;s what&apos;s happening today
        </p>
      </div>

      {/* ── Stat cards ── */}
      {statsLoading ? <SkeletonStatGrid count={5} /> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard label={t('totalClients')}     value={stats?.totalClients     ?? 0} icon={<Users2 size={20} />}        color="blue"   />
          <StatCard label={t('activeTasks')}      value={stats?.activeTasks      ?? 0} icon={<CheckSquare size={20} />}   color="mint"   />
          <StatCard label={t('overdueTasks')}     value={stats?.overdueTasks     ?? 0} icon={<AlertTriangle size={20} />} color="rose"   />
          <StatCard label={t('tasksDueThisWeek')} value={stats?.tasksDueThisWeek ?? 0} icon={<CalendarDays size={20} />}  color="violet" />
          <StatCard label="Total Assets"          value={stats?.totalAssets      ?? 0} icon={<FolderOpen size={20} />}    color="cyan"   />
        </div>
      )}

      {/* ── Trend + Team performance ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border p-6" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={16} style={{ color: 'var(--accent)' }} />
            <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>Completion Trend (30d)</h2>
          </div>
          {trendsData ? <TrendChart data={trendsData} /> : <div className="h-24 rounded-xl animate-pulse" style={{ background: 'var(--surface-2)' }} />}
        </div>
        <div className="rounded-2xl border p-6" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--text)' }}>Team Performance (this month)</h2>
          {teamPerf ? <TeamPerformance data={teamPerf} /> : <div className="h-24 rounded-xl animate-pulse" style={{ background: 'var(--surface-2)' }} />}
        </div>
      </div>

      {/* ── At-risk + Predictions ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border p-6" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={16} style={{ color: '#d97706' }} />
            <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>At-Risk Tasks (next 3 days)</h2>
          </div>
          <OverdueRisk tasks={atRiskTasks ?? []} />
        </div>
        <div className="rounded-2xl border p-6" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--text)' }}>Predictions</h2>
          <Predictions trends={trendsData ?? []} overdueTasks={stats?.overdueTasks ?? 0} />
        </div>
      </div>

      {/* ── Activity + Content distribution ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border p-6" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <h2 className="text-base font-semibold mb-5" style={{ color: 'var(--text)' }}>{t('recentActivity')}</h2>
          {!activitiesData ? (
            <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-10 rounded-lg animate-pulse" style={{ background: 'var(--surface-2)' }} />)}</div>
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
        <div className="rounded-2xl border p-6" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <h2 className="text-base font-semibold mb-5" style={{ color: 'var(--text)' }}>{t('contentDistribution')}</h2>
          <ContentDistribution items={contentDistItems} />
        </div>
      </div>

      {/* ── Upcoming scheduled posts ── */}
      <div className="rounded-2xl border p-6" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2 mb-5">
          <CalendarDays size={18} style={{ color: 'var(--accent)' }} />
          <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>Upcoming Scheduled Posts</h2>
        </div>
        {!scheduled ? (
          <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-12 rounded-xl animate-pulse" style={{ background: 'var(--surface-2)' }} />)}</div>
        ) : scheduled.length === 0 ? (
          <p className="text-sm py-4 text-center" style={{ color: 'var(--text-secondary)' }}>No scheduled posts coming up</p>
        ) : (
          <div className="space-y-3">
            {scheduled.map(s => (
              <div key={s.id} className="flex items-center justify-between gap-4 rounded-xl px-4 py-3" style={{ background: 'var(--surface-2)' }}>
                <div className="flex items-center gap-3 min-w-0">
                  <Send size={16} style={{ color: 'var(--accent)' }} />
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
                <div className="shrink-0 text-xs font-medium" style={{ color: 'var(--accent)' }}>
                  {new Date(s.scheduled_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  {s.scheduled_time ? ` · ${s.scheduled_time.slice(0, 5)}` : ''}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Recent Assets + Active Clients ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Assets */}
        <div className="rounded-2xl border p-6" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <ImageIcon size={16} style={{ color: 'var(--accent)' }} />
              <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>Recent Assets</h2>
            </div>
            <Link href="/assets" className="text-xs hover:opacity-70 transition-opacity" style={{ color: 'var(--accent)' }}>
              View all
            </Link>
          </div>
          {!recentAssets ? (
            <div className="grid grid-cols-3 gap-2">
              {[...Array(6)].map((_, i) => <div key={i} className="aspect-square rounded-lg animate-pulse" style={{ background: 'var(--surface-2)' }} />)}
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
        <div className="rounded-2xl border p-6" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Users2 size={16} style={{ color: 'var(--accent)' }} />
              <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>Active Clients</h2>
            </div>
            <Link href="/clients" className="text-xs hover:opacity-70 transition-opacity" style={{ color: 'var(--accent)' }}>
              View all
            </Link>
          </div>
          {!activeClients ? (
            <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-10 rounded-lg animate-pulse" style={{ background: 'var(--surface-2)' }} />)}</div>
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
