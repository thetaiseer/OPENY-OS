'use client';

import { useState, useCallback, Suspense } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, ChevronRight, Instagram, Linkedin, Youtube, Globe } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/context/toast-context';
import type { ContentItem, ContentItemStatus, Client } from '@/lib/types';
import { createClient as createSupabase } from '@/lib/supabase/client';
import NewContentModal from '@/components/content/NewContentModal';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import SelectDropdown from '@/components/ui/SelectDropdown';
import { PageShell, PageHeader } from '@/components/layout/PageLayout';
import { useLang } from '@/context/lang-context';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/states';
import EntityActionsMenu from '@/components/ui/actions/EntityActionsMenu';
import ConfirmDialog from '@/components/ui/actions/ConfirmDialog';
import { useDeleteContentItem } from '@/hooks/mutations/useDeleteContentItem';

// ── Status config ──────────────────────────────────────────────────────────────

const STATUS_DEF: readonly {
  status: ContentItemStatus;
  labelKey: string;
  color: string;
  bg: string;
}[] = [
  {
    status: 'draft',
    labelKey: 'contentStatusDraft',
    color: '#9ca3af',
    bg: 'rgba(156,163,175,0.1)',
  },
  {
    status: 'pending_review',
    labelKey: 'contentStatusInReview',
    color: '#d97706',
    bg: 'rgba(217,119,6,0.1)',
  },
  {
    status: 'approved',
    labelKey: 'contentStatusApproved',
    color: '#16a34a',
    bg: 'rgba(22,163,74,0.1)',
  },
  {
    status: 'scheduled',
    labelKey: 'contentStatusScheduled',
    color: '#7c3aed',
    bg: 'rgba(124,58,237,0.1)',
  },
  {
    status: 'published',
    labelKey: 'contentStatusPublished',
    color: '#0891b2',
    bg: 'rgba(8,145,178,0.1)',
  },
  {
    status: 'rejected',
    labelKey: 'contentStatusRejected',
    color: '#ef4444',
    bg: 'rgba(239,68,68,0.1)',
  },
];

function getStatusCfg(status: ContentItemStatus) {
  return STATUS_DEF.find((s) => s.status === status) ?? STATUS_DEF[0];
}

function StatusBadge({ status }: { status: ContentItemStatus }) {
  const { t } = useLang();
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
      {t(cfg.labelKey)}
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
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  isDeleting?: boolean;
}

function ContentCard({
  item,
  onStatusChange,
  onEdit,
  onDelete,
  isDeleting = false,
}: ContentCardProps) {
  const { t } = useLang();
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
              <ChevronRight size={12} className="rtl:rotate-180" />{' '}
              {t(getStatusCfg(nextStatus).labelKey)}
            </Button>
          )}
          {item.status !== 'rejected' && (
            <Button
              type="button"
              variant="danger"
              className="h-7 min-h-0 px-2 py-1 text-xs"
              onClick={() => onStatusChange(item.id, 'rejected')}
            >
              {t('reject')}
            </Button>
          )}
          {onDelete || onEdit ? (
            <EntityActionsMenu
              loading={isDeleting}
              onEdit={onEdit ? () => onEdit(item.id) : undefined}
              onDelete={onDelete ? () => onDelete(item.id) : undefined}
              editLabel={t('editAction')}
              deleteLabel={t('deleteAction')}
            />
          ) : null}
        </div>
      </div>
    </Card>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

