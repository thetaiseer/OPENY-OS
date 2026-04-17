'use client';

import type { ReactNode } from 'react';
import clsx from 'clsx';

export function AppPage({
  children,
  className,
  fullWidth = false,
  fill = false,
}: {
  children: ReactNode;
  className?: string;
  fullWidth?: boolean;
  fill?: boolean;
}) {
  return (
    <section className={clsx('app-page', fullWidth && 'app-page-full', fill && 'app-page-fill', className)}>
      {children}
    </section>
  );
}

export function AppPageHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx('app-page-header', className)}>
      <div className="min-w-0">
        <h1 className="app-page-title">{title}</h1>
        {subtitle ? <p className="app-page-subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="app-page-actions">{actions}</div> : null}
    </div>
  );
}
