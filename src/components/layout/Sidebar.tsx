'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users2, CheckSquare, FolderOpen,
  BarChart2, Users, X, CalendarDays, Shield, FileText, Activity,
  ClipboardList, FileSignature, BookOpen,
  Moon, Sun,
} from 'lucide-react';
import { useLang } from '@/lib/lang-context';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';
import AccountMenu from './AccountMenu';
import WorkspaceSwitcher from './WorkspaceSwitcher';
import clsx from 'clsx';
import OpenyLogo from '@/components/branding/OpenyLogo';
import { getWorkspaceDashboardHref } from '@/lib/workspace-navigation';

const osNavItems = [
  { href: '/os/dashboard',      base: '/os/dashboard',     icon: LayoutDashboard, key: 'dashboard', label: 'Dashboard' },
  { href: '/os/clients',        base: '/os/clients',       icon: Users2,          key: 'clients', label: 'Clients' },
  { href: '/os/tasks',          base: '/os/tasks',         icon: CheckSquare,     key: 'tasks', label: 'Tasks' },
  { href: '/os/content',        base: '/os/content',       icon: FileText,        key: 'content', label: 'Content' },
  { href: '/os/calendar',       base: '/os/calendar',      icon: CalendarDays,    key: 'calendar', label: 'Calendar' },
  { href: '/os/assets',         base: '/os/assets',        icon: FolderOpen,      key: 'assets', label: 'Assets' },
  { href: '/os/reports',        base: '/os/reports',       icon: BarChart2,       key: 'reports', label: 'Reports' },
  { href: '/os/team',           base: '/os/team',          icon: Users,           key: 'team', label: 'Team' },
  { href: '/os/activity',       base: '/os/activity',      icon: Activity,        key: 'activity', label: 'Activity' },
  { href: '/os/security',       base: '/os/security',      icon: Shield,          key: 'security', label: 'Security' },
];

const docsNavItems = [
  { href: '/docs',              base: '/docs',             icon: LayoutDashboard, key: 'dashboard', label: 'Dashboard' },
  { href: '/docs/invoice',      base: '/docs/invoice',     icon: FileText,        key: 'invoice', label: 'Invoice' },
  { href: '/docs/quotation',    base: '/docs/quotation',   icon: ClipboardList,   key: 'quotation', label: 'Quotation' },
  { href: '/docs/client-contract', base: '/docs/client-contract', icon: FileSignature, key: 'client-contract', label: 'Client Contract' },
  { href: '/docs/hr-contract',  base: '/docs/hr-contract', icon: BookOpen,        key: 'hr-contract', label: 'HR Contract' },
  { href: '/docs/employees',    base: '/docs/employees',   icon: Users,           key: 'employees', label: 'Employees' },
  { href: '/docs/accounting',   base: '/docs/accounting',  icon: BarChart2,       key: 'accounting', label: 'Accounting' },
];

interface SidebarProps { open?: boolean; onClose?: () => void; }

export default function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const isDocsWorkspace = pathname.startsWith('/docs');
  const navItems = isDocsWorkspace ? docsNavItems : osNavItems;
  const dashboardHref = getWorkspaceDashboardHref(pathname);
  const dashboardAriaLabel = dashboardHref === '/docs'
    ? 'Go to OPENY DOCS dashboard'
    : 'Go to OPENY OS dashboard';
  const { t } = useLang();
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/30 z-30 lg:hidden backdrop-blur-sm"
          onClick={onClose}
        />
      )}
        <aside
          className={clsx(
            'fixed top-0 left-0 h-full w-64 lg:w-[88px] xl:w-64 z-40 flex flex-col',
            'border-r transition-transform duration-200',
            'lg:translate-x-0 lg:static lg:z-auto',
            open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          )}
          style={{
            background: 'var(--surface-shell)',
            borderColor: 'var(--sidebar-border)',
            backdropFilter: 'var(--blur-panel)',
            WebkitBackdropFilter: 'var(--blur-panel)',
          }}
      >
        {/* Logo */}
        <div
          className="flex items-center justify-between h-16 px-5 border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="flex items-center gap-2.5 min-w-0 lg:justify-center xl:justify-start w-full">
            <Link
              href={dashboardHref}
              onClick={onClose}
              aria-label={dashboardAriaLabel}
              className="hidden xl:block cursor-pointer transition-opacity duration-150 hover:opacity-85"
            >
              <OpenyLogo width={96} height={28} />
            </Link>
            <span className="text-sm font-bold tracking-wide hidden lg:inline xl:hidden" style={{ color: 'var(--text)' }}>OY</span>
            <span
              className="text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded-md hidden xl:inline"
              style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
            >
              {isDocsWorkspace ? 'DOCS' : 'OS'}
            </span>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="lg:hidden p-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--text-secondary)' }}
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
          {navItems.map(({ href, base, icon: Icon, key, label }) => {
            const active = pathname === href || (base !== '/docs' && base !== '/os/dashboard' && pathname.startsWith(base));
            const displayLabel = isDocsWorkspace ? label : t(key);
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                aria-label={displayLabel}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-semibold transition-all',
                  'lg:justify-center xl:justify-start',
                  active
                    ? 'text-[var(--accent)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--surface-2)]',
                )}
                style={active ? {
                  background: 'var(--surface-active-chip)',
                  boxShadow: 'var(--shadow-xs), var(--highlight-inset)',
                } : {}}
              >
                {/* Icon badge */}
                <span
                  className="w-8 h-8 rounded-2xl flex items-center justify-center shrink-0 transition-all"
                  style={active ? {
                    background: 'var(--accent)',
                    color: '#fff',
                    boxShadow: 'var(--glow-accent-sm)',
                  } : {
                    background: 'var(--surface-2)',
                    color: 'var(--text-tertiary)',
                  }}
                >
                  <Icon size={16} strokeWidth={2} />
                </span>
                <span className="lg:hidden xl:inline">{displayLabel}</span>
              </Link>
            );
          })}
        </nav>

        <div className="px-3 pt-2 pb-4 border-t space-y-1.5" style={{ borderColor: 'var(--border)' }}>
          <div className="lg:flex lg:justify-center xl:block mb-1.5">
            <WorkspaceSwitcher />
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] lg:justify-center xl:justify-start"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            <span
              className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'var(--surface-2)', color: 'var(--text-tertiary)' }}
            >
              {theme === 'dark' ? <Sun size={16} strokeWidth={2} /> : <Moon size={16} strokeWidth={2} />}
            </span>
            <span className="lg:hidden xl:inline">{theme === 'dark' ? 'Light' : 'Dark'}</span>
          </button>

          <AccountMenu placement="sidebar">
            <div
              className="flex items-center gap-3 rounded-xl px-3 py-2 transition-colors cursor-pointer hover:bg-[var(--surface-2)] lg:justify-center xl:justify-start"
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                style={{
                  background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-3) 100%)',
                  boxShadow: 'var(--glow-accent-sm)',
                }}
              >
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0 lg:hidden xl:block">
                <p className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>
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
