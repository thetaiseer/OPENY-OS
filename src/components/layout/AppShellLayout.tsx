'use client';

import { useEffect, useMemo, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import MobileBottomNav from '@/components/layout/MobileBottomNav';
import { usePermissions } from '@/hooks/usePermissions';
import { PageShell, PageShellProvider } from '@/components/layout/PageLayout';
import AppModal from '@/components/ui/AppModal';
import Button from '@/components/ui/Button';
import { useQuickActions, type QuickActionId } from '@/context/quick-actions-context';
import { queuePendingQuickAction } from '@/lib/pending-quick-action';

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
  const { fallbackAction, clearFallbackAction } = useQuickActions();

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

  const quickActionRoutes: Record<QuickActionId, { href: string; label: string }> = {
    'add-task': { href: '/tasks/all', label: 'Open Tasks' },
    'add-client': { href: '/clients', label: 'Open Clients' },
    'add-content': { href: '/content', label: 'Open Content' },
    'add-asset': { href: '/assets', label: 'Open Assets' },
  };

  const goQuickAction = (action: QuickActionId) => {
    const target = quickActionRoutes[action];
    queuePendingQuickAction(action);
    clearFallbackAction();
    router.push(target.href);
  };

  return (
    <div className="min-h-screen bg-base text-primary">
      <Sidebar />
      <Header />
      <main className="pb-20 pt-16 md:ml-[240px] md:pb-6">
        <PageShellProvider>
          <PageShell>{children}</PageShell>
        </PageShellProvider>
      </main>
      <MobileBottomNav />
      <AppModal
        open={Boolean(fallbackAction)}
        onClose={clearFallbackAction}
        title="Quick add"
        subtitle="Open the right page to add your item — the form will open automatically."
        size="sm"
      >
        <div className="space-y-4 text-sm text-secondary">
          {fallbackAction ? (
            <Button
              type="button"
              variant="primary"
              className="w-full"
              onClick={() => goQuickAction(fallbackAction)}
            >
              {quickActionRoutes[fallbackAction].label}
            </Button>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" onClick={clearFallbackAction}>
              Cancel
            </Button>
          </div>
        </div>
      </AppModal>
    </div>
  );
}
