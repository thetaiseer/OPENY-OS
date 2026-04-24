'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users2,
  CheckSquare,
  FolderKanban,
  FolderOpen,
  BarChart2,
  Users,
  X,
  CalendarDays,
  Shield,
  FileText,
  Activity,
  ClipboardList,
  FileSignature,
  BookOpen,
  Moon,
  Sun,
} from 'lucide-react';
import { useLang } from '@/context/lang-context';
import { useAuth } from '@/context/auth-context';
import { useTheme } from '@/context/theme-context';
import AccountMenu from './AccountMenu';
import WorkspaceSwitcher from './WorkspaceSwitcher';
import clsx from 'clsx';
import OpenyLogo from '@/components/branding/OpenyLogo';
import { getWorkspaceDashboardHref } from '@/lib/workspace-navigation';
import { LayoutGroup, motion } from 'framer-motion';
import { motionTransition } from '@/lib/motion';

const osNavItems = [
  {
    href: '/os/dashboard',
    base: '/os/dashboard',
    icon: LayoutDashboard,
    key: 'dashboard',
    label: 'Dashboard',
  },
  { href: '/os/clients', base: '/os/clients', icon: Users2, key: 'clients', label: 'Clients' },
  {
    href: '/os/projects',
    base: '/os/projects',
    icon: FolderKanban,
    key: 'projects',
    label: 'Projects',
  },
  { href: '/os/tasks', base: '/os/tasks', icon: CheckSquare, key: 'tasks', label: 'Tasks' },
  { href: '/os/content', base: '/os/content', icon: FileText, key: 'content', label: 'Content' },
  {
    href: '/os/calendar',
    base: '/os/calendar',
    icon: CalendarDays,
    key: 'calendar',
    label: 'Calendar',
  },
  { href: '/os/assets', base: '/os/assets', icon: FolderOpen, key: 'assets', label: 'Assets' },
  { href: '/os/reports', base: '/os/reports', icon: BarChart2, key: 'reports', label: 'Reports' },
  { href: '/os/team', base: '/os/team', icon: Users, key: 'team', label: 'Team' },
  {
    href: '/os/activity',
    base: '/os/activity',
    icon: Activity,
    key: 'activity',
    label: 'Activity',
  },
  { href: '/os/security', base: '/os/security', icon: Shield, key: 'security', label: 'Security' },
];

