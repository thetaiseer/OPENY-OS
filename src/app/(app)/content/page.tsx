'use client';

import { useState, useCallback, useEffect, Suspense } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FileText, Plus, Search, Trash2, ChevronRight,
  Instagram, Linkedin, Youtube, Globe,
} from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/context/toast-context';
import type { ContentItem, ContentItemStatus, Client } from '@/lib/types';
import { createClient as createSupabase } from '@/lib/supabase/client';
import { useQuickActions } from '@/context/quick-actions-context';
import NewContentModal from '@/components/content/NewContentModal';

// ── Status config ──────────────────────────────────────────────────────────────

const STATUS_PIPELINE: { status: ContentItemStatus; label: string; color: string; bg: string }[] = [
  { status: 'draft',          label: 'Draft',          color: '#9ca3af', bg: 'rgba(156,163,175,0.1)' },
  { status: 'pending_review', label: 'In Review',      color: '#d97706', bg: 'rgba(217,119,6,0.1)'   },
  { status: 'approved',       label: 'Approved',       color: '#16a34a', bg: 'rgba(22,163,74,0.1)'   },
  { status: 'scheduled',      label: 'Scheduled',      color: '#7c3aed', bg: 'rgba(124,58,237,0.1)'  },
  { status: 'published',      label: 'Published',      color: '#0891b2', bg: 'rgba(8,145,178,0.1)'   },
  { status: 'rejected',       label: 'Rejected',       color: '#ef4444', bg: 'rgba(239,68,68,0.1)'   },
];

function getStatusCfg(status: ContentItemStatus) {
  return STATUS_PIPELINE.find(s => s.status === status) ?? STATUS_PIPELINE[0];
}

function StatusBadge({ status }: { status: ContentItemStatus }) {
  const cfg = getStatusCfg(status);
  return (
    <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  );
}

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  instagram: <Instagram size={12} />,
  linkedin:  <Linkedin size={12} />,
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
    <div className="rounded-2xl border p-4 flex flex-col gap-3" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>{item.title}</p>
          {item.client && <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{item.client.name}</p>}
        </div>
        <StatusBadge status={item.status} />
      </div>

      {item.caption && (
        <p className="text-xs line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{item.caption}</p>
      )}

      {item.platform_targets && item.platform_targets.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {item.platform_targets.map(p => (
            <span key={p} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
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
            <button
              onClick={() => onStatusChange(item.id, nextStatus)}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg font-medium"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              <ChevronRight size={12} /> {getStatusCfg(nextStatus).label}
            </button>
          )}
          {item.status !== 'rejected' && (
            <button
              onClick={() => onStatusChange(item.id, 'rejected')}
              className="text-xs px-2 py-1 rounded-lg font-medium"
              style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}
            >
              Reject
            </button>
          )}
          {onDelete && (
            <button onClick={() => onDelete(item.id)} className="p-1 rounded hover:opacity-70">
              <Trash2 size={13} style={{ color: 'var(--text-secondary)' }} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

function ContentPage() {
  const { registerQuickActionHandler } = useQuickActions();
  const { role } = useAuth();
  const canDeleteContent = role === 'admin' || role === 'owner';
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newOpen,   setNewOpen]   = useState(false);
  const [search,    setSearch]    = useState('');
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

  const items   = itemsData?.items  ?? [];
  const clients = clientsData?.data ?? [];

  const filtered = items.filter(item =>
    !search.trim() || item.title.toLowerCase().includes(search.toLowerCase()),
  );

  const prependContentItemToCache = useCallback((item: ContentItem) => {
    queryClient.setQueryData<{ success: boolean; items: ContentItem[] }>(
      ['content-items', clientFilter, statusFilter],
      old => {
        if (!old) return old;
        const existingIndex = old.items.findIndex(existing => existing.id === item.id);
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
  }, [clientFilter, queryClient, statusFilter]);

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
      const json = await res.json() as { success: boolean };
      if (!json.success) throw new Error('Update failed');
      void queryClient.invalidateQueries({ queryKey: ['content-items', clientFilter, statusFilter] });
      toast(`Status updated to ${status}`, 'success');
    } catch {
      toast('Failed to update status', 'error');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this content item?')) return;
    try {
      const res = await fetch(`/api/content-items/${id}`, { method: 'DELETE' });
      const json = await res.json() as { success: boolean };
      if (!json.success) throw new Error('Delete failed');
      queryClient.setQueryData<{ success: boolean; items: ContentItem[] }>(
        ['content-items', clientFilter, statusFilter],
        old => old ? { ...old, items: old.items.filter(item => item.id !== id) } : old,
      );
      void queryClient.invalidateQueries({ queryKey: ['content-items', clientFilter, statusFilter] });
      toast('Content item deleted', 'success');
    } catch {
      toast('Failed to delete', 'error');
    }
  }

  // Group by status for pipeline view
  const grouped = STATUS_PIPELINE.reduce<Record<string, ContentItem[]>>((acc, s) => {
    acc[s.status] = filtered.filter(item => item.status === s.status);
    return acc;
  }, {});

  return (
    <div className="app-page-shell max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="app-page-header">
        <div>
          <h1 className="app-page-title">Content Items</h1>
          <p className="app-page-subtitle">
            Manage your content pipeline from draft to published
          </p>
        </div>
        {(role === 'admin' || role === 'manager' || role === 'team_member') && (
          <button
            onClick={() => setNewOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: 'var(--accent)' }}
          >
            <Plus size={16} /> New Content
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-secondary)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search content\u2026"
            className="h-9 pl-8 pr-3 rounded-lg border text-sm"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)', minWidth: 200 }}
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="h-9 px-3 rounded-lg border text-sm"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
        >
          <option value="">All Statuses</option>
          {STATUS_PIPELINE.map(s => <option key={s.status} value={s.status}>{s.label}</option>)}
        </select>
        <select
          value={clientFilter}
          onChange={e => setClientFilter(e.target.value)}
          className="h-9 px-3 rounded-lg border text-sm"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
        >
          <option value="">All Clients</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Pipeline columns */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="rounded-2xl h-48 animate-pulse" style={{ background: 'var(--surface)' }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border p-16 text-center" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <FileText size={36} className="mx-auto mb-3 opacity-30" style={{ color: 'var(--text-secondary)' }} />
          <p className="text-base font-medium" style={{ color: 'var(--text)' }}>No content items yet</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Click &ldquo;New Content&rdquo; to start your pipeline
          </p>
        </div>
      ) : (
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-start"
          role="region"
          aria-label="Content status pipeline"
        >
          {STATUS_PIPELINE.filter(s => grouped[s.status]?.length > 0).map(s => (
            <div key={s.status} className="space-y-3" role="list" aria-label={`${s.label} items`}>
              <div className="flex items-center justify-between" role="heading" aria-level={2}>
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: s.color }}>{s.label}</span>
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: s.bg, color: s.color }}>{grouped[s.status].length}</span>
              </div>
              {grouped[s.status].map(item => (
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
          void queryClient.invalidateQueries({ queryKey: ['content-items', clientFilter, statusFilter] });
        }}
      />
    </div>
  );
}

export default function ContentPageWrapper() {
  return (
    <Suspense>
      <ContentPage />
    </Suspense>
  );
}
