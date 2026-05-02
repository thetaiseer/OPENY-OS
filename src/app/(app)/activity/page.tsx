'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Activity,
  BriefcaseBusiness,
  FileText,
  FolderOpen,
  Users,
  Shield,
  Search,
  Filter,
  CheckSquare,
  Briefcase,
  Image,
  UserCheck,
  AlertOctagon,
  CalendarDays,
  MessageSquare,
} from 'lucide-react';
import SelectDropdown from '@/components/ui/SelectDropdown';
import type { ActivityLogEntry, NotificationCategory } from '@/lib/types';
import { useLang } from '@/context/lang-context';
import supabase from '@/lib/supabase';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/states';

// ── Config ────────────────────────────────────────────────────────────────────

type CategoryFilter = 'all' | NotificationCategory;
type GroupMode = 'time' | 'module';

interface CategoryTab {
  id: CategoryFilter;
  labelKey: string;
  icon: React.ElementType;
}

const CATEGORY_TABS: CategoryTab[] = [
  { id: 'all', labelKey: 'all', icon: Activity },
  { id: 'tasks', labelKey: 'tasks', icon: BriefcaseBusiness },
  { id: 'content', labelKey: 'content', icon: FileText },
  { id: 'assets', labelKey: 'assets', icon: FolderOpen },
  { id: 'team', labelKey: 'team', icon: Users },
  { id: 'system', labelKey: 'activityCategorySystem', icon: Shield },
];

// ── Event type → icon + color ─────────────────────────────────────────────────

interface EventStyle {
  icon: React.ElementType;
  color: string;
  bg: string;
}

