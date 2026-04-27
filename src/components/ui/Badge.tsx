'use client';

import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  children?: ReactNode;
  variant?: 'default' | 'info' | 'success' | 'warning' | 'danger' | string;
};

const VARIANT_CLASS: Record<NonNullable<BadgeProps['variant']>, string> = {
  default: 'bg-[color:var(--surface-soft)] text-[color:var(--text-secondary)] border-border',
  info: 'bg-[color:var(--accent-soft)] text-[color:var(--primary)] border-[color:var(--primary)]/35',
  success:
    'bg-[color:var(--surface-soft)] text-[color:var(--success)] border-[color:var(--success)]',
  warning:
    'bg-[color:var(--surface-soft)] text-[color:var(--warning)] border-[color:var(--warning)]',
  danger:
    'bg-[color:var(--danger-soft)] text-[color:var(--danger-text)] border-[color:color-mix(in_srgb,var(--danger)_45%,transparent)]',
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
