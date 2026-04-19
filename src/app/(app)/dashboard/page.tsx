'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  CheckSquare,
  FolderOpen,
  Image as ImageIcon,
  Sparkles,
  TrendingUp,
  Users2,
} from 'lucide-react';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { motion } from 'framer-motion';
import Card from '@/components/ui/system/Card';
import Grid from '@/components/ui/system/Grid';
import Button from '@/components/ui/system/Button';
import StatCard from '@/components/ui/StatCard';
import EmptyState from '@/components/ui/EmptyState';
import supabase from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { useLang } from '@/lib/lang-context';
import { useDashboardStats } from '@/lib/queries';
import { contentTypeLabel } from '@/lib/asset-utils';
import type { Activity as ActivityType, PublishingSchedule, Asset, Client } from '@/lib/types';

const WEEK_LENGTH_DAYS = 7;
const MILLISECONDS_PER_DAY = 86_400_000;
const KPI_COUNT = 5;

function pluralize(count: number, singular: string, plural: string) {
  return count === 1 ? singular : plural;
}

function TrendChart({ data }: { data: { date: string; completed: number }[] }) {
  if (!data.length) {
    return (
      <EmptyState
        icon={TrendingUp}
        title="No trend data yet"
        description="Complete your first tasks to unlock weekly performance insights."
      />
    );
  }

  const chartData = data.map(d => ({
    name: new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    completed: d.completed,
  }));

  return (
    <div className="ds-trend-chart">
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--ds-accent)" stopOpacity={0.45} />
              <stop offset="95%" stopColor="var(--ds-accent)" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--ds-line)" strokeDasharray="4 4" />
          <XAxis dataKey="name" tick={{ fill: 'var(--ds-muted)', fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={16} />
          <Tooltip
            contentStyle={{
              borderRadius: 10,
              border: '1px solid var(--ds-line)',
              background: 'var(--ds-surface)',
              fontSize: 12,
            }}
          />
          <Area type="monotone" dataKey="completed" stroke="var(--ds-accent)" fill="url(#trendGradient)" strokeWidth={2.4} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

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
      const { data } = await supabase.from('assets').select('content_type').limit(500);
      return (data ?? []) as { content_type: string | null }[];
    },
    staleTime: 60_000,
  });

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
        .limit(6);
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
        .limit(6);
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

  const highlights = useMemo(() => {
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
        : 'No asset activity this week',
    ];
  }, [trendsData, stats?.overdueTasks, recentAssets]);

  const clients = activeClients ?? [];
  const scheduleRows = scheduled ?? [];
  const assets = recentAssets ?? [];
  const maxContentCount = Math.max(...contentDistItems.map(item => item.count), 1);

  return (
    <div className="ds-dashboard">
      <Card className="ds-hero">
        <div>
          <p className="ds-eyebrow">Workspace Overview</p>
          <h1>{t('welcomeBack')}, {firstName}</h1>
          <p>Modern day mode and futuristic night mode now share one clean system architecture.</p>
        </div>
        <div className="ds-hero-actions">
          <Link href="/os/tasks"><Button>Open Tasks</Button></Link>
          <Link href="/os/calendar"><Button variant="secondary">Open Calendar</Button></Link>
        </div>
      </Card>

      {statsLoading ? (
        <Grid cols={4} className="ds-loading-grid">
          {Array.from({ length: KPI_COUNT }).map((_, index) => <Card key={index} className="ds-skeleton" />)}
        </Grid>
      ) : (
        <Grid cols={4}>
          <StatCard label={t('totalClients')} value={stats?.totalClients ?? 0} icon={<Users2 size={16} />} />
          <StatCard label={t('activeTasks')} value={stats?.activeTasks ?? 0} icon={<CheckSquare size={16} />} />
          <StatCard label={t('overdueTasks')} value={stats?.overdueTasks ?? 0} icon={<AlertTriangle size={16} />} />
          <StatCard label={t('tasksDueThisWeek')} value={stats?.tasksDueThisWeek ?? 0} icon={<CalendarDays size={16} />} />
          <StatCard label="Total Assets" value={stats?.totalAssets ?? 0} icon={<FolderOpen size={16} />} />
        </Grid>
      )}

      <Grid cols={3}>
        <Card>
          <div className="ds-section-head">
            <h2><CheckSquare size={14} /> Tasks</h2>
            <p>At-risk queue</p>
          </div>
          {(atRiskTasks ?? []).length === 0 ? (
            <EmptyState
              icon={CheckSquare}
              title="Everything is on track"
              description="No critical tasks need attention right now."
              action={<Link href="/os/tasks"><Button>Open Task Board</Button></Link>}
            />
          ) : (
            <div className="ds-stack">
              {(atRiskTasks ?? []).map(task => (
                <Link key={task.id} href="/os/tasks" className="ds-list-row">
                  <span>{task.title}</span>
                  <span>{task.client?.name ?? 'Unassigned'}</span>
                  <span>{task.due_date ? new Date(task.due_date).toLocaleDateString() : 'Set date'}</span>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div className="ds-section-head">
            <h2><Users2 size={14} /> Clients</h2>
            <p>Recently active</p>
          </div>
          <div className="ds-stack">
            {clients.length === 0 ? (
              <EmptyState
                icon={Users2}
                title="Build your client roster"
                description="Create your first client space to unlock projects, assets, and tasks."
                action={<Link href="/os/clients"><Button>Create First Client</Button></Link>}
              />
            ) : clients.map(client => (
              <Link key={client.id} href={`/clients/${client.slug ?? client.id}/overview`} className="ds-list-row">
                <span>{client.name}</span>
                <span>{new Date(client.updated_at).toLocaleDateString()}</span>
              </Link>
            ))}
          </div>
        </Card>

        <Card>
          <div className="ds-section-head">
            <h2><CalendarDays size={14} /> Calendar</h2>
            <p>Upcoming publishing</p>
          </div>
          <div className="ds-stack">
            {scheduleRows.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title="No scheduled content yet"
                description="Plan and schedule your first campaign slot."
                action={<Link href="/os/content"><Button>Schedule First Post</Button></Link>}
              />
            ) : scheduleRows.map(item => (
              <div key={item.id} className="ds-list-row">
                <span>{item.asset?.name ?? item.caption ?? 'Scheduled post'}</span>
                <span>{new Date(item.scheduled_date).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </Card>
      </Grid>

      <Card>
        <div className="ds-section-head">
          <h2><TrendingUp size={14} /> Content Performance</h2>
          <p>Distribution and completion trend</p>
        </div>
        <Grid cols={2}>
          <div className="ds-stack">
            {contentDistItems.length === 0 ? (
              <EmptyState
                icon={FolderOpen}
                title="No asset distribution yet"
                description="Upload your first assets to activate performance distribution."
                action={<Link href="/os/assets"><Button>Upload First Asset</Button></Link>}
              />
            ) : contentDistItems.map(item => (
              <div key={item.label} className="ds-progress-row">
                <span>{item.label}</span>
                <div>
                  <motion.i
                    initial={{ width: 0 }}
                    animate={{ width: `${(item.count / maxContentCount) * 100}%` }}
                    transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                  />
                </div>
                <strong>{item.count}</strong>
              </div>
            ))}
          </div>
          <TrendChart data={trendsData ?? []} />
        </Grid>
      </Card>

      <Card>
        <div className="ds-section-head">
          <h2><Activity size={14} /> Recent Activity</h2>
          <p>Latest operational updates</p>
        </div>
        {(activitiesData ?? []).length === 0 ? (
          <EmptyState
            icon={Activity}
            title="Activity feed is waiting"
            description="Start creating tasks, assets, and content to see workspace momentum."
          />
        ) : (
          <div className="ds-stack">
            {(activitiesData ?? []).map(activity => (
              <div key={activity.id} className="ds-list-row">
                <span>{activity.description}</span>
                <span>{new Date(activity.created_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Grid cols={2}>
        <Card>
          <div className="ds-section-head">
            <h2><ImageIcon size={14} /> Latest Assets</h2>
            <p>Most recent uploads</p>
          </div>
          <div className="ds-asset-grid">
            {assets.length === 0 ? (
              <EmptyState
                icon={ImageIcon}
                title="No visual assets yet"
                description="Upload your first image, video, or document to start building the vault."
                action={<Link href="/os/assets"><Button>Upload First Asset</Button></Link>}
              />
            ) : assets.map(asset => (
              <div key={asset.id} className="ds-asset-item">
                <p>{asset.name}</p>
                <p>{asset.client_name ?? 'Unassigned'}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="ds-section-head">
            <h2><Sparkles size={14} /> Highlights</h2>
            <p>Weekly summary</p>
          </div>
          <div className="ds-stack">
            {highlights.map(text => <p key={text} className="ds-note">{text}</p>)}
          </div>
        </Card>
      </Grid>
    </div>
  );
}
