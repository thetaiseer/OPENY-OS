'use client';

import { useEffect, useState, useMemo, Suspense } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Plus, Search, Users2, AlertCircle,
  FolderOpen, Image as ImageIcon, CheckSquare, FileText, Activity, Globe,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import supabase from '@/lib/supabase';
import { useLang } from '@/lib/lang-context';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import SelectDropdown from '@/components/ui/SelectDropdown';
import type { Client } from '@/lib/types';
import { debugClientRouting, getClientRouteKey } from '@/lib/client-route-utils';

const statusVariant = (s: string) => {
  if (s === 'active') return 'success' as const;
  if (s === 'inactive') return 'default' as const;
  return 'info' as const;
};

/** Lightweight relative-time formatter (no external dep). */
function formatRelative(iso: string): string {
  try {
    const diff    = Date.now() - new Date(iso).getTime();
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60)  return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60)  return `${minutes}m ago`;
    const hours   = Math.floor(minutes / 60);
    if (hours < 24)    return `${hours}h ago`;
    const days    = Math.floor(hours / 24);
    if (days === 1)    return 'Yesterday';
    if (days < 7)      return `${days}d ago`;
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch { return ''; }
}

interface ClientStats {
  assets:       number;
  tasks:        number;
  content:      number;
  lastActivity: string | null; // ISO or null
  lastDesc:     string | null; // short description or null
}

