'use client';

import { Inbox } from 'lucide-react';
import Button from '@/components/ui/Button';

export default function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="openy-surface flex flex-col items-center justify-center gap-3 px-6 py-10 text-center">
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-control bg-[var(--accent-soft)] text-[var(--accent)]">
        <Inbox size={18} />
      </div>
      <p className="text-readable text-base font-semibold">{title}</p>
      <p className="text-readable-muted max-w-xl text-sm font-medium">{description}</p>
      {actionLabel && onAction ? (
        <Button type="button" variant="primary" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
