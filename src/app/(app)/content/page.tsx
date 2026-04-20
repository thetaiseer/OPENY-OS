'use client';

import { useState, useCallback, useEffect, Suspense } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText, Plus, Search, Filter, Pencil, Trash2, ChevronRight,
  Instagram, Linkedin, Youtube, Globe, CheckCircle, Clock, AlertCircle, XCircle, Send,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import type { ContentItem, ContentItemStatus, Client } from '@/lib/types';
import { createClient as createSupabase } from '@/lib/supabase/client';

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

// ── New Content Modal ──────────────────────────────────────────────────────────

interface NewContentModalProps {
  open: boolean;
  onClose: () => void;
  clients: Client[];
  onCreated: (item: ContentItem) => void;
}

const PLATFORMS = ['instagram', 'facebook', 'tiktok', 'linkedin', 'twitter', 'snapchat', 'youtube_shorts'];
const PURPOSES  = ['awareness', 'engagement', 'promotion', 'branding', 'lead_generation', 'announcement', 'offer_campaign'];

function NewContentModal({ open, onClose, clients, onCreated }: NewContentModalProps) {
  const { toast } = useToast();
  const [title,     setTitle]     = useState('');
  const [clientId,  setClientId]  = useState('');
  const [caption,   setCaption]   = useState('');
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [purpose,   setPurpose]   = useState('');
  const [saving,    setSaving]    = useState(false);

  if (!open) return null;

  function togglePlatform(p: string) {
    setPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { toast('Title is required', 'error'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/content-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, client_id: clientId || null, caption, platform_targets: platforms, purpose: purpose || null, status: 'draft' }),
      });
      const json = await res.json() as { success: boolean; item?: ContentItem; error?: string };
      if (!json.success) throw new Error(json.error ?? 'Failed to create');
      toast('Content item created', 'success');
      onCreated(json.item!);
      onClose();
      setTitle(''); setClientId(''); setCaption(''); setPlatforms([]); setPurpose('');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to create', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>New Content Item</h2>
          <button onClick={onClose} className="p-1 rounded hover:opacity-70"><XCircle size={18} style={{ color: 'var(--text-secondary)' }} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>Title *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. May Campaign — Instagram Reel" required
              className="w-full h-9 rounded-lg px-3 text-sm border" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>Client</label>
            <select value={clientId} onChange={e => setClientId(e.target.value)}
              className="w-full h-9 rounded-lg px-3 text-sm border" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }}>
              <option value="">— No client —</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>Caption / Copy</label>
            <textarea value={caption} onChange={e => setCaption(e.target.value)} rows={3} placeholder="Write the post caption..."
              className="w-full rounded-lg px-3 py-2 text-sm border resize-none" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          </div>
          <div>
            <label className="text-xs font-medium mb-2 block" style={{ color: 'var(--text-secondary)' }}>Target Platforms</label>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map(p => (
                <button key={p} type="button" onClick={() => togglePlatform(p)}
                  className="px-3 py-1 rounded-full text-xs font-medium border transition-colors"
                  style={platforms.includes(p)
                    ? { background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' }
                    : { background: 'var(--surface-2)', color: 'var(--text-secondary)', borderColor: 'var(--border)' }}>
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>Purpose</label>
            <select value={purpose} onChange={e => setPurpose(e.target.value)}
              className="w-full h-9 rounded-lg px-3 text-sm border" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }}>
              <option value="">— Select purpose —</option>
              {PURPOSES.map(p => <option key={p} value={p}>{p.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50" style={{ background: 'var(--accent)' }}>
              {saving ? 'Creating\u2026' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
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
    if (searchParams.get('quickAction') !== 'add-content') return;
    setNewOpen(true);
    const params = new URLSearchParams(searchParams.toString());
    params.delete('quickAction');
    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
  }, [pathname, router, searchParams, setNewOpen]);

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
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Content Items</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
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
