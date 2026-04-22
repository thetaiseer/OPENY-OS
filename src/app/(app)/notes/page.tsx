'use client';

import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, FileText, Pin, PinOff, Trash2, Pencil, Check } from 'lucide-react';
import type { Note } from '@/lib/types';
import FormModal from '@/components/ui/FormModal';

function formatRelative(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)  return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `${hrs}h ago`;
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch { return ''; }
}

async function fetchNotes(search: string): Promise<Note[]> {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  const res = await fetch(`/api/notes?${params}`);
  const json = await res.json() as { success: boolean; notes: Note[] };
  if (!json.success) throw new Error('Failed to load notes');
  return json.notes;
}

export default function NotesPage() {
  const queryClient = useQueryClient();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [search, setSearch]   = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editNote, setEditNote] = useState<Note | null>(null);
  const [form, setForm]       = useState({ title: '', content: '' });
  const [saving, setSaving]   = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const handleSearchChange = (v: string) => {
    setSearch(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(v), 300);
  };

  const { data: notes = [], isLoading } = useQuery<Note[]>({
    queryKey: ['notes', debouncedSearch],
    queryFn: () => fetchNotes(debouncedSearch),
  });

  const openCreate = () => {
    setEditNote(null);
    setForm({ title: '', content: '' });
    setSaveErr(null);
    setModalOpen(true);
  };

  const openEdit = (note: Note) => {
    setEditNote(note);
    setForm({ title: note.title, content: note.content ?? '' });
    setSaveErr(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveErr(null);
    try {
      const url    = editNote ? `/api/notes/${editNote.id}` : '/api/notes';
      const method = editNote ? 'PATCH' : 'POST';
      const res  = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json() as { success: boolean; error?: string };
      if (!json.success) throw new Error(json.error ?? 'Save failed');
      setModalOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['notes'] });
    } catch (err) {
      setSaveErr(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this note?')) return;
    await fetch(`/api/notes/${id}`, { method: 'DELETE' });
    void queryClient.invalidateQueries({ queryKey: ['notes'] });
  };

  const handlePin = async (note: Note) => {
    await fetch(`/api/notes/${note.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_pinned: !note.is_pinned }),
    });
    void queryClient.invalidateQueries({ queryKey: ['notes'] });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Notes &amp; Docs</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Capture ideas, briefs, strategies, and meeting notes
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium text-white hover:opacity-90 transition-opacity"
          style={{ background: 'var(--accent)' }}
        >
          <Plus size={16} /> New Note
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-secondary)' }} />
        <input
          type="text"
          value={search}
          onChange={e => handleSearchChange(e.target.value)}
          placeholder="Search notes…"
          className="w-full h-9 pl-9 pr-4 rounded-lg text-sm outline-none"
          style={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)' }}
        />
      </div>

      {/* Notes grid */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }} />
        </div>
      ) : notes.length === 0 ? (
        <div className="text-center py-20">
          <FileText size={40} className="mx-auto mb-3 opacity-40" style={{ color: 'var(--text-secondary)' }} />
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No notes yet. Create your first one!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {notes.map(note => (
            <div
              key={note.id}
              className="group rounded-2xl border p-4 flex flex-col gap-2 hover:border-[var(--accent)] transition-colors"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              {/* Card header */}
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-sm leading-snug flex-1" style={{ color: 'var(--text)' }}>
                  {note.title || 'Untitled'}
                </h3>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button
                    onClick={() => void handlePin(note)}
                    className="p-1 rounded hover:bg-[var(--surface-2)] transition-colors"
                    title={note.is_pinned ? 'Unpin' : 'Pin'}
                    style={{ color: note.is_pinned ? 'var(--accent)' : 'var(--text-secondary)' }}
                  >
                    {note.is_pinned ? <Pin size={13} /> : <PinOff size={13} />}
                  </button>
                  <button
                    onClick={() => openEdit(note)}
                    className="p-1 rounded hover:bg-[var(--surface-2)] transition-colors"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => void handleDelete(note.id)}
                    className="p-1 rounded hover:bg-[var(--surface-2)] transition-colors text-red-500"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* Content preview */}
              {note.content && (
                <p className="text-xs line-clamp-3 flex-1" style={{ color: 'var(--text-secondary)' }}>
                  {note.content}
                </p>
              )}

              {/* Footer */}
              <div className="flex items-center gap-2 pt-1">
                {note.is_pinned && (
                  <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                    Pinned
                  </span>
                )}
                {note.entity_type && (
                  <span className="text-xs px-1.5 py-0.5 rounded capitalize" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
                    {note.entity_type}
                  </span>
                )}
                <span className="text-xs ml-auto" style={{ color: 'var(--text-secondary)' }}>
                  {formatRelative(note.updated_at)}
                </span>
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
          title={editNote ? 'Edit Note' : 'New Note'}
          icon={<FileText size={15} />}
          size="md"
          onSubmit={e => void handleSave(e)}
          footer={(
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
                className="openy-modal-btn-primary disabled:opacity-60 flex items-center gap-2"
              >
                {saving ? 'Saving…' : <><Check size={14} /> Save</>}
              </button>
            </>
          )}
        >
              <div className="space-y-1">
                <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>Title</label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Note title…"
                  className="w-full h-9 px-3 rounded-lg text-sm outline-none"
                  style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>Content</label>
                <textarea
                  value={form.content}
                  onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                  rows={8}
                  placeholder="Write your note here…"
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-y"
                  style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
                />
              </div>
              {saveErr && (
                <p className="text-xs text-red-500">{saveErr}</p>
              )}
        </FormModal>
      )}
    </div>
  );
}
