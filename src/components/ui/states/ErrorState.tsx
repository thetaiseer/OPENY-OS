'use client';

import { AlertTriangle } from 'lucide-react';
import Button from '@/components/ui/Button';

export default function ErrorState({
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
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-control bg-[var(--color-danger-bg)] text-[var(--color-danger)]">
        <AlertTriangle size={18} />
      </div>
      <p className="text-base font-semibold text-[var(--text)]">{title}</p>
      <p className="max-w-xl text-sm text-[var(--text-secondary)]">{description}</p>
      {actionLabel && onAction ? (
        <Button type="button" variant="danger" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
