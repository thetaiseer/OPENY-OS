'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { BookOpenText, FileText, ClipboardList, FileSignature, BookOpen, Users, BarChart2, X } from 'lucide-react';
import OpenyLogo from '@/components/branding/OpenyLogo';
import { getWorkspaceDashboardHref } from '@/lib/workspace-navigation';

const docsNav = [
  { href: '/docs/documents/invoice', label: 'Invoice', icon: FileText },
  { href: '/docs/documents/quotation', label: 'Quotation', icon: ClipboardList },
  { href: '/docs/documents/client-contract', label: 'Client Contract', icon: FileSignature },
  { href: '/docs/documents/hr-contract', label: 'HR Contract', icon: BookOpen },
  { href: '/docs/documents/employees', label: 'Employees', icon: Users },
  { href: '/docs/documents/accounting', label: 'Accounting', icon: BarChart2 },
];

interface DocsSidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export default function DocsSidebar({ open, onClose }: DocsSidebarProps) {
  const pathname = usePathname();
  const dashboardHref = getWorkspaceDashboardHref(pathname);
  const dashboardAriaLabel = dashboardHref === '/docs/dashboard'
    ? 'Go to OPENY DOCS dashboard'
    : 'Go to OPENY OS dashboard';

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/30 z-30 lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={clsx(
          'fixed top-0 left-0 h-full w-64 xl:w-64 lg:w-[88px] z-40 flex flex-col',
          'border-r transition-transform duration-200',
          'lg:translate-x-0 lg:static lg:z-auto',
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
        style={{ background: 'var(--sidebar-bg)', borderColor: 'var(--sidebar-border)' }}
      >
        <div className="h-16 px-5 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2.5 min-w-0 lg:justify-center xl:justify-start w-full">
            <Link
              href={dashboardHref}
              onClick={onClose}
              aria-label={dashboardAriaLabel}
              className="hidden xl:block cursor-pointer transition-opacity duration-150 hover:opacity-85"
            >
              <OpenyLogo width={96} height={28} />
            </Link>
            <span className="text-sm font-semibold tracking-wide hidden lg:inline xl:hidden" style={{ color: 'var(--text)' }}>OY</span>
            <span className="text-xs font-semibold tracking-wide hidden xl:inline" style={{ color: 'var(--text-secondary)' }}>DOCS</span>
          </div>
          {onClose && (
            <button onClick={onClose} className="lg:hidden p-1 rounded hover:opacity-70">
              <X size={18} />
            </button>
          )}
        </div>
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {docsNav.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                aria-label={label}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  'lg:justify-center xl:justify-start',
                  active
                    ? 'text-[var(--accent)] bg-[var(--accent-soft)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--surface-2)]',
                )}
              >
                <Icon size={17} />
                <span className="lg:hidden xl:inline">{label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t" style={{ borderColor: 'var(--border)' }}>
          <Link
            href="/select-workspace"
            onClick={onClose}
            aria-label="Switch workspace"
            className="text-xs inline-flex items-center gap-1 lg:justify-center xl:justify-start w-full"
            style={{ color: 'var(--text-secondary)' }}
          >
            <BookOpenText size={13} /> <span className="lg:hidden xl:inline">Switch workspace</span>
          </Link>
        </div>
      </aside>
    </>
  );
}