function getEventStyle(type: string): EventStyle {
  if (type.startsWith('task'))
    return { icon: CheckSquare, color: 'var(--text-primary)', bg: 'var(--surface-2)' };
  if (type.startsWith('client'))
    return { icon: Briefcase, color: 'var(--text-secondary)', bg: 'var(--surface-2)' };
  if (type.startsWith('content') || type.startsWith('publish')) {
    return { icon: FileText, color: 'var(--text-primary)', bg: 'var(--surface-muted)' };
  }
  if (type.startsWith('asset') || type.startsWith('file')) {
    return { icon: Image, color: 'var(--text-secondary)', bg: 'var(--surface-2)' };
  }
  if (
    type.startsWith('invite') ||
    type.startsWith('member') ||
    type.startsWith('role') ||
    type.startsWith('team')
  ) {
    return { icon: UserCheck, color: 'var(--text-primary)', bg: 'var(--surface-2)' };
  }
  if (type.startsWith('comment')) {
    return { icon: MessageSquare, color: 'var(--text-secondary)', bg: 'var(--surface-2)' };
  }
  if (type.startsWith('event') || type.startsWith('calendar')) {
    return { icon: CalendarDays, color: 'var(--text-primary)', bg: 'var(--surface-2)' };
  }
  if (
    type.startsWith('login') ||
    type.startsWith('permission') ||
    type.startsWith('critical') ||
    type.startsWith('security')
  ) {
    return { icon: AlertOctagon, color: 'var(--text-primary)', bg: 'var(--surface-muted)' };
  }
  return { icon: Activity, color: 'var(--text-secondary)', bg: 'var(--surface-2)' };
}

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtDate(
  d: string,
  t: (key: string, vars?: Record<string, string | number>) => string,
  lang: 'en' | 'ar',
) {
  const date = new Date(d);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  if (diff < 60_000) return t('relativeJustNow');
  if (diff < 3_600_000) return t('relativeMinutesAgo', { n: Math.floor(diff / 60_000) });
  if (diff < 86_400_000) return t('relativeHoursAgo', { n: Math.floor(diff / 3_600_000) });
  if (diff < 7 * 86_400_000) return t('relativeDaysAgo', { n: Math.floor(diff / 86_400_000) });
  return date.toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function fmtFull(d: string, locale: string) {
  return new Date(d).toLocaleString(locale === 'ar' ? 'ar' : undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ActivityTimelinePage() {
  const { t, lang } = useLang();
  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeTab, setActiveTab] = useState<CategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [draftSearch, setDraftSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [moduleFilter, setModuleFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [groupMode, setGroupMode] = useState<GroupMode>('time');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(
    async (nextPage = 1, append = false) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      try {
        setLoadError(false);
        const params = new URLSearchParams({ limit: '30', page: String(nextPage) });
        if (activeTab !== 'all') params.set('category', activeTab);
        if (moduleFilter !== 'all') params.set('module', moduleFilter);
        if (typeFilter !== 'all') params.set('type', typeFilter);
        if (statusFilter !== 'all') params.set('status', statusFilter);
        if (userFilter !== 'all') params.set('actor_id', userFilter);
        if (searchQuery) params.set('q', searchQuery);
        if (fromDate) params.set('from', fromDate);
        if (toDate) params.set('to', toDate + 'T23:59:59');
        const res = await fetch(`/api/activity-timeline?${params.toString()}`);
        if (!res.ok) throw new Error('fetch failed');
        const json = (await res.json()) as {
          activities?: ActivityLogEntry[];
          total?: number;
          hasMore?: boolean;
        };
        const incoming = json.activities ?? [];
        setEntries((prev) => (append ? [...prev, ...incoming] : incoming));
        setTotal(json.total ?? 0);
        setHasMore(Boolean(json.hasMore));
        setPage(nextPage);
      } catch (err) {
        console.error('[activity-timeline] load error:', err);
        setLoadError(true);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [activeTab, moduleFilter, typeFilter, statusFilter, userFilter, searchQuery, fromDate, toDate],
  );

  useEffect(() => {
    void load(1, false);
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel('activity-live')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activities' },
        () => void load(1, false),
      )
      .subscribe();

    const poll = window.setInterval(() => void load(1, false), 30_000);
    return () => {
      window.clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [load]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(draftSearch.trim());
  };

  const clearFilters = () => {
    setFromDate('');
    setToDate('');
    setSearchQuery('');
    setDraftSearch('');
    setModuleFilter('all');
    setTypeFilter('all');
    setStatusFilter('all');
    setUserFilter('all');
  };

  const hasActiveFilters = Boolean(
    searchQuery ||
    fromDate ||
    toDate ||
    moduleFilter !== 'all' ||
    typeFilter !== 'all' ||
    statusFilter !== 'all' ||
    userFilter !== 'all',
  );

  const moduleOptions = [
    { value: 'all', label: t('all') },
    ...Array.from(new Set(entries.map((e) => e.module).filter(Boolean) as string[])).map((m) => ({
      value: m,
      label: m,
    })),
  ];
  const typeOptions = [
    { value: 'all', label: t('all') },
    ...Array.from(new Set(entries.map((e) => e.type).filter(Boolean) as string[])).map((type) => ({
      value: type,
      label: type,
    })),
  ];
  const statusOptions = [
    { value: 'all', label: t('all') },
    { value: 'success', label: 'Success' },
    { value: 'failed', label: 'Failed' },
    { value: 'pending', label: 'Pending' },
  ];
  const userOptions = [
    { value: 'all', label: t('all') },
    ...Array.from(
      new Map(
        entries
          .filter((e) => e.actor_id || e.user_uuid)
          .map((e) => [(e.actor_id ?? e.user_uuid) as string, e.actor_name ?? 'Unknown user']),
      ).entries(),
    ).map(([id, name]) => ({ value: id, label: name })),
  ];

  const getTimeGroup = (createdAt: string): string => {
    const now = new Date();
    const date = new Date(createdAt);
    const oneDay = 86_400_000;
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startTarget = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const dayDiff = Math.floor((startToday - startTarget) / oneDay);
    if (dayDiff === 0) return 'Today';
    if (dayDiff === 1) return 'Yesterday';
    if (dayDiff <= 7) return 'This week';
    return 'Older';
  };

  const groupedEntries = entries.reduce<Record<string, ActivityLogEntry[]>>((acc, entry) => {
    const key = groupMode === 'module' ? entry.module || 'system' : getTimeGroup(entry.created_at);
    if (!acc[key]) acc[key] = [];
    acc[key].push(entry);
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1
            className="flex items-center gap-2 text-2xl font-bold"
            style={{ color: 'var(--text)' }}
          >
            <Activity size={22} style={{ color: 'var(--accent)' }} />
            {t('activityPageTitle')}
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {total > 0
              ? t('activityEventsCount', {
                  count: total.toLocaleString(lang === 'ar' ? 'ar' : 'en'),
                })
              : t('activityHistoryPermanent')}
          </p>
        </div>
        <button
          onClick={() => setShowFilters((v) => !v)}
          className="flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-opacity hover:opacity-80"
          style={{
            background: showFilters ? 'var(--accent)' : 'var(--surface)',
            color: showFilters ? 'var(--accent-foreground)' : 'var(--text)',
            border: `1px solid ${showFilters ? 'var(--accent)' : 'var(--border)'}`,
          }}
        >
          <Filter size={14} />
          {t('activityFilters')}
          {hasActiveFilters && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[color:var(--accent)] text-[10px] font-bold text-[color:var(--accent-foreground)]">
              !
            </span>
          )}
        </button>
      </div>

      {/* ── Category tabs ────────────────────────────────────────────────── */}
      <div className="scrollbar-thin flex items-center gap-1 overflow-x-auto pb-1">
        {CATEGORY_TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-xs font-medium transition-colors"
              style={{
                background: active ? 'var(--accent)' : 'var(--surface)',
                color: active ? 'var(--accent-foreground)' : 'var(--text-secondary)',
                border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
              }}
            >
              <Icon size={13} />
              {t(tab.labelKey)}
            </button>
          );
        })}
      </div>

      {/* ── Filter panel ─────────────────────────────────────────────────── */}
      {showFilters && (
        <div
          className="space-y-3 rounded-xl border p-4"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          {/* Search */}
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search
                size={15}
                className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--text-secondary)' }}
              />
              <input
                type="text"
                value={draftSearch}
                onChange={(e) => setDraftSearch(e.target.value)}
                placeholder={t('activitySearchPlaceholder')}
                className="h-9 w-full rounded-lg pe-3 ps-9 text-sm outline-none"
                style={{
                  background: 'var(--surface-2)',
                  color: 'var(--text)',
                  border: '1px solid var(--border)',
                }}
              />
            </div>
            <button
              type="submit"
              className="h-9 rounded-lg px-4 text-sm font-medium"
              style={{ background: 'var(--accent)', color: 'var(--accent-foreground)' }}
            >
              {t('activitySearch')}
            </button>
          </form>

          {/* Date range */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-[180px] flex-1">
              <SelectDropdown
                value={moduleFilter}
                onChange={setModuleFilter}
                options={moduleOptions}
                placeholder="Module"
                fullWidth
                clearable
              />
            </div>
            <div className="min-w-[180px] flex-1">
              <SelectDropdown
                value={typeFilter}
                onChange={setTypeFilter}
                options={typeOptions}
                placeholder="Type"
                fullWidth
                clearable
              />
            </div>
            <div className="min-w-[160px] flex-1">
              <SelectDropdown
                value={statusFilter}
                onChange={setStatusFilter}
                options={statusOptions}
                placeholder="Status"
                fullWidth
                clearable
              />
            </div>
            <div className="min-w-[180px] flex-1">
              <SelectDropdown
                value={userFilter}
                onChange={setUserFilter}
                options={userOptions}
                placeholder="User"
                fullWidth
                clearable
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {t('activityDateFrom')}
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="h-8 rounded-lg px-2 text-xs outline-none"
                style={{
                  background: 'var(--surface-2)',
                  color: 'var(--text)',
                  border: '1px solid var(--border)',
                }}
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {t('activityDateTo')}
              </label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="h-8 rounded-lg px-2 text-xs outline-none"
                style={{
                  background: 'var(--surface-2)',
                  color: 'var(--text)',
                  border: '1px solid var(--border)',
                }}
              />
            </div>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-xs underline"
                style={{ color: 'var(--text-secondary)' }}
              >
                {t('clearFilters')}
              </button>
            )}
            <div className="ms-auto min-w-[180px]">
              <SelectDropdown
                value={groupMode}
                onChange={(v) => setGroupMode(v as GroupMode)}
                options={[
                  { value: 'time', label: 'Group: Time' },
                  { value: 'module', label: 'Group: Module' },
                ]}
                fullWidth
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Timeline list ─────────────────────────────────────────────────── */}
      {loading ? (
        <LoadingState rows={6} className="grid-cols-1" cardHeightClass="h-16" />
      ) : loadError ? (
        <ErrorState
          title={t('activityLoadError')}
          description={t('activityNoActivityDesc')}
          actionLabel={t('assetsRetry')}
          onAction={() => void load(1, false)}
        />
      ) : entries.length === 0 ? (
        <EmptyState
          title={t('activityNoActivityTitle')}
          description={t('activityNoActivityDesc')}
        />
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedEntries).map(([groupLabel, groupEntries]) => (
            <div key={groupLabel} className="space-y-0">
              <div
                className="sticky top-0 z-10 mb-1 rounded-lg px-2 py-1 text-xs font-semibold"
                style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
              >
                {groupLabel}
              </div>
              {groupEntries.map((entry, idx) => {
                const style = getEventStyle(entry.type);
                const Icon = style.icon;
                const isLast = idx === groupEntries.length - 1;

                return (
                  <div key={entry.id} className="flex gap-3">
                    {/* Timeline rail */}
                    <div className="flex shrink-0 flex-col items-center">
                      <div
                        className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                        style={{ background: style.bg, border: `1.5px solid ${style.color}40` }}
                      >
                        <Icon size={15} style={{ color: style.color }} />
                      </div>
                      {!isLast && (
                        <div
                          className="mt-1 w-px flex-1"
                          style={{ background: 'var(--border)', minHeight: '16px' }}
                        />
                      )}
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1 pb-4">
                      <div className="flex items-start justify-between gap-2">
                        <a
                          href={
                            (entry.metadata_json?.action_url as string | undefined) ??
                            (entry.module ? `/${entry.module}` : '#')
                          }
                          className="text-sm font-medium leading-snug hover:underline"
                          style={{ color: 'var(--text)' }}
                        >
                          {entry.title ?? entry.description}
                        </a>
                        <span
                          className="mt-0.5 shrink-0 text-[11px]"
                          style={{ color: 'var(--text-secondary)' }}
                          title={fmtFull(entry.created_at, lang)}
                        >
                          {fmtDate(entry.created_at, t, lang)}
                        </span>
                      </div>
                      {entry.title && entry.description !== entry.title && (
                        <p
                          className="mt-0.5 line-clamp-2 text-xs"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          {entry.description}
                        </p>
                      )}
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                        {entry.actor_name ? (
                          <span
                            className="rounded-full px-2 py-0.5"
                            style={{
                              background: 'var(--surface-2)',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            {entry.actor_name}
                          </span>
                        ) : null}
                        {entry.status ? (
                          <span
                            className="rounded-full px-2 py-0.5"
                            style={{
                              background:
                                entry.status === 'failed'
                                  ? 'var(--surface-muted)'
                                  : entry.status === 'pending'
                                    ? 'var(--surface-2)'
                                    : 'var(--surface-muted)',
                              color:
                                entry.status === 'failed'
                                  ? 'var(--text-primary)'
                                  : entry.status === 'pending'
                                    ? 'var(--text-secondary)'
                                    : 'var(--text-primary)',
                            }}
                          >
                            {entry.status}
                          </span>
                        ) : null}
                        {entry.module ? (
                          <span
                            className="rounded-full px-2 py-0.5"
                            style={{
                              background: 'var(--surface-2)',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            {entry.module}
                          </span>
                        ) : null}
                      </div>
                      {/* Before / after change summary */}
                      {(entry.before_value || entry.after_value) && (
                        <div
                          className="mt-1.5 flex gap-2 text-[11px]"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          {entry.before_value && (
                            <span
                              className="rounded px-2 py-0.5"
                              style={{
                                background: 'var(--surface-muted)',
                                color: 'var(--text-primary)',
                              }}
                            >
                              {String(
                                entry.before_value.status ??
                                  entry.before_value.priority ??
                                  t('activityStateBefore'),
                              )}
                            </span>
                          )}
                          {entry.before_value && entry.after_value && (
                            <span style={{ color: 'var(--text-secondary)' }}>
                              {t('activityArrowTo')}
                            </span>
                          )}
                          {entry.after_value && (
                            <span
                              className="rounded px-2 py-0.5"
                              style={{
                                background: 'var(--surface-muted)',
                                color: 'var(--text-primary)',
                              }}
                            >
                              {String(
                                entry.after_value.status ??
                                  entry.after_value.priority ??
                                  t('activityStateAfter'),
                              )}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

          {hasMore && (
            <button
              onClick={() => void load(page + 1, true)}
              disabled={loadingMore}
              className="mt-2 h-10 w-full rounded-xl text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
              style={{
                background: 'var(--surface-2)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
              }}
            >
              {loadingMore ? t('loading') : t('activityLoadMore')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
