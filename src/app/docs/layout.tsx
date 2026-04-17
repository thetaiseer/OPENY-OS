'use client';

import { useEffect, useRef, useState } from 'react';
import DocsSidebar from '@/components/layout/DocsSidebar';
import { usePathname, useRouter } from 'next/navigation';
import { subscribeToTableChanges } from '@/lib/realtime';
import AppTopbar from '@/components/layout/AppTopbar';
import AppShell from '@/components/layout/AppShell';
import { AppPage } from '@/components/layout/AppPage';

const DOCS_REALTIME_REFRESH_DEBOUNCE_MS = 120;

function getRealtimeTablesForPath(path: string): string[] {
  if (path.includes('/docs/documents/client-profiles')) return ['clients', 'templates', 'docs_client_document_profiles'];
  if (path.includes('/docs/documents/invoice')) return ['docs_invoices', 'docs_client_document_profiles'];
  if (path.includes('/docs/documents/quotation')) return ['docs_quotations', 'docs_client_document_profiles'];
  if (path.includes('/docs/documents/client-contract')) return ['docs_client_contracts', 'docs_client_document_profiles'];
  if (path.includes('/docs/documents/hr-contract')) return ['docs_hr_contracts', 'docs_client_document_profiles'];
  if (path.includes('/docs/documents/employees')) return ['docs_employees', 'docs_client_document_profiles'];
  if (path.includes('/docs/documents/accounting')) return ['docs_accounting_entries', 'docs_accounting_expenses', 'docs_client_document_profiles'];
  return ['docs_client_document_profiles'];
}

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!pathname.startsWith('/docs/documents')) return;

    const requestRefresh = () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = setTimeout(() => router.refresh(), DOCS_REALTIME_REFRESH_DEBOUNCE_MS);
    };

    const tables = getRealtimeTablesForPath(pathname);

    const unsubscribers = [
      ...tables.map(table => subscribeToTableChanges({ table }, requestRefresh)),
    ];

    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      unsubscribers.forEach(unsub => unsub());
    };
  }, [pathname, router]);

  return (
    <AppShell
      workspaceClassName="docs-workspace"
      sidebar={<DocsSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />}
      topbar={<AppTopbar onMenuClick={() => setSidebarOpen(true)} />}
      containerClassName="docs-shell-container"
    >
      <AppPage fill>{children}</AppPage>
    </AppShell>
  );
}
