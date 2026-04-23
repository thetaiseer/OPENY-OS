'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { CheckSquare, FolderOpen, FileText, Clock, AlertCircle } from 'lucide-react';
import { useClientWorkspace } from '../client-context';
import supabase from '@/lib/supabase';
import { useLang } from '@/context/lang-context';
import type { Task, Asset, ContentItem } from '@/lib/types';

function fmtDate(d?: string) {
  if (!d) return '';
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function taskStatusColor(s: string) {
  if (s === 'done' || s === 'completed') return '#16a34a';
  if (s === 'overdue') return '#ef4444';
  if (s === 'in_progress') return '#2563eb';
  return 'var(--text-secondary)';
}

export default function ClientOverviewPage() {
  const { client, clientId } = useClientWorkspace();
  const { slug } = useParams<{ slug: string }>();
  const { t } = useLang();

  const [counts, setCounts] = useState({ tasks: 0, assets: 0, content: 0 });
  const [recentTasks, setRecentTasks] = useState<Task[]>([]);
  const [recentAssets, setRecentAssets] = useState<Asset[]>([]);
  const [recentContent, setRecentContent] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clientId) return;
    void (async () => {
      const [tk, ast, ct, rtk, rast, rct] = await Promise.allSettled([
        supabase
          .from('tasks')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', clientId),
        supabase
          .from('assets')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', clientId),
        supabase
          .from('content_items')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', clientId),
        supabase
          .from('tasks')
          .select('id,title,status,priority,due_date')
          .eq('client_id', clientId)
          .not('status', 'in', '("done","completed","delivered","cancelled")')
          .order('due_date', { ascending: true })
          .limit(4),
        supabase
          .from('assets')
          .select('id,name,file_type,created_at,thumbnail_url,preview_url,file_url')
          .eq('client_id', clientId)
          .order('created_at', { ascending: false })
          .limit(4),
        supabase
          .from('content_items')
          .select('id,title,status,created_at')
          .eq('client_id', clientId)
          .order('created_at', { ascending: false })
          .limit(4),
      ]);
      const taskCount = tk.status === 'fulfilled' ? (tk.value.count ?? 0) : 0;
      const assetCount = ast.status === 'fulfilled' ? (ast.value.count ?? 0) : 0;
      const contentCount = ct.status === 'fulfilled' ? (ct.value.count ?? 0) : 0;
      setCounts({ tasks: taskCount, assets: assetCount, content: contentCount });
      if (rtk.status === 'fulfilled' && !rtk.value.error)
        setRecentTasks((rtk.value.data ?? []) as Task[]);
      if (rast.status === 'fulfilled' && !rast.value.error)
        setRecentAssets((rast.value.data ?? []) as Asset[]);
      if (rct.status === 'fulfilled' && !rct.value.error)
        setRecentContent((rct.value.data ?? []) as ContentItem[]);
      setLoading(false);
    })();
  }, [clientId]);

  if (!client) return null;

  return (
    <div className="space-y-6">
      {/* Notes */}
      {client.notes && (
        <div
          className="rounded-2xl border p-5"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <h3 className="mb-2 text-sm font-semibold" style={{ color: 'var(--text)' }}>
            {t('notes')}
          </h3>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {client.notes}
          </p>
        </div>
      )}

      {/* Summary counts */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {loading
          ? Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-2xl border p-5"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
              />
            ))
          : [
              {
                label: t('tasks'),
                value: counts.tasks,
                icon: <CheckSquare size={16} />,
                href: `/clients/${slug}/tasks`,
              },
              {
                label: t('assets'),
                value: counts.assets,
                icon: <FolderOpen size={16} />,
                href: `/clients/${slug}/assets`,
              },
              {
                label: t('content'),
                value: counts.content,
                icon: <FileText size={16} />,
                href: `/clients/${slug}/content`,
              },
            ].map(({ label, value, icon, href }) => (
              <Link
                key={label}
                href={href}
                className="rounded-2xl border p-5 text-center transition-opacity hover:opacity-80"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
              >
                <div className="mb-1 flex justify-center" style={{ color: 'var(--accent)' }}>
                  {icon}
                </div>
                <div className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
                  {value}
                </div>
                <div className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {label}
                </div>
              </Link>
            ))}
      </div>

      {/* Recent active tasks */}
      {!loading && recentTasks.length > 0 && (
        <div
          className="rounded-2xl border p-5"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckSquare size={15} style={{ color: 'var(--accent)' }} />
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                Active Tasks
              </h3>
            </div>
            <Link
              href={`/clients/${slug}/tasks`}
              className="text-xs transition-opacity hover:opacity-70"
              style={{ color: 'var(--accent)' }}
            >
              View all
            </Link>
          </div>
          <div className="space-y-2">
            {recentTasks.map((task) => {
              const isOverdue =
                task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done';
              return (
                <div
                  key={task.id}
                  className="flex items-center justify-between gap-3 rounded-xl px-3 py-2"
                  style={{ background: 'var(--surface-2)' }}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    {isOverdue ? (
                      <AlertCircle size={12} className="shrink-0" style={{ color: '#ef4444' }} />
                    ) : (
                      <Clock
                        size={12}
                        className="shrink-0"
                        style={{ color: 'var(--text-secondary)' }}
                      />
                    )}
                    <p className="truncate text-sm font-medium" style={{ color: 'var(--text)' }}>
                      {task.title}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {task.due_date && (
                      <span
                        className="text-xs"
                        style={{ color: isOverdue ? '#ef4444' : 'var(--text-secondary)' }}
                      >
                        {fmtDate(task.due_date)}
                      </span>
                    )}
                    <span
                      className="rounded px-1.5 py-0.5 text-[10px] font-medium"
                      style={{
                        background: `${taskStatusColor(task.status)}20`,
                        color: taskStatusColor(task.status),
                      }}
                    >
                      {task.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent assets */}
      {!loading && recentAssets.length > 0 && (
        <div
          className="rounded-2xl border p-5"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderOpen size={15} style={{ color: 'var(--accent)' }} />
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                Recent Assets
              </h3>
            </div>
            <Link
              href={`/clients/${slug}/assets`}
              className="text-xs transition-opacity hover:opacity-70"
              style={{ color: 'var(--accent)' }}
            >
              View all
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
                    <FolderOpen size={20} style={{ color: 'var(--text-secondary)' }} />
                  </div>
                )}
                <div className="px-2 py-1.5">
                  <p className="truncate text-xs font-medium" style={{ color: 'var(--text)' }}>
                    {asset.name}
                  </p>
                  <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                    {fmtDate(asset.created_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent content */}
      {!loading && recentContent.length > 0 && (
        <div
          className="rounded-2xl border p-5"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText size={15} style={{ color: 'var(--accent)' }} />
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                Recent Content
              </h3>
            </div>
            <Link
              href={`/clients/${slug}/content`}
              className="text-xs transition-opacity hover:opacity-70"
              style={{ color: 'var(--accent)' }}
            >
              View all
            </Link>
          </div>
          <div className="space-y-2">
            {recentContent.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-xl px-3 py-2"
                style={{ background: 'var(--surface-2)' }}
              >
                <p className="truncate text-sm font-medium" style={{ color: 'var(--text)' }}>
                  {item.title}
                </p>
                <span
                  className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium"
                  style={{
                    background:
                      item.status === 'published'
                        ? 'rgba(8,145,178,0.12)'
                        : item.status === 'scheduled'
                          ? 'rgba(124,58,237,0.12)'
                          : 'rgba(156,163,175,0.12)',
                    color:
                      item.status === 'published'
                        ? '#0891b2'
                        : item.status === 'scheduled'
                          ? '#7c3aed'
                          : '#9ca3af',
                  }}
                >
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
