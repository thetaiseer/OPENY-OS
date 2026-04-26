'use client';

import { useEffect, useMemo, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import MobileBottomNav from '@/components/layout/MobileBottomNav';
import FloatingDock from '@/components/layout/FloatingDock';
import { usePermissions } from '@/hooks/usePermissions';
import { PageShell, PageShellProvider } from '@/components/layout/PageLayout';
import GlobalQuickCreate from '@/components/layout/GlobalQuickCreate';

function routePermissionTarget(
  pathname: string,
): { workspace: 'os' | 'docs'; module: string } | null {
  const path = pathname.replace(/\/+$/, '') || '/';

  if (path === '/dashboard' || path === '/os/dashboard')
    return { workspace: 'os', module: 'dashboard' };
  if (path.startsWith('/clients') || path.startsWith('/os/clients'))
    return { workspace: 'os', module: 'clients' };
  if (path.startsWith('/tasks') || path.startsWith('/my-tasks') || path.startsWith('/os/tasks'))
    return { workspace: 'os', module: 'tasks' };
  if (path.startsWith('/content') || path.startsWith('/os/content'))
    return { workspace: 'os', module: 'content' };
  if (path.startsWith('/calendar') || path.startsWith('/os/calendar'))
    return { workspace: 'os', module: 'calendar' };
  if (path.startsWith('/assets') || path.startsWith('/os/assets'))
    return { workspace: 'os', module: 'assets' };
  if (path.startsWith('/reports') || path.startsWith('/os/reports'))
    return { workspace: 'os', module: 'reports' };
  if (path.startsWith('/team') || path.startsWith('/os/team'))
    return { workspace: 'os', module: 'team' };
  if (path.startsWith('/activity')) return { workspace: 'os', module: 'activity' };
  if (path.startsWith('/security') || path.startsWith('/os/security'))
    return { workspace: 'os', module: 'security' };

  if (path.startsWith('/docs/invoice') || path === '/invoice')
    return { workspace: 'docs', module: 'invoice' };
  if (path.startsWith('/docs/quotation') || path === '/quotation')
    return { workspace: 'docs', module: 'quotation' };
  if (path.startsWith('/docs/accounting') || path === '/accounting')
    return { workspace: 'docs', module: 'accounting' };
  if (
    path.startsWith('/docs/client-contract') ||
    path.startsWith('/docs/hr-contract') ||
    path.startsWith('/docs/employees')
  ) {
    return { workspace: 'docs', module: 'contracts' };
  }

  return null;
}

export default function AppShellLayout({ children }: { children?: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { canView, loading } = usePermissions();
  const permissionTarget = useMemo(() => routePermissionTarget(pathname), [pathname]);
  const isAllowed = useMemo(() => {
    if (!permissionTarget) return true;
    return canView(permissionTarget.workspace, permissionTarget.module);
  }, [canView, permissionTarget]);

  useEffect(() => {
    if (loading || isAllowed || !permissionTarget) return;
    router.replace(`/access-denied?workspace=${permissionTarget.workspace}`);
  }, [isAllowed, loading, permissionTarget, router]);

  if (!isAllowed && permissionTarget) {
    return null;
  }

  return (
    <div className="min-h-screen min-h-screen-dynamic bg-base text-primary">
      <Sidebar />
      <Header />
      <main className="pb-[calc(5.75rem+env(safe-area-inset-bottom,0px))] pt-[calc(4rem+env(safe-area-inset-top,0px))] md:ml-[240px] md:pb-6 md:pt-16">
        <PageShellProvider>
          <PageShell>{children}</PageShell>
        </PageShellProvider>
      </main>
      <MobileBottomNav />
      <FloatingDock />
      <GlobalQuickCreate />
    </div>
  );
}
