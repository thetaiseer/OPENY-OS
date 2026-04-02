'use client';

import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import pb from '@/lib/pocketbase';
import { useLang } from '@/lib/lang-context';
import EmptyState from '@/components/ui/EmptyState';

interface Notification { id: string; description: string; created: string; }

export default function NotificationsPage() {
  const { t } = useLang();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await pb.collection('activities').getList(1, 50, { sort: '-created' });
        setNotifications(res.items as unknown as Notification[]);
      } catch {
        setNotifications([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{t('notifications')}</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Your recent notifications</p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: 'var(--surface)' }} />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState icon={Bell} title="No notifications" description="You're all caught up!" />
      ) : (
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          {notifications.map(n => (
            <div
              key={n.id}
              className="flex gap-4 px-6 py-4 border-b last:border-b-0"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <div className="w-2 h-2 rounded-full mt-2 shrink-0" style={{ background: 'var(--accent)' }} />
              <div>
                <p className="text-sm" style={{ color: 'var(--text)' }}>{n.description}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                  {new Date(n.created).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
