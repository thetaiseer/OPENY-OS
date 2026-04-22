'use client';

/**
 * NotificationDropdown
 *
 * Bell icon with unread count badge. Clicking it opens a popover showing the
 * latest notifications with quick-actions. Polls on mount and after each open.
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import {
  Bell, Info, CheckCircle, AlertTriangle, XCircle,
  Check, CheckCheck, ExternalLink, Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import type { Notification } from '@/lib/types';
import { OPENY_MENU_PANEL_CLASS } from '@/components/ui/menu-system';

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

function fmtDate(d: string) {
  const date = new Date(d);
  const now  = new Date();
  const diff = now.getTime() - date.getTime();
  if (diff < 60_000)      return 'just now';
  if (diff < 3_600_000)   return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000)  return `${Math.floor(diff / 3_600_000)}h ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function NotificationDropdown() {
  const { user }    = useAuth();
  const [open, setOpen]         = useState(false);
  const [loading, setLoading]   = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount]     = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  // ── Initial unread count (lightweight) ──────────────────────────────────
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const fetchCount = async () => {
      try {
        const res = await fetch(`/api/notifications?unread=true&user_id=${user.id}&limit=1`);
        if (!res.ok || cancelled) return;
        const json = await res.json() as { unreadCount?: number };
        if (!cancelled) setUnreadCount(json.unreadCount ?? 0);
      } catch { /* silent */ }
    };
    void fetchCount();
    // Refresh count every 60s (Realtime will also push updates)
    const tid = setInterval(fetchCount, 60_000);
    return () => { cancelled = true; clearInterval(tid); };
  }, [user]);

  // ── Load full list when dropdown opens ───────────────────────────────────
  const loadNotifications = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '10', user_id: user.id });
      const res = await fetch(`/api/notifications?${params.toString()}`);
      if (!res.ok) return;
      const json = await res.json() as { notifications?: Notification[]; unreadCount?: number };
      setNotifications(json.notifications ?? []);
      setUnreadCount(json.unreadCount ?? 0);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (open) void loadNotifications();
  }, [open, loadNotifications]);

  // ── Close on outside click / Escape ─────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const onMouse = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onMouse);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onMouse);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // ── Mark single as read ──────────────────────────────────────────────────
  const markRead = async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    setUnreadCount(c => Math.max(0, c - 1));
    try {
      await fetch(`/api/notifications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ read: true }),
      });
    } catch { /* best-effort */ }
  };

  // ── Delete ───────────────────────────────────────────────────────────────
  const deleteNotif = async (id: string, wasUnread: boolean) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    if (wasUnread) setUnreadCount(c => Math.max(0, c - 1));
    try { await fetch(`/api/notifications/${id}`, { method: 'DELETE' }); } catch { /* best-effort */ }
  };

  // ── Mark all as read ─────────────────────────────────────────────────────
  const markAllRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
    try {
      await fetch('/api/notifications/mark-all-read', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user?.id }),
      });
    } catch { /* best-effort */ }
  };

  const unread = notifications.filter(n => !n.read).length;

  return (
    <div ref={ref} className="relative">
      {/* Bell button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-2 rounded-lg hover:bg-[var(--surface-2)] transition-colors"
        style={{ color: 'var(--text-secondary)' }}
        aria-label="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span
            className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full text-white flex items-center justify-center"
            style={{ background: '#ef4444', fontSize: '10px', fontWeight: 700, lineHeight: 1 }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className={`absolute right-0 top-full mt-2 overflow-hidden z-[200] ${OPENY_MENU_PANEL_CLASS}`}
          style={{
            width: 360,
            padding: '0.45rem',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-3 py-2.5 border-b"
            style={{ borderColor: 'var(--border)' }}
          >
            <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
              Notifications {unread > 0 && (
                <span
                  className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs font-bold text-white"
                  style={{ background: '#ef4444' }}
                >
                  {unread}
                </span>
              )}
            </span>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-xs hover:opacity-70 transition-opacity"
                style={{ color: 'var(--accent)' }}
              >
                <CheckCheck size={12} /> Mark all read
              </button>
            )}
          </div>

          {/* List */}
            <div className="overflow-y-auto" style={{ maxHeight: 400 }}>
            {loading ? (
              <div className="space-y-2 p-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-14 rounded-xl animate-pulse" style={{ background: 'var(--surface-2)' }} />
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 gap-2" style={{ color: 'var(--text-secondary)' }}>
                <Bell size={28} style={{ opacity: 0.4 }} />
                <p className="text-sm">No notifications yet</p>
              </div>
            ) : (
              <div className="py-1 space-y-0.5">
                {notifications.map(n => {
                  const Icon  = TYPE_ICON[n.type as keyof typeof TYPE_ICON] ?? Info;
                  const color = TYPE_COLOR[n.type as keyof typeof TYPE_COLOR] ?? '#3b82f6';
                  return (
                    <div
                      key={n.id}
                      className="openy-menu-item flex items-start gap-3 rounded-2xl px-3 py-3 transition-colors group"
                      style={{
                        borderLeft: n.read ? 'none' : '3px solid ' + color,
                        // Compensate left-padding so content stays aligned when the 3px indicator border is shown
                        paddingLeft: n.read ? 12 : 9,
                      }}
                    >
                      {/* Icon */}
                      <div
                        className="mt-0.5 shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
                        style={{ background: `${color}1a` }}
                      >
                        <Icon size={14} style={{ color }} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-xs font-semibold leading-snug"
                          style={{ color: 'var(--text)' }}
                        >
                          {n.title}
                        </p>
                        <p
                          className="text-xs mt-0.5 line-clamp-2"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          {n.message}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)', opacity: 0.7 }}>
                          {fmtDate(n.created_at)}
                        </p>
                      </div>

                      {/* Actions (shown on hover) */}
                      <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        {n.action_url && (
                          <Link
                            href={n.action_url}
                            onClick={() => setOpen(false)}
                            className="p-1 rounded-lg hover:bg-[var(--border)] transition-colors"
                            style={{ color: 'var(--text-secondary)' }}
                            title="Open"
                          >
                            <ExternalLink size={12} />
                          </Link>
                        )}
                        {!n.read && (
                          <button
                            onClick={() => markRead(n.id)}
                            className="p-1 rounded-lg hover:bg-[var(--border)] transition-colors"
                            style={{ color: 'var(--text-secondary)' }}
                            title="Mark as read"
                          >
                            <Check size={12} />
                          </button>
                        )}
                        <button
                          onClick={() => deleteNotif(n.id, !n.read)}
                          className="p-1 rounded-lg hover:bg-[var(--border)] transition-colors"
                          style={{ color: 'var(--text-secondary)' }}
                          title="Delete"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            className="border-t px-3 py-2.5"
            style={{ borderColor: 'var(--border)' }}
          >
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="block text-center text-xs font-medium hover:opacity-70 transition-opacity"
              style={{ color: 'var(--accent)' }}
            >
              View all notifications →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
