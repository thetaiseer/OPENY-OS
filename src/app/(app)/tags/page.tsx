'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Tag, Trash2, Pencil, X, Check, Circle } from 'lucide-react';
import type { Tag as TagType } from '@/lib/types';

const TAG_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#64748b',
];

async function fetchTags(): Promise<TagType[]> {
  const res = await fetch('/api/tags');
  const json = await res.json() as { success: boolean; tags: TagType[] };
  if (!json.success) throw new Error('Failed to load tags');
  return json.tags;
}

export default function TagsPage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen]   = useState(false);
  const [editTag, setEditTag]       = useState<TagType | null>(null);
  const [form, setForm]             = useState({ name: '', color: '#6366f1', description: '' });
  const [saving, setSaving]         = useState(false);
  const [saveErr, setSaveErr]       = useState<string | null>(null);

  const { data: tags = [], isLoading } = useQuery<TagType[]>({
    queryKey: ['tags'],
    queryFn: fetchTags,
  });

  const openCreate = () => {
    setEditTag(null);
    setForm({ name: '', color: '#6366f1', description: '' });
    setSaveErr(null);
    setModalOpen(true);
  };

  const openEdit = (tag: TagType) => {
    setEditTag(tag);
    setForm({ name: tag.name, color: tag.color, description: tag.description ?? '' });
    setSaveErr(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveErr(null);
    try {
      const url    = editTag ? `/api/tags/${editTag.id}` : '/api/tags';
      const method = editTag ? 'PATCH' : 'POST';
      const res  = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json() as { success: boolean; error?: string };
      if (!json.success) throw new Error(json.error ?? 'Save failed');
      setModalOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['tags'] });
    } catch (err) {
      setSaveErr(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this tag? All tag links will also be removed.')) return;
    await fetch(`/api/tags/${id}`, { method: 'DELETE' });
    void queryClient.invalidateQueries({ queryKey: ['tags'] });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Tag Manager</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Reusable tags across tasks, assets, content, and more
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium text-white hover:opacity-90 transition-opacity"
          style={{ background: 'var(--accent)' }}
        >
          <Plus size={16} /> New Tag
        </button>
      </div>

      {/* Tags list */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }} />
        </div>
      ) : tags.length === 0 ? (
        <div className="text-center py-20">
          <Tag size={40} className="mx-auto mb-3 opacity-40" style={{ color: 'var(--text-secondary)' }} />
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No tags yet. Create your first tag!</p>
        </div>
      ) : (
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          {tags.map((tag, i) => (
            <div
              key={tag.id}
              className="flex items-center gap-4 px-4 py-3 hover:bg-[var(--surface-2)] transition-colors group"
              style={{
                background: 'var(--surface)',
                borderBottom: i < tags.length - 1 ? '1px solid var(--border)' : undefined,
              }}
            >
              {/* Color chip */}
              <div className="w-4 h-4 rounded-full shrink-0" style={{ background: tag.color }} />

              {/* Name + desc */}
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{tag.name}</span>
                {tag.description && (
                  <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-secondary)' }}>{tag.description}</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => openEdit(tag)}
                  className="p-1.5 rounded hover:bg-[var(--surface)] transition-colors"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => void handleDelete(tag.id)}
                  className="p-1.5 rounded hover:bg-[var(--surface)] transition-colors text-red-500"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-md rounded-2xl border p-6 space-y-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold" style={{ color: 'var(--text)' }}>{editTag ? 'Edit Tag' : 'New Tag'}</h2>
              <button onClick={() => setModalOpen(false)} style={{ color: 'var(--text-secondary)' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={e => void handleSave(e)} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>Name *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Tag name…"
                  className="w-full h-9 px-3 rounded-lg text-sm outline-none"
                  style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
                />
              </div>

              {/* Color picker */}
              <div className="space-y-2">
                <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>Color</label>
                <div className="flex flex-wrap gap-2">
                  {TAG_COLORS.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, color }))}
                      className="w-7 h-7 rounded-full flex items-center justify-center transition-transform hover:scale-110"
                      style={{ background: color }}
                    >
                      {form.color === color && <Check size={12} className="text-white" />}
                    </button>
                  ))}
                  <div className="flex items-center gap-1.5">
                    <Circle size={16} style={{ color: form.color }} />
                    <input
                      type="color"
                      value={form.color}
                      onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                      className="w-8 h-8 rounded cursor-pointer border-0"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>Description</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Optional description…"
                  className="w-full h-9 px-3 rounded-lg text-sm outline-none"
                  style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
                />
              </div>

              {saveErr && <p className="text-xs text-red-500">{saveErr}</p>}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="h-9 px-4 rounded-lg text-sm font-medium"
                  style={{ background: 'var(--surface-2)', color: 'var(--text)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="h-9 px-4 rounded-lg text-sm font-medium text-white disabled:opacity-60"
                  style={{ background: 'var(--accent)' }}
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
