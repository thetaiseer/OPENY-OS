'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Bell,
  Info,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Check,
  CheckCheck,
  Archive,
  ExternalLink,
  BriefcaseBusiness,
  FileText,
  FolderOpen,
  Users,
  Shield,
  Layout,
} from 'lucide-react';
import Link from 'next/link';
import SelectDropdown from '@/components/ui/SelectDropdown';
import { useAuth } from '@/context/auth-context';
import { useLang } from '@/context/lang-context';
import EmptyState from '@/components/ui/EmptyState';
import type { Notification, NotificationCategory, NotificationPriority } from '@/lib/types';

// ── Types ─────────────────────────────────────────────────────────────────────

type TabId = 'all' | 'unread' | NotificationCategory;

interface Tab {
  id: TabId;
  label: string;
  icon: React.ElementType;
}

const TABS: Tab[] = [
  { id: 'all', label: 'All', icon: Layout },
  { id: 'unread', label: 'Unread', icon: Bell },
  { id: 'tasks', label: 'Tasks', icon: BriefcaseBusiness },
  { id: 'content', label: 'Content', icon: FileText },
  { id: 'assets', label: 'Assets', icon: FolderOpen },
  { id: 'team', label: 'Team', icon: Users },
  { id: 'system', label: 'System', icon: Shield },
];

// ── Priority visuals ──────────────────────────────────────────────────────────

const PRIORITY_COLOR: Record<NotificationPriority, string> = {
  low: 'var(--text-secondary)',
  medium: '#3b82f6',
  high: '#f59e0b',
  critical: '#dc2626',
};

const PRIORITY_LABEL: Record<NotificationPriority, string> = {
  low: '',
  medium: '',
  high: 'HIGH',
  critical: 'CRITICAL',
};

