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
import { useAuth } from '@/context/auth-context';
import { useLang } from '@/context/lang-context';
import EmptyState from '@/components/ui/EmptyState';
import Button from '@/components/ui/Button';
import { PageHeader, PageShell } from '@/components/layout/PageLayout';
import { cn } from '@/lib/cn';
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
    [user, activeTab],
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

  return (
    <PageShell className="mx-auto max-w-3xl space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <Bell size={22} className="text-accent" />
            {t('notifications')}
          </span>
        }
        subtitle={unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
        actions={
          unreadCount > 0 ? (
            <Button
              type="button"
              variant="secondary"
              onClick={markAllRead}
              disabled={markingAll}
              className="h-9 gap-2 text-sm"
            >
              <CheckCheck size={14} /> Mark all read
            </Button>
          ) : undefined
        }
      />

      {/* ── Category tabs ────────────────────────────────────────────────── */}
      <div className="scrollbar-thin flex items-center gap-1 overflow-x-auto pb-1">
        {TABS.map((tab) => {
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

      {/* ── Notification list ────────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-[var(--surface)]" />
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
        <div className="space-y-2">
          {notifications.map((n) => {
            const Icon = TYPE_ICON[n.type as keyof typeof TYPE_ICON] ?? Info;
            const color = getIconColor(n);
            const priority = (n.priority ?? 'low') as NotificationPriority;
            const priorityLbl = PRIORITY_LABEL[priority];
            const isCritical = priority === 'critical';
            const isHigh = priority === 'high';
            const borderColor =
              isCritical || isHigh ? PRIORITY_COLOR[priority] : n.read ? 'var(--border)' : color;

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
                  style={{ backgroundColor: `${color}18` }}
                >
                  <Icon size={16} style={{ color }} />
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-primary">{n.title}</p>
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
                    <span className="shrink-0 text-xs text-secondary">{fmtDate(n.created_at)}</span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs text-secondary">{n.message}</p>
                </div>

                {/* Actions */}
                <div className="flex shrink-0 items-center gap-0.5">
                  {n.action_url && (
                    <Link
                      href={n.action_url}
                      className="rounded-lg p-1.5 text-secondary transition-colors hover:bg-[var(--surface-2)]"
                      title="Open related item"
                    >
                      <ExternalLink size={13} />
                    </Link>
                  )}
                  {!n.read && (
                    <button
                      onClick={() => markRead(n.id)}
                      className="rounded-lg p-1.5 text-secondary transition-colors hover:bg-[var(--surface-2)]"
                      title="Mark as read"
                    >
                      <Check size={13} />
                    </button>
                  )}
                  <button
                    onClick={() => archiveNotif(n.id)}
                    className="rounded-lg p-1.5 text-secondary transition-colors hover:opacity-70"
                    title="Archive"
                  >
                    <Archive size={13} />
                  </button>
                </div>
              </div>
            );
          })}

          {hasMore && (
            <Button
              onClick={() => void loadNotifications(page + 1, true)}
              disabled={loadingMore}
              variant="secondary"
              className="h-10 w-full text-sm"
            >
              {loadingMore ? 'Loading…' : 'Load more'}
            </Button>
          )}
        </div>
      )}
    </PageShell>
  );
}
