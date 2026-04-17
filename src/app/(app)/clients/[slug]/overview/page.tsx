'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  CheckSquare,
  FolderOpen,
  FileText,
  Clock,
  AlertCircle,
  Activity,
  TrendingUp,
  Layers,
} from 'lucide-react';
import supabase from '@/lib/supabase';
import { useLang } from '@/lib/lang-context';
import { useClientWorkspace } from '../client-context';
import type { Task, Asset, ContentItem, Activity as ActivityItem } from '@/lib/types';

function fmtDate(d?: string) {
  if (!d) return '';
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function taskStatusColor(status: string) {
  if (status === 'done' || status === 'completed') return '#16a34a';
  if (status === 'overdue') return '#ef4444';
  if (status === 'in_progress') return '#2563eb';
  return 'var(--text-secondary)';
}

export default function ClientOverviewPage() {
  const { client, clientId } = useClientWorkspace();
  const { slug } = useParams<{ slug: string }>();
  const { t } = useLang();

  const [counts, setCounts] = useState({ tasks: 0, assets: 0, content: 0, activeTasks: 0 });
  const [recentTasks, setRecentTasks] = useState<Task[]>([]);
  const [recentAssets, setRecentAssets] = useState<Asset[]>([]);
  const [recentContent, setRecentContent] = useState<ContentItem[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clientId) return;

    void (async () => {
      const [tk, ast, ct, allTasks, rtk, rast, rct, act] = await Promise.allSettled([
        supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('client_id', clientId),
        supabase.from('assets').select('id', { count: 'exact', head: true }).eq('client_id', clientId),
        supabase.from('content_items').select('id', { count: 'exact', head: true }).eq('client_id', clientId),
        supabase.from('tasks').select('id,status').eq('client_id', clientId),
        supabase
          .from('tasks')
          .select('id,title,status,priority,due_date')
          .eq('client_id', clientId)
          .not('status', 'in', '("done","completed","delivered","cancelled")')
          .order('due_date', { ascending: true })
          .limit(5),
        supabase
          .from('assets')
          .select('id,name,file_type,created_at,thumbnail_url,preview_url,file_url')
          .eq('client_id', clientId)
          .order('created_at', { ascending: false })
          .limit(4),
        supabase
          .from('content_items')
          .select('id,title,status,created_at,schedule_date')
          .eq('client_id', clientId)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('activities')
          .select('*')
          .eq('client_id', clientId)
          .order('created_at', { ascending: false })
          .limit(8),
      ]);

      const allTasksRows = allTasks.status === 'fulfilled' && !allTasks.value.error
        ? (allTasks.value.data ?? []) as { status: string }[]
        : [];

      const activeTasks = allTasksRows.filter(task => !['done', 'completed', 'delivered', 'cancelled'].includes(task.status ?? '')).length;

      setCounts({
        tasks: tk.status === 'fulfilled' ? (tk.value.count ?? 0) : 0,
        assets: ast.status === 'fulfilled' ? (ast.value.count ?? 0) : 0,
        content: ct.status === 'fulfilled' ? (ct.value.count ?? 0) : 0,
        activeTasks,
      });

      if (rtk.status === 'fulfilled' && !rtk.value.error) setRecentTasks((rtk.value.data ?? []) as Task[]);
      if (rast.status === 'fulfilled' && !rast.value.error) setRecentAssets((rast.value.data ?? []) as Asset[]);
      if (rct.status === 'fulfilled' && !rct.value.error) setRecentContent((rct.value.data ?? []) as ContentItem[]);
      if (act.status === 'fulfilled' && !act.value.error) setRecentActivity((act.value.data ?? []) as ActivityItem[]);

      setLoading(false);
    })();
  }, [clientId]);

  const insights = useMemo(() => {
    const overdue = recentTasks.filter(task => task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done').length;
    const published = recentContent.filter(item => item.status === 'published').length;

    return [
      {
        icon: <TrendingUp size={14} />,
        title: 'Productivity insight',
        text: counts.activeTasks === 0
          ? 'All tasks are currently completed or closed.'
          : `${counts.activeTasks} active tasks need attention this cycle.`,
      },
      {
        icon: <AlertCircle size={14} />,
        title: 'Deadline insight',
        text: overdue > 0
          ? `${overdue} task${overdue > 1 ? 's are' : ' is'} currently overdue.`
          : 'No overdue tasks right now.',
      },
      {
        icon: <Layers size={14} />,
        title: 'Content insight',
        text: counts.content === 0
          ? 'No content in pipeline yet.'
          : `${published} published from ${counts.content} content item${counts.content > 1 ? 's' : ''}.`,
      },
    ];
  }, [recentTasks, recentContent, counts]);

  if (!client) return null;

  return (
    <div className="space-y-5">
      {client.notes && (
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text)' }}>{t('notes')}</h3>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{client.notes}</p>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl border p-5 h-24 animate-pulse" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }} />
          ))
        ) : (
          [
            { label: 'Tasks', value: counts.tasks, icon: <CheckSquare size={16} />, href: `/clients/${slug}/tasks` },
            { label: 'Active Tasks', value: counts.activeTasks, icon: <Activity size={16} />, href: `/clients/${slug}/tasks` },
            { label: 'Assets', value: counts.assets, icon: <FolderOpen size={16} />, href: `/clients/${slug}/assets` },
            { label: 'Content', value: counts.content, icon: <FileText size={16} />, href: `/clients/${slug}/content` },
          ].map(({ label, value, icon, href }) => (
            <Link
              key={label}
              href={href}
              className="glass-card p-4 md:p-5 transition-all hover:-translate-y-0.5"
            >
              <div className="flex justify-between items-start">
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>{label}</span>
                <span style={{ color: 'var(--accent)' }}>{icon}</span>
              </div>
              <div className="text-2xl font-bold mt-2" style={{ color: 'var(--text)' }}>{value}</div>
            </Link>
          ))
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="glass-card p-5 xl:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold inline-flex items-center gap-2" style={{ color: 'var(--text)' }}>
              <CheckSquare size={15} style={{ color: 'var(--accent)' }} /> Recent Tasks
            </h3>
            <Link href={`/clients/${slug}/tasks`} className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>
              View all
            </Link>
          </div>

          {recentTasks.length === 0 ? (
            <div className="rounded-xl border px-4 py-8 text-center" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
              No active tasks yet.
            </div>
          ) : (
            <div className="space-y-2">
              {recentTasks.map(task => {
                const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done';

                return (
                  <div key={task.id} className="rounded-xl border px-3 py-2.5 flex items-center justify-between gap-3" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>{task.title}</p>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                        {task.priority} priority
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs shrink-0">
                      {task.due_date && (
                        <span className="inline-flex items-center gap-1" style={{ color: isOverdue ? '#ef4444' : 'var(--text-secondary)' }}>
                          {isOverdue ? <AlertCircle size={11} /> : <Clock size={11} />}
                          {fmtDate(task.due_date)}
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: `${taskStatusColor(task.status)}20`, color: taskStatusColor(task.status) }}>
                        {task.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold inline-flex items-center gap-2 mb-4" style={{ color: 'var(--text)' }}>
            <TrendingUp size={15} style={{ color: 'var(--accent)' }} /> Quick Insights
          </h3>
          <div className="space-y-2.5">
            {insights.map(item => (
              <div key={item.title} className="rounded-xl border p-3" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
                <div className="text-xs font-semibold inline-flex items-center gap-1.5" style={{ color: 'var(--text)' }}>
                  {item.icon}{item.title}
                </div>
                <p className="text-xs mt-1.5 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold inline-flex items-center gap-2" style={{ color: 'var(--text)' }}>
              <FolderOpen size={15} style={{ color: 'var(--accent)' }} /> Recent Assets
            </h3>
            <Link href={`/clients/${slug}/assets`} className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>
              View all
            </Link>
          </div>

          {recentAssets.length === 0 ? (
            <div className="rounded-xl border px-4 py-8 text-center" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
              No assets uploaded yet.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {recentAssets.map(asset => (
                <div key={asset.id} className="rounded-xl overflow-hidden border" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
                  {(asset.thumbnail_url ?? asset.preview_url ?? (asset.file_type?.startsWith('image/') ? asset.file_url : null)) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={asset.thumbnail_url ?? asset.preview_url ?? asset.file_url} alt={asset.name} className="w-full aspect-square object-cover" />
                  ) : (
                    <div className="w-full aspect-square flex items-center justify-center" style={{ background: 'var(--surface)' }}>
                      <FolderOpen size={18} style={{ color: 'var(--text-secondary)' }} />
                    </div>
                  )}
                  <div className="px-2 py-1.5">
                    <p className="text-xs font-semibold truncate" style={{ color: 'var(--text)' }}>{asset.name}</p>
                    <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{fmtDate(asset.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold inline-flex items-center gap-2" style={{ color: 'var(--text)' }}>
              <FileText size={15} style={{ color: 'var(--accent)' }} /> Recent Content
            </h3>
            <Link href={`/clients/${slug}/content`} className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>
              View all
            </Link>
          </div>

          {recentContent.length === 0 ? (
            <div className="rounded-xl border px-4 py-8 text-center" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
              No content created yet.
            </div>
          ) : (
            <div className="space-y-2">
              {recentContent.map(item => (
                <div key={item.id} className="rounded-xl border px-3 py-2.5 flex items-center justify-between gap-3" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{item.title}</p>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0" style={{
                    background: item.status === 'published' ? 'var(--accent-soft)' : item.status === 'scheduled' ? 'rgba(124,58,237,0.12)' : 'rgba(156,163,175,0.12)',
                    color: item.status === 'published' ? 'var(--accent)' : item.status === 'scheduled' ? '#7c3aed' : '#9ca3af',
                  }}>
                    {item.status.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold inline-flex items-center gap-2" style={{ color: 'var(--text)' }}>
            <Activity size={15} style={{ color: 'var(--accent)' }} /> Latest Activity
          </h3>
          <Link href={`/clients/${slug}/activity`} className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>
            Open timeline
          </Link>
        </div>

        {recentActivity.length === 0 ? (
          <div className="rounded-xl border px-4 py-8 text-center" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
            No activity recorded yet.
          </div>
        ) : (
          <div className="space-y-2">
            {recentActivity.slice(0, 5).map(item => (
              <div key={item.id} className="rounded-xl border px-3 py-2.5" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
                <p className="text-sm" style={{ color: 'var(--text)' }}>{item.description}</p>
                <p className="text-[11px] mt-1" style={{ color: 'var(--text-secondary)' }}>
                  {new Date(item.created_at).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
