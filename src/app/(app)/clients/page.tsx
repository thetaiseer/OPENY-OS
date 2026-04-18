'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Search,
  Users2,
  AlertCircle,
  X,
  FolderOpen,
  Image as ImageIcon,
  CheckSquare,
  FileText,
  Activity,
  Globe,
  LayoutGrid,
  List,
  ArrowUpDown,
  CalendarDays,
  SlidersHorizontal,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import supabase from '@/lib/supabase';
import { useLang } from '@/lib/lang-context';
import { useAuth } from '@/lib/auth-context';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import SelectDropdown from '@/components/ui/SelectDropdown';
import EmptyState from '@/components/ui/EmptyState';
import type { Client } from '@/lib/types';

interface ClientStats {
  assets: number;
  tasks: number;
  content: number;
  lastActivity: string | null;
  lastDesc: string | null;
}

type ViewMode = 'grid' | 'list';
type StatusFilter = 'all' | 'active' | 'paused' | 'archived';
type ActivityFilter = 'all' | 'activeWithin7Days' | 'activeWithin30Days' | 'inactiveOver30Days';
type DateFilter = 'all' | '7' | '30' | '90';
type SortBy = 'recent' | 'name' | 'tasks' | 'assets' | 'activity';
const MAX_ACTIVITY_DESC_LENGTH = 56;

function statusGroup(status?: string): Exclude<StatusFilter, 'all'> {
  if (status === 'active') return 'active';
  if (status === 'inactive' || status === 'paused') return 'paused';
  return 'archived';
}

function statusBadgeVariant(status?: string) {
  const group = statusGroup(status);
  if (group === 'active') return 'success' as const;
  if (group === 'paused') return 'warning' as const;
  return 'default' as const;
}

function statusBadgeLabel(status?: string) {
  const group = statusGroup(status);
  if (group === 'active') return 'Active';
  if (group === 'paused') return 'Paused';
  return 'Archived';
}

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

function daysSince(iso?: string | null) {
  if (!iso) return Number.POSITIVE_INFINITY;
  return (Date.now() - new Date(iso).getTime()) / 86400000;
}

function formatActivityDescription(description: string, timestamp: string) {
  const short = description.length > MAX_ACTIVITY_DESC_LENGTH
    ? `${description.slice(0, MAX_ACTIVITY_DESC_LENGTH)}…`
    : description;
  return `${short} · ${formatRelative(timestamp)}`;
}

