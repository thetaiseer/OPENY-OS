'use client';

import { isValidElement, type ElementType, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Card } from '@/components/ui/Card';

type StatCardProps = {
  label?: ReactNode;
  value?: ReactNode;
  trend?: ReactNode | { value?: ReactNode; positive?: boolean } | null;
  icon?: ReactNode | ElementType;
  detail?: ReactNode;
  children?: ReactNode;
  className?: string;
  [key: string]: unknown;
};

function renderSafeNode(node: ReactNode | ElementType | null | undefined, iconClassName?: string) {
  if (node == null || node === false) return null;
  if (isValidElement(node)) return node;

  // Support component refs passed as values (e.g. icon={Users}).
  if (typeof node === 'function') {
    const NodeComponent = node as ElementType;
    return <NodeComponent className={iconClassName} />;
  }

  // Guard against plain objects being rendered as React children.
  if (typeof node === 'object') return null;

  return node;
}

export default function StatCard({
  label,
  value,
  trend,
  icon,
  detail,
  children,
  className,
}: StatCardProps) {
  const iconNode = renderSafeNode(icon, 'h-5 w-5');
  const trendNode =
    trend && typeof trend === 'object' && !isValidElement(trend) && 'value' in trend
      ? renderSafeNode((trend as { value?: ReactNode }).value)
      : renderSafeNode(trend as ReactNode);
  const trendPositive =
    trend && typeof trend === 'object' && !isValidElement(trend) && 'positive' in trend
      ? Boolean((trend as { positive?: boolean }).positive)
      : null;

  return (
    <Card className={cn('space-y-2', className)}>
      <div className="flex items-start justify-between gap-2">
        {label ? (
          <div className="text-xs font-medium uppercase tracking-wide text-secondary">{label}</div>
        ) : null}
        {iconNode ? (
          <div className="inline-flex h-8 w-8 items-center justify-center rounded-control bg-[color:var(--accent-soft)] text-[color:var(--accent)]">
            {iconNode}
          </div>
        ) : null}
      </div>
      {value !== null && value !== undefined ? (
        <div className="text-3xl font-semibold leading-none text-primary">{value}</div>
      ) : null}
      {trendNode !== null && trendNode !== undefined ? (
        <div
          className={cn(
            'text-xs font-medium',
            trendPositive === null
              ? 'text-secondary'
              : trendPositive
                ? 'text-[var(--text-primary)]'
                : 'text-[var(--text-secondary)]',
          )}
        >
          {trendPositive === null ? null : trendPositive ? '▲ ' : '▼ '}
          {trendNode}
        </div>
      ) : null}
      {detail ? <div className="text-xs text-secondary">{detail}</div> : null}
      {children}
    </Card>
  );
}
