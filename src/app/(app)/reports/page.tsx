'use client';

import { useEffect, useState } from 'react';
import { BarChart2, Users2, CheckSquare, Clock, FolderOpen } from 'lucide-react';
import supabase from '@/lib/supabase';
import { useLang } from '@/lib/lang-context';
import StatCard from '@/components/ui/StatCard';

export default function ReportsPage() {
  const { t } = useLang();
  const [stats, setStats] = useState({ clients: 0, tasks: 0, assets: 0, content: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [c, tk, a, ct] = await Promise.allSettled([
          supabase.from('clients').select('id', { count: 'exact', head: true }),
          supabase.from('tasks').select('id', { count: 'exact', head: true }),
          supabase.from('assets').select('id', { count: 'exact', head: true }),
          supabase.from('content_items').select('id', { count: 'exact', head: true }),
        ]);
        setStats({
          clients: c.status  === 'fulfilled' ? (c.value.count  ?? 0) : 0,
          tasks:   tk.status === 'fulfilled' ? (tk.value.count ?? 0) : 0,
          assets:  a.status  === 'fulfilled' ? (a.value.count  ?? 0) : 0,
          content: ct.status === 'fulfilled' ? (ct.value.count ?? 0) : 0,
        });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{t('reports')}</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Overview of your workspace</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 rounded-2xl animate-pulse" style={{ background: 'var(--surface)' }} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label={t('clients')} value={stats.clients} icon={<Users2 size={20} />}      color="blue"  />
          <StatCard label={t('tasks')}   value={stats.tasks}   icon={<CheckSquare size={20} />}  color="green" />
          <StatCard label={t('assets')}  value={stats.assets}  icon={<FolderOpen size={20} />}   color="amber" />
          <StatCard label={t('content')} value={stats.content} icon={<Clock size={20} />}         color="red"   />
        </div>
      )}

      <div className="rounded-2xl border p-6" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2 mb-6">
          <BarChart2 size={20} style={{ color: 'var(--accent)' }} />
          <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>Performance Overview</h2>
        </div>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <BarChart2 size={40} className="mb-4 opacity-20" style={{ color: 'var(--text-secondary)' }} />
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Add data to see analytics
          </p>
        </div>
      </div>
    </div>
  );
}
