'use client';

import { useEffect, useState, useCallback } from 'react';
import { Activity, Clock3, Upload, CheckSquare, Pencil, Trash2, FileText } from 'lucide-react';
import supabase from '@/lib/supabase';
import EmptyState from '@/components/ui/EmptyState';
import { useClientWorkspace } from '../client-context';
import type { Activity as ActivityItem } from '@/lib/types';

const ACTIVITY_VISUALS: Record<string, { icon: JSX.Element; color: string }> = {
  upload: { icon: <Upload size={14} />, color: '#3b82f6' },
  task_created: { icon: <CheckSquare size={14} />, color: '#10b981' },
  task_updated: { icon: <CheckSquare size={14} />, color: '#10b981' },
  task_deleted: { icon: <Trash2 size={14} />, color: '#ef4444' },
  delete: { icon: <Trash2 size={14} />, color: '#ef4444' },
  content_created: { icon: <FileText size={14} />, color: '#8b5cf6' },
  content_updated: { icon: <FileText size={14} />, color: '#8b5cf6' },
  update: { icon: <Pencil size={14} />, color: '#f59e0b' },
  edit: { icon: <Pencil size={14} />, color: '#f59e0b' },
};

function iconFor(type: string) {
  if (ACTIVITY_VISUALS[type]) return ACTIVITY_VISUALS[type].icon;
  if (type.startsWith('task_')) return <CheckSquare size={14} />;
  if (type.startsWith('content_')) return <FileText size={14} />;
  return <Activity size={14} />;
}

function colorFor(type: string) {
  if (ACTIVITY_VISUALS[type]) return ACTIVITY_VISUALS[type].color;
  if (type.startsWith('task_')) return '#10b981';
  if (type.startsWith('content_')) return '#8b5cf6';
  return 'var(--accent)';
}

export default function ClientActivityPage() {
  const { clientId } = useClientWorkspace();

  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!clientId) return;

    setLoading(true);
    const { data } = await supabase
      .from('activities')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(80);

    setItems((data ?? []) as ActivityItem[]);
    setLoading(false);
  }, [clientId]);

  useEffect(() => { void load(); }, [load]);

  if (!clientId) return null;

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: 'var(--surface)' }} />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="glass-card">
        <EmptyState
          icon={Activity}
          title="No activity yet"
          description="Task updates, uploads, edits, and events for this client will appear in this timeline."
        />
      </div>
    );
  }

  return (
    <div className="glass-card p-5 md:p-6">
      <div className="mb-4">
        <h2 className="text-base font-semibold inline-flex items-center gap-2" style={{ color: 'var(--text)' }}>
          <Activity size={16} style={{ color: 'var(--accent)' }} /> Activity Timeline
        </h2>
        <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
          Live operational history connected to tasks, assets, and content.
        </p>
      </div>

      <div className="relative pl-5 space-y-3">
        <div className="absolute left-[8px] top-0 bottom-0 w-px" style={{ background: 'var(--border)' }} />

        {items.map(item => {
          const dotColor = colorFor(item.type);

          return (
            <div key={item.id} className="relative">
              <span
                className="absolute -left-[17px] top-2.5 w-4 h-4 rounded-full border-2 flex items-center justify-center"
                style={{ background: 'var(--surface)', borderColor: dotColor, color: dotColor }}
              >
                {iconFor(item.type)}
              </span>

              <div className="rounded-xl border p-3" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>{item.description}</p>
                <p className="text-xs mt-1.5 inline-flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                  <Clock3 size={11} />
                  {new Date(item.created_at).toLocaleString()}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
