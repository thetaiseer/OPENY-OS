'use client';

import type { ReactNode } from 'react';
import clsx from 'clsx';

export default function AppShell({
  sidebar,
  topbar,
  children,
  workspaceClassName,
  mainClassName,
  containerClassName,
}: {
  sidebar: ReactNode;
  topbar: ReactNode;
  children: ReactNode;
  workspaceClassName?: string;
  mainClassName?: string;
  containerClassName?: string;
}) {
  return (
    <div className={clsx('app-shell-root flex h-screen overflow-hidden', workspaceClassName)}>
      {sidebar}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {topbar}
        <main className={clsx('flex-1 overflow-y-auto app-shell-main', mainClassName)}>
          <div className={clsx('app-shell-container', containerClassName)}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
