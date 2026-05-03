'use client';

import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import { Card } from '@/components/ui/Card';

export default function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={cn(
        'animate-pulse rounded-control bg-[linear-gradient(90deg,var(--surface-muted),var(--surface-soft),var(--surface-muted))] bg-[length:200%_100%]',
        className,
      )}
    />
  );
}

export function SkeletonTable(
  props: HTMLAttributes<HTMLDivElement> & { rows?: number; cols?: number },
) {
  const { rows = 5, cols = 5, className, ...rest } = props;
  return (
    <div {...rest} className={cn('space-y-2', className)}>
      <Skeleton className="h-10 rounded-card" />
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div
          key={rowIdx}
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
        >
          {Array.from({ length: cols }).map((__, colIdx) => (
            <Skeleton key={`${rowIdx}-${colIdx}`} className="h-8" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonStatGrid(props: HTMLAttributes<HTMLDivElement> & { count?: number }) {
  const { count = 4, className, ...rest } = props;
  return (
    <div
      {...rest}
      className={cn('grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4', className)}
    >
      {Array.from({ length: count }).map((_, idx) => (
        <Card key={idx}>
          <div className="space-y-3">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </Card>
      ))}
    </div>
  );
}
