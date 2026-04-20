'use client';

import { useEffect, useRef, useState } from 'react';
import DocsSidebar from '@/components/layout/DocsSidebar';
import OpenyLogo from '@/components/branding/OpenyLogo';
import { Menu, Moon, Sun } from 'lucide-react';
import { useTheme } from '@/lib/theme-context';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getWorkspaceDashboardHref, getWorkspaceFromPathname } from '@/lib/workspace-navigation';
import { subscribeToTableChanges } from '@/lib/realtime';
import WorkspaceSwitcher from '@/components/layout/WorkspaceSwitcher';

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
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const dashboardHref = getWorkspaceDashboardHref(pathname);
  const workspaceLabel = getWorkspaceFromPathname(pathname) === 'docs' ? 'DOCS' : 'OS';
  const dashboardAriaLabel = dashboardHref === '/docs/dashboard'
    ? 'Go to OPENY DOCS dashboard'
    : 'Go to OPENY OS dashboard';
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
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>
      <DocsSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 min-w-0 overflow-hidden flex flex-col">
        <header
          className="h-16 px-4 sm:px-5 lg:px-6 border-b sticky top-0 z-20 flex items-center gap-3"
          style={{ background: 'var(--header-bg)', borderColor: 'var(--border)' }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-lg hover:bg-[var(--surface-2)] transition-colors"
            style={{ color: 'var(--text-secondary)' }}
          >
            <Menu size={20} />
          </button>
          <div className="flex lg:hidden items-center gap-2">
            <Link
              href={dashboardHref}
              onClick={() => setSidebarOpen(false)}
              aria-label={dashboardAriaLabel}
              className="cursor-pointer transition-opacity duration-150 hover:opacity-85"
            >
              <OpenyLogo width={80} height={24} />
            </Link>
            <span className="text-[10px] sm:text-xs font-semibold tracking-wide" style={{ color: 'var(--text-secondary)' }}>{workspaceLabel}</span>
          </div>
          <div className="flex-1" />
          <WorkspaceSwitcher />
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-[var(--surface-2)] transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </header>
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
