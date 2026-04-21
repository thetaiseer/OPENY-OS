'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { FileText, ClipboardList, FileSignature, BookOpen, Users, BarChart2, X, Settings, Moon, Sun, LayoutDashboard } from 'lucide-react';
import OpenyLogo from '@/components/branding/OpenyLogo';
import { getWorkspaceDashboardHref } from '@/lib/workspace-navigation';
import AccountMenu from './AccountMenu';
import WorkspaceSwitcher from './WorkspaceSwitcher';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';

const docsNav = [
  { href: '/docs/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/docs/invoice', label: 'Invoice', icon: FileText },
  { href: '/docs/quotation', label: 'Quotation', icon: ClipboardList },
  { href: '/docs/client-contract', label: 'Client Contract', icon: FileSignature },
  { href: '/docs/hr-contract', label: 'HR Contract', icon: BookOpen },
  { href: '/docs/employees', label: 'Employees', icon: Users },
  { href: '/docs/accounting', label: 'Accounting', icon: BarChart2 },
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
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();

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
            const active = pathname === href || (href !== '/docs/dashboard' && pathname.startsWith(href + '/'));
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

        <div className="px-3 pt-2 pb-4 border-t space-y-1.5" style={{ borderColor: 'var(--border)' }}>
          <div className="lg:flex lg:justify-center xl:block mb-1.5">
            <WorkspaceSwitcher />
          </div>
          <Link
            href="/docs/settings"
            onClick={onClose}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] lg:justify-center xl:justify-start"
            aria-label="Settings"
          >
            <Settings size={18} strokeWidth={1.8} />
            <span className="lg:hidden xl:inline">Settings</span>
          </Link>
          <button
            type="button"
            onClick={toggleTheme}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] lg:justify-center xl:justify-start"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun size={18} strokeWidth={1.8} /> : <Moon size={18} strokeWidth={1.8} />}
            <span className="lg:hidden xl:inline">{theme === 'dark' ? 'Light' : 'Dark'}</span>
          </button>

          <AccountMenu placement="sidebar">
            <div className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-[var(--surface-2)] transition-colors cursor-pointer lg:justify-center xl:justify-start">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0"
                style={{ background: 'var(--accent)' }}
              >
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0 lg:hidden xl:block">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
                  {user.name}
                </p>
                <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                  {user.role}
                </p>
              </div>
            </div>
          </AccountMenu>
        </div>
      </aside>
    </>
  );
}