function ContentPage() {
  const { role } = useAuth();
  const { t } = useLang();
  const canDeleteContent = role === 'owner' || role === 'admin' || role === 'manager';
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newOpen, setNewOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [clientFilter, setClientFilter] = useState<string>('');
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const deleteContentItemMutation = useDeleteContentItem();

  const {
    data: itemsData,
    isLoading,
    error: itemsError,
    refetch: refetchItems,
  } = useQuery<{ success: boolean; items: ContentItem[] }>({
    queryKey: ['content-items', clientFilter, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (clientFilter) params.set('client_id', clientFilter);
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/content-items?${params}`);
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      const json = (await res.json()) as { success: boolean; items: ContentItem[]; error?: string };
      if (!json.success) throw new Error(json.error ?? 'Failed to load content');
      return json;
    },
    staleTime: 30_000,
    retry: 1,
  });

  const { data: clientsData } = useQuery<{ data: Client[] }>({
    queryKey: ['clients', 1, 100, ''],
    queryFn: async () => {
      const sb = createSupabase();
      const { data } = await sb.from('clients').select('id, name').order('name');
      return { data: (data ?? []) as Client[] };
    },
    staleTime: 60_000,
    retry: 1,
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
      toast(t('statusUpdatedToast'), 'success');
    } catch {
      toast(t('failedUpdateStatusToast'), 'error');
    }
  }

  async function handleDelete(id: string) {
    setDeletingItemId(id);
    try {
      await deleteContentItemMutation.mutateAsync(id);
    } catch (err) {
      toast(err instanceof Error ? err.message : t('failedDeleteToast'), 'error');
    } finally {
      setDeletingItemId((current) => (current === id ? null : current));
    }
  }

  // Group by status for pipeline view
  const grouped = STATUS_DEF.reduce<Record<string, ContentItem[]>>((acc, s) => {
    acc[s.status] = filtered.filter((item) => item.status === s.status);
    return acc;
  }, {});

  return (
    <PageShell className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title={t('contentItemsTitle')}
        subtitle={t('contentItemsSubtitle')}
        actions={
          role === 'owner' || role === 'admin' || role === 'manager' || role === 'team_member' ? (
            <Button type="button" variant="primary" onClick={() => setNewOpen(true)}>
              <Plus size={16} /> {t('newContent')}
            </Button>
          ) : undefined
        }
      />

      <Card padding="sm" className="sm:p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search
              size={14}
              className="pointer-events-none absolute start-3 top-1/2 z-[1] -translate-y-1/2 text-[var(--text-secondary)]"
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('searchContentPlaceholder')}
              className="min-w-0 ps-9"
              aria-label={t('searchContentAria')}
            />
          </div>
          <SelectDropdown
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: '', label: t('allStatuses') },
              ...STATUS_DEF.map((s) => ({ value: s.status, label: t(s.labelKey) })),
            ]}
          />
          <SelectDropdown
            value={clientFilter}
            onChange={setClientFilter}
            options={[
              { value: '', label: t('allClients') },
              ...clients.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
        </div>
      </Card>

      {/* Pipeline columns */}
      {isLoading ? (
        <LoadingState rows={6} cardHeightClass="h-48" className="grid-cols-2 lg:grid-cols-3" />
      ) : itemsError ? (
        <ErrorState
          title={t('contentItemsTitle')}
          description={(itemsError as Error).message}
          actionLabel={t('assetsRetry')}
          onAction={() => void refetchItems()}
        />
      ) : filtered.length === 0 ? (
        <EmptyState title={t('noContentItemsYet')} description={t('noContentItemsDesc')} />
      ) : (
        <div
          className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-3"
          role="region"
          aria-label={t('contentPipelineAria')}
        >
          {STATUS_DEF.filter((s) => grouped[s.status]?.length > 0).map((s) => (
            <div
              key={s.status}
              className="space-y-3"
              role="list"
              aria-label={`${t(s.labelKey)} items`}
            >
              <div className="flex items-center justify-between" role="heading" aria-level={2}>
                <span
                  className="text-xs font-semibold uppercase tracking-wider"
                  style={{ color: s.color }}
                >
                  {t(s.labelKey)}
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
                    onDelete={canDeleteContent ? (id) => setPendingDeleteId(id) : undefined}
                    isDeleting={deletingItemId === item.id}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pendingDeleteId)}
        title={t('deleteAction')}
        description={t('confirmDeleteContentItem')}
        confirmLabel={t('deleteAction')}
        cancelLabel={t('cancel')}
        destructive
        loading={Boolean(pendingDeleteId) && deletingItemId === pendingDeleteId}
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={async () => {
          if (!pendingDeleteId) return;
          await handleDelete(pendingDeleteId);
          setPendingDeleteId(null);
        }}
      />

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
