'use client';

import { useEffect, useMemo, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import MobileBottomNav from '@/components/layout/MobileBottomNav';
import FloatingUploadDock from '@/components/layout/FloatingUploadDock';
import { usePermissions } from '@/hooks/usePermissions';
import { PageShellProvider } from '@/components/layout/PageLayout';
import GlobalQuickCreate from '@/components/layout/GlobalQuickCreate';
import Breadcrumbs from '@/components/ui/navigation/Breadcrumbs';
import RouteTitle from '@/components/ui/navigation/RouteTitle';
import { useAuth } from '@/context/auth-context';
import { workspaceKey } from '@/hooks/workspace-query';
import PageTransition from '@/components/layout/PageTransition';

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
  const queryClient = useQueryClient();
  const { defaultWorkspaceId } = useAuth();
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

  useEffect(() => {
    if (!defaultWorkspaceId) return;
    void Promise.allSettled([
      queryClient.prefetchQuery({
        queryKey: workspaceKey(defaultWorkspaceId, 'dashboard-stats'),
        queryFn: async () => {
          const response = await fetch('/api/reports/overview', { cache: 'no-store' });
          if (!response.ok) return null;
          return response.json();
        },
        staleTime: 45_000,
      }),
      queryClient.prefetchQuery({
        queryKey: workspaceKey(defaultWorkspaceId, 'tasks-all', 'prefetch'),
        queryFn: async () => {
          const response = await fetch('/api/tasks?limit=40', { cache: 'no-store' });
          if (!response.ok) return [];
          const json = (await response.json()) as { tasks?: unknown[] };
          return json.tasks ?? [];
        },
        staleTime: 45_000,
      }),
    ]);
  }, [defaultWorkspaceId, queryClient]);

  if (!loading && !isAllowed && permissionTarget) {
    return null;
  }

  return (
    <div className="min-h-screen min-h-screen-dynamic bg-background">
      <Sidebar />
      <Header />
      <main className="pb-[calc(5.75rem+env(safe-area-inset-bottom,0px))] pt-[calc(3.25rem+env(safe-area-inset-top,0px))] md:ms-[var(--openy-sidebar-width)] md:pb-6 md:pt-10">
        <PageShellProvider>
          <div className="mx-auto w-full max-w-shell pb-4 pe-[max(1rem,env(safe-area-inset-right,0px))] ps-[max(1rem,env(safe-area-inset-left,0px))] pt-3 sm:pb-5 md:pb-6 md:pe-6 md:ps-6">
            <PageTransition className="space-y-2">
              <div className="sr-only">
                <RouteTitle />
              </div>
              {pathname !== '/dashboard' && (
                <div className="flex min-h-6 items-center justify-between gap-3">
                  <Breadcrumbs className="min-w-0 flex-1" hideOnDashboard />
                </div>
              )}
              {children}
            </PageTransition>
          </div>
        </PageShellProvider>
      </main>
      <MobileBottomNav />
      <FloatingUploadDock />
      <GlobalQuickCreate />
    </div>
  );
}
