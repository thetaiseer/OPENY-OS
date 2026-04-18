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
    <div className={clsx('workspace-shell', workspaceClassName)}>
      {sidebar}
      <div className="workspace-stage">
        {topbar}
        <main className={clsx('workspace-main', mainClassName)}>
          <div className={clsx('workspace-container', containerClassName)}>{children}</div>
        </main>
      </div>
    </div>
  );
}
