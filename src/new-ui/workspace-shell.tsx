'use client';

import { usePathname } from 'next/navigation';
import { AppShell, NavItem, Sidebar, Topbar } from '@/new-ui/primitives';

function formatLabel(pathname: string) {
  const segment = pathname.split('/').filter(Boolean).slice(-1)[0] || 'dashboard';
  return segment.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const nav: NavItem[] = [
    { href: '/os/dashboard', label: 'Dashboard' },
    { href: '/os/clients', label: 'Clients' },
    { href: '/os/tasks', label: 'Tasks' },
    { href: '/os/content', label: 'Content' },
    { href: '/os/calendar', label: 'Calendar' },
    { href: '/os/assets', label: 'Assets' },
    { href: '/os/reports', label: 'Reports' },
    { href: '/os/team', label: 'Team' },
    { href: '/os/security', label: 'Security' },
    { href: '/os/settings', label: 'Settings' },
    { href: '/docs', label: 'Docs' },
  ];

  return (
    <AppShell
      sidebar={<Sidebar title="OPENY OS" nav={nav} activePath={pathname} />}
      topbar={<Topbar label={formatLabel(pathname)} />}
    >
      {children}
    </AppShell>
  );
}

export function DocsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const nav: NavItem[] = [
    { href: '/docs', label: 'Docs Home' },
    { href: '/docs/dashboard', label: 'Dashboard' },
    { href: '/docs/documents', label: 'Documents' },
    { href: '/docs/settings', label: 'Settings' },
  ];

  return (
    <AppShell
      sidebar={<Sidebar title="OPENY DOCS" nav={nav} activePath={pathname} />}
      topbar={<Topbar label={formatLabel(pathname)} />}
    >
      {children}
    </AppShell>
  );
}
