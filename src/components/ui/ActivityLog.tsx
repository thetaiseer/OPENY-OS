'use client';

import type { ReactNode } from 'react';
import { History } from 'lucide-react';
import { cn } from '@/lib/cn';

export default function ActivityLog({
  children,
  entries = [],
  className,
}: {
  children?: ReactNode;
  entries?: Array<{ id?: string | number; action?: string; actor?: string; created_at?: string }>;
  className?: string;
  [key: string]: unknown;
}) {
  return (
    <div
      className={cn(
        'space-y-2 rounded-card border border-border bg-surface p-4 shadow-soft',
        className,
      )}
    >
      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-primary">
        <History className="h-4 w-4" />
        Activity
      </div>
      {entries.length ? (
        entries.map((entry, index) => (
          <div
            key={entry.id ?? index}
            className="rounded-control border border-border px-3 py-2 text-sm"
          >
            <div className="text-primary">{entry.action ?? 'Updated'}</div>
            <div className="text-xs text-secondary">
              {entry.actor ?? 'System'}{' '}
              {entry.created_at ? `- ${new Date(entry.created_at).toLocaleString()}` : ''}
            </div>
          </div>
        ))
      ) : (
        <div className="text-sm text-secondary">No activity yet.</div>
      )}
      {children}
    </div>
  );
}
