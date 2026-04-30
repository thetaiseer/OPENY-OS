'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  CheckSquare,
  FolderOpen,
  FileText,
  Clock,
  AlertCircle,
  Receipt,
  FileSignature,
} from 'lucide-react';
import { useClientWorkspace } from '../client-context';
import supabase from '@/lib/supabase';
import { useLang } from '@/context/lang-context';
import type { Task, Asset, ContentItem } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import Skeleton from '@/components/ui/Skeleton';

function fmtDate(d?: string) {
  if (!d) return '';
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function ClientOverviewPage() {
  const { client, clientId } = useClientWorkspace();
  const { slug } = useParams<{ slug: string }>();
  const { t } = useLang();

  const [counts, setCounts] = useState({ tasks: 0, assets: 0, content: 0, docs: 0 });
  const [recentTasks, setRecentTasks] = useState<Task[]>([]);
  const [recentAssets, setRecentAssets] = useState<Asset[]>([]);
  const [recentContent, setRecentContent] = useState<ContentItem[]>([]);
  const [recentDocs, setRecentDocs] = useState<
    {
      id: string;
      title: string;
      type: 'invoice' | 'quotation' | 'contract';
      created_at?: string | null;
    }[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clientId || !client?.name) return;
    void (async () => {
      const [tk, ast, ct, rtk, rast, rct, inv, quo, ctr] = await Promise.allSettled([
        supabase
          .from('tasks')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', clientId),
        supabase
          .from('assets')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', clientId)
          .is('deleted_at', null)
          .or('is_deleted.is.null,is_deleted.eq.false')
          .or('missing_in_storage.is.null,missing_in_storage.eq.false'),
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
          .is('deleted_at', null)
          .or('is_deleted.is.null,is_deleted.eq.false')
          .or('missing_in_storage.is.null,missing_in_storage.eq.false')
          .order('created_at', { ascending: false })
          .limit(4),
        supabase
          .from('content_items')
          .select('id,title,status,created_at')
          .eq('client_id', clientId)
          .order('created_at', { ascending: false })
          .limit(4),
        supabase
          .from('docs_invoices')
          .select('id,invoice_number,created_at')
          .ilike('client_name', `%${client.name}%`)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('docs_quotations')
          .select('id,quote_number,created_at')
          .ilike('client_name', `%${client.name}%`)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('docs_client_contracts')
          .select('id,contract_number,created_at')
          .ilike('party2_client_name', `%${client.name}%`)
          .order('created_at', { ascending: false })
          .limit(5),
      ]);
      const taskCount = tk.status === 'fulfilled' ? (tk.value.count ?? 0) : 0;
      const assetCount = ast.status === 'fulfilled' ? (ast.value.count ?? 0) : 0;
      const contentCount = ct.status === 'fulfilled' ? (ct.value.count ?? 0) : 0;
      const invoiceRows =
        inv.status === 'fulfilled' && !inv.value.error
          ? ((inv.value.data ?? []) as {
              id: string;
              invoice_number?: string;
              created_at?: string;
            }[])
          : [];
      const quotationRows =
        quo.status === 'fulfilled' && !quo.value.error
          ? ((quo.value.data ?? []) as { id: string; quote_number?: string; created_at?: string }[])
          : [];
      const contractRows =
        ctr.status === 'fulfilled' && !ctr.value.error
          ? ((ctr.value.data ?? []) as {
              id: string;
              contract_number?: string;
              created_at?: string;
            }[])
          : [];
      setCounts({
        tasks: taskCount,
        assets: assetCount,
        content: contentCount,
        docs: invoiceRows.length + quotationRows.length + contractRows.length,
      });
      const docs = [
        ...invoiceRows.map((d) => ({
          id: d.id,
          title: d.invoice_number || 'Invoice',
          type: 'invoice' as const,
          created_at: d.created_at ?? null,
        })),
        ...quotationRows.map((d) => ({
          id: d.id,
          title: d.quote_number || 'Quotation',
          type: 'quotation' as const,
          created_at: d.created_at ?? null,
        })),
        ...contractRows.map((d) => ({
          id: d.id,
          title: d.contract_number || 'Client Contract',
          type: 'contract' as const,
          created_at: d.created_at ?? null,
        })),
      ]
        .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
        .slice(0, 4);
      setRecentDocs(docs);
      if (rtk.status === 'fulfilled' && !rtk.value.error)
        setRecentTasks((rtk.value.data ?? []) as Task[]);
      if (rast.status === 'fulfilled' && !rast.value.error)
        setRecentAssets((rast.value.data ?? []) as Asset[]);
      if (rct.status === 'fulfilled' && !rct.value.error)
        setRecentContent((rct.value.data ?? []) as ContentItem[]);
      setLoading(false);
    })();
  }, [clientId, client?.name]);

  if (!client) return null;

  return (
    <div className="space-y-6">
      {client.notes && (
        <Card>
          <CardHeader>
            <CardTitle>{t('notes')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-secondary">{client.notes}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
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
              {
                label: 'Docs',
                value: counts.docs,
                icon: <Receipt size={16} />,
                href: '/docs',
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

      {!loading && recentTasks.length > 0 && (
        <Card>
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
              const overdue =
                task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done';
              return (
                <div
                  key={task.id}
                  className="flex items-center justify-between gap-3 rounded-xl px-3 py-2"
                  style={{ background: 'var(--surface-2)' }}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    {overdue ? (
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
                        style={{ color: overdue ? '#ef4444' : 'var(--text-secondary)' }}
                      >
                        {fmtDate(task.due_date)}
                      </span>
                    )}
                    <Badge variant={overdue ? 'danger' : 'info'} className="text-[10px]">
                      {task.status.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {!loading && recentAssets.length > 0 && (
        <Card>
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
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={asset.thumbnail_url ?? asset.preview_url ?? asset.file_url}
                    alt={asset.name}
                    className="aspect-square w-full object-cover"
                    loading="lazy"
                    decoding="async"
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
        </Card>
      )}

      {!loading && recentContent.length > 0 && (
        <Card>
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
                <Badge
                  variant={
                    item.status === 'published'
                      ? 'success'
                      : item.status === 'scheduled'
                        ? 'info'
                        : 'default'
                  }
                >
                  {item.status}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {!loading && (
        <Card>
          <CardHeader className="mb-4 items-center">
            <div className="flex items-center gap-2">
              <FileSignature size={15} style={{ color: 'var(--accent)' }} />
              <CardTitle className="!text-sm">Linked Docs</CardTitle>
            </div>
            <Link
              href="/docs"
              className="text-xs transition-opacity hover:opacity-70"
              style={{ color: 'var(--accent)' }}
            >
              Open docs
            </Link>
          </CardHeader>
          <CardContent>
            {recentDocs.length === 0 ? (
              <EmptyState
                icon={Receipt}
                title="No linked docs yet"
                description="Invoices, quotations, and contracts matching this client will appear here."
              />
            ) : (
              <div className="space-y-2">
                {recentDocs.map((doc) => (
                  <div
                    key={`${doc.type}-${doc.id}`}
                    className="flex items-center justify-between gap-3 rounded-xl px-3 py-2"
                    style={{ background: 'var(--surface-2)' }}
                  >
                    <p className="truncate text-sm font-medium" style={{ color: 'var(--text)' }}>
                      {doc.title}
                    </p>
                    <div className="flex items-center gap-2">
                      <Badge variant="default">{doc.type}</Badge>
                      <span className="text-xs text-secondary">
                        {fmtDate(doc.created_at ?? undefined)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
