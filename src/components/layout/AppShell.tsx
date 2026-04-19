'use client';

import type { ReactNode } from 'react';
import clsx from 'clsx';

interface AppShellProps {
  sidebar: ReactNode;
  topbar: ReactNode;
  children: ReactNode;
  workspaceClassName?: string;
  mainClassName?: string;
  containerClassName?: string;
}

export default function AppShell({
  sidebar,
  topbar,
  children,
  workspaceClassName,
  mainClassName,
  containerClassName,
}: AppShellProps) {
  return (
    <div className={clsx('os-shell', workspaceClassName)}>
      <div className="os-shell-grid">
        {sidebar}
        <div className="os-stage">
          {topbar}
          <main className={clsx('os-main', mainClassName)}>
            <div className={clsx('os-main-container', containerClassName)}>{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
