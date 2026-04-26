'use client';

import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  children?: ReactNode;
  variant?: 'default' | 'info' | 'success' | 'warning' | 'danger' | string;
};

const VARIANT_CLASS: Record<NonNullable<BadgeProps['variant']>, string> = {
  default: 'bg-[color:var(--surface-elevated)] text-secondary border-border',
  info: 'bg-[color:var(--accent-soft)] text-[color:var(--accent)] border-[color:var(--accent)]/35',
  success: 'bg-emerald-500/18 text-emerald-800 dark:text-emerald-200 border-emerald-500/35',
  warning: 'bg-amber-500/18 text-amber-800 dark:text-amber-200 border-amber-500/35',
  danger: 'bg-rose-500/18 text-rose-800 dark:text-rose-200 border-rose-500/35',
};

export default function Badge({ children, variant = 'default', className, ...props }: BadgeProps) {
  const resolvedVariant = (
    variant in VARIANT_CLASS ? variant : 'default'
  ) as keyof typeof VARIANT_CLASS;
  return (
    <span
      {...props}
      className={cn(
        'inline-flex items-center rounded-badge border px-3 py-1.5 text-xs font-medium leading-normal',
        VARIANT_CLASS[resolvedVariant],
        className,
      )}
    >
      {children}
    </span>
  );
}
