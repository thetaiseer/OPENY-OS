'use client';

import { useState, useMemo, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Search,
  Users2,
  AlertCircle,
  FolderOpen,
  Image as ImageIcon,
  CheckSquare,
  FileText,
  Activity,
  Globe,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import supabase from '@/lib/supabase';
import { useLang } from '@/context/lang-context';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/context/toast-context';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Input, Textarea, Field } from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import { PageShell, PageHeader } from '@/components/layout/PageLayout';
import { ClientBrandMark } from '@/components/ui/ClientBrandMark';
import SelectDropdown from '@/components/ui/SelectDropdown';
import type { Client } from '@/lib/types';
import { debugClientRouting, getClientRouteKey } from '@/lib/client-route-utils';
import { CLIENT_LIST_COLUMNS } from '@/lib/supabase-list-columns';
import { formatRelativeTime } from '@/lib/relative-time';

const statusVariant = (s: string) => {
  if (s === 'active') return 'success' as const;
  if (s === 'inactive') return 'default' as const;
  return 'info' as const;
};

interface ClientStats {
  assets: number;
  tasks: number;
  content: number;
  lastActivity: string | null; // ISO or null
  lastDesc: string | null; // short description or null
}

function ClientsPage() {
  const { t, lang } = useLang();
  const { role } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();
  const canManageClients =
    role === 'owner' || role === 'admin' || role === 'manager' || role === 'team_member';
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [industryFilter, setIndustryFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    website: '',
    industry: '',
    status: 'active',
    notes: '',
  });

  // React Query caches the client list across navigations — re-visiting this
  // page within the staleTime window renders the cached list immediately
  // without a loading spinner, then background-refetches to stay fresh.
  const {
    data: clients = [],
    isLoading: loading,
    error: fetchErrorObj,
  } = useQuery<Client[]>({
    queryKey: ['clients-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select(CLIENT_LIST_COLUMNS)
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
          if (!map[r.client_id])
            map[r.client_id] = {
              assets: 0,
              tasks: 0,
              content: 0,
              lastActivity: null,
              lastDesc: null,
            };
          map[r.client_id][key]++;
        }
      };

      inc(assetRows.data as { client_id: string }[] | null, 'assets');
      inc(taskRows.data as { client_id: string }[] | null, 'tasks');
      inc(contentRows.data as { client_id: string }[] | null, 'content');

      // Activities are ordered newest first — first one per client wins.
      for (const row of (activityRows.data ?? []) as {
        client_id: string;
        created_at: string;
        description: string;
      }[]) {
        if (!row.client_id) continue;
        if (!map[row.client_id])
          map[row.client_id] = {
            assets: 0,
            tasks: 0,
            content: 0,
            lastActivity: null,
            lastDesc: null,
          };
        if (!map[row.client_id].lastActivity) {
          map[row.client_id].lastActivity = row.created_at;
          map[row.client_id].lastDesc = row.description ?? null;
        }
      }

      return map;
    },
    staleTime: 2 * 60 * 1000, // 2 min
  });

  // Client-side search filter — no extra round-trips, no race conditions.
  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    const ind = industryFilter.trim().toLowerCase();
    return clients.filter((c) => {
      if (statusFilter !== 'all' && (c.status ?? '') !== statusFilter) return false;
      if (ind && !(c.industry ?? '').toLowerCase().includes(ind)) return false;
      if (!q) return true;
      return (c.name ?? '').toLowerCase().includes(q) || (c.email ?? '').toLowerCase().includes(q);
    });
  }, [clients, search, statusFilter, industryFilter]);

  const logActivity = (description: string, clientId?: string) => {
    void supabase
      .from('activities')
      .insert({
        type: 'client',
        description,
        client_id: clientId ?? null,
      })
      .then(
        ({ error }) => {
          if (error) console.warn('[logActivity]', error);
        },
        (err: unknown) => {
          console.warn('[logActivity network]', err);
        },
      );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageClients) {
      setSaveError(t('onlyAdminCanCreateClients'));
      return;
    }
    setSaving(true);
    setSaveError(null);

    // Timeout-safe protection: fail gracefully if the API call hangs.
    // NOTE: clearTimeout is in the finally block so it always runs.
    const timeoutMs = 15_000;
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

    try {
      const fetchWithTimeout = new Promise<Response>((resolve, reject) => {
        timeoutHandle = setTimeout(() => reject(new Error(t('requestTimedOut'))), timeoutMs);
        fetch('/api/clients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        }).then(resolve, reject);
      });

      const res = await fetchWithTimeout;
      let result: {
        success: boolean;
        client?: { id?: string; slug?: string };
        step?: string;
        error?: string;
      };
      try {
        result = (await res.json()) as typeof result;
      } catch {
        throw new Error(`Server returned status ${res.status} with non-JSON body`);
      }

      if (!result.success) {
        const step = result.step ? ` [${result.step}]` : '';
        const msg = result.error ?? t('failedCreateClient');
        throw new Error(`${msg}${step}`);
      }

      // — SUCCESS PATH —
      // Close modal and reset form immediately; navigation is non-blocking.
      setModalOpen(false);
      setForm({
        name: '',
        email: '',
        phone: '',
        website: '',
        industry: '',
        status: 'active',
        notes: '',
      });

      // Fire-and-forget activity log — never blocks the UI
      logActivity(`Client "${form.name}" created`, result.client?.id);

      if (result.client?.id) {
        queryClient.setQueryData<Client[]>(['clients-list'], (old) => {
          const nextClient = result.client as Client;
          if (!old) return [nextClient];
          if (old.some((client) => client.id === nextClient.id)) return old;
          return [nextClient, ...old];
        });
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
        toast(t('clientCreatedSuccess', { name: form.name }), 'success');

        void queryClient.invalidateQueries({ queryKey: ['clients-list'] });
      }
    } catch (err: unknown) {
      console.error('[client create] error:', err);
      const message =
        err instanceof Error
          ? err.message
          : ((err as { message?: string })?.message ?? t('failedCreateClient'));
      setSaveError(message);
    } finally {
      // Always clear the timeout and reset loading — no matter what happened above.
      clearTimeout(timeoutHandle);
      setSaving(false);
    }
  };

  return (
    <PageShell>
      <PageHeader
        title={t('clients')}
        subtitle={t('clientsSubtitle')}
        actions={
          canManageClients ? (
            <Button type="button" variant="primary" onClick={() => setModalOpen(true)}>
              <Plus size={16} />
              {t('newClient')}
            </Button>
          ) : undefined
        }
      />

      <Card padding="sm" className="sm:p-6">
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="relative min-w-[200px] flex-1">
            <Search
              size={16}
              className="pointer-events-none absolute start-3 top-1/2 z-[1] -translate-y-1/2"
              style={{ color: 'var(--text-secondary)' }}
            />
            <Input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('searchClientsPlaceholder')}
              className="ps-9"
            />
          </div>
          <div className="w-full min-w-[140px] sm:w-44">
            <p className="mb-1 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>
              {t('status')}
            </p>
            <SelectDropdown
              fullWidth
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: 'all', label: t('allStatuses') },
                { value: 'active', label: t('active') },
                { value: 'inactive', label: t('inactive') },
                { value: 'prospect', label: t('prospect') },
              ]}
            />
          </div>
          <div className="w-full min-w-[160px] sm:w-48">
            <p className="mb-1 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>
              {t('industry')}
            </p>
            <Input
              type="text"
              value={industryFilter}
              onChange={(e) => setIndustryFilter(e.target.value)}
              placeholder={t('filterIndustryPlaceholder')}
            />
          </div>
          <div className="w-full min-w-[180px] sm:w-56">
            <p className="mb-1 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>
              {t('accountManager')}
            </p>
            <Input
              disabled
              title={t('comingSoon')}
              placeholder={t('filterSoonPlaceholder')}
              className="cursor-not-allowed opacity-60"
            />
          </div>
        </CardContent>
      </Card>

      {fetchError && (
        <div
          className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm"
          style={{
            background: 'rgba(239,68,68,0.1)',
            color: '#ef4444',
            border: '1px solid rgba(239,68,68,0.3)',
          }}
        >
          <AlertCircle size={16} className="shrink-0" />
          <span>{t('clientsLoadError')}</span>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-2xl"
              style={{ background: 'var(--surface)', height: 220 }}
            />
          ))}
        </div>
      ) : filteredClients.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <div
              className="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl"
              style={{ background: 'var(--surface-2)' }}
            >
              <Users2 size={36} style={{ color: 'var(--text-secondary)' }} />
            </div>
            <h3 className="mb-2 text-xl font-semibold" style={{ color: 'var(--text)' }}>
              {t('noClientsYet')}
            </h3>
            <p className="mb-6 max-w-xs text-sm" style={{ color: 'var(--text-secondary)' }}>
              {t('noClientsDesc')}
            </p>
            {canManageClients && (
              <Button type="button" variant="primary" onClick={() => setModalOpen(true)}>
                <Plus size={16} />
                {t('newClient')}
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredClients.map((client) => {
            const stats = statsMap[client.id] ?? {
              assets: 0,
              tasks: 0,
              content: 0,
              lastActivity: null,
              lastDesc: null,
            };
            const routeKey = getClientRouteKey(client);
            if (!routeKey) return null;
            const baseClientHref = `/clients/${routeKey}`;

            return (
              <div
                key={client.id}
                role="button"
                tabIndex={0}
                onClick={() => {
                  debugClientRouting('[clients] clicked client route key', {
                    id: client.id,
                    slug: client.slug,
                    routeKey,
                  });
                  router.push(baseClientHref);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    debugClientRouting('[clients] keyboard-open client route key', {
                      id: client.id,
                      slug: client.slug,
                      routeKey,
                    });
                    router.push(baseClientHref);
                  }
                }}
                className="openy-motion-card shadow-card group flex cursor-pointer select-none flex-col rounded-2xl border border-[var(--border-glass)] p-6 transition-transform duration-200 ease-out hover:-translate-y-0.5 hover:border-[var(--accent)] hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] active:translate-y-0 active:scale-[0.99]"
                style={{
                  background: 'var(--gradient-card-glass)',
                  backdropFilter: 'var(--blur-glass)',
                  WebkitBackdropFilter: 'var(--blur-glass)',
                  gap: 0,
                }}
              >
                {/* ── Header ──────────────────────────────────────────────── */}
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <ClientBrandMark
                      name={client.name}
                      logoUrl={client.logo}
                      size={44}
                      roundedClassName="rounded-xl"
                      className="shadow-sm"
                    />
                    <div className="min-w-0">
                      <p
                        className="truncate text-base font-semibold leading-snug"
                        style={{ color: 'var(--text)' }}
                      >
                        {client.name}
                      </p>
                      {(client.industry || client.website) && (
                        <p
                          className="mt-0.5 flex items-center gap-1 truncate text-xs"
                          style={{ color: 'var(--text-secondary)' }}
                        >
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
                  className="mb-4 grid grid-cols-3 gap-2 rounded-xl px-3 py-2.5"
                  style={{ background: 'var(--surface-2)' }}
                >
                  {[
                    { icon: <ImageIcon size={13} />, label: t('assets'), value: stats.assets },
                    { icon: <CheckSquare size={13} />, label: t('tasks'), value: stats.tasks },
                    { icon: <FileText size={13} />, label: t('content'), value: stats.content },
                  ].map(({ icon, label, value }) => (
                    <div key={label} className="flex flex-col items-center gap-0.5">
                      <div
                        className="flex items-center gap-1"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {icon}
                      </div>
                      <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                        {value}
                      </span>
                      <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                        {label}
                      </span>
                    </div>
                  ))}
                </div>

                {/* ── Activity hint ────────────────────────────────────────── */}
                <div className="mb-4 flex min-h-[18px] items-center gap-1.5">
                  <Activity
                    size={11}
                    className="shrink-0"
                    style={{ color: 'var(--text-secondary)' }}
                  />
                  {stats.lastActivity ? (
                    <p className="truncate text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {stats.lastDesc ? (
                        <>
                          {stats.lastDesc.length > 48
                            ? stats.lastDesc.slice(0, 48) + '…'
                            : stats.lastDesc}{' '}
                          &middot; {formatRelativeTime(stats.lastActivity, lang)}
                        </>
                      ) : (
                        <>
                          {t('updatedLabel')} {formatRelativeTime(stats.lastActivity, lang)}
                        </>
                      )}
                    </p>
                  ) : (
                    <p className="text-xs italic" style={{ color: 'var(--text-secondary)' }}>
                      {t('noRecentActivity')}
                    </p>
                  )}
                </div>

                {/* ── Actions ──────────────────────────────────────────────── */}
                <div className="mt-auto flex gap-2" onClick={(e) => e.stopPropagation()}>
                  <a
                    href={`${baseClientHref}/overview`}
                    className="flex h-7 flex-1 items-center justify-center gap-1.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-80"
                    style={{
                      background: 'rgba(99,102,241,0.1)',
                      color: 'var(--accent)',
                      textDecoration: 'none',
                    }}
                  >
                    <FolderOpen size={12} /> {t('open')}
                  </a>
                  <a
                    href={`${baseClientHref}/assets`}
                    className="flex h-7 items-center justify-center gap-1 rounded-lg px-3 text-xs font-medium transition-opacity hover:opacity-80"
                    style={{
                      background: 'var(--surface-2)',
                      color: 'var(--text)',
                      border: '1px solid var(--border)',
                      textDecoration: 'none',
                    }}
                  >
                    <ImageIcon size={11} /> {t('assets')}
                  </a>
                  <a
                    href={`${baseClientHref}/tasks`}
                    className="flex h-7 items-center justify-center gap-1 rounded-lg px-3 text-xs font-medium transition-opacity hover:opacity-80"
                    style={{
                      background: 'var(--surface-2)',
                      color: 'var(--text)',
                      border: '1px solid var(--border)',
                      textDecoration: 'none',
                    }}
                  >
                    <CheckSquare size={11} /> {t('tasks')}
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSaveError(null);
        }}
        title={t('newClient')}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
              {t('cancel')}
            </Button>
            <Button type="submit" variant="primary" form="client-create-form" disabled={saving}>
              {saving ? t('loading') : t('save')}
            </Button>
          </>
        }
      >
        <form id="client-create-form" onSubmit={handleSave} className="space-y-4">
          {saveError && (
            <div
              className="flex items-start gap-2 rounded-lg px-3 py-2 text-sm"
              style={{
                background: 'rgba(239,68,68,0.1)',
                color: '#ef4444',
                border: '1px solid rgba(239,68,68,0.3)',
              }}
            >
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{saveError}</span>
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[
              { label: t('companyName') + ' *', key: 'name', type: 'text', required: true },
              { label: t('email'), key: 'email', type: 'email', required: false },
              { label: t('phone'), key: 'phone', type: 'text', required: false },
              { label: t('website'), key: 'website', type: 'text', required: false },
              { label: t('industry'), key: 'industry', type: 'text', required: false },
            ].map(({ label, key, type, required }) => (
              <Field key={key} label={label} id={`client-${key}`}>
                <Input
                  id={`client-${key}`}
                  type={type}
                  required={required}
                  value={form[key as keyof typeof form]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                />
              </Field>
            ))}
            <Field label={t('status')}>
              <SelectDropdown
                fullWidth
                value={form.status}
                onChange={(v) => setForm((f) => ({ ...f, status: v }))}
                options={[
                  { value: 'active', label: t('active') },
                  { value: 'inactive', label: t('inactive') },
                  { value: 'prospect', label: t('prospect') },
                ]}
              />
            </Field>
          </div>
          <Field label={t('notes')}>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={3}
            />
          </Field>
        </form>
      </Modal>
    </PageShell>
  );
}

export default function ClientsPageWrapper() {
  return (
    <Suspense>
      <ClientsPage />
    </Suspense>
  );
}
