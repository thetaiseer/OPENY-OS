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
      </div>
    </div>
  );
}

