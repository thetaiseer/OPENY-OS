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
    <div className={clsx('app-shell-root app-shell-workspace', workspaceClassName)}>
      <div className="app-shell-grid">
        {sidebar}
        <div className="app-shell-stage">
          {topbar}
          <main className={clsx('app-shell-main', mainClassName)}>
            <div className={clsx('app-shell-container', containerClassName)}>{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
