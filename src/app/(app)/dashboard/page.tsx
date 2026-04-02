'use client';

import { useEffect, useState } from 'react';
import { Users2, CheckSquare, Clock, AlertTriangle, Activity } from 'lucide-react';
import pb from '@/lib/pocketbase';
import { useAuth } from '@/lib/auth-context';
import { useLang } from '@/lib/lang-context';
import StatCard from '@/components/ui/StatCard';
import type { Activity as ActivityType } from '@/lib/types';

interface Stats {
  totalClients: number;
  activeTasks: number;
  pendingApprovals: number;
  overdueTasks: number;
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [clients, tasks, approvals, overdueRes, activityRes] = await Promise.allSettled([
          pb.collection('clients').getList(1, 1, {}),
          pb.collection('tasks').getList(1, 1, { filter: 'status != "done"' }),
          pb.collection('approvals').getList(1, 1, { filter: 'status = "pending"' }),
          pb.collection('tasks').getList(1, 1, { filter: 'status = "overdue"' }),
          pb.collection('activities').getList(1, 10, { sort: '-created' }),
        ]);
        setStats({
          totalClients:    clients.status    === 'fulfilled' ? clients.value.totalItems    : 0,
          activeTasks:     tasks.status      === 'fulfilled' ? tasks.value.totalItems      : 0,
          pendingApprovals:approvals.status  === 'fulfilled' ? approvals.value.totalItems  : 0,
          overdueTasks:    overdueRes.status === 'fulfilled' ? overdueRes.value.totalItems : 0,
        });
        if (activityRes.status === 'fulfilled') {
          setActivities(activityRes.value.items as unknown as ActivityType[]);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const firstName = user?.name?.split(' ')[0] || 'there';

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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-2xl h-32 animate-pulse" style={{ background: 'var(--surface)' }} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label={t('totalClients')}    value={stats.totalClients}    icon={<Users2 size={20} />}        color="blue"  />
          <StatCard label={t('activeTasks')}     value={stats.activeTasks}     icon={<CheckSquare size={20} />}   color="green" />
          <StatCard label={t('pendingApprovals')}value={stats.pendingApprovals}icon={<Clock size={20} />}         color="amber" />
          <StatCard label={t('overdueTasks')}    value={stats.overdueTasks}    icon={<AlertTriangle size={20} />} color="red"   />
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
                      {new Date(a.created).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border p-6" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <h2 className="text-base font-semibold mb-5" style={{ color: 'var(--text)' }}>{t('contentDistribution')}</h2>
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Connect PocketBase to see analytics
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