function ClientsPage() {
  const { t } = useLang();
  const { role } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const canManageClients = role === 'owner' || role === 'admin' || role === 'manager' || role === 'team_member';
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '', email: '', phone: '', website: '', industry: '', status: 'active', notes: '',
  });

  // React Query caches the client list across navigations — re-visiting this
  // page within the staleTime window renders the cached list immediately
  // without a loading spinner, then background-refetches to stay fresh.
  const { data: clients = [], isLoading: loading, error: fetchErrorObj } = useQuery<Client[]>({
    queryKey: ['clients-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw new Error(error.message);
      return (data ?? []) as Client[];
    },
    // Clients change infrequently — keep cache fresh for 2 min (inherited from
    // QueryClient defaults) but also accept a longer gcTime so the list is
    // retained in memory while the user browses other sections.
  });
  const fetchError = fetchErrorObj ? (fetchErrorObj as Error).message : null;

  // Fetch per-client stats in a single parallel batch.
  // Each query only pulls the client_id column (lightweight).
  const { data: statsMap = {} } = useQuery<Record<string, ClientStats>>({
    queryKey: ['clients-stats'],
    queryFn: async () => {
      const [assetRows, taskRows, contentRows, activityRows] = await Promise.all([
        supabase.from('assets').select('client_id').not('client_id', 'is', null),
        supabase.from('tasks').select('client_id').not('client_id', 'is', null),
        supabase.from('content_items').select('client_id').not('client_id', 'is', null),
        supabase
          .from('activities')
          .select('client_id, created_at, description')
          .not('client_id', 'is', null)
          .order('created_at', { ascending: false })
          .limit(600),
      ]);

      const map: Record<string, ClientStats> = {};

      const inc = (rows: { client_id: string }[] | null, key: 'assets' | 'tasks' | 'content') => {
        for (const r of rows ?? []) {
          if (!r.client_id) continue;
          if (!map[r.client_id]) map[r.client_id] = { assets: 0, tasks: 0, content: 0, lastActivity: null, lastDesc: null };
          map[r.client_id][key]++;
        }
      };

      inc(assetRows.data as { client_id: string }[] | null, 'assets');
      inc(taskRows.data   as { client_id: string }[] | null, 'tasks');
      inc(contentRows.data as { client_id: string }[] | null, 'content');

      // Activities are ordered newest first — first one per client wins.
      for (const row of (activityRows.data ?? []) as { client_id: string; created_at: string; description: string }[]) {
        if (!row.client_id) continue;
        if (!map[row.client_id]) map[row.client_id] = { assets: 0, tasks: 0, content: 0, lastActivity: null, lastDesc: null };
        if (!map[row.client_id].lastActivity) {
          map[row.client_id].lastActivity = row.created_at;
          map[row.client_id].lastDesc     = row.description ?? null;
        }
      }

      return map;
    },
    staleTime: 2 * 60 * 1000, // 2 min
  });

  // Client-side search filter — no extra round-trips, no race conditions.
  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(c =>
      c.name?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q),
    );
  }, [clients, search]);

  useEffect(() => {
    if (searchParams.get('quickAction') !== 'add-client') return;
    setModalOpen(true);
    const params = new URLSearchParams(searchParams.toString());
    params.delete('quickAction');
    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
  }, [pathname, router, searchParams, setModalOpen]);

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
      let result: { success: boolean; client?: { id?: string; slug?: string }; step?: string; error?: string };
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
      // Close modal and reset form immediately; navigation is non-blocking.
      setModalOpen(false);
      setForm({ name: '', email: '', phone: '', website: '', industry: '', status: 'active', notes: '' });

      // Fire-and-forget activity log — never blocks the UI
      logActivity(`Client "${form.name}" created`, result.client?.id);

      if (result.client?.id) {
        queryClient.setQueryData<Client[]>(
          ['clients-list'],
          old => {
            const nextClient = result.client as Client;
            if (!old) return [nextClient];
            if (old.some(client => client.id === nextClient.id)) return old;
            return [nextClient, ...old];
          },
        );
      }

      const createdClientRouteKey = result.client ? getClientRouteKey(result.client) : null;
      if (createdClientRouteKey) {
        debugClientRouting('[clients] created client route key', {
          id: result.client?.id,
          slug: result.client?.slug,
          routeKey: createdClientRouteKey,
        });
        router.push(`/clients/${createdClientRouteKey}`);
      } else {
        toast(`Client "${form.name}" created successfully.`, 'success');

        // Refresh list non-blocking via React Query cache invalidation
        console.log('[client create] triggering list refetch');
        void queryClient.invalidateQueries({ queryKey: ['clients-list'] });
      }
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
    <div className="max-w-7xl mx-auto space-y-6">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-2xl animate-pulse" style={{ background: 'var(--surface)', height: 220 }} />
          ))}
        </div>
      ) : filteredClients.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-24 text-center rounded-2xl border"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center mb-5"
            style={{ background: 'var(--surface-2)' }}
          >
            <Users2 size={36} style={{ color: 'var(--text-secondary)' }} />
          </div>
          <h3 className="text-xl font-semibold mb-2" style={{ color: 'var(--text)' }}>{t('noClientsYet')}</h3>
          <p className="text-sm max-w-xs mb-6" style={{ color: 'var(--text-secondary)' }}>{t('noClientsDesc')}</p>
          {canManageClients && (
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-2 h-10 px-5 rounded-lg text-sm font-medium text-white hover:opacity-90 transition-opacity"
              style={{ background: 'var(--accent)' }}
            >
              <Plus size={16} />{t('newClient')}
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClients.map(client => {
            const stats = statsMap[client.id] ?? { assets: 0, tasks: 0, content: 0, lastActivity: null, lastDesc: null };
            const routeKey = getClientRouteKey(client);
            if (!routeKey) return null;
            const baseClientHref = `/clients/${routeKey}`;

            return (
              <div
                key={client.id}
                role="button"
                tabIndex={0}
                onClick={() => {
                  debugClientRouting('[clients] clicked client route key', { id: client.id, slug: client.slug, routeKey });
                  router.push(baseClientHref);
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    debugClientRouting('[clients] keyboard-open client route key', { id: client.id, slug: client.slug, routeKey });
                    router.push(baseClientHref);
                  }
                }}
                className="group flex flex-col p-5 rounded-2xl border cursor-pointer select-none
                  transition-all duration-200 ease-out
                  hover:-translate-y-0.5 hover:shadow-lg hover:border-[var(--accent)]
                  active:translate-y-0 active:scale-[0.99] active:shadow-sm
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)', gap: 0 }}
              >
                {/* ── Header ──────────────────────────────────────────────── */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center text-base font-bold text-white shrink-0 shadow-sm"
                      style={{ background: 'var(--accent)' }}
                    >
                      {client.name?.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-base font-semibold leading-snug truncate" style={{ color: 'var(--text)' }}>
                        {client.name}
                      </p>
                      {(client.industry || client.website) && (
                        <p className="text-xs truncate mt-0.5 flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                          {client.website && <Globe size={10} className="shrink-0" />}
                          {client.industry ?? client.website}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 pt-0.5">
                    <Badge variant={statusVariant(client.status)}>{t(client.status)}</Badge>
                  </div>
                </div>

                {/* ── Quick stats ──────────────────────────────────────────── */}
                <div
                  className="grid grid-cols-3 gap-2 rounded-xl px-3 py-2.5 mb-4"
                  style={{ background: 'var(--surface-2)' }}
                >
                  {[
                    { icon: <ImageIcon size={13} />,       label: 'Assets',  value: stats.assets  },
                    { icon: <CheckSquare size={13} />, label: 'Tasks',   value: stats.tasks   },
                    { icon: <FileText size={13} />,    label: 'Content', value: stats.content },
                  ].map(({ icon, label, value }) => (
                    <div key={label} className="flex flex-col items-center gap-0.5">
                      <div className="flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                        {icon}
                      </div>
                      <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{value}</span>
                      <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{label}</span>
                    </div>
                  ))}
                </div>

                {/* ── Activity hint ────────────────────────────────────────── */}
                <div className="flex items-center gap-1.5 mb-4 min-h-[18px]">
                  <Activity size={11} className="shrink-0" style={{ color: 'var(--text-secondary)' }} />
                  {stats.lastActivity ? (
                    <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                      {stats.lastDesc
                        ? <>{stats.lastDesc.length > 48 ? stats.lastDesc.slice(0, 48) + '…' : stats.lastDesc} &middot; {formatRelative(stats.lastActivity)}</>
                        : <>Updated {formatRelative(stats.lastActivity)}</>
                      }
                    </p>
                  ) : (
                    <p className="text-xs italic" style={{ color: 'var(--text-secondary)' }}>No recent activity</p>
                  )}
                </div>

                {/* ── Actions ──────────────────────────────────────────────── */}
                <div className="flex gap-2 mt-auto" onClick={e => e.stopPropagation()}>
                  <a
                    href={`${baseClientHref}/overview`}
                    className="flex-1 flex items-center justify-center gap-1.5 h-7 rounded-lg text-xs font-medium transition-opacity hover:opacity-80"
                    style={{ background: 'rgba(99,102,241,0.1)', color: 'var(--accent)', textDecoration: 'none' }}
                  >
                    <FolderOpen size={12} /> Open
                  </a>
                  <a
                    href={`${baseClientHref}/assets`}
                    className="flex items-center justify-center gap-1 h-7 px-3 rounded-lg text-xs font-medium transition-opacity hover:opacity-80"
                    style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)', textDecoration: 'none' }}
                  >
                    <ImageIcon size={11} /> Assets
                  </a>
                  <a
                    href={`${baseClientHref}/tasks`}
                    className="flex items-center justify-center gap-1 h-7 px-3 rounded-lg text-xs font-medium transition-opacity hover:opacity-80"
                    style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)', textDecoration: 'none' }}
                  >
                    <CheckSquare size={11} /> Tasks
                  </a>
                </div>
              </div>
            );
          })}
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

export default function ClientsPageWrapper() {
  return (
    <Suspense>
      <ClientsPage />
    </Suspense>
  );
}
