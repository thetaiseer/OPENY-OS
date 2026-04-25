'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  CalendarDays,
  CheckSquare,
  FolderKanban,
  FolderOpen,
  ImageIcon,
  Send,
  Sparkles,
  TrendingUp,
  Users2,
} from 'lucide-react';
import Link from 'next/link';
import supabase from '@/lib/supabase';
import { useAuth } from '@/context/auth-context';
import { useLang } from '@/context/lang-context';
import { useDashboardStats } from '@/hooks/queries';
import { contentTypeLabel } from '@/lib/asset-utils';
import type { Activity as ActivityType, Asset, Client, PublishingSchedule } from '@/lib/types';
import { useQuickActions } from '@/context/quick-actions-context';
import { PageHeader, PageShell } from '@/components/layout/PageLayout';
import Button from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { SkeletonStatGrid } from '@/components/ui/Skeleton';
import StatCard from '@/components/ui/StatCard';

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
        .from('activity_log')
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

  const { data: projectRows = [] } = useQuery({
    queryKey: ['dashboard-projects-mini'],
    queryFn: async () => {
      const { data, error } = await supabase.from('projects').select('id,status');
      if (error) throw new Error(error.message);
      return (data ?? []) as { id: string; status: string }[];
    },
    staleTime: 60_000,
  });

  const contentDistItems = useMemo(() => {
    if (!assetRows) return [];
    const counts: Record<string, number> = {};
    for (const row of assetRows)
      counts[row.content_type ?? 'OTHER'] = (counts[row.content_type ?? 'OTHER'] ?? 0) + 1;
    return Object.entries(counts)
      .map(([key, count]) => ({ label: contentTypeLabel(key), count }))
      .sort((a, b) => b.count - a.count);
  }, [assetRows]);

  const projectStats = useMemo(() => {
    let active = 0;
    let completed = 0;
    for (const p of projectRows) {
      if (p.status === 'active') active += 1;
      if (p.status === 'completed') completed += 1;
    }
    return { total: projectRows.length, active, completed };
  }, [projectRows]);

  const recentPace = (trendsData ?? []).slice(-7).reduce((s, d) => s + d.completed, 0) / 7;
  const currentTasks = taskTab === 'upcoming' ? upcomingTasks : overdueTasksList;

  return (
    <PageShell>
      <PageHeader
        title={`Good morning, ${firstName} 👋`}
        subtitle="Here's what's happening with your projects today."
        actions={
          <>
            <Button
              type="button"
              variant="primary"
              onClick={() => triggerQuickAction('add-client')}
            >
              + New client
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => triggerQuickAction('add-task')}
            >
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
            value={projectStats.total}
            icon={<FolderKanban size={18} />}
          />
          <StatCard
            label="In progress"
            value={projectStats.active}
            icon={<TrendingUp size={18} />}
          />
          <StatCard
            label="Completed"
            value={projectStats.completed}
            icon={<CheckSquare size={18} />}
          />
          <StatCard
            label="Overdue tasks"
            value={stats?.overdueTasks ?? 0}
            icon={<AlertTriangle size={18} />}
          />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Performance overview</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <p className="text-xs uppercase text-secondary">Completion rate</p>
            <p className="text-xl font-semibold text-primary">
              {stats?.activeTasks
                ? Math.max(
                    0,
                    Math.round(
                      (1 - (stats.overdueTasks ?? 0) / Math.max(1, stats.activeTasks)) * 100,
                    ),
                  )
                : 0}
              %
            </p>
          </div>
          <div>
            <p className="text-xs uppercase text-secondary">Tasks/day (7d)</p>
            <p className="text-xl font-semibold text-primary">{recentPace.toFixed(1)}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-secondary">Team tracked</p>
            <p className="text-xl font-semibold text-primary">{teamPerf?.length ?? 0}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Tasks</CardTitle>
            <Link href="/tasks/all" className="text-xs text-accent hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent>
            <div className="mb-3 flex gap-2">
              <Button
                size="sm"
                variant={taskTab === 'upcoming' ? 'primary' : 'secondary'}
                onClick={() => setTaskTab('upcoming')}
              >
                Upcoming
              </Button>
              <Button
                size="sm"
                variant={taskTab === 'overdue' ? 'primary' : 'secondary'}
                onClick={() => setTaskTab('overdue')}
              >
                Overdue ({overdueTasksList.length})
              </Button>
            </div>
            <div className="space-y-2">
              {currentTasks.length === 0 ? (
                <p className="text-sm text-secondary">Nothing here</p>
              ) : (
                currentTasks.map((task) => (
                  <div
                    key={task.id}
                    className="rounded-control border border-border bg-elevated px-3 py-2"
                  >
                    <p className="text-sm font-medium text-primary">{task.title}</p>
                    <p className="text-xs text-secondary">{task.client?.name ?? 'No client'}</p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('recentActivity')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {!activitiesData?.length ? (
              <p className="text-sm text-secondary">No recent activity</p>
            ) : (
              activitiesData.map((a) => (
                <div
                  key={a.id}
                  className="rounded-control border border-border bg-elevated px-3 py-2"
                >
                  <p className="text-sm text-primary">{a.description}</p>
                  <p className="text-xs text-secondary">
                    {new Date(a.created_at).toLocaleString()}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Insights & predictions</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-2 text-sm text-primary">
          <Sparkles size={16} className="text-accent" />
          You are on track to clear {Math.max(stats?.overdueTasks ?? 0, 0)} overdue items.
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Scheduled Posts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {!scheduled?.length ? (
              <p className="text-sm text-secondary">No scheduled posts coming up</p>
            ) : (
              scheduled.map((s) => (
                <div
                  key={s.id}
                  className="rounded-control border border-border bg-elevated px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <Send size={14} className="text-accent" />
                    <p className="text-sm text-primary">
                      {s.asset?.name ?? s.caption ?? 'Publishing schedule'}
                    </p>
                  </div>
                  <p className="text-xs text-secondary">{s.asset?.client_name ?? ''}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('contentDistribution')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {!contentDistItems.length ? (
              <p className="text-sm text-secondary">No assets yet</p>
            ) : (
              contentDistItems.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between rounded-control border border-border bg-elevated px-3 py-2"
                >
                  <span className="text-sm text-secondary">{item.label}</span>
                  <span className="text-sm font-semibold text-primary">{item.count}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Assets</CardTitle>
            <Link href="/assets" className="text-xs text-accent hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-2">
            {recentAssets?.slice(0, 6).map((asset) => (
              <div key={asset.id} className="rounded-control border border-border bg-elevated p-2">
                <p className="truncate text-xs text-primary">{asset.name}</p>
                <p className="truncate text-[10px] text-secondary">{asset.client_name ?? ''}</p>
              </div>
            )) ?? <p className="text-sm text-secondary">No assets yet</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Active Clients</CardTitle>
            <Link href="/clients" className="text-xs text-accent hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {!activeClients?.length ? (
              <p className="text-sm text-secondary">No active clients</p>
            ) : (
              activeClients.map((client) => (
                <Link
                  key={client.id}
                  href={`/clients/${client.slug ?? client.id}/overview`}
                  className="flex items-center gap-2 rounded-control border border-border bg-elevated px-3 py-2"
                >
                  <Users2 size={14} className="text-accent" />
                  <span className="truncate text-sm text-primary">{client.name}</span>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick actions</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button variant="secondary" onClick={() => triggerQuickAction('add-client')}>
            <Users2 size={16} /> New client
          </Button>
          <Button variant="secondary" onClick={() => triggerQuickAction('add-task')}>
            <CheckSquare size={16} /> New task
          </Button>
          <Button variant="secondary" onClick={() => triggerQuickAction('add-content')}>
            <FolderOpen size={16} /> New content
          </Button>
          <Button variant="secondary" onClick={() => triggerQuickAction('add-asset')}>
            <ImageIcon size={16} /> Upload asset
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Team performance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!teamPerf?.length ? (
            <p className="text-sm text-secondary">No completions this month</p>
          ) : (
            teamPerf.slice(0, 6).map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between rounded-control border border-border bg-elevated px-3 py-2"
              >
                <p className="text-sm text-primary">{member.name}</p>
                <p className="text-sm font-semibold text-primary">{member.completed}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CalendarDays size={16} className="text-accent" />
            <CardTitle>Navigation</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Link href="/projects">
            <Button variant="ghost">Projects</Button>
          </Link>
          <Link href="/tasks/all">
            <Button variant="ghost">Tasks</Button>
          </Link>
          <Link href="/assets">
            <Button variant="ghost">Assets</Button>
          </Link>
          <Link href="/reports/overview">
            <Button variant="ghost">Reports</Button>
          </Link>
        </CardContent>
      </Card>
    </PageShell>
  );
}
