'use client';

import { useEffect, useState, useCallback } from 'react';
import { Bell, Info, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import supabase from '@/lib/supabase';
import { useLang } from '@/lib/lang-context';
import EmptyState from '@/components/ui/EmptyState';
import type { Notification } from '@/lib/types';

interface ActivityFallback { id: string; description: string; created_at: string; }

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

export default function NotificationsPage() {
  const { t } = useLang();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [fallback, setFallback] = useState<ActivityFallback[]>([]);
  const [usesFallback, setUsesFallback] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    const FETCH_TIMEOUT_MS = 15_000;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('TIMEOUT')), FETCH_TIMEOUT_MS);
      });
      const { data, error } = await Promise.race([
        supabase
          .from('notifications')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50),
        timeoutPromise,
      ]);
      if (error) {
        // Table may not exist yet — fall back to activities
        setUsesFallback(true);
        const { data: actData } = await supabase
          .from('activities')
          .select('id, description, created_at')
          .order('created_at', { ascending: false })
          .limit(50);
        setFallback((actData ?? []) as ActivityFallback[]);
      } else {
        setNotifications((data ?? []) as Notification[]);
      }
    } catch (err) {
      const isTimeout = err instanceof Error && err.message === 'TIMEOUT';
      console.error('[notifications] load error:', isTimeout ? 'timeout' : err);
    } finally {
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadNotifications(); }, [loadNotifications]);

  const markAllRead = async () => {
    if (usesFallback) return;
    await supabase.from('notifications').update({ read: true }).eq('read', false);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{t('notifications')}</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {usesFallback ? 'Recent activity' : 'Your recent notifications'}
          </p>
        </div>
        {!usesFallback && unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="h-9 px-4 rounded-lg text-sm font-medium transition-opacity hover:opacity-70"
            style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
          >
            Mark all as read ({unreadCount})
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: 'var(--surface)' }} />
          ))}
        </div>
      ) : usesFallback ? (
        fallback.length === 0 ? (
          <EmptyState icon={Bell} title="No notifications" description="You're all caught up!" />
        ) : (
          <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
            {fallback.map(n => (
              <div
                key={n.id}
                className="flex gap-4 px-6 py-4 border-b last:border-b-0"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
              >
                <div className="w-2 h-2 rounded-full mt-2 shrink-0" style={{ background: 'var(--accent)' }} />
                <div>
                  <p className="text-sm" style={{ color: 'var(--text)' }}>{n.description}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    {new Date(n.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )
      ) : notifications.length === 0 ? (
        <EmptyState icon={Bell} title="No notifications" description="You're all caught up!" />
      ) : (
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          {notifications.map(n => {
            const Icon = TYPE_ICON[n.type] ?? Info;
            const color = TYPE_COLOR[n.type] ?? '#3b82f6';
            return (
              <div
                key={n.id}
                className="flex gap-4 px-6 py-4 border-b last:border-b-0 transition-colors"
                style={{
                  background:   n.read ? 'var(--surface)' : 'var(--accent-soft)',
                  borderColor:  'var(--border)',
                }}
              >
                <Icon size={16} className="shrink-0 mt-0.5" style={{ color }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{n.title}</p>
                    {!n.read && (
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: 'var(--accent)' }}
                      />
                    )}
                  </div>
                  <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>{n.message}</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                    {new Date(n.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