const TYPE_ICON = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: XCircle,
} as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  const date = new Date(d);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function getIconColor(n: Notification): string {
  const priority = (n.priority ?? 'low') as NotificationPriority;
  if (priority === 'critical' || priority === 'high') return PRIORITY_COLOR[priority];
  const map: Record<string, string> = {
    success: '#16a34a',
    warning: '#d97706',
    error: '#dc2626',
    info: '#3b82f6',
  };
  return map[n.type] ?? '#3b82f6';
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const { t } = useLang();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [readFilter, setReadFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const loadNotifications = useCallback(
    async (nextPage = 1, append = false) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      try {
        const params = new URLSearchParams({ limit: '20', page: String(nextPage) });
        if (user?.id) params.set('user_id', user.id);
        if (activeTab === 'unread') {
          params.set('unread', 'true');
        } else if (activeTab !== 'all') {
          params.set('category', activeTab);
        }
        if (searchQuery) params.set('q', searchQuery);
        if (moduleFilter !== 'all') params.set('module', moduleFilter);
        if (priorityFilter !== 'all') params.set('priority', priorityFilter);
        if (readFilter !== 'all') params.set('read', readFilter);
        if (typeFilter !== 'all') params.set('type', typeFilter);
        const res = await fetch(`/api/notifications?${params.toString()}`);
        if (!res.ok) throw new Error('fetch failed');
        const json = (await res.json()) as { notifications?: Notification[]; hasMore?: boolean };
        const incoming = json.notifications ?? [];
        setNotifications((prev) => (append ? [...prev, ...incoming] : incoming));
        setHasMore(Boolean(json.hasMore));
        setPage(nextPage);
      } catch (err) {
        console.error('[notifications] load error:', err);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [user, activeTab, searchQuery, moduleFilter, priorityFilter, readFilter, typeFilter],
  );

  useEffect(() => {
    void loadNotifications(1, false);
  }, [loadNotifications]);

  const markRead = async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    try {
      await fetch(`/api/notifications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ read: true }),
      });
    } catch {
      /* best-effort */
    }
  };

  const markUnread = async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: false } : n)));
    try {
      await fetch(`/api/notifications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ read: false }),
      });
    } catch {
      /* best-effort */
    }
  };

  const archiveNotif = async (id: string) => {
    // Optimistic: remove from view immediately
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    try {
      const res = await fetch(`/api/notifications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_archived: true }),
      });
      if (!res.ok) {
        // Revert: reload notifications to restore the item
        void loadNotifications(1, false);
      }
    } catch {
      // Revert on network error
      void loadNotifications(1, false);
    }
  };

  const markAllRead = async () => {
    setMarkingAll(true);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await fetch('/api/notifications/mark-all-read', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user?.id }),
      });
    } catch {
      /* best-effort */
    } finally {
      setMarkingAll(false);
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;
  const moduleOptions = [
    { value: 'all', label: 'All modules' },
    ...Array.from(new Set(notifications.map((n) => n.module).filter(Boolean) as string[])).map(
      (m) => ({
        value: m,
        label: m,
      }),
    ),
  ];
  const grouped = notifications.reduce<Record<string, Notification[]>>((acc, n) => {
    const d = new Date(n.created_at);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const diffDays = Math.floor((today - day) / 86400000);
    const key = diffDays === 0 ? 'Today' : diffDays === 1 ? 'Yesterday' : 'Older';
    if (!acc[key]) acc[key] = [];
    acc[key].push(n);
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
            <Bell size={22} style={{ color: 'var(--accent)' }} />
            {t('notifications')}
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            disabled={markingAll}
            className="flex h-9 items-center gap-2 rounded-lg px-4 text-sm font-medium transition-opacity hover:opacity-70 disabled:opacity-50"
            style={{
              background: 'var(--surface-2)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
            }}
          >
            <CheckCheck size={14} /> Mark all read
          </button>
        )}
      </div>

      {/* ── Category tabs ────────────────────────────────────────────────── */}
      <div className="scrollbar-thin flex items-center gap-1 overflow-x-auto pb-1">
        {TABS.map((tab) => {
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
              {tab.label}
            </button>
          );
        })}
      </div>

      <div
        className="grid grid-cols-1 gap-2 rounded-xl border p-3 md:grid-cols-5"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search notifications..."
          className="h-9 rounded-lg px-3 text-sm outline-none"
          style={{
            background: 'var(--surface-2)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
          }}
        />
        <SelectDropdown
          value={moduleFilter}
          onChange={setModuleFilter}
          options={moduleOptions}
          fullWidth
        />
        <SelectDropdown
          value={priorityFilter}
          onChange={setPriorityFilter}
          options={[
            { value: 'all', label: 'All priorities' },
            { value: 'low', label: 'Low' },
            { value: 'medium', label: 'Medium' },
            { value: 'high', label: 'High' },
            { value: 'critical', label: 'Critical' },
          ]}
          fullWidth
        />
        <SelectDropdown
          value={readFilter}
          onChange={setReadFilter}
          options={[
            { value: 'all', label: 'All states' },
            { value: 'false', label: 'Unread' },
            { value: 'true', label: 'Read' },
          ]}
          fullWidth
        />
        <SelectDropdown
          value={typeFilter}
          onChange={setTypeFilter}
          options={[
            { value: 'all', label: 'All types' },
            { value: 'info', label: 'Info' },
            { value: 'success', label: 'Success' },
            { value: 'warning', label: 'Warning' },
            { value: 'error', label: 'Error' },
          ]}
          fullWidth
        />
      </div>

      {/* ── Notification list ────────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-xl"
              style={{ background: 'var(--surface)' }}
            />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No notifications"
          description={
            activeTab === 'unread'
              ? "You're all caught up — no unread notifications."
              : `No ${activeTab === 'all' ? '' : activeTab + ' '}notifications yet.`
          }
        />
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([group, items]) => (
            <div key={group} className="space-y-2">
              <div
                className="rounded-lg px-2 py-1 text-xs font-semibold"
                style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
              >
                {group}
              </div>
              {items.map((n) => {
                const Icon = TYPE_ICON[n.type as keyof typeof TYPE_ICON] ?? Info;
                const color = getIconColor(n);
                const priority = (n.priority ?? 'low') as NotificationPriority;
                const priorityLbl = PRIORITY_LABEL[priority];
                const isCritical = priority === 'critical';
                const isHigh = priority === 'high';
                const borderColor =
                  isCritical || isHigh
                    ? PRIORITY_COLOR[priority]
                    : n.read
                      ? 'var(--border)'
                      : color;

                return (
                  <div
                    key={n.id}
                    className="flex items-start gap-3 rounded-xl border px-4 py-3 transition-all"
                    style={{
                      background: n.read ? 'var(--surface)' : 'var(--surface-2)',
                      borderColor,
                      borderLeftWidth: n.read ? '1px' : '3px',
                      opacity: n.read && !isCritical ? 0.75 : 1,
                    }}
                  >
                    {/* Icon */}
                    <div
                      className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                      style={{ background: `${color}18` }}
                    >
                      <Icon size={16} style={{ color }} />
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <p
                            className="truncate text-sm font-semibold"
                            style={{ color: 'var(--text)' }}
                          >
                            {n.title}
                          </p>
                          {priorityLbl && (
                            <span
                              className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold"
                              style={{
                                background: `${PRIORITY_COLOR[priority]}20`,
                                color: PRIORITY_COLOR[priority],
                              }}
                            >
                              {priorityLbl}
                            </span>
                          )}
                        </div>
                        <span
                          className="shrink-0 text-xs"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          {fmtDate(n.created_at)}
                        </span>
                      </div>
                      <p
                        className="mt-0.5 line-clamp-2 text-xs"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {n.message}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                        {n.module ? (
                          <span
                            className="rounded-full px-2 py-0.5"
                            style={{
                              background: 'var(--surface-2)',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            {n.module}
                          </span>
                        ) : null}
                        {n.category ? (
                          <span
                            className="rounded-full px-2 py-0.5"
                            style={{
                              background: 'var(--surface-2)',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            {n.category}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex shrink-0 items-center gap-0.5">
                      {n.action_url && (
                        <Link
                          href={n.action_url}
                          className="rounded-lg p-1.5 transition-colors hover:bg-[var(--surface-2)]"
                          style={{ color: 'var(--text-secondary)' }}
                          title="Open related item"
                        >
                          <ExternalLink size={13} />
                        </Link>
                      )}
                      {!n.read && (
                        <button
                          onClick={() => markRead(n.id)}
                          className="rounded-lg p-1.5 transition-colors hover:bg-[var(--surface-2)]"
                          style={{ color: 'var(--text-secondary)' }}
                          title="Mark as read"
                        >
                          <Check size={13} />
                        </button>
                      )}
                      {n.read && (
                        <button
                          onClick={() => markUnread(n.id)}
                          className="rounded-lg p-1.5 transition-colors hover:bg-[var(--surface-2)]"
                          style={{ color: 'var(--text-secondary)' }}
                          title="Mark as unread"
                        >
                          <Check size={13} />
                        </button>
                      )}
                      <button
                        onClick={() => archiveNotif(n.id)}
                        className="rounded-lg p-1.5 transition-colors hover:opacity-70"
                        style={{ color: 'var(--text-secondary)' }}
                        title="Archive"
                      >
                        <Archive size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

          {hasMore && (
            <button
              onClick={() => void loadNotifications(page + 1, true)}
              disabled={loadingMore}
              className="h-10 w-full rounded-xl text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
              style={{
                background: 'var(--surface-2)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
              }}
            >
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
