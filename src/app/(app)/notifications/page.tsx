'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Bell, Info, CheckCircle, AlertTriangle, XCircle, Check, CheckCheck, Trash2, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useLang } from '@/lib/lang-context';
import EmptyState from '@/components/ui/EmptyState';
import type { Notification } from '@/lib/types';
const MAX_EVENT_SUMMARY_DISPLAY = 3;

const TYPE_ICON = {
  info:    Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error:   XCircle,
} as const;

const TYPE_COLOR = {
  info:    '#3b82f6',
  success: '#16a34a',
  warning: '#d97706',
  error:   '#dc2626',
} as const;

const EVENT_LABEL: Record<string, string> = {
  task_created:           'Task Created',
  'task.created':         'Task Created',
  task_assigned:          'Task Assigned',
  'task.assigned':        'Task Assigned',
  task_updated:           'Task Updated',
  'task.updated':         'Task Updated',
  task_due_soon:          'Due Soon',
  task_overdue:           'Overdue',
  task_completed:         'Completed',
  'task.completed':       'Completed',
  task_published:         'Published',
  publishing_scheduled:   'Publishing Scheduled',
  publishing_rescheduled: 'Rescheduled',
  publishing_published:   'Published',
  asset_uploaded:         'Asset Uploaded',
  'file.uploaded':        'File Uploaded',
  asset_linked:           'Asset Linked',
  client_created:         'Client Created',
  'client.created':       'Client Created',
  team_invitation:        'Team Invitation',
  'member.invited':       'Team Invitation',
  'member.joined':        'Member Joined',
  'comment.added':        'Comment Added',
};

function fmtDate(d: string) {
  const date = new Date(d);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function NotificationsPage() {
  const { t } = useLang();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const loadNotifications = useCallback(async (nextPage = 1, append = false) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '20', page: String(nextPage) });
      if (user?.id) params.set('user_id', user.id);
      if (showUnreadOnly) params.set('unread', 'true');
      const res = await fetch(`/api/notifications?${params.toString()}`);
      if (!res.ok) throw new Error('fetch failed');
      const json = await res.json() as { notifications?: Notification[]; hasMore?: boolean };
      const incoming = json.notifications ?? [];
      setNotifications(prev => append ? [...prev, ...incoming] : incoming);
      setHasMore(Boolean(json.hasMore));
      setPage(nextPage);
    } catch (err) {
      console.error('[notifications] load error:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [user, showUnreadOnly]);

  useEffect(() => { void loadNotifications(1, false); }, [loadNotifications]);

  const markRead = async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    try {
      await fetch(`/api/notifications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ read: true }),
      });
    } catch { /* best-effort */ }
  };

  const deleteNotif = async (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    try {
      await fetch(`/api/notifications/${id}`, { method: 'DELETE' });
    } catch { /* best-effort */ }
  };

  const markAllRead = async () => {
    setMarkingAll(true);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    try {
      await fetch('/api/notifications/mark-all-read', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user?.id }),
      });
    } catch { /* best-effort */ } finally {
      setMarkingAll(false);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;
  const groupedUnread = useMemo(() => notifications
    .filter(n => !n.read && n.event_type)
    .reduce<Record<string, number>>((acc, n) => {
      const key = n.event_type as string;
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {}), [notifications]);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--text)' }}>
            <Bell size={22} style={{ color: 'var(--accent)' }} />
            {t('notifications')}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowUnreadOnly(false)}
            className="h-8 px-3 rounded-lg text-xs font-medium"
            style={{
              background: showUnreadOnly ? 'var(--surface)' : 'var(--surface-2)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
            }}
          >
            All
          </button>
          <button
            onClick={() => setShowUnreadOnly(true)}
            className="h-8 px-3 rounded-lg text-xs font-medium"
            style={{
              background: showUnreadOnly ? 'var(--surface-2)' : 'var(--surface)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
            }}
          >
            Unread
          </button>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              disabled={markingAll}
              className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium transition-opacity hover:opacity-70 disabled:opacity-50"
              style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
            >
              <CheckCheck size={14} /> Mark all read
            </button>
          )}
        </div>
      </div>
      {Object.entries(groupedUnread).slice(0, MAX_EVENT_SUMMARY_DISPLAY).map(([eventType, count]) => (
        <p key={eventType} className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          {count} new {EVENT_LABEL[eventType] ?? eventType}
        </p>
      ))}

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: 'var(--surface)' }} />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState icon={Bell} title="No notifications yet" description="You'll see task assignments, asset uploads, and publishing updates here." />
      ) : (
        <div className="space-y-2">
          {notifications.map(n => {
            const Icon  = TYPE_ICON[n.type as keyof typeof TYPE_ICON] ?? Info;
            const color = TYPE_COLOR[n.type as keyof typeof TYPE_COLOR] ?? '#3b82f6';
            const eventLabel = n.event_type ? EVENT_LABEL[n.event_type] : null;
            return (
              <div
                key={n.id}
                className="flex items-start gap-3 px-4 py-3 rounded-xl border transition-all"
                style={{
                  background: n.read ? 'var(--surface)' : 'var(--surface-2)',
                  borderColor: n.read ? 'var(--border)' : color,
                  borderLeftWidth: n.read ? '1px' : '3px',
                  opacity: n.read ? 0.75 : 1,
                }}
              >
                {/* Icon */}
                <div className="mt-0.5 shrink-0 w-8 h-8 rounded-full flex items-center justify-center" style={{ background: `${color}18` }}>
                  <Icon size={16} style={{ color }} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{n.title}</p>
                    <span className="text-xs shrink-0" style={{ color: 'var(--text-secondary)' }}>{fmtDate(n.created_at)}</span>
                  </div>
                  <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{n.message}</p>
                  {eventLabel && (
                    <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: `${color}18`, color }}>
                      {eventLabel}
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {n.action_url && (
                    <Link
                      href={n.action_url}
                      className="p-1.5 rounded-lg hover:bg-[var(--surface-2)] transition-colors"
                      style={{ color: 'var(--text-secondary)' }}
                      title="Open related item"
                    >
                      <ExternalLink size={14} />
                    </Link>
                  )}
                  {!n.read && (
                    <button
                      onClick={() => markRead(n.id)}
                      className="p-1.5 rounded-lg hover:bg-[var(--surface-2)] transition-colors"
                      style={{ color: 'var(--text-secondary)' }}
                      title="Mark as read"
                    >
                      <Check size={14} />
                    </button>
                  )}
                  <button
                    onClick={() => deleteNotif(n.id)}
                    className="p-1.5 rounded-lg transition-colors hover:opacity-70"
                    style={{ color: 'var(--text-secondary)' }}
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
          {hasMore && (
            <button
              onClick={() => void loadNotifications(page + 1, true)}
              disabled={loadingMore}
              className="w-full h-10 rounded-xl text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
              style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
            >
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
