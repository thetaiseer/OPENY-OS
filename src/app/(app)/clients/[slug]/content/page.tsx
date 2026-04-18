'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import supabase from '@/lib/supabase';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import SelectDropdown from '@/components/ui/SelectDropdown';
import AiImproveButton from '@/components/ui/AiImproveButton';
import EmptyState from '@/components/ui/EmptyState';
import { useClientWorkspace } from '../client-context';
import { useToast } from '@/lib/toast-context';
import type { ContentItem, ContentItemStatus } from '@/lib/types';
import { Plus, FileText, Calendar, Search, SlidersHorizontal } from 'lucide-react';

const STATUS_OPTIONS: { value: ContentItemStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'pending_review', label: 'Pending Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'published', label: 'Published' },
];

function statusVariant(status: string) {
  if (status === 'published') return 'success' as const;
  if (status === 'scheduled') return 'info' as const;
  if (status === 'approved') return 'success' as const;
  if (status === 'pending_review') return 'warning' as const;
  if (status === 'rejected') return 'danger' as const;
  return 'default' as const;
}

function fmtDate(date?: string | null) {
  if (!date) return null;
  return new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ClientContentPage() {
  const { clientId } = useClientWorkspace();
  const { toast: addToast } = useToast();
  const searchParams = useSearchParams();

  const [content, setContent] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    title: '', description: '', status: 'draft' as ContentItemStatus, schedule_date: '',
  });
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ContentItemStatus>('all');

  const load = useCallback(async () => {
    if (!clientId) return;
    const { data } = await supabase
      .from('content_items')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(50);

    setContent((data ?? []) as ContentItem[]);
    setLoading(false);
  }, [clientId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (searchParams.get('quickAdd') === '1') {
      setCreateOpen(true);
    }
  }, [searchParams]);

  const filteredContent = useMemo(() => {
    const q = search.trim().toLowerCase();

    return content.filter(item => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (!q) return true;
      return item.title.toLowerCase().includes(q) || item.description?.toLowerCase().includes(q);
    });
  }, [content, search, statusFilter]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;

    setSaving(true);
    try {
      const res = await fetch('/api/content-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim() || null,
          status: form.status,
          client_id: clientId,
          schedule_date: form.schedule_date || null,
        }),
      });

      const json = await res.json() as { success: boolean; item?: ContentItem; error?: string };
      if (!json.success) throw new Error(json.error ?? 'Failed to create content');

      if (json.item) setContent(prev => [json.item!, ...prev]);
      setCreateOpen(false);
      setForm({ title: '', description: '', status: 'draft', schedule_date: '' });
      addToast('Content item created', 'success');
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Failed to create content', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: ContentItemStatus) => {
    setUpdatingId(id);

    try {
      const res = await fetch(`/api/content-items/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      const json = await res.json() as { success: boolean; item?: ContentItem; error?: string };
      if (!json.success) throw new Error(json.error ?? 'Failed to update status');

      if (json.item) {
        setContent(prev => prev.map(item => (item.id === id ? { ...item, status: json.item!.status } : item)));
      }
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Failed to update status', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: 'var(--surface)' }} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="glass-card p-4">
        <div className="flex flex-col md:flex-row md:items-center gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-secondary)' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input-glass h-9 w-full pl-8 pr-3 text-sm"
              placeholder="Search content title or description"
            />
          </div>

          <label className="relative">
            <SlidersHorizontal size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-secondary)' }} />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as 'all' | ContentItemStatus)}
              className="input-glass h-9 pl-8 pr-7 text-xs font-semibold min-w-[145px]"
            >
              <option value="all">All statuses</option>
              {STATUS_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <button
            onClick={() => setCreateOpen(true)}
            className="btn-primary h-9 px-4 rounded-xl text-sm font-semibold inline-flex items-center gap-2"
          >
            <Plus size={14} /> New Content
          </button>
        </div>
      </div>

      {filteredContent.length === 0 ? (
        <div className="glass-card">
          <EmptyState
            icon={FileText}
            title="No content yet"
            description="Create content plans, drafts, and publishing items for this client."
            action={(
              <button onClick={() => setCreateOpen(true)} className="btn-primary h-9 px-4 rounded-xl text-sm font-semibold inline-flex items-center gap-2">
                <Plus size={14} /> Create content
              </button>
            )}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          {filteredContent.map(item => (
            <div key={item.id} className="glass-card p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{item.title}</p>
                  {item.description && (
                    <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{item.description}</p>
                  )}
                  {(item.platform_targets?.length ?? 0) > 0 && (
                    <p className="text-[11px] mt-1" style={{ color: 'var(--text-secondary)' }}>{item.platform_targets!.join(', ')}</p>
                  )}
                </div>
                <Badge variant={statusVariant(item.status)}>{item.status.replace(/_/g, ' ')}</Badge>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  {item.schedule_date && (
                    <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
                      <Calendar size={10} />
                      {fmtDate(item.schedule_date)}
                    </span>
                  )}
                  {item.created_at && (
                    <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      Created {fmtDate(item.created_at)}
                    </span>
                  )}
                </div>

                <SelectDropdown
                  value={item.status}
                  onChange={v => void handleStatusChange(item.id, v as ContentItemStatus)}
                  options={STATUS_OPTIONS}
                  disabled={updatingId === item.id}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New Content Item"
        subtitle="Create a content draft with schedule and status."
        size="sm"
      >
        <form onSubmit={e => void handleCreate(e)} className="space-y-4">
          <div className="space-y-1">
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>Title *</label>
              <AiImproveButton value={form.title} onImproved={v => setForm(f => ({ ...f, title: v }))} />
            </div>
              <input
                required
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="openy-field w-full h-10 px-3 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]"
                style={{ color: 'var(--text)', border: '1px solid var(--border)' }}
                placeholder="Content title"
              />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>Description</label>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={2}
                className="openy-field w-full px-3 py-2 rounded-lg text-sm outline-none resize-none focus:ring-2 focus:ring-[var(--accent)]"
                style={{ color: 'var(--text)', border: '1px solid var(--border)' }}
                placeholder="Optional description"
              />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>Status</label>
              <SelectDropdown
                fullWidth
                value={form.status}
                onChange={v => setForm(f => ({ ...f, status: v as ContentItemStatus }))}
                options={STATUS_OPTIONS}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>Scheduled Date</label>
              <input
                type="date"
                value={form.schedule_date}
                onChange={e => setForm(f => ({ ...f, schedule_date: e.target.value }))}
                className="openy-field w-full h-10 px-3 rounded-lg text-sm outline-none"
                style={{ color: 'var(--text)', border: '1px solid var(--border)' }}
              />
            </div>
          </div>

          <div className="openy-modal-actions" data-modal-footer="true">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="btn-secondary h-10 px-4 rounded-lg text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary h-10 px-4 rounded-lg text-sm font-medium disabled:opacity-60"
            >
              {saving ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
