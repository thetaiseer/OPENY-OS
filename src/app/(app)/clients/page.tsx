'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Globe, Plus, Search, Users2 } from 'lucide-react';
import supabase from '@/lib/supabase';
import { useLang } from '@/context/lang-context';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/context/toast-context';
import { useQuickActions } from '@/context/quick-actions-context';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Field, Input, Textarea } from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import { PageHeader, PageShell } from '@/components/layout/PageLayout';
import SelectDropdown from '@/components/ui/SelectDropdown';
import type { Client } from '@/lib/types';
import { debugClientRouting, getClientRouteKey } from '@/lib/client-route-utils';
import { CLIENT_LIST_COLUMNS } from '@/lib/supabase-list-columns';

const statusVariant = (status: string) => {
  if (status === 'active') return 'success' as const;
  if (status === 'inactive') return 'default' as const;
  return 'info' as const;
};

function formatRelative(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

interface ClientStats {
  assets: number;
  tasks: number;
  content: number;
  lastActivity: string | null;
  lastDesc: string | null;
}

function ClientsPage() {
  const { t } = useLang();
  const { role } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const { registerQuickActionHandler } = useQuickActions();
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
  });
  const fetchError = fetchErrorObj ? (fetchErrorObj as Error).message : null;

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
        for (const row of rows ?? []) {
          if (!row.client_id) continue;
          if (!map[row.client_id]) {
            map[row.client_id] = {
              assets: 0,
              tasks: 0,
              content: 0,
              lastActivity: null,
              lastDesc: null,
            };
          }
          map[row.client_id][key] += 1;
        }
      };

      inc(assetRows.data as { client_id: string }[] | null, 'assets');
      inc(taskRows.data as { client_id: string }[] | null, 'tasks');
      inc(contentRows.data as { client_id: string }[] | null, 'content');

      for (const row of (activityRows.data ?? []) as {
        client_id: string;
        created_at: string;
        description: string;
      }[]) {
        if (!row.client_id) continue;
        if (!map[row.client_id]) {
          map[row.client_id] = {
            assets: 0,
            tasks: 0,
            content: 0,
            lastActivity: null,
            lastDesc: null,
          };
        }
        if (!map[row.client_id].lastActivity) {
          map[row.client_id].lastActivity = row.created_at;
          map[row.client_id].lastDesc = row.description ?? null;
        }
      }

      return map;
    },
    staleTime: 2 * 60 * 1000,
  });

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    const ind = industryFilter.trim().toLowerCase();
    return clients.filter((client) => {
      if (statusFilter !== 'all' && (client.status ?? '') !== statusFilter) return false;
      if (ind && !(client.industry ?? '').toLowerCase().includes(ind)) return false;
      if (!q) return true;
      return (
        (client.name ?? '').toLowerCase().includes(q) ||
        (client.email ?? '').toLowerCase().includes(q)
      );
    });
  }, [clients, search, statusFilter, industryFilter]);

  useEffect(() => {
    return registerQuickActionHandler('add-client', () => {
      setModalOpen(true);
    });
  }, [registerQuickActionHandler]);

  const logActivity = (description: string, clientId?: string) => {
    void supabase
      .from('activities')
      .insert({
        type: 'client',
        description,
        client_id: clientId ?? null,
      })
      .then(({ error }) => {
        if (error) console.warn('[logActivity]', error);
      });
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canManageClients) {
      setSaveError('Only admin or team members can create clients.');
      return;
    }

    setSaving(true);
    setSaveError(null);
    const timeoutMs = 15_000;
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

    try {
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
      const result = (await res.json()) as {
        success: boolean;
        client?: { id?: string; slug?: string };
        step?: string;
        error?: string;
      };

      if (!result.success) {
        const step = result.step ? ` [${result.step}]` : '';
        throw new Error(`${result.error ?? 'Failed to create client'}${step}`);
      }

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
        toast(`Client "${form.name}" created successfully.`, 'success');
        void queryClient.invalidateQueries({ queryKey: ['clients-list'] });
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : ((err as { message?: string })?.message ?? 'Failed to create client');
      setSaveError(message);
    } finally {
      clearTimeout(timeoutHandle);
      setSaving(false);
    }
  };

  return (
    <PageShell>
      <PageHeader
        title={t('clients')}
        subtitle="Manage your clients and client relationships."
        actions={
          canManageClients ? (
            <Button type="button" variant="primary" onClick={() => setModalOpen(true)}>
              <Plus size={16} />
              Add client
            </Button>
          ) : undefined
        }
      />

      <Card>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div className="relative sm:col-span-2">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-secondary"
            />
            <Input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name or email..."
              className="pl-9"
            />
          </div>
          <SelectDropdown
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: 'all', label: 'All statuses' },
              { value: 'active', label: t('active') },
              { value: 'inactive', label: t('inactive') },
              { value: 'prospect', label: t('prospect') },
            ]}
            fullWidth
          />
          <Input
            type="text"
            value={industryFilter}
            onChange={(event) => setIndustryFilter(event.target.value)}
            placeholder="Filter industry"
          />
        </CardContent>
      </Card>

      {fetchError ? (
        <Card>
          <CardContent className="flex items-center gap-2 text-sm text-danger">
            <AlertCircle size={16} />
            {fetchError}
          </CardContent>
        </Card>
      ) : null}

      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Card key={index}>
              <CardContent>
                <div className="h-28 animate-pulse rounded-control bg-elevated" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredClients.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Users2 size={28} className="mb-2 text-secondary" />
            <h3 className="text-lg font-semibold text-primary">{t('noClientsYet')}</h3>
            <p className="mt-1 text-sm text-secondary">{t('noClientsDesc')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
              <Card
                key={client.id}
                role="button"
                tabIndex={0}
                onClick={() => router.push(baseClientHref)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    router.push(baseClientHref);
                  }
                }}
                className="cursor-pointer"
              >
                <CardHeader>
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-control bg-accent text-sm font-semibold text-white">
                      {client.name?.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="truncate">{client.name}</CardTitle>
                      <p className="truncate text-xs text-secondary">
                        {client.industry ?? client.email}
                      </p>
                    </div>
                  </div>
                  <Badge variant={statusVariant(client.status)}>{t(client.status)}</Badge>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-control border border-border bg-elevated p-2 text-center">
                      <p className="text-xs text-secondary">Assets</p>
                      <p className="text-sm font-semibold text-primary">{stats.assets}</p>
                    </div>
                    <div className="rounded-control border border-border bg-elevated p-2 text-center">
                      <p className="text-xs text-secondary">Tasks</p>
                      <p className="text-sm font-semibold text-primary">{stats.tasks}</p>
                    </div>
                    <div className="rounded-control border border-border bg-elevated p-2 text-center">
                      <p className="text-xs text-secondary">Content</p>
                      <p className="text-sm font-semibold text-primary">{stats.content}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-1 text-xs text-secondary">
                    <Globe size={11} />
                    {stats.lastActivity
                      ? `Updated ${formatRelative(stats.lastActivity)}`
                      : 'No recent activity'}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <LinkButton href={`${baseClientHref}/overview`} label="Open" />
                    <LinkButton href={`${baseClientHref}/assets`} label="Assets" />
                    <LinkButton href={`${baseClientHref}/tasks`} label="Tasks" />
                  </div>
                </CardContent>
              </Card>
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
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
              {t('cancel')}
            </Button>
            <Button type="submit" variant="primary" form="client-create-form" disabled={saving}>
              {saving ? t('loading') : t('save')}
            </Button>
          </div>
        }
      >
        <form id="client-create-form" onSubmit={handleSave} className="space-y-4">
          {saveError ? (
            <div className="border-danger/40 bg-danger/15 flex items-start gap-2 rounded-control border px-3 py-2 text-sm text-danger">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{saveError}</span>
            </div>
          ) : null}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[
              { label: `${t('companyName')} *`, key: 'name', type: 'text', required: true },
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
                  onChange={(event) => setForm((prev) => ({ ...prev, [key]: event.target.value }))}
                />
              </Field>
            ))}
            <Field label={t('status')}>
              <SelectDropdown
                fullWidth
                value={form.status}
                onChange={(value) => setForm((prev) => ({ ...prev, status: value }))}
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
              onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
              rows={3}
            />
          </Field>
        </form>
      </Modal>
    </PageShell>
  );
}

function LinkButton({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="inline-flex h-8 items-center rounded-control border border-border bg-surface px-3 text-xs text-primary hover:bg-elevated"
    >
      {label}
    </a>
  );
}

export default function ClientsPageWrapper() {
  return (
    <Suspense>
      <ClientsPage />
    </Suspense>
  );
}
