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
    <div className={clsx('app-shell-root flex min-h-dvh overflow-hidden', workspaceClassName)}>
      {sidebar}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {topbar}
        <main className={clsx('app-shell-main flex-1 overflow-y-auto', mainClassName)}>
          <div className={clsx('app-shell-container', containerClassName)}>{children}</div>
        </main>
      </div>
    </div>
  );
}
