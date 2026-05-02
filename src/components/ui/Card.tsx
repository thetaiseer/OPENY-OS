'use client';

import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

type DivProps = HTMLAttributes<HTMLDivElement> & { children?: ReactNode };

const paddingClasses = {
  none: '',
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
} as const;

export const cardSurfaceClass =
  'rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--card-foreground)] shadow-[var(--shadow-sm)] transition-shadow duration-200 hover:shadow-[var(--shadow-hover)]';

export function Card({
  children,
  padding = 'md',
  className,
  ...props
}: DivProps & { padding?: keyof typeof paddingClasses }) {
  return (
    <section {...props} className={cn(cardSurfaceClass, paddingClasses[padding], className)}>
      {children}
    </section>
  );
}

export function CardHeader({ children, className, ...props }: DivProps) {
  return (
    <div {...props} className={cn('mb-4 flex items-start justify-between gap-3', className)}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className, ...props }: DivProps) {
  return (
    <h3
      {...props}
      className={cn(
        'bg-transparent text-lg font-semibold text-[color:var(--text-primary)]',
        className,
      )}
    >
      {children}
    </h3>
  );
}

export function CardDescription({ children, className, ...props }: DivProps) {
  return (
    <p
      {...props}
      className={cn('bg-transparent text-sm text-[color:var(--text-secondary)]', className)}
    >
      {children}
    </p>
  );
}

export function CardContent({ children, className, ...props }: DivProps) {
  return (
    <div {...props} className={cn('space-y-4', className)}>
      {children}
    </div>
  );
}
