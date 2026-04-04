'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Search, Users2, ExternalLink, AlertCircle, X } from 'lucide-react';
import Link from 'next/link';
import supabase from '@/lib/supabase';
import { useLang } from '@/lib/lang-context';
import EmptyState from '@/components/ui/EmptyState';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import type { Client } from '@/lib/types';

const statusVariant = (s: string) => {
  if (s === 'active') return 'success' as const;
  if (s === 'inactive') return 'default' as const;
  return 'info' as const;
};

const WARN_TOAST_BG = '#d97706';

export default function ClientsPage() {
  const { t } = useLang();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [warnMsg, setWarnMsg] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '', email: '', phone: '', website: '', industry: '', status: 'active', notes: '',
  });

  const fetchClients = useCallback(async (): Promise<boolean> => {
    try {
      let query = supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (search) {
        query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
      }
      const { data, error } = await query;
      if (error) {
        console.error('[clients fetch]', error);
        setClients([]);
        return false;
      } else {
        setClients((data ?? []) as Client[]);
        return true;
      }
    } catch (err: unknown) {
      console.error('[clients fetch] unexpected error:', err);
      setClients([]);
      return false;
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { fetchClients(); }, [fetchClients]);

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
    setSaving(true);
    setSaveError(null);

    // Timeout-safe protection: fail gracefully if request hangs
    const timeoutMs = 15_000;
    let timeoutHandle: number | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = window.setTimeout(
        () => reject(new Error('Request timed out. Please try again.')),
        timeoutMs,
      ) as unknown as number;
    });

    try {
      // Log auth user, profile, and resolved role for debugging
      const { data: { user } } = await supabase.auth.getUser();
      console.log('[client create] auth user id:', user?.id ?? 'none');
      if (user?.id) {
        const { data: profile, error: profileErr } = await supabase
          .from('profiles')
          .select('role, client_id')
          .eq('id', user.id)
          .single();
        if (profileErr) console.warn('[client create] profile fetch error:', profileErr);
        else console.log('[client create] fetched profile:', profile, '| resolved role:', profile?.role ?? 'unknown');
      }

      console.log('[client create] before insert', { name: form.name });
      const { data, error } = await Promise.race([
        supabase.from('clients').insert(form).select().single(),
        timeoutPromise,
      ]);
      clearTimeout(timeoutHandle);
      if (error) throw error;
      console.log('[client create] after insert, id:', data?.id);

      // Close modal and reset form immediately after successful insert
      console.log('[client create] before modal close');
      setModalOpen(false);
      setForm({ name: '', email: '', phone: '', website: '', industry: '', status: 'active', notes: '' });
      console.log('[client create] after modal close');

      // Fire-and-forget activity log — never blocks the UI
      logActivity(`Client "${form.name}" created`, data?.id);

      // Refresh list non-blocking — show warning if it fails but don't block modal
      console.log('[client create] before fetchClients');
      void fetchClients().then(ok => {
        console.log('[client create] after fetchClients, ok:', ok);
        if (!ok) {
          setWarnMsg('Client was created but the list failed to refresh. Please reload the page.');
          setTimeout(() => setWarnMsg(null), 6000);
        }
      });
    } catch (err: unknown) {
      clearTimeout(timeoutHandle);
      console.error('[client create] error:', err);
      const message = err instanceof Error
        ? err.message
        : (err as { message?: string })?.message ?? 'Failed to create client';
      setSaveError(message);
    } finally {
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
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium text-white hover:opacity-90 transition-opacity"
          style={{ background: 'var(--accent)' }}
        >
          <Plus size={16} />{t('newClient')}
        </button>
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

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: 'var(--surface)' }} />
          ))}
        </div>
      ) : clients.length === 0 ? (
        <EmptyState
          icon={Users2}
          title={t('noClientsYet')}
          description={t('noClientsDesc')}
          action={
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium text-white"
              style={{ background: 'var(--accent)' }}
            >
              <Plus size={16} />{t('newClient')}
            </button>
          }
        />
      ) : (
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          {clients.map(client => (
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
              <select
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                className="w-full h-9 px-3 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]"
                style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
              >
                <option value="active">{t('active')}</option>
                <option value="inactive">{t('inactive')}</option>
                <option value="prospect">{t('prospect')}</option>
              </select>
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