export default function ClientsPage() {
  const { t } = useLang();
  const { role } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const canManageClients = role === 'owner' || role === 'admin' || role === 'manager' || role === 'team_member';

  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [sortBy, setSortBy] = useState<SortBy>('recent');

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [warnMsg, setWarnMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '', email: '', phone: '', website: '', industry: '', status: 'active', notes: '',
  });

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem('clients-page-filters') ?? '{}') as {
        search?: string;
        viewMode?: ViewMode;
        statusFilter?: StatusFilter;
        activityFilter?: ActivityFilter;
        dateFilter?: DateFilter;
        sortBy?: SortBy;
      };
      if (saved.search) setSearch(saved.search);
      if (saved.viewMode === 'grid' || saved.viewMode === 'list') setViewMode(saved.viewMode);
      if (saved.statusFilter) setStatusFilter(saved.statusFilter);
      if (saved.activityFilter) setActivityFilter(saved.activityFilter);
      if (saved.dateFilter) setDateFilter(saved.dateFilter);
      if (saved.sortBy) setSortBy(saved.sortBy);
    } catch {
      // ignore invalid saved filters
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      'clients-page-filters',
      JSON.stringify({ search, viewMode, statusFilter, activityFilter, dateFilter, sortBy }),
    );
  }, [search, viewMode, statusFilter, activityFilter, dateFilter, sortBy]);

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
          if (!map[row.client_id]) map[row.client_id] = { assets: 0, tasks: 0, content: 0, lastActivity: null, lastDesc: null };
          map[row.client_id][key]++;
        }
      };

      inc(assetRows.data as { client_id: string }[] | null, 'assets');
      inc(taskRows.data as { client_id: string }[] | null, 'tasks');
      inc(contentRows.data as { client_id: string }[] | null, 'content');

      for (const row of (activityRows.data ?? []) as { client_id: string; created_at: string; description: string }[]) {
        if (!row.client_id) continue;
        if (!map[row.client_id]) map[row.client_id] = { assets: 0, tasks: 0, content: 0, lastActivity: null, lastDesc: null };
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

    let next = clients.filter(client => {
      const stats = statsMap[client.id] ?? { assets: 0, tasks: 0, content: 0, lastActivity: null, lastDesc: null };

      if (q && !(client.name?.toLowerCase().includes(q) || client.email?.toLowerCase().includes(q) || client.industry?.toLowerCase().includes(q))) {
        return false;
      }

      if (statusFilter !== 'all' && statusGroup(client.status) !== statusFilter) {
        return false;
      }

      if (activityFilter === 'activeWithin7Days' && daysSince(stats.lastActivity) > 7) return false;
      if (activityFilter === 'activeWithin30Days' && daysSince(stats.lastActivity) > 30) return false;
      if (activityFilter === 'inactiveOver30Days' && daysSince(stats.lastActivity) <= 30) return false;

      if (dateFilter !== 'all') {
        const created = daysSince(client.created_at);
        if (created > Number(dateFilter)) return false;
      }

      return true;
    });

    next = [...next].sort((a, b) => {
      const aStats = statsMap[a.id] ?? { assets: 0, tasks: 0, content: 0, lastActivity: null, lastDesc: null };
      const bStats = statsMap[b.id] ?? { assets: 0, tasks: 0, content: 0, lastActivity: null, lastDesc: null };

      if (sortBy === 'name') return (a.name ?? '').localeCompare(b.name ?? '');
      if (sortBy === 'tasks') return (bStats.tasks ?? 0) - (aStats.tasks ?? 0);
      if (sortBy === 'assets') return (bStats.assets ?? 0) - (aStats.assets ?? 0);
      if (sortBy === 'activity') {
        const aTs = aStats.lastActivity ? new Date(aStats.lastActivity).getTime() : 0;
        const bTs = bStats.lastActivity ? new Date(bStats.lastActivity).getTime() : 0;
        return bTs - aTs;
      }
      return new Date(b.created_at ?? '').getTime() - new Date(a.created_at ?? '').getTime();
    });

    return next;
  }, [clients, statsMap, search, statusFilter, activityFilter, dateFilter, sortBy]);

  const logActivity = (description: string, clientId?: string) => {
    void supabase.from('activities').insert({
      type: 'client',
      description,
      client_id: clientId ?? null,
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
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
        timeoutHandle = setTimeout(() => reject(new Error('Request timed out. Please try again.')), timeoutMs);
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

      if (!result.success) {
        const step = result.step ? ` [${result.step}]` : '';
        const msg = result.error ?? 'Failed to create client';
        throw new Error(`${msg}${step}`);
      }

      setModalOpen(false);
      setForm({ name: '', email: '', phone: '', website: '', industry: '', status: 'active', notes: '' });

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

      if (result.client?.slug) {
        router.push(`/clients/${result.client.slug}`);
      } else {
        setSuccessMsg(`Client "${form.name}" created successfully.`);
        setTimeout(() => setSuccessMsg(null), 4000);
        void queryClient.invalidateQueries({ queryKey: ['clients-list'] });
      }
    } catch (err: unknown) {
      const message = err instanceof Error
        ? err.message
        : (err as { message?: string })?.message ?? 'Failed to create client';
      setSaveError(message);
    } finally {
      clearTimeout(timeoutHandle);
      setSaving(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-5 animate-openy-fade-in pb-2">
      <div className="glass-card p-5 md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--text)' }}>{t('clients')}</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              Premium CRM workspace for client relationships, tasks, assets, and content.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-xl border p-1" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className="h-8 px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5"
                style={{
                  background: viewMode === 'grid' ? 'var(--accent-soft)' : 'transparent',
                  color: viewMode === 'grid' ? 'var(--accent)' : 'var(--text-secondary)',
                }}
              >
                <LayoutGrid size={13} /> Grid
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className="h-8 px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5"
                style={{
                  background: viewMode === 'list' ? 'var(--accent-soft)' : 'transparent',
                  color: viewMode === 'list' ? 'var(--accent)' : 'var(--text-secondary)',
                }}
              >
                <List size={13} /> List
              </button>
            </div>
            {canManageClients && (
              <button
                onClick={() => setModalOpen(true)}
                className="btn-primary flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-semibold"
              >
                <Plus size={15} />{t('newClient')}
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_auto_auto_auto] gap-2 mt-4">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-secondary)' }} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search clients, email, industry..."
              className="input-glass w-full h-9 pl-9 pr-4 text-sm"
            />
          </div>

          <label className="relative">
            <SlidersHorizontal size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-secondary)' }} />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as StatusFilter)}
              className="input-glass h-9 pl-8 pr-7 text-xs font-semibold min-w-[120px]"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="archived">Archived</option>
            </select>
          </label>

          <label className="relative">
            <Activity size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-secondary)' }} />
            <select
              value={activityFilter}
              onChange={e => setActivityFilter(e.target.value as ActivityFilter)}
              className="input-glass h-9 pl-8 pr-7 text-xs font-semibold min-w-[125px]"
            >
              <option value="all">Any Activity</option>
              <option value="activeWithin7Days">Active 7d</option>
              <option value="activeWithin30Days">Active 30d</option>
              <option value="inactiveOver30Days">Inactive 30d+</option>
            </select>
          </label>

          <label className="relative">
            <CalendarDays size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-secondary)' }} />
            <select
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value as DateFilter)}
              className="input-glass h-9 pl-8 pr-7 text-xs font-semibold min-w-[120px]"
            >
              <option value="all">Any Date</option>
              <option value="7">Created 7d</option>
              <option value="30">Created 30d</option>
              <option value="90">Created 90d</option>
            </select>
          </label>

          <label className="relative">
            <ArrowUpDown size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-secondary)' }} />
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as SortBy)}
              className="input-glass h-9 pl-8 pr-7 text-xs font-semibold min-w-[120px]"
            >
              <option value="recent">Sort: Recent</option>
              <option value="name">Sort: Name</option>
              <option value="tasks">Sort: Tasks</option>
              <option value="assets">Sort: Assets</option>
              <option value="activity">Sort: Activity</option>
            </select>
          </label>
        </div>
      </div>

      {fetchError && (
        <div
          className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm border"
          style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)', borderColor: 'var(--color-danger-border)' }}
        >
          <AlertCircle size={16} className="shrink-0" />
          <span>{fetchError}</span>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-2xl skeleton-shimmer" style={{ height: 220 }} />
          ))}
        </div>
      ) : filteredClients.length === 0 ? (
        <div className="glass-card">
          <EmptyState
            icon={Users2}
            title={t('noClientsYet')}
            description="Add your first client to unlock tasks, assets, and collaboration."
            action={canManageClients ? (
              <button
                onClick={() => setModalOpen(true)}
                className="btn-primary flex items-center gap-2 h-10 px-5 rounded-xl text-sm font-semibold"
              >
                <Plus size={16} />{t('newClient')}
              </button>
            ) : undefined}
            suggestions={[
              {
                title: 'Add your first client',
                description: 'Create a workspace for your next active account.',
              },
              {
                title: 'Use a starter template',
                description: 'Start from a standard onboarding structure and customize later.',
              },
            ]}
          />
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredClients.map(client => {
            const stats = statsMap[client.id] ?? { assets: 0, tasks: 0, content: 0, lastActivity: null, lastDesc: null };

            return (
              <div
                key={client.id}
                role="button"
                tabIndex={0}
                onClick={() => router.push(`/clients/${client.slug}/overview`)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    router.push(`/clients/${client.slug}/overview`);
                  }
                }}
                className="glass-card group flex flex-col p-5 cursor-pointer select-none transition-all duration-300 hover:-translate-y-1"
              >
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center text-base font-bold text-white shrink-0"
                      style={{ background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%)' }}
                    >
                      {client.name?.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold leading-snug truncate" style={{ color: 'var(--text)' }}>{client.name}</p>
                      {(client.industry || client.website) && (
                        <p className="text-xs truncate mt-0.5 flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                          {client.website && <Globe size={10} className="shrink-0" />}
                          {client.industry ?? client.website}
                        </p>
                      )}
                    </div>
                  </div>
                  <Badge variant={statusBadgeVariant(client.status)}>{statusBadgeLabel(client.status)}</Badge>
                </div>

                <div className="grid grid-cols-3 gap-2 rounded-xl px-3 py-2.5 mb-4 border" style={{ background: 'var(--surface-2)', borderColor: 'var(--border-2)' }}>
                  {[
                    { icon: <CheckSquare size={13} />, label: 'Tasks', value: stats.tasks },
                    { icon: <ImageIcon size={13} />, label: 'Assets', value: stats.assets },
                    { icon: <FileText size={13} />, label: 'Content', value: stats.content },
                  ].map(({ icon, label, value }) => (
                    <div key={label} className="flex flex-col items-center gap-0.5">
                      <div className="flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>{icon}</div>
                      <span className="text-sm font-bold" style={{ color: 'var(--text)' }}>{value}</span>
                      <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{label}</span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-1.5 min-h-[18px] mb-4">
                  <Activity size={11} className="shrink-0" style={{ color: 'var(--text-tertiary)' }} />
                  {stats.lastActivity ? (
                    <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }} title={stats.lastDesc ?? undefined}>
                      {stats.lastDesc
                        ? formatActivityDescription(stats.lastDesc, stats.lastActivity)
                        : `Updated ${formatRelative(stats.lastActivity)}`}
                    </p>
                  ) : (
                    <p className="text-xs italic" style={{ color: 'var(--text-tertiary)' }}>No recent activity</p>
                  )}
                </div>

                <div className="mt-auto grid grid-cols-3 gap-2 opacity-90 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                  <Link
                    href={`/clients/${client.slug}/overview`}
                    className="h-8 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5"
                    style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
                  >
                    <FolderOpen size={12} /> Open
                  </Link>
                  <Link
                    href={`/clients/${client.slug}/tasks`}
                    className="h-8 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1"
                    style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
                  >
                    <CheckSquare size={11} /> Tasks
                  </Link>
                  <Link
                    href={`/clients/${client.slug}/assets`}
                    className="h-8 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1"
                    style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
                  >
                    <ImageIcon size={11} /> Assets
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredClients.map(client => {
            const stats = statsMap[client.id] ?? { assets: 0, tasks: 0, content: 0, lastActivity: null, lastDesc: null };

            return (
              <div
                key={client.id}
                role="button"
                tabIndex={0}
                onClick={() => router.push(`/clients/${client.slug}/overview`)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    router.push(`/clients/${client.slug}/overview`);
                  }
                }}
                className="glass-card group p-4 md:p-5 cursor-pointer"
              >
                <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
                  <div className="flex items-center gap-3 min-w-0 md:w-[30%]">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0"
                      style={{ background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%)' }}
                    >
                      {client.name?.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate" style={{ color: 'var(--text)' }}>{client.name}</p>
                      <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{client.email || client.industry || '—'}</p>
                    </div>
                  </div>

                  <div className="md:w-[33%] flex items-center gap-2 flex-wrap">
                    <Badge variant={statusBadgeVariant(client.status)}>{statusBadgeLabel(client.status)}</Badge>
                    <span className="text-xs px-2 py-1 rounded-lg" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
                      {stats.tasks} tasks
                    </span>
                    <span className="text-xs px-2 py-1 rounded-lg" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
                      {stats.assets} assets
                    </span>
                    <span className="text-xs px-2 py-1 rounded-lg" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
                      {stats.content} content
                    </span>
                  </div>

                  <div className="md:flex-1 min-w-0">
                    <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                      {stats.lastActivity ? `Last activity ${formatRelative(stats.lastActivity)}` : 'No activity yet'}
                    </p>
                  </div>

                  <div className="md:w-auto flex items-center gap-2 md:justify-end" onClick={e => e.stopPropagation()}>
                    <Link href={`/clients/${client.slug}/overview`} className="btn-secondary h-8 px-3 rounded-lg text-xs font-semibold">Open</Link>
                    <Link href={`/clients/${client.slug}/tasks`} className="btn-ghost h-8 px-3 rounded-lg text-xs font-semibold">Tasks</Link>
                    <Link href={`/clients/${client.slug}/assets`} className="btn-ghost h-8 px-3 rounded-lg text-xs font-semibold">Assets</Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {warnMsg && (
        <div className="fixed bottom-6 right-4 sm:right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium animate-openy-toast-in" style={{ background: 'var(--surface)', borderColor: 'rgba(245,158,11,0.35)', boxShadow: 'var(--shadow-lg)', color: 'var(--text)' }}>
          <AlertCircle size={16} className="shrink-0" style={{ color: 'var(--color-warning)' }} />
          <span className="flex-1">{warnMsg}</span>
          <button onClick={() => setWarnMsg(null)} className="shrink-0 opacity-50 hover:opacity-100 transition-opacity">
            <X size={13} />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="fixed bottom-6 right-4 sm:right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium animate-openy-toast-in" style={{ background: 'var(--surface)', borderColor: 'rgba(16,185,129,0.35)', boxShadow: 'var(--shadow-lg)', color: 'var(--text)' }}>
          <AlertCircle size={16} className="shrink-0" style={{ color: 'var(--color-success)' }} />
          <span className="flex-1">{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="shrink-0 opacity-50 hover:opacity-100 transition-opacity">
            <X size={13} />
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
              <div key={key} className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>{label}</label>
                <input
                  type={type}
                  required={required}
                  value={form[key as keyof typeof form]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  className="input-glass w-full h-9 px-3 text-sm"
                />
              </div>
            ))}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>{t('status')}</label>
              <SelectDropdown
                fullWidth
                value={form.status}
                onChange={v => setForm(f => ({ ...f, status: v }))}
                options={[
                  { value: 'active', label: t('active') },
                  { value: 'inactive', label: t('inactive') },
                  { value: 'prospect', label: t('prospect') },
                ]}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>{t('notes')}</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={3}
              className="input-glass w-full px-3 py-2 text-sm resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-ghost h-9 px-4 rounded-xl text-sm font-semibold">
              {t('cancel')}
            </button>
            <button type="submit" disabled={saving} className="btn-primary h-9 px-5 rounded-xl text-sm font-semibold disabled:opacity-60">
              {saving ? t('loading') : t('save')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
