'use client';

import type { ReactNode } from 'react';
import clsx from 'clsx';

interface AppPageProps {
  children: ReactNode;
  className?: string;
  fullWidth?: boolean;
  fill?: boolean;
}

export function AppPage({ children, className }: AppPageProps) {
  return <section className={clsx('workspace-page', className)}>{children}</section>;
}

interface AppPageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function AppPageHeader({ title, subtitle, actions, className }: AppPageHeaderProps) {
  return (
    <header className={clsx('workspace-page-header', className)}>
      <div>
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {actions ? <div>{actions}</div> : null}
    </header>
  );
}
