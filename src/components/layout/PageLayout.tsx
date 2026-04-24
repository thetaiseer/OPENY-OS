import * as React from 'react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export const PageShell = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    children: ReactNode;
    /** e.g. max-w-5xl for DOCS home */
    className?: string;
  }
>(function PageShell({ children, className, ...rest }, ref) {
  return (
    <div ref={ref} className={cn('app-page-shell', className)} {...rest}>
      {children}
    </div>
  );
});

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="app-page-header">
      <div>
        <h1 className="app-page-title">{title}</h1>
        {subtitle ? <p className="app-page-subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function SectionTitle({
  children,
  className,
  as: Comp = 'h2',
}: {
  children: ReactNode;
  className?: string;
  as?: 'h2' | 'h3';
}) {
  return <Comp className={cn('app-section-title', className)}>{children}</Comp>;
}

/** 8px grid: gap-4 = 16px, gap-6 = 24px */
export function PageGrid({
  children,
  className,
  columns = 'responsive',
}: {
  children: ReactNode;
  className?: string;
  columns?: '1' | '2' | 'responsive';
}) {
  if (columns === '1') {
    return <div className={cn('grid grid-cols-1 gap-6', className)}>{children}</div>;
  }
  if (columns === '2') {
    return <div className={cn('grid grid-cols-1 gap-6 sm:grid-cols-2', className)}>{children}</div>;
  }
  return <div className={cn('grid grid-cols-1 gap-6 lg:grid-cols-2', className)}>{children}</div>;
}
