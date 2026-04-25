'use client';

import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export default function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cn('animate-pulse rounded-control bg-elevated', className)} />;
}

export function SkeletonTable(
  props: HTMLAttributes<HTMLDivElement> & { rows?: number; cols?: number },
) {
  const { rows = 5, className, ...rest } = props;
  return (
    <div {...rest} className={cn('space-y-2', className)}>
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-10 w-full rounded-card" />
      ))}
    </div>
  );
}

export function SkeletonStatGrid(props: HTMLAttributes<HTMLDivElement> & { count?: number }) {
  const { count = 4, className, ...rest } = props;
  return (
    <div
      {...rest}
      className={cn('grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4', className)}
    >
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton key={index} className="h-24 rounded-card" />
      ))}
    </div>
  );
}
