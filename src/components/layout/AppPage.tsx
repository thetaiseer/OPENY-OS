'use client';

import type { ReactNode } from 'react';
import clsx from 'clsx';

interface AppPageProps {
  children: ReactNode;
  className?: string;
  fullWidth?: boolean;
  fill?: boolean;
}

export function AppPage({ children, className, fullWidth = false, fill = false }: AppPageProps) {
  return <section className={clsx('app-page openy-page-shell page-enter', fullWidth && 'app-page-full', fill && 'app-page-fill', className)}>{children}</section>;
}

interface AppPageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function AppPageHeader({ title, subtitle, actions, className }: AppPageHeaderProps) {
  return (
    <header className={clsx('app-page-header', className)}>
      <div className="min-w-0">
        <h1 className="app-page-title">{title}</h1>
        {subtitle ? <p className="app-page-subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="app-page-actions">{actions}</div> : null}
    </header>
  );
}
