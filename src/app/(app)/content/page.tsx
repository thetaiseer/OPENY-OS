'use client';

import { useState, useCallback, useEffect, Suspense } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  Plus,
  Search,
  Trash2,
  ChevronRight,
  Instagram,
  Linkedin,
  Youtube,
  Globe,
} from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/context/toast-context';
import type { ContentItem, ContentItemStatus, Client } from '@/lib/types';
import { createClient as createSupabase } from '@/lib/supabase/client';
import { useQuickActions } from '@/context/quick-actions-context';
import NewContentModal from '@/components/content/NewContentModal';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import SelectDropdown from '@/components/ui/SelectDropdown';
import { PageShell, PageHeader } from '@/components/layout/PageLayout';

// ── Status config ──────────────────────────────────────────────────────────────

const STATUS_PIPELINE: { status: ContentItemStatus; label: string; color: string; bg: string }[] = [
  { status: 'draft', label: 'Draft', color: '#9ca3af', bg: 'rgba(156,163,175,0.1)' },
  { status: 'pending_review', label: 'In Review', color: '#d97706', bg: 'rgba(217,119,6,0.1)' },
  { status: 'approved', label: 'Approved', color: '#16a34a', bg: 'rgba(22,163,74,0.1)' },
  { status: 'scheduled', label: 'Scheduled', color: '#7c3aed', bg: 'rgba(124,58,237,0.1)' },
  { status: 'published', label: 'Published', color: '#0891b2', bg: 'rgba(8,145,178,0.1)' },
  { status: 'rejected', label: 'Rejected', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
];

function getStatusCfg(status: ContentItemStatus) {
  return STATUS_PIPELINE.find((s) => s.status === status) ?? STATUS_PIPELINE[0];
}

function StatusBadge({ status }: { status: ContentItemStatus }) {
  const cfg = getStatusCfg(status);
  const variant =
    status === 'published' || status === 'approved'
      ? 'success'
      : status === 'scheduled'
        ? 'info'
        : status === 'pending_review'
          ? 'warning'
          : status === 'rejected'
            ? 'danger'
            : 'default';
  return (
    <Badge variant={variant} className="text-xs">
      {cfg.label}
    </Badge>
  );
}

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  instagram: <Instagram size={12} />,
  linkedin: <Linkedin size={12} />,
  youtube_shorts: <Youtube size={12} />,
};

// ── Content Card ──────────────────────────────────────────────────────────────

interface ContentCardProps {
  item: ContentItem;
  onStatusChange: (id: string, status: ContentItemStatus) => void;
  onDelete?: (id: string) => void;
}

