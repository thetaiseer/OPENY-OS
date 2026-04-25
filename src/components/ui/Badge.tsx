'use client';

import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

const variantClasses = {
  default: 'bg-elevated text-secondary border-border',
  active: 'bg-success/15 text-success border-success/40',
  success: 'bg-success/15 text-success border-success/40',
  inactive: 'bg-muted/15 text-secondary border-border',
  pending: 'bg-warning/15 text-warning border-warning/40',
  info: 'bg-accent/20 text-accent border-accent/40',
  danger: 'bg-danger/15 text-danger border-danger/40',
  warning: 'bg-warning/15 text-warning border-warning/40',
} as const;

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  children?: ReactNode;
  variant?: keyof typeof variantClasses;
};

export default function Badge({ children, className, variant = 'inactive', ...props }: BadgeProps) {
  return (
    <span
      {...props}
      className={cn(
        'inline-flex items-center rounded-badge border px-2 py-1 text-xs font-medium',
        variantClasses[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
