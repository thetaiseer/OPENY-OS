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
import EmptyState from '@/components/ui/EmptyState';
import type { ActivityLogEntry, NotificationCategory } from '@/lib/types';
import { useLang } from '@/context/lang-context';

// ── Config ────────────────────────────────────────────────────────────────────

type CategoryFilter = 'all' | NotificationCategory;

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
  if (type.startsWith('task')) return { icon: CheckSquare, color: '#3b82f6', bg: '#eff6ff' };
  if (type.startsWith('client')) return { icon: Briefcase, color: '#8b5cf6', bg: '#f5f3ff' };
  if (type.startsWith('content') || type.startsWith('publish')) {
    return { icon: FileText, color: '#059669', bg: '#f0fdf4' };
  }
  if (type.startsWith('asset') || type.startsWith('file')) {
    return { icon: Image, color: '#f59e0b', bg: '#fffbeb' };
  }
  if (
    type.startsWith('invite') ||
    type.startsWith('member') ||
    type.startsWith('role') ||
    type.startsWith('team')
  ) {
    return { icon: UserCheck, color: '#10b981', bg: '#ecfdf5' };
  }
  if (type.startsWith('comment')) {
    return { icon: MessageSquare, color: '#6366f1', bg: '#f0f0ff' };
  }
  if (type.startsWith('event') || type.startsWith('calendar')) {
    return { icon: CalendarDays, color: '#06b6d4', bg: '#ecfeff' };
  }
  if (
    type.startsWith('login') ||
    type.startsWith('permission') ||
    type.startsWith('critical') ||
    type.startsWith('security')
  ) {
    return { icon: AlertOctagon, color: '#ef4444', bg: '#fef2f2' };
  }
  return { icon: Activity, color: 'var(--text-secondary)', bg: 'var(--surface-2)' };
}

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtDate(d: string, t: (key: string, vars?: Record<string, string | number>) => string) {
  const date = new Date(d);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  if (diff < 60_000) return t('relativeJustNow');
  if (diff < 3_600_000) return t('relativeMinutesAgo', { n: Math.floor(diff / 60_000) });
  if (diff < 86_400_000) return t('relativeHoursAgo', { n: Math.floor(diff / 3_600_000) });
  if (diff < 7 * 86_400_000) return t('relativeDaysAgo', { n: Math.floor(diff / 86_400_000) });
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
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
    [activeTab, searchQuery, fromDate, toDate],
  );

  useEffect(() => {
    void load(1, false);
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
  };

  const hasActiveFilters = Boolean(searchQuery || fromDate || toDate);

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
            color: showFilters ? '#fff' : 'var(--text)',
            border: `1px solid ${showFilters ? 'var(--accent)' : 'var(--border)'}`,
          }}
        >
          <Filter size={14} />
          {t('activityFilters')}
          {hasActiveFilters && (
            <span
              className="flex h-4 w-4 items-center justify-center rounded-full bg-white text-[10px] font-bold"
              style={{ color: 'var(--accent)' }}
            >
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
                color: active ? '#fff' : 'var(--text-secondary)',
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
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              {t('activitySearch')}
            </button>
          </form>

          {/* Date range */}
          <div className="flex flex-wrap items-center gap-3">
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
          </div>
        </div>
      )}

      {loadError && !loading && (
        <p className="rounded-xl border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] px-4 py-3 text-sm text-[var(--color-danger)]">
          {t('activityLoadError')}
        </p>
      )}

      {/* ── Timeline list ─────────────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-xl"
              style={{ background: 'var(--surface)' }}
            />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <EmptyState
          icon={Activity}
          title={t('activityNoActivityTitle')}
          description={t('activityNoActivityDesc')}
        />
      ) : (
        <div className="space-y-0">
          {entries.map((entry, idx) => {
            const style = getEventStyle(entry.type);
            const Icon = style.icon;
            const isLast = idx === entries.length - 1;

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
                    <p
                      className="text-sm font-medium leading-snug"
                      style={{ color: 'var(--text)' }}
                    >
                      {entry.title ?? entry.description}
                    </p>
                    <span
                      className="mt-0.5 shrink-0 text-[11px]"
                      style={{ color: 'var(--text-secondary)' }}
                      title={fmtFull(entry.created_at, lang)}
                    >
                      {fmtDate(entry.created_at, t)}
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
                  {/* Before / after change summary */}
                  {(entry.before_value || entry.after_value) && (
                    <div
                      className="mt-1.5 flex gap-2 text-[11px]"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {entry.before_value && (
                        <span
                          className="rounded px-2 py-0.5"
                          style={{ background: '#fef2f2', color: '#dc2626' }}
                        >
                          {String(
                            entry.before_value.status ??
                              entry.before_value.priority ??
                              t('activityStateBefore'),
                          )}
                        </span>
                      )}
                      {entry.before_value && entry.after_value && (
                        <span style={{ color: 'var(--text-secondary)' }}>→</span>
                      )}
                      {entry.after_value && (
                        <span
                          className="rounded px-2 py-0.5"
                          style={{ background: '#f0fdf4', color: '#16a34a' }}
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
