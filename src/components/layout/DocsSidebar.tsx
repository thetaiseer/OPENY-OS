'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { FileText, ClipboardList, FileSignature, BookOpen, Users, BarChart2, X } from 'lucide-react';
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
          className="fixed inset-0 z-30 lg:hidden"
          style={{ background: 'rgba(10,12,25,0.45)', backdropFilter: 'blur(4px)' }}
          onClick={onClose}
        />
      )}
      <aside
        className={clsx(
          'fixed top-0 left-0 h-full w-64 xl:w-64 lg:w-[88px] z-40 flex flex-col',
          'border-r transition-transform duration-200 sidebar-glass',
          'lg:translate-x-0 lg:static lg:z-auto',
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        <div
          className="h-16 px-5 border-b flex items-center justify-between"
          style={{ borderColor: 'var(--sidebar-border)' }}
        >
          <div className="flex items-center gap-2.5 min-w-0 lg:justify-center xl:justify-start w-full">
            <Link
              href={dashboardHref}
              onClick={onClose}
              aria-label={dashboardAriaLabel}
              className="hidden xl:block cursor-pointer transition-opacity duration-150 hover:opacity-80"
            >
              <OpenyLogo width={96} height={28} />
            </Link>
            <span
              className="text-sm font-bold tracking-widest hidden lg:inline xl:hidden"
              style={{ color: 'var(--accent)' }}
            >
              OY
            </span>
            <span
              className="text-[10px] font-bold tracking-widest hidden xl:inline px-1.5 py-0.5 rounded-md"
              style={{ color: 'var(--accent)', background: 'var(--accent-soft)' }}
            >
              DOCS
            </span>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="lg:hidden p-1.5 rounded-lg transition-colors hover:bg-[var(--surface-2)]"
              style={{ color: 'var(--text-secondary)' }}
            >
              <X size={17} />
            </button>
          )}
        </div>
        <nav className="flex-1 py-3 px-2.5 space-y-0.5 overflow-y-auto">
          {docsNav.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                aria-label={label}
                className={clsx(
                  'nav-item flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium',
                  'lg:justify-center xl:justify-start',
                  active
                    ? ''
                    : 'text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--surface-2)]',
                )}
                style={active ? {
                  background: 'var(--accent-soft)',
                  color: 'var(--accent)',
                  boxShadow: 'inset 0 0 0 1px var(--accent-glow), 0 8px 24px rgba(7, 37, 89, 0.18)',
                } : {}}
              >
                <Icon
                  size={17}
                  strokeWidth={active ? 2 : 1.7}
                  style={{
                    flexShrink: 0,
                    filter: active ? 'drop-shadow(0 0 9px var(--accent-glow))' : 'none',
                  }}
                />
                <span className="lg:hidden xl:inline leading-none">{label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
