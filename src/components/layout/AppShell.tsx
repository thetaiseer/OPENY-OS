import { ReactNode } from 'react';

interface AppShellProps {
  sidebar: ReactNode;
  topbar: ReactNode;
  children: ReactNode;
}

/**
 * AppShell — primary layout frame.
 * Renders a sticky sidebar + a scrollable main column (topbar + content).
 */
export function AppShell({ sidebar, topbar, children }: AppShellProps) {
  return (
    <div className="ui-shell">
      {sidebar}
      <div className="ui-main">
        {topbar}
        <div className="ui-content">{children}</div>
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
