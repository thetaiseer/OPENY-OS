'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Card } from '@/components/ui/Card';

type StatCardProps = {
  label?: ReactNode;
  value?: ReactNode;
  trend?: any;
  icon?: ReactNode;
  children?: ReactNode;
  className?: string;
  [key: string]: unknown;
};

export default function StatCard({
  label,
  value,
  trend,
  icon,
  children,
  className,
}: StatCardProps) {
  const trendContent =
    trend && typeof trend === 'object' && 'value' in trend ? (
      <span>{String((trend as { value?: unknown }).value ?? '')}</span>
    ) : (
      trend
    );

  return (
    <Card className={cn('space-y-2', className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm text-secondary">{label}</div>
        {icon ? <div className="text-secondary">{icon}</div> : null}
      </div>
      {value ? <div className="text-2xl font-semibold text-primary">{value}</div> : null}
      {trend ? <div className="text-xs text-secondary">{trendContent}</div> : null}
      {children}
    </Card>
  );
}
