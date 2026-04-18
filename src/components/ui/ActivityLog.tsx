'use client';

import { useCallback, useEffect, useState } from 'react';
import { Activity } from 'lucide-react';
import supabase from '@/lib/supabase';
import type { Activity as ActivityType } from '@/lib/types';

interface ActivityLogProps {
  clientId?: string;
  limit?: number;
}

const typeColor: Record<string, string> = {
  upload: '#44a3ff',
  delete: '#ff5b72',
  approve: '#12bf76',
  reject: '#ff5b72',
  comment: '#7f88ff',
  update: '#ffb020',
};

export default function ActivityLog({ clientId, limit = 20 }: ActivityLogProps) {
  const [items, setItems] = useState<ActivityType[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActivities = useCallback(async () => {
    try {
      let query = supabase.from('activities').select('*').order('created_at', { ascending: false }).limit(limit);
      if (clientId) query = query.eq('client_id', clientId);
      const { data, error } = await query;
      if (!error) setItems((data ?? []) as ActivityType[]);
    } finally {
      setLoading(false);
    }
  }, [clientId, limit]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  if (loading) {
    return (
      <div className="space-y-2.5">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="skeleton-shimmer h-12 rounded-lg" />
        ))}
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="rounded-xl border py-9 text-center" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        <Activity size={26} className="mx-auto mb-2 text-[var(--text-tertiary)]" />
        <p className="text-sm text-[var(--text-secondary)]">No activity recorded yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {items.map((item) => (
        <article key={item.id} className="flex gap-3 rounded-xl border p-3" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: typeColor[item.type] ?? 'var(--accent)' }} />
          <div className="min-w-0 flex-1">
            <p className="text-sm">{item.description}</p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">{new Date(item.created_at).toLocaleString()}</p>
          </div>
        </article>
      ))}
    </div>
  );
}
