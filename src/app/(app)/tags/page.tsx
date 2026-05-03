'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Tag, Trash2, Pencil, Check, Circle } from 'lucide-react';
import type { Tag as TagType } from '@/lib/types';
import FormModal from '@/components/ui/FormModal';
import ConfirmDialog from '@/components/ui/actions/ConfirmDialog';

const TAG_COLORS = [
  '#000000',
  '#222222',
  '#444444',
  '#555555',
  '#666666',
  '#888888',
  '#aaaaaa',
  '#cccccc',
  '#dddddd',
  '#ffffff',
];

async function fetchTags(): Promise<TagType[]> {
  const res = await fetch('/api/tags');
  const json = (await res.json()) as { success: boolean; tags: TagType[] };
  if (!json.success) throw new Error('Failed to load tags');
  return json.tags;
}

export default function TagsPage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editTag, setEditTag] = useState<TagType | null>(null);
  const [form, setForm] = useState({ name: '', color: '#000000', description: '' });
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [pendingDeleteTag, setPendingDeleteTag] = useState<TagType | null>(null);
  const [deletingTag, setDeletingTag] = useState(false);

  const { data: tags = [], isLoading } = useQuery<TagType[]>({
    queryKey: ['tags'],
    queryFn: fetchTags,
  });

  const openCreate = () => {
    setEditTag(null);
    setForm({ name: '', color: '#000000', description: '' });
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
      const url = editTag ? `/api/tags/${editTag.id}` : '/api/tags';
      const method = editTag ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (!json.success) throw new Error(json.error ?? 'Save failed');
      setModalOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['tags'] });
    } catch (err) {
      setSaveErr(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!pendingDeleteTag) return;
    setDeletingTag(true);
    try {
      await fetch(`/api/tags/${pendingDeleteTag.id}`, { method: 'DELETE' });
      void queryClient.invalidateQueries({ queryKey: ['tags'] });
      setPendingDeleteTag(null);
    } finally {
      setDeletingTag(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
            Tag Manager
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Reusable tags across tasks, assets, content, and more
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex h-9 items-center gap-2 rounded-lg px-4 text-sm font-medium text-[var(--accent-foreground)] transition-opacity hover:opacity-90"
          style={{ background: 'var(--accent)' }}
        >
          <Plus size={16} /> New Tag
        </button>
      </div>

      {/* Tags list */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div
            className="h-6 w-6 animate-spin rounded-full border-2"
            style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }}
          />
        </div>
      ) : tags.length === 0 ? (
        <div className="py-20 text-center">
          <Tag
            size={40}
            className="mx-auto mb-3 opacity-40"
            style={{ color: 'var(--text-secondary)' }}
          />
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            No tags yet. Create your first tag!
          </p>
        </div>
      ) : (
        <div
          className="overflow-hidden rounded-2xl border"
          style={{ borderColor: 'var(--border)' }}
        >
          {tags.map((tag, i) => (
            <div
              key={tag.id}
              className="group flex items-center gap-4 px-4 py-3 transition-colors hover:bg-[var(--surface-2)]"
              style={{
                background: 'var(--surface)',
                borderBottom: i < tags.length - 1 ? '1px solid var(--border)' : undefined,
              }}
            >
              {/* Color chip */}
              <div className="h-4 w-4 shrink-0 rounded-full" style={{ background: tag.color }} />

              {/* Name + desc */}
              <div className="min-w-0 flex-1">
                <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                  {tag.name}
                </span>
                {tag.description && (
                  <p className="mt-0.5 truncate text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {tag.description}
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  onClick={() => openEdit(tag)}
                  className="rounded p-1.5 transition-colors hover:bg-[var(--surface)]"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => setPendingDeleteTag(tag)}
                  className="rounded p-1.5 text-red-500 transition-colors hover:bg-[var(--surface)]"
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
        <FormModal
          open
          onClose={() => setModalOpen(false)}
          title={editTag ? 'Edit Tag' : 'New Tag'}
          icon={<Tag size={15} />}
          size="sm"
          onSubmit={(e) => void handleSave(e)}
          footer={
            <>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="openy-modal-btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="openy-modal-btn-primary disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </>
          }
        >
          <div className="space-y-1">
            <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>
              Name *
            </label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Tag name…"
              className="h-9 w-full rounded-lg px-3 text-sm outline-none"
              style={{
                background: 'var(--surface-2)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
              }}
            />
          </div>

          {/* Color picker */}
          <div className="space-y-2">
            <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>
              Color
            </label>
            <div className="flex flex-wrap gap-2">
              {TAG_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, color }))}
                  className="flex h-7 w-7 items-center justify-center rounded-full transition-transform hover:scale-110"
                  style={{ background: color }}
                >
                  {form.color === color && (
                    <Check
                      size={12}
                      style={{ color: 'white', mixBlendMode: 'difference' }}
                    />
                  )}
                </button>
              ))}
              <div className="flex items-center gap-1.5">
                <Circle size={16} style={{ color: form.color }} />
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                  className="h-8 w-8 cursor-pointer rounded border-0"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>
              Description
            </label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Optional description…"
              className="h-9 w-full rounded-lg px-3 text-sm outline-none"
              style={{
                background: 'var(--surface-2)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
              }}
            />
          </div>

          {saveErr && <p className="text-xs text-red-500">{saveErr}</p>}
        </FormModal>
      )}
      <ConfirmDialog
        open={Boolean(pendingDeleteTag)}
        title="Delete tag"
        description={`Delete "${pendingDeleteTag?.name || 'this tag'}"? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        destructive
        loading={deletingTag}
        onCancel={() => {
          if (deletingTag) return;
          setPendingDeleteTag(null);
        }}
        onConfirm={handleDelete}
      />
    </div>
  );
}
