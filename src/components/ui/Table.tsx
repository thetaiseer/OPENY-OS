'use client';

import type { HTMLAttributes, ReactNode, TableHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export function Table({ className, ...props }: TableHTMLAttributes<HTMLTableElement>) {
  return <table {...props} className={cn('w-full min-w-full border-collapse', className)} />;
}

export function TableContainer({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={cn(
        'overflow-x-auto rounded-card border border-border bg-surface shadow-soft',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function TableHead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead {...props} className={cn('bg-elevated', className)} />;
}

export function TableBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...props} className={cn(className)} />;
}

export function TableRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr {...props} className={cn('border-b border-border', className)} />;
}

export function TableHeaderCell({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLTableCellElement> & { children?: ReactNode }) {
  return (
    <th
      {...props}
      className={cn(
        'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-secondary',
        className,
      )}
    >
      {children}
    </th>
  );
}

export function TableCell({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLTableCellElement> & { children?: ReactNode }) {
  return (
    <td {...props} className={cn('px-4 py-3 text-sm text-primary', className)}>
      {children}
    </td>
  );
}
