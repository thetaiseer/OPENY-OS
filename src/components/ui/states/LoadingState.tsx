'use client';

import Skeleton from '@/components/ui/Skeleton';
import { cn } from '@/lib/cn';

export default function LoadingState({
  className,
  rows = 6,
  cardHeightClass = 'h-24',
}: {
  className?: string;
  rows?: number;
  cardHeightClass?: string;
}) {
  return (
    <div className={cn('grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3', className)}>
      {Array.from({ length: rows }).map((_, idx) => (
        <Skeleton key={idx} className={cn('rounded-2xl', cardHeightClass)} />
      ))}
    </div>
  );
}
