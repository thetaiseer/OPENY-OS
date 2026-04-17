'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users2, CheckSquare, FolderOpen,
  BarChart2, Users, Settings, X, CalendarDays, Shield, FileText,
} from 'lucide-react';
import { useLang } from '@/lib/lang-context';
import { useAuth } from '@/lib/auth-context';
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
        {/* Logo */}
        <div
          className="flex items-center justify-between h-16 px-5 border-b"
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
              OS
            </span>
            <span
              className="text-[10px] font-bold tracking-widest hidden xl:inline px-1.5 py-0.5 rounded-md"
              style={{ color: 'var(--accent)', background: 'var(--accent-soft)' }}
            >
              OS
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

        {/* Nav */}
        <nav className="flex-1 py-3 px-2.5 space-y-0.5 overflow-y-auto">
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
                  'nav-item flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium',
                  'lg:justify-center xl:justify-start',
                  active ? 'nav-item-active' : 'text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--surface-2)]',
                )}
              >
                <Icon
                  size={18}
                  strokeWidth={active ? 2 : 1.7}
                  style={{ color: active ? 'var(--accent)' : 'currentColor', flexShrink: 0 }}
                />
                <span className="lg:hidden xl:inline leading-none">{displayLabel}</span>
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="p-3 border-t" style={{ borderColor: 'var(--sidebar-border)' }}>
          <AccountMenu placement="sidebar">
            <div className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-[var(--surface-2)] transition-colors cursor-pointer lg:justify-center xl:justify-start">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-sm"
                style={{ background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%)' }}
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
