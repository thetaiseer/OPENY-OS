'use client';

/**
 * CreateClientModal — inline nested modal for creating a new client
 * from within the Upload modal. Posts to /api/clients and returns
 * the newly created client on success.
 */

import { useState } from 'react';
import { X, Loader2, UserPlus } from 'lucide-react';
import type { Client } from '@/lib/types';

export interface CreateClientModalProps {
  onCreated: (client: Client) => void;
  onCancel:  () => void;
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label
      className="block text-xs font-semibold mb-1.5 tracking-wide"
      style={{ color: 'var(--text-secondary)' }}
    >
      {children}
      {required && <span className="ml-0.5 text-red-400">*</span>}
    </label>
  );
}

export default function CreateClientModal({ onCreated, onCancel }: CreateClientModalProps) {
  const [name,    setName]    = useState('');
  const [email,   setEmail]   = useState('');
  const [phone,   setPhone]   = useState('');
  const [website, setWebsite] = useState('');
  const [notes,   setNotes]   = useState('');
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const inputClass =
    'w-full h-9 px-3 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[var(--accent)] transition-all';
  const inputStyle: React.CSSProperties = {
    background: 'var(--surface)',
    color:      'var(--text)',
    border:     '1.5px solid var(--border)',
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) { setError('Client name is required'); return; }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/clients', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:    trimmedName,
          email:   email.trim()   || undefined,
          phone:   phone.trim()   || undefined,
          website: website.trim() || undefined,
          notes:   notes.trim()   || undefined,
        }),
      });

      let json: { success: boolean; client?: Client; error?: string } | undefined;
      try {
        json = await res.json() as { success: boolean; client?: Client; error?: string };
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSave(); }
    if (e.key === 'Escape') onCancel();
  };

  return (
    /* Backdrop — sits on top of UploadModal (z-50) */
    <div
      className="openy-modal-overlay fixed inset-0 z-[60] flex items-start sm:items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={onCancel}
    >
      <div
        className="openy-modal-panel w-full max-w-sm rounded-2xl flex flex-col max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] my-auto overflow-hidden"
        style={{
          animation: 'openy-modal-in 280ms var(--ease-spring) both',
        }}
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b shrink-0"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="flex items-center gap-2">
            <UserPlus size={16} style={{ color: 'var(--accent)' }} />
            <h3 className="text-sm font-bold" style={{ color: 'var(--text)' }}>
              Create New Client
            </h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center justify-center w-7 h-7 rounded-lg hover:opacity-70 transition-opacity"
            style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3.5">
          {/* Error */}
          {error && (
            <div
              className="flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm"
              style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}
            >
              <X size={14} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Name */}
          <div>
            <FieldLabel required>Client Name</FieldLabel>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
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
              onChange={e => setEmail(e.target.value)}
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
              onChange={e => setPhone(e.target.value)}
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
              onChange={e => setWebsite(e.target.value)}
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
              onChange={e => setNotes(e.target.value)}
              placeholder="Any notes about this client..."
              rows={2}
              disabled={saving}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[var(--accent)] transition-all resize-none"
              style={{
                background: 'var(--surface)',
                color:      'var(--text)',
                border:     '1.5px solid var(--border)',
              }}
            />
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center gap-2.5 px-5 py-4 border-t shrink-0"
          style={{ borderColor: 'var(--border)' }}
        >
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="flex-1 h-9 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-40"
            style={{
              background: 'var(--surface-2)',
              color:      'var(--text)',
              border:     '1px solid var(--border)',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || !name.trim()}
            className="flex-1 h-9 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={{ background: 'var(--accent)' }}
          >
            {saving ? (
              <><Loader2 size={14} className="animate-spin" /> Saving...</>
            ) : (
              'Create Client'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
