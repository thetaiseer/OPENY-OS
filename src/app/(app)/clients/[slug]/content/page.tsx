'use client';

import { useEffect, useState } from 'react';
import supabase from '@/lib/supabase';
import Badge from '@/components/ui/Badge';
import { useClientWorkspace } from '../client-context';
import type { ContentItem } from '@/lib/types';

export default function ClientContentPage() {
  const { clientId } = useClientWorkspace();
  const [content, setContent] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clientId) return;
    void (async () => {
      const { data } = await supabase
        .from('content_items')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(50);
      setContent((data ?? []) as ContentItem[]);
      setLoading(false);
    })();
  }, [clientId]);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: 'var(--surface)' }} />
        ))}
      </div>
    );
  }

  if (content.length === 0) {
    return (
      <div className="py-16 text-center" style={{ color: 'var(--text-secondary)' }}>No content yet</div>
    );
  }

  return (
    <div className="space-y-3">
      {content.map(item => (
        <div
          key={item.id}
          className="flex items-center gap-4 rounded-xl border px-5 py-3"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <div className="flex-1">
            <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{item.title}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{item.platform}</p>
          </div>
          <Badge>{item.status}</Badge>
        </div>
      ))}
    </div>
  );
}
