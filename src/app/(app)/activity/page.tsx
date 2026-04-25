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
import Button from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { PageHeader, PageShell } from '@/components/layout/PageLayout';
import { cn } from '@/lib/cn';
import type { ActivityLogEntry, NotificationCategory } from '@/lib/types';

// ── Config ────────────────────────────────────────────────────────────────────

type CategoryFilter = 'all' | NotificationCategory;

interface CategoryTab {
  id: CategoryFilter;
  label: string;
  icon: React.ElementType;
}

const CATEGORY_TABS: CategoryTab[] = [
  { id: 'all', label: 'All', icon: Activity },
  { id: 'tasks', label: 'Tasks', icon: BriefcaseBusiness },
  { id: 'content', label: 'Content', icon: FileText },
  { id: 'assets', label: 'Assets', icon: FolderOpen },
  { id: 'team', label: 'Team', icon: Users },
  { id: 'system', label: 'System', icon: Shield },
];

// ── Event type → icon + color ─────────────────────────────────────────────────

interface EventStyle {
  icon: React.ElementType;
  iconClass: string;
  chipClass: string;
  railClass: string;
}

function getEventStyle(type: string): EventStyle {
  if (type.startsWith('task'))
    return {
      icon: CheckSquare,
      iconClass: 'text-blue-500',
      chipClass: 'bg-blue-50 text-blue-700',
      railClass: 'border-blue-200 bg-blue-50',
    };
  if (type.startsWith('client'))
    return {
      icon: Briefcase,
      iconClass: 'text-violet-500',
      chipClass: 'bg-violet-50 text-violet-700',
      railClass: 'border-violet-200 bg-violet-50',
    };
  if (type.startsWith('content') || type.startsWith('publish')) {
    return {
      icon: FileText,
      iconClass: 'text-emerald-600',
      chipClass: 'bg-emerald-50 text-emerald-700',
      railClass: 'border-emerald-200 bg-emerald-50',
    };
  }
  if (type.startsWith('asset') || type.startsWith('file')) {
    return {
      icon: Image,
      iconClass: 'text-amber-500',
      chipClass: 'bg-amber-50 text-amber-700',
      railClass: 'border-amber-200 bg-amber-50',
    };
  }
  if (
    type.startsWith('invite') ||
    type.startsWith('member') ||
    type.startsWith('role') ||
    type.startsWith('team')
  ) {
    return {
      icon: UserCheck,
      iconClass: 'text-emerald-500',
      chipClass: 'bg-emerald-50 text-emerald-700',
      railClass: 'border-emerald-200 bg-emerald-50',
    };
  }
  if (type.startsWith('comment')) {
    return {
      icon: MessageSquare,
      iconClass: 'text-indigo-500',
      chipClass: 'bg-indigo-50 text-indigo-700',
      railClass: 'border-indigo-200 bg-indigo-50',
    };
  }
  if (type.startsWith('event') || type.startsWith('calendar')) {
    return {
      icon: CalendarDays,
      iconClass: 'text-cyan-500',
      chipClass: 'bg-cyan-50 text-cyan-700',
      railClass: 'border-cyan-200 bg-cyan-50',
    };
  }
  if (
    type.startsWith('login') ||
    type.startsWith('permission') ||
    type.startsWith('critical') ||
    type.startsWith('security')
  ) {
    return {
      icon: AlertOctagon,
      iconClass: 'text-red-500',
      chipClass: 'bg-red-50 text-red-700',
      railClass: 'border-red-200 bg-red-50',
    };
  }
  return {
    icon: Activity,
    iconClass: 'text-secondary',
    chipClass: 'bg-[var(--surface-2)] text-secondary',
    railClass: 'border-border bg-[var(--surface-2)]',
  };
}

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  const date = new Date(d);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtFull(d: string) {
  return new Date(d).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ActivityTimelinePage() {
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

  const load = useCallback(
    async (nextPage = 1, append = false) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      try {
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
    <PageShell className="mx-auto max-w-3xl space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <Activity size={22} className="text-accent" />
            Activity Timeline
          </span>
        }
        subtitle={total > 0 ? `${total.toLocaleString()} events` : 'Permanent workspace history'}
        actions={
          <Button
            type="button"
            variant={showFilters ? 'primary' : 'secondary'}
            className="h-9 gap-2"
            onClick={() => setShowFilters((v) => !v)}
          >
            <Filter size={14} />
            Filters
            {hasActiveFilters && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white text-[10px] font-bold text-accent">
                !
              </span>
            )}
          </Button>
        }
      />

      {/* ── Category tabs ────────────────────────────────────────────────── */}
      <div className="scrollbar-thin flex items-center gap-1 overflow-x-auto pb-1">
        {CATEGORY_TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 text-xs font-medium transition-colors',
                active
                  ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                  : 'border-border bg-[var(--surface)] text-secondary',
              )}
            >
              <Icon size={13} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Filter panel ─────────────────────────────────────────────────── */}
      {showFilters && (
        <Card padding="sm" className="space-y-3 border border-border bg-[var(--surface)] p-4">
          {/* Search */}
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-secondary"
              />
              <Input
                type="text"
                value={draftSearch}
                onChange={(e) => setDraftSearch(e.target.value)}
                placeholder="Search activity…"
                className="h-9 pl-9"
              />
            </div>
            <Button type="submit" variant="primary" className="h-9 px-4 text-sm">
              Search
            </Button>
          </form>

          {/* Date range */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs text-secondary">From</label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="h-8 rounded-lg px-2 text-xs"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-secondary">To</label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="h-8 rounded-lg px-2 text-xs"
              />
            </div>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="text-xs text-secondary underline">
                Clear filters
              </button>
            )}
          </div>
        </Card>
      )}

      {/* ── Timeline list ─────────────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-[var(--surface)]" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No activity yet"
          description="Activity will appear here as the team works across tasks, content, assets, and more."
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
                    className={cn(
                      'mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border',
                      style.railClass,
                    )}
                  >
                    <Icon size={15} className={style.iconClass} />
                  </div>
                  {!isLast && <div className="mt-1 min-h-4 w-px flex-1 bg-border" />}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1 pb-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium leading-snug text-primary">
                      {entry.title ?? entry.description}
                    </p>
                    <span
                      className="mt-0.5 shrink-0 text-[11px] text-secondary"
                      title={fmtFull(entry.created_at)}
                    >
                      {fmtDate(entry.created_at)}
                    </span>
                  </div>
                  {entry.title && entry.description !== entry.title && (
                    <p className="mt-0.5 line-clamp-2 text-xs text-secondary">
                      {entry.description}
                    </p>
                  )}
                  {/* Before / after change summary */}
                  {(entry.before_value || entry.after_value) && (
                    <div className="mt-1.5 flex gap-2 text-[11px] text-secondary">
                      {entry.before_value && (
                        <span className="rounded bg-red-50 px-2 py-0.5 text-red-600">
                          {String(
                            entry.before_value.status ?? entry.before_value.priority ?? 'before',
                          )}
                        </span>
                      )}
                      {entry.before_value && entry.after_value && (
                        <span className="text-secondary">→</span>
                      )}
                      {entry.after_value && (
                        <span className="rounded bg-emerald-50 px-2 py-0.5 text-emerald-600">
                          {String(
                            entry.after_value.status ?? entry.after_value.priority ?? 'after',
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
            <Button
              onClick={() => void load(page + 1, true)}
              disabled={loadingMore}
              variant="secondary"
              className="mt-2 h-10 w-full text-sm"
            >
              {loadingMore ? 'Loading…' : 'Load more events'}
            </Button>
          )}
        </div>
      )}
    </PageShell>
  );
}
