'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AlertCircle, CheckSquare, Clock, FileText, FolderOpen } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { useClientWorkspace } from '../client-context';
import supabase from '@/lib/supabase';
import { useLang } from '@/context/lang-context';
import type { Asset, ContentItem, Task } from '@/lib/types';

function fmtDate(d?: string) {
  if (!d) return '';
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function taskStatusColorClass(status: string) {
  if (status === 'done' || status === 'completed') return 'bg-success/15 text-success';
  if (status === 'overdue') return 'bg-danger/15 text-danger';
  if (status === 'in_progress') return 'bg-accent/15 text-accent';
  return 'bg-elevated text-secondary';
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
      setCounts({
        tasks: tk.status === 'fulfilled' ? (tk.value.count ?? 0) : 0,
        assets: ast.status === 'fulfilled' ? (ast.value.count ?? 0) : 0,
        content: ct.status === 'fulfilled' ? (ct.value.count ?? 0) : 0,
      });
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
      {client.notes ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('notes')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-secondary">{client.notes}</p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {loading
          ? Array.from({ length: 3 }).map((_, index) => (
              <Card key={index}>
                <CardContent>
                  <div className="h-24 animate-pulse rounded-control bg-elevated" />
                </CardContent>
              </Card>
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
              <Link key={label} href={href}>
                <Card className="text-center hover:border-accent">
                  <CardContent className="space-y-1">
                    <div className="flex justify-center text-accent">{icon}</div>
                    <p className="text-2xl font-bold text-primary">{value}</p>
                    <p className="text-xs text-secondary">{label}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
      </div>

      {!loading && recentTasks.length > 0 ? (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div className="flex items-center gap-2 text-primary">
              <CheckSquare size={15} className="text-accent" />
              <CardTitle>Active Tasks</CardTitle>
            </div>
            <Link
              href={`/clients/${slug}/tasks`}
              className="text-xs text-accent hover:text-accent-hover"
            >
              View all
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentTasks.map((task) => {
              const isOverdue =
                task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done';
              return (
                <div
                  key={task.id}
                  className="flex items-center justify-between gap-3 rounded-control bg-elevated px-3 py-2"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    {isOverdue ? (
                      <AlertCircle size={12} className="shrink-0 text-danger" />
                    ) : (
                      <Clock size={12} className="shrink-0 text-secondary" />
                    )}
                    <p className="truncate text-sm font-medium text-primary">{task.title}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {task.due_date ? (
                      <span className={`text-xs ${isOverdue ? 'text-danger' : 'text-secondary'}`}>
                        {fmtDate(task.due_date)}
                      </span>
                    ) : null}
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${taskStatusColorClass(task.status)}`}
                    >
                      {task.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}

      {!loading && recentAssets.length > 0 ? (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderOpen size={15} className="text-accent" />
              <CardTitle>Recent Assets</CardTitle>
            </div>
            <Link
              href={`/clients/${slug}/assets`}
              className="text-xs text-accent hover:text-accent-hover"
            >
              View all
            </Link>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {recentAssets.map((asset) => (
              <div
                key={asset.id}
                className="overflow-hidden rounded-control border border-border bg-elevated"
              >
                {(asset.thumbnail_url ??
                asset.preview_url ??
                (asset.file_type?.startsWith('image/') ? asset.file_url : null)) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={asset.thumbnail_url ?? asset.preview_url ?? asset.file_url}
                    alt={asset.name}
                    className="aspect-square w-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div className="flex aspect-square w-full items-center justify-center bg-surface">
                    <FolderOpen size={20} className="text-secondary" />
                  </div>
                )}
                <div className="px-2 py-1.5">
                  <p className="truncate text-xs font-medium text-primary">{asset.name}</p>
                  <p className="text-[10px] text-secondary">{fmtDate(asset.created_at)}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {!loading && recentContent.length > 0 ? (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText size={15} className="text-accent" />
              <CardTitle>Recent Content</CardTitle>
            </div>
            <Link
              href={`/clients/${slug}/content`}
              className="text-xs text-accent hover:text-accent-hover"
            >
              View all
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentContent.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-control bg-elevated px-3 py-2"
              >
                <p className="truncate text-sm font-medium text-primary">{item.title}</p>
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                    item.status === 'published'
                      ? 'bg-success/15 text-success'
                      : item.status === 'scheduled'
                        ? 'bg-accent/15 text-accent'
                        : 'bg-muted text-secondary'
                  }`}
                >
                  {item.status}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
