'use client';

import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function Tabs({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      role="tablist"
      className={cn(
        'inline-flex flex-wrap items-center gap-1 rounded-control border border-border bg-surface p-1',
        className,
      )}
    />
  );
}

export function TabButton({
  active = false,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean; children?: ReactNode }) {
  return (
    <button
      {...props}
      role="tab"
      aria-selected={active}
      className={cn(
        'h-8 rounded-control px-3 text-xs font-semibold transition-colors',
        active
          ? 'bg-[color:var(--accent)] text-[color:var(--accent-contrast)]'
          : 'text-secondary hover:bg-[color:var(--surface-elevated)] hover:text-primary',
        className,
      )}
    >
      {children}
    </button>
  );
}
