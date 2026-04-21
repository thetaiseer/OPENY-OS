'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users2, CheckSquare, FolderOpen,
  BarChart2, Users, Settings, X, CalendarDays, Shield, FileText, Activity,
  Moon, Sun,
} from 'lucide-react';
import { useLang } from '@/lib/lang-context';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';
import AccountMenu from './AccountMenu';
import clsx from 'clsx';
import OpenyLogo from '@/components/branding/OpenyLogo';
import { getWorkspaceDashboardHref } from '@/lib/workspace-navigation';

const navItems = [
  { href: '/os/dashboard',      base: '/os/dashboard',     icon: LayoutDashboard, key: 'dashboard'     },
  { href: '/os/clients',        base: '/os/clients',       icon: Users2,          key: 'clients'        },
  { href: '/os/tasks',          base: '/os/tasks',         icon: CheckSquare,     key: 'tasks'          },
  { href: '/os/content',        base: '/os/content',       icon: FileText,        key: 'content'        },
  { href: '/os/calendar',       base: '/os/calendar',      icon: CalendarDays,    key: 'calendar'       },
  { href: '/os/assets',         base: '/os/assets',        icon: FolderOpen,      key: 'assets'         },
  { href: '/os/reports',        base: '/os/reports',       icon: BarChart2,       key: 'reports'        },
  { href: '/os/team',           base: '/os/team',          icon: Users,           key: 'team'           },
  { href: '/os/activity',       base: '/os/activity',      icon: Activity,        key: 'activity'       },
  { href: '/os/security',       base: '/os/security',      icon: Shield,          key: 'security'       },
  { href: '/os/settings',       base: '/os/settings',      icon: Settings,        key: 'settings'       },
];

interface SidebarProps { open?: boolean; onClose?: () => void; }

export default function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const dashboardHref = getWorkspaceDashboardHref(pathname);
  const dashboardAriaLabel = dashboardHref === '/docs/dashboard'
    ? 'Go to OPENY DOCS dashboard'
    : 'Go to OPENY OS dashboard';
  const { t } = useLang();
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
            'fixed top-0 left-0 h-full w-72 lg:w-[84px] xl:w-72 z-40 flex flex-col',
            'border-r transition-transform duration-200 backdrop-blur-xl',
            'lg:translate-x-0 lg:static lg:z-auto',
            open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          )}
          style={{ background: 'var(--sidebar-bg)', borderColor: 'var(--sidebar-border)' }}
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
            <span className="text-sm font-semibold tracking-wide hidden lg:inline xl:hidden" style={{ color: 'var(--text)' }}>OY</span>
            <span className="text-xs font-semibold tracking-wide hidden xl:inline" style={{ color: 'var(--text-secondary)' }}>OS</span>
          </div>
          {onClose && (
            <button onClick={onClose} className="lg:hidden p-1 rounded hover:opacity-70">
              <X size={18} />
            </button>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
          {navItems.map(({ href, base, icon: Icon, key }) => {
            const active =
              pathname === href ||
              (base !== '/os/dashboard' && pathname.startsWith(base));
            const displayLabel = key ? t(key) : href;
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                aria-label={displayLabel}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                  'lg:justify-center xl:justify-start',
                  active
                    ? 'text-[var(--accent)] bg-[var(--accent-soft)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--surface-2)]',
                )}
              >
                <Icon size={18} strokeWidth={1.8} />
                <span className="lg:hidden xl:inline">{displayLabel}</span>
              </Link>
            );
          })}
        </nav>

        <div className="px-3 pt-2 pb-4 border-t space-y-1.5" style={{ borderColor: 'var(--border)' }}>
          <Link
            href="/os/settings"
            onClick={onClose}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] lg:justify-center xl:justify-start"
            aria-label={t('settings')}
          >
            <Settings size={18} strokeWidth={1.8} />
            <span className="lg:hidden xl:inline">{t('settings')}</span>
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