function ContentCard({ item, onStatusChange, onDelete }: ContentCardProps) {
  const nextStatuses: Partial<Record<ContentItemStatus, ContentItemStatus>> = {
    draft: 'pending_review',
    pending_review: 'approved',
    approved: 'scheduled',
    scheduled: 'published',
  };

  const nextStatus = nextStatuses[item.status];

  return (
    <Card padding="md" className="flex flex-col gap-3 !p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold" style={{ color: 'var(--text)' }}>
            {item.title}
          </p>
          {item.client && (
            <p className="mt-0.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
              {item.client.name}
            </p>
          )}
        </div>
        <StatusBadge status={item.status} />
      </div>

      {item.caption && (
        <p className="line-clamp-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
          {item.caption}
        </p>
      )}

      {item.platform_targets && item.platform_targets.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {item.platform_targets.map((p) => (
            <span
              key={p}
              className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
              style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
            >
              {PLATFORM_ICONS[p] ?? <Globe size={10} />} {p}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-1">
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          {new Date(item.created_at).toLocaleDateString()}
        </p>
        <div className="flex items-center gap-2">
          {nextStatus && (
            <Button
              type="button"
              variant="primary"
              className="h-7 min-h-0 gap-1 px-2 py-1 text-xs"
              onClick={() => onStatusChange(item.id, nextStatus)}
            >
              <ChevronRight size={12} /> {getStatusCfg(nextStatus).label}
            </Button>
          )}
          {item.status !== 'rejected' && (
            <Button
              type="button"
              variant="danger"
              className="h-7 min-h-0 px-2 py-1 text-xs"
              onClick={() => onStatusChange(item.id, 'rejected')}
            >
              Reject
            </Button>
          )}
          {onDelete && (
            <Button
              type="button"
              variant="ghost"
              className="h-7 min-h-0 w-7 p-0"
              onClick={() => onDelete(item.id)}
              aria-label="Delete"
            >
              <Trash2 size={13} />
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

function ContentPage() {
  const { registerQuickActionHandler } = useQuickActions();
  const { role } = useAuth();
  const canDeleteContent = role === 'admin' || role === 'owner';
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newOpen, setNewOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [clientFilter, setClientFilter] = useState<string>('');

  const { data: itemsData, isLoading } = useQuery<{ success: boolean; items: ContentItem[] }>({
    queryKey: ['content-items', clientFilter, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (clientFilter) params.set('client_id', clientFilter);
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/content-items?${params}`);
      return res.json() as Promise<{ success: boolean; items: ContentItem[] }>;
    },
    staleTime: 30_000,
  });

  const { data: clientsData } = useQuery<{ data: Client[] }>({
    queryKey: ['clients', 1, 100, ''],
    queryFn: async () => {
      const sb = createSupabase();
      const { data } = await sb.from('clients').select('id, name').order('name');
      return { data: (data ?? []) as Client[] };
    },
    staleTime: 60_000,
  });

  const items = itemsData?.items ?? [];
  const clients = clientsData?.data ?? [];

  const filtered = items.filter(
    (item) => !search.trim() || item.title.toLowerCase().includes(search.toLowerCase()),
  );

  const prependContentItemToCache = useCallback(
    (item: ContentItem) => {
      queryClient.setQueryData<{ success: boolean; items: ContentItem[] }>(
        ['content-items', clientFilter, statusFilter],
        (old) => {
          if (!old) return old;
          const existingIndex = old.items.findIndex((existing) => existing.id === item.id);
          if (existingIndex === -1) {
            return { ...old, items: [item, ...old.items] };
          }
          const nextItems = [...old.items];
          nextItems.splice(existingIndex, 1);
          return {
            ...old,
            items: [item, ...nextItems],
          };
        },
      );
    },
    [clientFilter, queryClient, statusFilter],
  );

  useEffect(() => {
    return registerQuickActionHandler('add-content', () => {
      setNewOpen(true);
    });
  }, [registerQuickActionHandler, setNewOpen]);

  async function handleStatusChange(id: string, status: ContentItemStatus) {
    try {
      const res = await fetch(`/api/content-items/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const json = (await res.json()) as { success: boolean };
      if (!json.success) throw new Error('Update failed');
      void queryClient.invalidateQueries({
        queryKey: ['content-items', clientFilter, statusFilter],
      });
      toast(`Status updated to ${status}`, 'success');
    } catch {
      toast('Failed to update status', 'error');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this content item?')) return;
    try {
      const res = await fetch(`/api/content-items/${id}`, { method: 'DELETE' });
      const json = (await res.json()) as { success: boolean };
      if (!json.success) throw new Error('Delete failed');
      queryClient.setQueryData<{ success: boolean; items: ContentItem[] }>(
        ['content-items', clientFilter, statusFilter],
        (old) => (old ? { ...old, items: old.items.filter((item) => item.id !== id) } : old),
      );
      void queryClient.invalidateQueries({
        queryKey: ['content-items', clientFilter, statusFilter],
      });
      toast('Content item deleted', 'success');
    } catch {
      toast('Failed to delete', 'error');
    }
  }

  // Group by status for pipeline view
  const grouped = STATUS_PIPELINE.reduce<Record<string, ContentItem[]>>((acc, s) => {
    acc[s.status] = filtered.filter((item) => item.status === s.status);
    return acc;
  }, {});

  return (
    <PageShell className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Content Items"
        subtitle="Manage your content pipeline from draft to published"
        actions={
          role === 'admin' || role === 'manager' || role === 'team_member' ? (
            <Button type="button" variant="primary" onClick={() => setNewOpen(true)}>
              <Plus size={16} /> New Content
            </Button>
          ) : undefined
        }
      />

      <Card padding="sm" className="sm:p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 z-[1] -translate-y-1/2 text-[var(--text-secondary)]"
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search content\u2026"
              className="min-w-0 pl-9"
              aria-label="Search content"
            />
          </div>
          <SelectDropdown
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: '', label: 'All Statuses' },
              ...STATUS_PIPELINE.map((s) => ({ value: s.status, label: s.label })),
            ]}
          />
          <SelectDropdown
            value={clientFilter}
            onChange={setClientFilter}
            options={[
              { value: '', label: 'All Clients' },
              ...clients.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
        </div>
      </Card>

      {/* Pipeline columns */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-48 animate-pulse rounded-2xl bg-[var(--surface)]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card padding="md" className="p-16 text-center">
          <FileText size={36} className="mx-auto mb-3 text-[var(--text-secondary)] opacity-30" />
          <p className="text-base font-medium text-[var(--text)]">No content items yet</p>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Click &ldquo;New Content&rdquo; to start your pipeline
          </p>
        </Card>
      ) : (
        <div
          className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-3"
          role="region"
          aria-label="Content status pipeline"
        >
          {STATUS_PIPELINE.filter((s) => grouped[s.status]?.length > 0).map((s) => (
            <div key={s.status} className="space-y-3" role="list" aria-label={`${s.label} items`}>
              <div className="flex items-center justify-between" role="heading" aria-level={2}>
                <span
                  className="text-xs font-semibold uppercase tracking-wider"
                  style={{ color: s.color }}
                >
                  {s.label}
                </span>
                <span
                  className="rounded-full px-2 py-0.5 text-xs"
                  style={{ background: s.bg, color: s.color }}
                >
                  {grouped[s.status].length}
                </span>
              </div>
              {grouped[s.status].map((item) => (
                <div key={item.id} role="listitem">
                  <ContentCard
                    item={item}
                    onStatusChange={handleStatusChange}
                    onDelete={canDeleteContent ? handleDelete : undefined}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      <NewContentModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        clients={clients}
        onCreated={(item) => {
          prependContentItemToCache(item);
          void queryClient.invalidateQueries({
            queryKey: ['content-items', clientFilter, statusFilter],
          });
        }}
      />
    </PageShell>
  );
}

export default function ContentPageWrapper() {
  return (
    <Suspense>
      <ContentPage />
    </Suspense>
  );
}
