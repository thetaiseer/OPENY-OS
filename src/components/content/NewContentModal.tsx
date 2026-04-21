'use client';

import { useState } from 'react';
import { XCircle } from 'lucide-react';
import { useToast } from '@/lib/toast-context';
import type { Client, ContentItem } from '@/lib/types';

interface NewContentModalProps {
  open: boolean;
  onClose: () => void;
  clients: Client[];
  onCreated: (item: ContentItem) => void;
}

const PLATFORMS = ['instagram', 'facebook', 'tiktok', 'linkedin', 'twitter', 'snapchat', 'youtube_shorts'];
const PURPOSES = ['awareness', 'engagement', 'promotion', 'branding', 'lead_generation', 'announcement', 'offer_campaign'];

export default function NewContentModal({ open, onClose, clients, onCreated }: NewContentModalProps) {
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [clientId, setClientId] = useState('');
  const [caption, setCaption] = useState('');
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [purpose, setPurpose] = useState('');
  const [saving, setSaving] = useState(false);

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
              {saving ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

