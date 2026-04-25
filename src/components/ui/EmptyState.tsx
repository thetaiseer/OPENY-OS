'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import Button from '@/components/ui/Button';

export default function EmptyState({
  className,
  icon,
  title,
  description,
  action,
  actionLabel,
  onAction,
  children,
}: {
  className?: string;
  icon?: any;
  children?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  [key: string]: unknown;
}) {
  const iconNode =
    typeof icon === 'function' ? icon({ className: 'h-6 w-6', 'aria-hidden': true }) : icon;

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-card border border-border bg-surface px-6 py-10 text-center shadow-soft',
        className,
      )}
    >
      {iconNode ? <div className="text-secondary">{iconNode}</div> : null}
      {title ? <h3 className="text-lg font-semibold text-primary">{title}</h3> : null}
      {description ? <p className="max-w-md text-sm text-secondary">{description}</p> : null}
      {action ?? (actionLabel ? <Button onClick={onAction}>{actionLabel}</Button> : null)}
      {children}
    </div>
  );
}
