'use client';

import { usePathname } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { AppTopbar } from '@/components/layout/AppTopbar';
import { DocsSidebar } from '@/components/layout/DocsSidebar';

function formatPageTitle(pathname: string): string {
  const segment = pathname.split('/').filter(Boolean).slice(-1)[0] || 'dashboard';
  return segment.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <AppShell
      sidebar={<AppSidebar activePath={pathname} />}
      topbar={<AppTopbar context="OPENY OS" pageTitle={formatPageTitle(pathname)} />}
    >
      {children}
    </AppShell>
  );
}

export function DocsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <AppShell
      sidebar={<DocsSidebar activePath={pathname} />}
      topbar={<AppTopbar context="OPENY DOCS" pageTitle={formatPageTitle(pathname)} />}
    >
      {children}
    </AppShell>
  );
}
