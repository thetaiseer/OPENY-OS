'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Plus, Search, Users2, ExternalLink, AlertCircle, X } from 'lucide-react';
import Link from 'next/link';
import supabase from '@/lib/supabase';
import { useLang } from '@/lib/lang-context';
import { useAuth } from '@/lib/auth-context';
import EmptyState from '@/components/ui/EmptyState';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import SelectDropdown from '@/components/ui/SelectDropdown';
import type { Client } from '@/lib/types';

const statusVariant = (s: string) => {
  if (s === 'active') return 'success' as const;
  if (s === 'inactive') return 'default' as const;
  return 'info' as const;
};

const WARN_TOAST_BG    = '#d97706';
const SUCCESS_TOAST_BG = '#16a34a';

const FETCH_TIMEOUT_MS = 15_000;

export default function ClientsPage() {
  const { t } = useLang();
  const { role } = useAuth();
  const canManageClients = role === 'admin' || role === 'team_member' || role === 'manager';
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [warnMsg, setWarnMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '', email: '', phone: '', website: '', industry: '', status: 'active', notes: '',
  });

  // silent=true → background refresh after mutations; does not touch the error
  // banner, does not clear existing data, and does not flip the loading spinner.
  //
  // NOTE: search is intentionally NOT in the dependency array. All clients are
  // fetched once (up to 200) and filtered client-side via `filteredClients`.
  // Putting `search` here would cause a new DB round-trip on every keystroke,
  // creating race conditions where stale results overwrite newer ones.
  const fetchClients = useCallback(async (silent = false): Promise<boolean> => {
    if (!silent) setFetchError(null);
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('TIMEOUT')), FETCH_TIMEOUT_MS);
      });
      const query = supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      const { data, error } = await Promise.race([query, timeoutPromise]);
      if (error) {
        console.error('[clients fetch]', error);
        if (!silent) {
          setFetchError('Failed to load clients. Please try again.');
          setClients([]);
        }
        return false;
      } else {
        setClients((data ?? []) as Client[]);
        return true;
      }
    } catch (err: unknown) {
      const isTimeout = err instanceof Error && err.message === 'TIMEOUT';
      const msg = isTimeout
        ? 'Clients took too long to load. Please try again.'
        : 'Failed to load clients. Please try again.';
      console.error('[clients fetch] unexpected error:', err);
      if (!silent) {
        setFetchError(msg);
        setClients([]);
      }
      return false;
    } finally {
      clearTimeout(timeoutId);
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  // Client-side search filter — no extra round-trips, no race conditions.
  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(c =>
      c.name?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q),
    );
  }, [clients, search]);

  const logActivity = (description: string, clientId?: string) => {
    console.log('[client create] before activity log:', description);
    void supabase.from('activities').insert({
      type: 'client',
      description,
      client_id: clientId ?? null,
    }).then(
      ({ error }) => {
        if (error) console.warn('[logActivity]', error);
        else console.log('[client create] after activity log: success');
      },
      (err: unknown) => {
        console.warn('[logActivity network]', err);
      },
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageClients) {
      setSaveError('Only admin or team members can create clients.');
      return;
    }
    setSaving(true);
    setSaveError(null);

    // Timeout-safe protection: fail gracefully if the API call hangs.
    // NOTE: clearTimeout is in the finally block so it always runs.
    const timeoutMs = 15_000;
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

    try {
      console.log('[client create] form submit started', { name: form.name });
      console.log('[client create] request payload:', JSON.stringify(form));

      const fetchWithTimeout = new Promise<Response>((resolve, reject) => {
        timeoutHandle = setTimeout(
          () => reject(new Error('Request timed out. Please try again.')),
          timeoutMs,
        );
        fetch('/api/clients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        }).then(resolve, reject);
      });

      const res = await fetchWithTimeout;
      let result: { success: boolean; client?: { id?: string }; step?: string; error?: string };
      try {
        result = await res.json() as typeof result;
      } catch {
        throw new Error(`Server returned status ${res.status} with non-JSON body`);
      }

      console.log('[client create] API response:', JSON.stringify(result));

      if (!result.success) {
        const step  = result.step  ? ` [${result.step}]` : '';
        const msg   = result.error ?? 'Failed to create client';
        throw new Error(`${msg}${step}`);
      }

      console.log('[client create] insert success, id:', result.client?.id);

      // — SUCCESS PATH —
      // Close modal and reset form immediately; the list refresh is non-blocking.
      setModalOpen(false);
      setForm({ name: '', email: '', phone: '', website: '', industry: '', status: 'active', notes: '' });

      // Show success toast (auto-dismiss after 4 s)
      setSuccessMsg(`Client "${form.name}" created successfully.`);
      setTimeout(() => setSuccessMsg(null), 4000);

      // Fire-and-forget activity log — never blocks the UI
      logActivity(`Client "${form.name}" created`, result.client?.id);

      // Refresh list non-blocking — show warning if it fails, but never block modal
      console.log('[client create] triggering list refetch');
      void fetchClients(true).then(ok => {
        console.log('[client create] list refetch result, ok:', ok);
        if (!ok) {
          setWarnMsg('Client was created but the list failed to refresh. Please reload the page.');
          setTimeout(() => setWarnMsg(null), 6000);
        }
      });
    } catch (err: unknown) {
      console.error('[client create] error:', err);
      const message = err instanceof Error
        ? err.message
        : (err as { message?: string })?.message ?? 'Failed to create client';
      setSaveError(message);
    } finally {
      // Always clear the timeout and reset loading — no matter what happened above.
      clearTimeout(timeoutHandle);
      setSaving(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{t('clients')}</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Manage all your clients</p>
        </div>
        {canManageClients && (
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium text-white hover:opacity-90 transition-opacity"
            style={{ background: 'var(--accent)' }}
          >
            <Plus size={16} />{t('newClient')}
          </button>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-secondary)' }} />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('search')}
          className="w-full h-9 pl-9 pr-4 rounded-lg text-sm outline-none"
          style={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)' }}
        />
      </div>

      {fetchError && (
        <div
          className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm"
          style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}
        >
          <AlertCircle size={16} className="shrink-0" />
          <span>{fetchError}</span>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: 'var(--surface)' }} />
          ))}
        </div>
      ) : filteredClients.length === 0 ? (
        <EmptyState
          icon={Users2}
          title={t('noClientsYet')}
          description={t('noClientsDesc')}
          action={
            canManageClients ? (
              <button
                onClick={() => setModalOpen(true)}
                className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium text-white"
                style={{ background: 'var(--accent)' }}
              >
                <Plus size={16} />{t('newClient')}
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          {filteredClients.map(client => (
            <Link
              key={client.id}
              href={`/clients/${client.id}`}
              className="flex items-center gap-4 px-6 py-4 hover:bg-[var(--surface-2)] transition-colors border-b last:border-b-0"
              style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-semibold text-white shrink-0"
                style={{ background: 'var(--accent)' }}
              >
                {client.name?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{client.name}</p>
                <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{client.email}</p>
              </div>
              {client.industry && (
                <span className="text-xs hidden sm:block" style={{ color: 'var(--text-secondary)' }}>
                  {client.industry}
                </span>
              )}
              <Badge variant={statusVariant(client.status)}>{t(client.status)}</Badge>
              <ExternalLink size={16} className="shrink-0 opacity-50" style={{ color: 'var(--text-secondary)' }} />
            </Link>
          ))}
        </div>
      )}

      {warnMsg && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white" style={{ background: WARN_TOAST_BG, minWidth: 280 }}>
          <AlertCircle size={16} className="shrink-0" />
          <span className="flex-1">{warnMsg}</span>
          <button onClick={() => setWarnMsg(null)} className="shrink-0 opacity-70 hover:opacity-100 transition-opacity">
            <X size={14} />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white" style={{ background: SUCCESS_TOAST_BG, minWidth: 280 }}>
          <AlertCircle size={16} className="shrink-0" />
          <span className="flex-1">{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="shrink-0 opacity-70 hover:opacity-100 transition-opacity">
            <X size={14} />
          </button>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setSaveError(null); }} title={t('newClient')}>
        <form onSubmit={handleSave} className="space-y-4">
          {saveError && (
            <div className="flex items-start gap-2 rounded-lg px-3 py-2 text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{saveError}</span>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { label: t('companyName') + ' *', key: 'name', type: 'text', required: true },
              { label: t('email'), key: 'email', type: 'email', required: false },
              { label: t('phone'), key: 'phone', type: 'text', required: false },
              { label: t('website'), key: 'website', type: 'text', required: false },
              { label: t('industry'), key: 'industry', type: 'text', required: false },
            ].map(({ label, key, type, required }) => (
              <div key={key} className="space-y-1">
                <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>{label}</label>
                <input
                  type={type}
                  required={required}
                  value={form[key as keyof typeof form]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  className="w-full h-9 px-3 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
                />
              </div>
            ))}
            <div className="space-y-1">
              <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>{t('status')}</label>
              <SelectDropdown
                fullWidth
                value={form.status}
                onChange={v => setForm(f => ({ ...f, status: v }))}
                options={[
                  { value: 'active',   label: t('active') },
                  { value: 'inactive', label: t('inactive') },
                  { value: 'prospect', label: t('prospect') },
                ]}
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>{t('notes')}</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none focus:ring-2 focus:ring-[var(--accent)]"
              style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="h-9 px-4 rounded-lg text-sm font-medium transition-colors"
              style={{ background: 'var(--surface-2)', color: 'var(--text)' }}
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="h-9 px-4 rounded-lg text-sm font-medium text-white disabled:opacity-60 transition-opacity"
              style={{ background: 'var(--accent)' }}
            >
              {saving ? t('loading') : t('save')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
