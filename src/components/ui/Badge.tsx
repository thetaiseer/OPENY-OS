'use client';

import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  children?: ReactNode;
  variant?: 'default' | 'info' | 'success' | 'warning' | 'danger' | string;
};

const VARIANT_CLASS: Record<NonNullable<BadgeProps['variant']>, string> = {
  default: 'bg-[color:var(--surface-elevated)] text-secondary border-border',
  info: 'bg-[color:var(--accent-soft)] text-[color:var(--accent)] border-[color:var(--accent)]/25',
  success: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-300 border-emerald-500/25',
  warning: 'bg-amber-500/12 text-amber-700 dark:text-amber-300 border-amber-500/25',
  danger: 'bg-rose-500/12 text-rose-700 dark:text-rose-300 border-rose-500/25',
};

export default function Badge({ children, variant = 'default', className, ...props }: BadgeProps) {
  const resolvedVariant = (
    variant in VARIANT_CLASS ? variant : 'default'
  ) as keyof typeof VARIANT_CLASS;
  return (
    <span
      {...props}
      className={cn(
        'inline-flex items-center rounded-badge border px-2.5 py-1 text-xs font-medium',
        VARIANT_CLASS[resolvedVariant],
        className,
      )}
    >
      {children}
    </span>
  );
}