const docsNavItems = [
  { href: '/docs', base: '/docs', icon: LayoutDashboard, key: 'dashboard', label: 'Dashboard' },
  {
    href: '/docs/invoice',
    base: '/docs/invoice',
    icon: FileText,
    key: 'invoice',
    label: 'Invoice',
  },
  {
    href: '/docs/quotation',
    base: '/docs/quotation',
    icon: ClipboardList,
    key: 'quotation',
    label: 'Quotation',
  },
  {
    href: '/docs/client-contract',
    base: '/docs/client-contract',
    icon: FileSignature,
    key: 'client-contract',
    label: 'Client Contract',
  },
  {
    href: '/docs/hr-contract',
    base: '/docs/hr-contract',
    icon: BookOpen,
    key: 'hr-contract',
    label: 'HR Contract',
  },
  {
    href: '/docs/employees',
    base: '/docs/employees',
    icon: Users,
    key: 'employees',
    label: 'Employees',
  },
  {
    href: '/docs/accounting',
    base: '/docs/accounting',
    icon: BarChart2,
    key: 'accounting',
    label: 'Accounting',
  },
];

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const isDocsWorkspace = pathname.startsWith('/docs');
  const navItems = isDocsWorkspace ? docsNavItems : osNavItems;
  const dashboardHref = getWorkspaceDashboardHref(pathname);
  const dashboardAriaLabel =
    dashboardHref === '/docs' ? 'Go to OPENY DOCS dashboard' : 'Go to OPENY OS dashboard';
  const { t } = useLang();
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/30 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={clsx(
          'fixed left-0 top-0 z-40 flex h-full w-64 flex-col lg:w-[88px] xl:w-64',
          'border-r transition-transform duration-200',
          'lg:static lg:z-auto lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
        style={{
          background: 'var(--sidebar-bg)',
          borderColor: 'var(--sidebar-border)',
          backdropFilter: 'var(--blur-panel)',
          WebkitBackdropFilter: 'var(--blur-panel)',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        {/* Logo */}
        <div
          className="flex h-16 items-center justify-between border-b px-5"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="flex w-full min-w-0 items-center gap-2.5 lg:justify-center xl:justify-start">
            <Link
              href={dashboardHref}
              onClick={onClose}
              aria-label={dashboardAriaLabel}
              className="hidden cursor-pointer transition-opacity duration-150 hover:opacity-85 xl:block"
            >
              <OpenyLogo width={96} height={28} />
            </Link>
            <span
              className="hidden text-sm font-bold tracking-wide lg:inline xl:hidden"
              style={{ color: 'var(--text)' }}
            >
              OY
            </span>
            <span
              className="hidden rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wider xl:inline"
              style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
            >
              {isDocsWorkspace ? 'DOCS' : 'OS'}
            </span>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 transition-colors lg:hidden"
              style={{ color: 'var(--text-secondary)' }}
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1.5 overflow-y-auto px-3.5 py-5">
          <LayoutGroup id="sidebar-nav">
            {navItems.map(({ href, base, icon: Icon, key, label }) => {
              const active =
                pathname === href ||
                (base !== '/docs' && base !== '/os/dashboard' && pathname.startsWith(base));
              const displayLabel = isDocsWorkspace ? label : t(key);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={onClose}
                  aria-label={displayLabel}
                  className={clsx(
                    'group relative flex items-center gap-3 rounded-full px-3 py-2.5 text-sm font-semibold transition-all',
                    'lg:justify-center xl:justify-start',
                    active
                      ? 'text-white'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]',
                  )}
                  style={{
                    transitionDuration: 'var(--motion-duration-ui)',
                    transitionTimingFunction: 'var(--motion-ease-standard)',
                  }}
                >
                  {active && (
                    <motion.span
                      layoutId="sidebar-active-indicator"
                      transition={motionTransition.ui}
                      className="absolute inset-0 rounded-full"
                      style={{
                        background:
                          'linear-gradient(135deg, var(--accent) 0%, var(--accent-3) 100%)',
                        boxShadow: 'var(--shadow-sm), var(--glow-accent-sm)',
                      }}
                    />
                  )}
                  <span
                    className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-transform group-hover:scale-[1.05]"
                    style={{
                      transitionDuration: 'var(--motion-duration-ui)',
                      transitionTimingFunction: 'var(--motion-ease-standard)',
                      ...(active
                        ? {
                            background: 'rgba(255,255,255,0.22)',
                            color: '#fff',
                            boxShadow: 'var(--glow-accent-sm)',
                          }
                        : {
                            background:
                              'color-mix(in srgb, var(--surface-2) var(--sidebar-icon-chip-base), var(--accent-soft) var(--sidebar-icon-chip-tint))',
                            color: 'var(--text-tertiary)',
                          }),
                    }}
                  >
                    <Icon size={16} strokeWidth={2} />
                  </span>
                  <span className="relative z-10 lg:hidden xl:inline">{displayLabel}</span>
                </Link>
              );
            })}
          </LayoutGroup>
        </nav>

        <div
          className="space-y-1.5 border-t px-3 pb-4 pt-2"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="mb-1.5 lg:flex lg:justify-center xl:block">
            <WorkspaceSwitcher />
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)] lg:justify-center xl:justify-start"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
              style={{ background: 'var(--surface-2)', color: 'var(--text-tertiary)' }}
            >
              {theme === 'dark' ? (
                <Sun size={16} strokeWidth={2} />
              ) : (
                <Moon size={16} strokeWidth={2} />
              )}
            </span>
            <span className="lg:hidden xl:inline">{theme === 'dark' ? 'Light' : 'Dark'}</span>
          </button>

          <AccountMenu placement="sidebar">
            <div className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 transition-colors hover:bg-[var(--surface-2)] lg:justify-center xl:justify-start">
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{
                  background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-3) 100%)',
                  boxShadow: 'var(--glow-accent-sm)',
                }}
              >
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1 lg:hidden xl:block">
                <p className="truncate text-sm font-semibold" style={{ color: 'var(--text)' }}>
                  {user.name}
                </p>
                <p className="truncate text-xs" style={{ color: 'var(--text-secondary)' }}>
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
