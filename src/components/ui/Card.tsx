'use client';

import * as React from 'react';
import { cn } from '@/lib/cn';

/** Shared glass card surface — identical padding, radius, shadow, blur across the app */
export const cardSurfaceClass =
  'openy-card relative overflow-hidden rounded-2xl border border-[var(--border-glass)] shadow-card';

const paddings = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
} as const;

export type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  padding?: keyof typeof paddings;
};

export function Card({ className, padding = 'md', children, ...rest }: CardProps) {
  return (
    <div className={cn(cardSurfaceClass, paddings[padding], className)} {...rest}>
      <div className="relative z-[1]">{children}</div>
    </div>
  );
}

export function CardHeader({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mb-4 flex flex-wrap items-start justify-between gap-3', className)} {...rest} />;
}

export function CardTitle({ className, ...rest }: React.ComponentPropsWithoutRef<'h2'>) {
  return <h2 className={cn('app-card-title', className)} {...rest} />;
}

export function CardDescription({ className, ...rest }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn('mt-1 text-sm leading-relaxed text-[var(--text-secondary)]', className)}
      {...rest}
    />
  );
}

export function CardContent({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn(className)} {...rest} />;
}

export function CardFooter({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('mt-6 flex flex-wrap items-center justify-end gap-2 border-t border-[var(--border)] pt-4', className)}
      {...rest}
    />
  );
}
