'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Bell, Info, CheckCircle, AlertTriangle, XCircle, Check, CheckCheck, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useLang } from '@/lib/lang-context';
import EmptyState from '@/components/ui/EmptyState';
import type { Notification } from '@/lib/types';

const TYPE_ICON = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: XCircle,
} as const;

const TYPE_COLOR = {
  info: '#3b82f6',
  success: '#16a34a',
  warning: '#d97706',
  error: '#dc2626',
} as const;

function fmtDate(d: string) {
  const date = new Date(d);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function dayKey(dateIso: string): 'today' | 'yesterday' | 'earlier' {
  const d = new Date(dateIso);
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startYesterday = startToday - 86_400_000;
  const t = d.getTime();
  if (t >= startToday) return 'today';
  if (t >= startYesterday) return 'yesterday';
  return 'earlier';
}

export default function NotificationsPage() {
  const { t } = useLang();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 30;

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(limit), page: String(page) });
      if (user?.id) params.set('user_id', user.id);
      if (search.trim()) params.set('q', search.trim());
      if (category) params.set('category', category);
      if (priority) params.set('priority', priority);
      const res = await fetch(`/api/notifications?${params.toString()}`);
      if (!res.ok) throw new Error('fetch failed');
      const json = await res.json() as { notifications?: Notification[]; total?: number };
      setNotifications(json.notifications ?? []);
      setTotal(json.total ?? 0);
    } catch (err) {
      console.error('[notifications] load error:', err);
    } finally {
      setLoading(false);
    }
  }, [user, page, search, category, priority]);

  useEffect(() => { void loadNotifications(); }, [loadNotifications]);
  useEffect(() => { setPage(1); }, [search, category, priority]);

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

  const markTaskDone = async (taskId: string, notificationId: string) => {
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      });
      await markRead(notificationId);
    } catch {
      // best-effort
    }
  };

  const grouped = useMemo(() => {
    const g = { today: [] as Notification[], yesterday: [] as Notification[], earlier: [] as Notification[] };
    for (const n of notifications) g[dayKey(n.created_at)].push(n);
    return g;
  }, [notifications]);

  const unreadCount = notifications.filter(n => !n.read).length;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--text)' }}>
            <Bell size={22} style={{ color: 'var(--accent)' }} />
            {t('notifications')}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </p>
        </div>
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search notifications..."
          className="h-10 px-3 rounded-lg border text-sm"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="h-10 px-3 rounded-lg border text-sm"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
        >
          <option value="">All categories</option>
          <option value="task">Task</option>
          <option value="content">Content</option>
          <option value="team">Team</option>
          <option value="system">System</option>
        </select>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="h-10 px-3 rounded-lg border text-sm"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
        >
          <option value="">All priorities</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: 'var(--surface)' }} />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState icon={Bell} title="No notifications found" description="Try changing filters or search." />
      ) : (
        <div className="space-y-5">
          {(['today', 'yesterday', 'earlier'] as const).map((bucket) => (
            grouped[bucket].length > 0 ? (
              <div key={bucket} className="space-y-2">
                <h2 className="text-xs uppercase tracking-wide font-semibold" style={{ color: 'var(--text-secondary)' }}>
                  {bucket}
                </h2>
                {grouped[bucket].map(n => {
                  const Icon = TYPE_ICON[n.type as keyof typeof TYPE_ICON] ?? Info;
                  const color = TYPE_COLOR[n.type as keyof typeof TYPE_COLOR] ?? '#3b82f6';
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
                      <div className="mt-0.5 shrink-0 w-8 h-8 rounded-full flex items-center justify-center" style={{ background: `${color}18` }}>
                        <Icon size={16} style={{ color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{n.title}</p>
                          <span className="text-xs shrink-0" style={{ color: 'var(--text-secondary)' }}>{fmtDate(n.created_at)}</span>
                        </div>
                        <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{n.message}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {n.category && (
                            <span className="inline-block px-2 py-0.5 rounded-full text-xs" style={{ background: `${color}18`, color }}>
                              {n.category}
                            </span>
                          )}
                          {n.priority && (
                            <span className="inline-block px-2 py-0.5 rounded-full text-xs" style={{ background: 'var(--surface)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                              {n.priority}
                            </span>
                          )}
                        </div>
                      </div>
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
                        {n.task_id && (
                          <button
                            onClick={() => markTaskDone(n.task_id as string, n.id)}
                            className="px-2 h-7 rounded-md text-xs border"
                            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                            title="Mark task as done"
                          >
                            Mark done
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          Page {page} / {totalPages}
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="h-8 px-3 rounded-lg text-xs border disabled:opacity-50"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
          >
            Previous
          </button>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="h-8 px-3 rounded-lg text-xs border disabled:opacity-50"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
