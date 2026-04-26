'use client';

import { useEffect, useState, useCallback } from 'react';
import supabase from '@/lib/supabase';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import SelectDropdown from '@/components/ui/SelectDropdown';
import AiImproveButton from '@/components/ui/AiImproveButton';
import { useClientWorkspace } from '../client-context';
import { useToast } from '@/context/toast-context';
import type { ContentItem, ContentItemStatus } from '@/lib/types';
import { Plus, FileText, Calendar } from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: ContentItemStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'pending_review', label: 'Pending Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'published', label: 'Published' },
];

function statusVariant(s: string) {
  if (s === 'published') return 'success' as const;
  if (s === 'scheduled') return 'info' as const;
  if (s === 'approved') return 'success' as const;
  if (s === 'pending_review') return 'warning' as const;
  if (s === 'rejected') return 'danger' as const;
  return 'default' as const;
}

function fmtDate(d?: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ClientContentPage() {
  const { clientId } = useClientWorkspace();
  const { toast: addToast } = useToast();
  const [content, setContent] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Create modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    status: 'draft' as ContentItemStatus,
    schedule_date: '',
  });
  const [saving, setSaving] = useState(false);

  // Status change state
  const [updatingId, setUpdatingId] = useState<string | null>(null);

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

  useEffect(() => {
    void load();
  }, [load]);

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
      const json = (await res.json()) as { success: boolean; item?: ContentItem; error?: string };
      if (!json.success) throw new Error(json.error ?? 'Failed to create content');
      const createdItem = json.item;
      if (createdItem) setContent((prev) => [createdItem, ...prev]);
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
      const json = (await res.json()) as { success: boolean; item?: ContentItem; error?: string };
      if (!json.success) throw new Error(json.error ?? 'Failed to update status');
      if (json.item) {
        setContent((prev) =>
          prev.map((c) => (c.id === id ? { ...c, status: json.item?.status ?? c.status } : c)),
        );
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
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-16 animate-pulse rounded-xl"
            style={{ background: 'var(--surface)' }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with create button */}
      <div className="flex justify-end">
        <button
          onClick={() => setCreateOpen(true)}
          className="flex h-9 items-center gap-2 rounded-lg px-4 text-sm font-medium text-white"
          style={{ background: 'var(--accent)' }}
        >
          <Plus size={14} /> New Content
        </button>
      </div>

      {content.length === 0 ? (
        <div className="space-y-2 py-16 text-center">
          <FileText
            size={32}
            className="mx-auto opacity-30"
            style={{ color: 'var(--text-secondary)' }}
          />
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            No content yet. Create your first content item.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {content.map((item) => (
            <div
              key={item.id}
              className="space-y-2 rounded-xl border p-4"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                    {item.title}
                  </p>
                  {item.description && (
                    <p
                      className="mt-0.5 line-clamp-2 text-xs"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {item.description}
                    </p>
                  )}
                  {(item.platform_targets?.length ?? 0) > 0 && (
                    <p className="mt-0.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {item.platform_targets?.join(', ')}
                    </p>
                  )}
                </div>
                <Badge variant={statusVariant(item.status)}>{item.status.replace(/_/g, ' ')}</Badge>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {item.schedule_date && (
                    <span
                      className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
                      style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
                    >
                      <Calendar size={10} />
                      {fmtDate(item.schedule_date)}
                    </span>
                  )}
                </div>
                {/* Status quick-change */}
                <SelectDropdown
                  value={item.status}
                  onChange={(v) => void handleStatusChange(item.id, v as ContentItemStatus)}
                  options={STATUS_OPTIONS}
                  disabled={updatingId === item.id}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create content modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New Content Item"
        size="sm"
      >
        <form onSubmit={(e) => void handleCreate(e)} className="space-y-4">
          <div className="space-y-1">
            <div className="mb-1 flex items-center justify-between">
              <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                Title *
              </label>
              <AiImproveButton
                value={form.title}
                onImproved={(v) => setForm((f) => ({ ...f, title: v }))}
              />
            </div>
            <input
              required
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="h-9 w-full rounded-lg px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]"
              style={{
                background: 'var(--surface-2)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
              }}
              placeholder="Content title"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={2}
              className="w-full resize-none rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]"
              style={{
                background: 'var(--surface-2)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
              }}
              placeholder="Optional description"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                Status
              </label>
              <SelectDropdown
                fullWidth
                value={form.status}
                onChange={(v) => setForm((f) => ({ ...f, status: v as ContentItemStatus }))}
                options={STATUS_OPTIONS}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                Scheduled Date
              </label>
              <input
                type="date"
                value={form.schedule_date}
                onChange={(e) => setForm((f) => ({ ...f, schedule_date: e.target.value }))}
                className="h-9 w-full rounded-lg px-3 text-sm outline-none"
                style={{
                  background: 'var(--surface-2)',
                  color: 'var(--text)',
                  border: '1px solid var(--border)',
                }}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="h-9 rounded-lg px-4 text-sm font-medium"
              style={{ background: 'var(--surface-2)', color: 'var(--text)' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="h-9 rounded-lg px-4 text-sm font-medium text-white disabled:opacity-60"
              style={{ background: 'var(--accent)' }}
            >
              {saving ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
