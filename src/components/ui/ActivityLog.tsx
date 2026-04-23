'use client';

import { useEffect, useState, useCallback } from 'react';
import { Activity } from 'lucide-react';
import supabase from '@/lib/supabase';
import type { Activity as ActivityType } from '@/lib/types';

interface ActivityLogProps {
  clientId?: string;
  limit?: number;
}

const TYPE_COLOR: Record<string, string> = {
  upload: '#3b82f6',
  delete: '#ef4444',
  approve: '#16a34a',
  reject: '#dc2626',
  comment: '#8b5cf6',
  update: '#d97706',
};

function dotColor(type: string): string {
  return TYPE_COLOR[type] ?? 'var(--accent)';
}

export default function ActivityLog({ clientId, limit = 20 }: ActivityLogProps) {
  const [items, setItems] = useState<ActivityType[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActivities = useCallback(async () => {
    try {
      let query = supabase
        .from('activities')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
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
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="h-12 animate-pulse rounded-lg"
            style={{ background: 'var(--surface-2)' }}
          />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <Activity
          size={28}
          className="mb-3 opacity-40"
          style={{ color: 'var(--text-secondary)' }}
        />
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          No activity recorded yet
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((a) => (
        <div key={a.id} className="flex items-start gap-3">
          <div
            className="mt-2 h-2 w-2 shrink-0 rounded-full"
            style={{ background: dotColor(a.type) }}
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm" style={{ color: 'var(--text)' }}>
              {a.description}
            </p>
            <p className="mt-0.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
              {new Date(a.created_at).toLocaleString()}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
