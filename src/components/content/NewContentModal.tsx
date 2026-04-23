'use client';

import { useState } from 'react';
import { PenSquare } from 'lucide-react';
import { useToast } from '@/context/toast-context';
import type { Client, ContentItem } from '@/lib/types';
import AppModal from '@/components/ui/AppModal';

interface NewContentModalProps {
  open: boolean;
  onClose: () => void;
  clients: Client[];
  onCreated: (item: ContentItem) => void;
}

const PLATFORMS = [
  'instagram',
  'facebook',
  'tiktok',
  'linkedin',
  'twitter',
  'snapchat',
  'youtube_shorts',
];
const PURPOSES = [
  'awareness',
  'engagement',
  'promotion',
  'branding',
  'lead_generation',
  'announcement',
  'offer_campaign',
];

export default function NewContentModal({
  open,
  onClose,
  clients,
  onCreated,
}: NewContentModalProps) {
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [clientId, setClientId] = useState('');
  const [caption, setCaption] = useState('');
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [purpose, setPurpose] = useState('');
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  function togglePlatform(p: string) {
    setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast('Title is required', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/content-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          client_id: clientId || null,
          caption,
          platform_targets: platforms,
          purpose: purpose || null,
          status: 'draft',
        }),
      });
      const json = (await res.json()) as { success: boolean; item?: ContentItem; error?: string };
      if (!json.success) throw new Error(json.error ?? 'Failed to create');
      toast('Content item created', 'success');
      onCreated(json.item!);
      onClose();
      setTitle('');
      setClientId('');
      setCaption('');
      setPlatforms([]);
      setPurpose('');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to create', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppModal
      open
      onClose={onClose}
      title="New Content Item"
      icon={<PenSquare size={15} />}
      size="md"
      footer={
        <>
          <button type="button" onClick={onClose} className="openy-modal-btn-secondary">
            Cancel
          </button>
          <button
            type="submit"
            form="new-content-item-form"
            disabled={saving}
            className="openy-modal-btn-primary disabled:opacity-50"
          >
            {saving ? 'Creating…' : 'Create'}
          </button>
        </>
      }
    >
      <form id="new-content-item-form" onSubmit={handleSubmit} className="openy-modal-stack">
        <div>
          <label
            className="mb-1 block text-xs font-medium"
            style={{ color: 'var(--text-secondary)' }}
          >
            Title *
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. May Campaign — Instagram Reel"
            required
            className="h-9 w-full rounded-lg border px-3 text-sm"
            style={{
              background: 'var(--surface-2)',
              borderColor: 'var(--border)',
              color: 'var(--text)',
            }}
          />
        </div>
        <div>
          <label
            className="mb-1 block text-xs font-medium"
            style={{ color: 'var(--text-secondary)' }}
          >
            Client
          </label>
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="h-9 w-full rounded-lg border px-3 text-sm"
            style={{
              background: 'var(--surface-2)',
              borderColor: 'var(--border)',
              color: 'var(--text)',
            }}
          >
            <option value="">— No client —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            className="mb-1 block text-xs font-medium"
            style={{ color: 'var(--text-secondary)' }}
          >
            Caption / Copy
          </label>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={3}
            placeholder="Write the post caption..."
            className="w-full resize-none rounded-lg border px-3 py-2 text-sm"
            style={{
              background: 'var(--surface-2)',
              borderColor: 'var(--border)',
              color: 'var(--text)',
            }}
          />
        </div>
        <div>
          <label
            className="mb-2 block text-xs font-medium"
            style={{ color: 'var(--text-secondary)' }}
          >
            Target Platforms
          </label>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => togglePlatform(p)}
                className="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
                style={
                  platforms.includes(p)
                    ? { background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' }
                    : {
                        background: 'var(--surface-2)',
                        color: 'var(--text-secondary)',
                        borderColor: 'var(--border)',
                      }
                }
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label
            className="mb-1 block text-xs font-medium"
            style={{ color: 'var(--text-secondary)' }}
          >
            Purpose
          </label>
          <select
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            className="h-9 w-full rounded-lg border px-3 text-sm"
            style={{
              background: 'var(--surface-2)',
              borderColor: 'var(--border)',
              color: 'var(--text)',
            }}
          >
            <option value="">— Select purpose —</option>
            {PURPOSES.map((p) => (
              <option key={p} value={p}>
                {p.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>
      </form>
    </AppModal>
  );
}
