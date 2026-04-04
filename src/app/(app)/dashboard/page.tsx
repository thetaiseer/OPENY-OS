'use client';

import { useEffect, useState, useMemo } from 'react';
import { Users2, CheckSquare, Clock, AlertTriangle, Activity, FolderOpen, CalendarDays } from 'lucide-react';
import supabase from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { useLang } from '@/lib/lang-context';
import StatCard from '@/components/ui/StatCard';
import { contentTypeLabel } from '@/lib/asset-utils';
import type { Activity as ActivityType, Asset } from '@/lib/types';

interface Stats {
  totalClients: number;
  activeTasks: number;
  pendingApprovals: number;
  overdueTasks: number;
}

interface AssetRow {
  content_type: string | null;
  file_size: number | null;
}

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

export default function DashboardPage() {
  const { user } = useAuth();
  const { t } = useLang();
  const [stats, setStats] = useState<Stats>({
    totalClients: 0,
    activeTasks: 0,
    pendingApprovals: 0,
    overdueTasks: 0,
  });
  const [activities, setActivities] = useState<ActivityType[]>([]);
  const [assetRows, setAssetRows]   = useState<AssetRow[]>([]);
  const [scheduled, setScheduled]   = useState<Asset[]>([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [clients, tasks, approvals, overdue, activityRes, assetsRes, scheduledRes] = await Promise.allSettled([
          supabase.from('clients').select('id', { count: 'exact', head: true }),
          supabase.from('tasks').select('id', { count: 'exact', head: true }).neq('status', 'done'),
          supabase.from('approvals').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
          supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('status', 'overdue'),
          supabase.from('activities').select('*').order('created_at', { ascending: false }).limit(10),
          supabase.from('assets').select('content_type, file_size'),
          supabase.from('assets')
            .select('id, name, publish_date, approval_status, client_name, content_type')
            .eq('approval_status', 'scheduled')
            .gte('publish_date', new Date().toISOString().slice(0, 10))
            .order('publish_date', { ascending: true })
            .limit(5),
        ]);

        setStats({
          totalClients:     clients.status    === 'fulfilled' ? (clients.value.count    ?? 0) : 0,
          activeTasks:      tasks.status      === 'fulfilled' ? (tasks.value.count      ?? 0) : 0,
          pendingApprovals: approvals.status  === 'fulfilled' ? (approvals.value.count  ?? 0) : 0,
          overdueTasks:     overdue.status    === 'fulfilled' ? (overdue.value.count    ?? 0) : 0,
        });
        if (activityRes.status === 'fulfilled' && !activityRes.value.error) {
          setActivities((activityRes.value.data ?? []) as ActivityType[]);
        }
        if (assetsRes.status === 'fulfilled' && !assetsRes.value.error) {
          setAssetRows((assetsRes.value.data ?? []) as AssetRow[]);
        }
        if (scheduledRes.status === 'fulfilled' && !scheduledRes.value.error) {
          setScheduled((scheduledRes.value.data ?? []) as Asset[]);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const firstName = user?.name?.split(' ')[0] || 'there';

  const contentDistItems = useMemo(() => {
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

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="rounded-2xl h-32 animate-pulse" style={{ background: 'var(--surface)' }} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard label={t('totalClients')}     value={stats.totalClients}     icon={<Users2 size={20} />}        color="blue"  />
          <StatCard label={t('activeTasks')}      value={stats.activeTasks}      icon={<CheckSquare size={20} />}   color="green" />
          <StatCard label={t('pendingApprovals')} value={stats.pendingApprovals} icon={<Clock size={20} />}         color="amber" />
          <StatCard label={t('overdueTasks')}     value={stats.overdueTasks}     icon={<AlertTriangle size={20} />} color="red"   />
          <StatCard label="Total Assets"          value={assetRows.length}       icon={<FolderOpen size={20} />}    color="blue"  />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border p-6" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <h2 className="text-base font-semibold mb-5" style={{ color: 'var(--text)' }}>{t('recentActivity')}</h2>
          {activities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Activity size={28} className="mb-3 opacity-40" style={{ color: 'var(--text-secondary)' }} />
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No recent activity</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activities.map(a => (
                <div key={a.id} className="flex gap-3">
                  <div className="w-2 h-2 rounded-full mt-2 shrink-0" style={{ background: 'var(--accent)' }} />
                  <div>
                    <p className="text-sm" style={{ color: 'var(--text)' }}>{a.description}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                      {new Date(a.created_at).toLocaleDateString()}
                    </p>
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

      {/* Upcoming scheduled posts */}
      <div className="rounded-2xl border p-6" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2 mb-5">
          <CalendarDays size={18} style={{ color: 'var(--accent)' }} />
          <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>Upcoming Scheduled Posts</h2>
        </div>
        {scheduled.length === 0 ? (
          <p className="text-sm py-4 text-center" style={{ color: 'var(--text-secondary)' }}>No scheduled posts coming up</p>
        ) : (
          <div className="space-y-3">
            {scheduled.map(a => (
              <div key={a.id} className="flex items-center justify-between gap-4 rounded-xl px-4 py-3" style={{ background: 'var(--surface-2)' }}>
                <div className="flex items-center gap-3 min-w-0">
                  <FolderOpen size={16} style={{ color: 'var(--accent)' }} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{a.name}</p>
                    {a.client_name && (
                      <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{a.client_name}</p>
                    )}
                  </div>
                </div>
                <div className="shrink-0 text-xs font-medium" style={{ color: 'var(--accent)' }}>
                  {a.publish_date ? new Date(a.publish_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
