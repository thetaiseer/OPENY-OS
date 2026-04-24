'use client';

/**
 * CreateClientModal — inline nested modal for creating a new client
 * from within the Upload modal. Posts to /api/clients and returns
 * the newly created client on success.
 */

import { useState } from 'react';
import { X, Loader2, UserPlus } from 'lucide-react';
import type { Client } from '@/lib/types';
import AppModal from '@/components/ui/AppModal';

export interface CreateClientModalProps {
  onCreated: (client: Client) => void;
  onCancel: () => void;
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label
      className="mb-1.5 block text-xs font-semibold tracking-wide"
      style={{ color: 'var(--text-secondary)' }}
    >
      {children}
      {required && <span className="ml-0.5 text-red-400">*</span>}
    </label>
  );
}

export default function CreateClientModal({ onCreated, onCancel }: CreateClientModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputClass =
    'w-full h-9 px-3 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[var(--accent)] transition-all';
  const inputStyle: React.CSSProperties = {
    background: 'var(--surface)',
    color: 'var(--text)',
    border: '1.5px solid var(--border)',
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Client name is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          website: website.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });

      let json: { success: boolean; client?: Client; error?: string } | undefined;
      try {
        json = (await res.json()) as { success: boolean; client?: Client; error?: string };
      } catch {
        throw new Error(`Server returned an invalid response (HTTP ${res.status})`);
      }

      if (!json || !res.ok || !json.success) {
        throw new Error(json?.error ?? `Failed to create client (HTTP ${res.status})`);
      }
      if (!json.client) {
        throw new Error('Server did not return the created client');
      }

      onCreated(json.client);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppModal
      open
      onClose={onCancel}
      title="Create New Client"
      icon={<UserPlus size={15} />}
      size="sm"
      zIndexClassName="z-[60]"
      footer={
        <>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="openy-modal-btn-secondary flex-1 disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="create-client-modal-form"
            disabled={saving || !name.trim()}
            className="openy-modal-btn-primary inline-flex flex-1 items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Saving...
              </>
            ) : (
              'Create Client'
            )}
          </button>
        </>
      }
    >
      <form
        id="create-client-modal-form"
        className="openy-modal-stack"
        onSubmit={(e) => {
          e.preventDefault();
          void handleSave();
        }}
      >
        {/* Error */}
        {error && (
          <div
            className="flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm"
            style={{
              background: 'rgba(239,68,68,0.1)',
              color: '#ef4444',
              border: '1px solid rgba(239,68,68,0.3)',
            }}
          >
            <X size={14} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Name */}
        <div>
          <FieldLabel required>Client Name</FieldLabel>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Acme Corp"
            className={inputClass}
            style={inputStyle}
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            disabled={saving}
          />
        </div>

        {/* Email */}
        <div>
          <FieldLabel>Email</FieldLabel>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="client@example.com"
            className={inputClass}
            style={inputStyle}
            disabled={saving}
          />
        </div>

        {/* Phone */}
        <div>
          <FieldLabel>Phone</FieldLabel>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 555 000 0000"
            className={inputClass}
            style={inputStyle}
            disabled={saving}
          />
        </div>

        {/* Website */}
        <div>
          <FieldLabel>Website</FieldLabel>
          <input
            type="url"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://example.com"
            className={inputClass}
            style={inputStyle}
            disabled={saving}
          />
        </div>

        {/* Notes */}
        <div>
          <FieldLabel>Notes</FieldLabel>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any notes about this client..."
            rows={2}
            disabled={saving}
            className="w-full resize-none rounded-lg px-3 py-2 text-sm outline-none transition-all focus:ring-2 focus:ring-[var(--accent)]"
            style={{
              background: 'var(--surface)',
              color: 'var(--text)',
              border: '1.5px solid var(--border)',
            }}
          />
        </div>
      </form>
    </AppModal>
  );
}
