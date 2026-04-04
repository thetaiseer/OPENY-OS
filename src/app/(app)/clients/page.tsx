'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Search, Users2, ExternalLink } from 'lucide-react';
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

export default function ClientsPage() {
  const { t } = useLang();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', email: '', phone: '', website: '', industry: '', status: 'active', notes: '',
  });

  const fetchClients = useCallback(async () => {
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
        if (process.env.NODE_ENV === 'development') console.error('[clients fetch]', error);
        setClients([]);
      } else {
        setClients((data ?? []) as Client[]);
      }
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  const logActivity = (description: string, clientId?: string) => {
    supabase.from('activities').insert({
      type: 'client',
      description,
      client_id: clientId ?? null,
    }).then(({ error }) => {
      if (error && process.env.NODE_ENV === 'development') console.warn('[logActivity]', error);
    }).catch((err) => {
      if (process.env.NODE_ENV === 'development') console.warn('[logActivity network]', err);
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data, error } = await supabase.from('clients').insert(form).select().single();
      if (error) throw error;
      setModalOpen(false);
      setForm({ name: '', email: '', phone: '', website: '', industry: '', status: 'active', notes: '' });
      logActivity(`Client "${form.name}" created`, data?.id);
      fetchClients();
    } catch (err: unknown) {
      if (process.env.NODE_ENV === 'development') console.error('[client create]', err);
      const message = err instanceof Error
        ? err.message
        : (err as { message?: string })?.message ?? 'Failed to create client';
      alert(message);
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={t('newClient')}>
        <form onSubmit={handleSave} className="space-y-4">
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
