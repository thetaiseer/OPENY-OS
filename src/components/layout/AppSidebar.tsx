'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import { X } from 'lucide-react';
import clsx from 'clsx';
import OpenyLogo from '@/components/branding/OpenyLogo';
import { getWorkspaceDashboardHref } from '@/lib/workspace-navigation';
import { useAuth } from '@/lib/auth-context';
import AccountMenu from './AccountMenu';

export interface AppSidebarItem {
  href: string;
  base: string;
  label: string;
  icon: LucideIcon;
}

export default function AppSidebar({
  items,
  open,
  onClose,
  workspaceTag,
  variant = 'os',
  profile = false,
}: {
  items: AppSidebarItem[];
  open?: boolean;
  onClose?: () => void;
  workspaceTag: string;
  variant?: 'os' | 'docs';
  profile?: boolean;
}) {
  const pathname = usePathname();
  const dashboardHref = getWorkspaceDashboardHref(pathname);
  const dashboardAriaLabel = dashboardHref === '/docs/dashboard'
    ? 'Go to OPENY DOCS dashboard'
    : 'Go to OPENY OS dashboard';
  const { user } = useAuth();

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-30 lg:hidden app-sidebar-backdrop" onClick={onClose} />
      )}
        <aside
          className={clsx(
            'fixed top-0 left-0 h-full w-[88vw] max-w-[280px] lg:w-[94px] z-40 flex flex-col sidebar-glass app-sidebar-panel',
            'lg:translate-x-0 lg:static lg:z-auto',
            open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          )}
        >
        <div className="app-sidebar-header">
          <div className="flex items-center gap-2.5 min-w-0 lg:justify-center xl:justify-start w-full">
            <Link
              href={dashboardHref}
              onClick={onClose}
              aria-label={dashboardAriaLabel}
              className="hidden xl:block cursor-pointer transition-opacity duration-150 hover:opacity-80"
            >
              <OpenyLogo width={100} height={30} />
            </Link>
            <span className="text-sm font-bold tracking-[0.2em] hidden lg:inline xl:hidden app-sidebar-tag-compact">
              {workspaceTag}
            </span>
            <span
              className={clsx(
                'text-[10px] font-bold tracking-[0.2em] hidden xl:inline px-2 py-1 rounded-full app-sidebar-tag',
                variant === 'docs' && 'app-sidebar-tag-docs',
              )}
            >
              {workspaceTag}
            </span>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="lg:hidden p-2 rounded-xl transition-colors hover:bg-[var(--surface-2)]"
              style={{ color: 'var(--text-secondary)' }}
            >
              <X size={17} />
            </button>
          )}
        </div>

        <nav className="flex-1 py-3.5 px-2.5 space-y-1 overflow-y-auto">
          {items.map(({ href, base, icon: Icon, label }) => {
            const active = pathname === href || (base !== '/os/dashboard' && pathname.startsWith(base));
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                aria-label={label}
                className={clsx(
                  'app-sidebar-item nav-item flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium',
                  'lg:justify-center xl:justify-start',
                  active ? 'nav-item-active' : 'text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--surface-2)]',
                )}
              >
                <Icon
                  size={18}
                  strokeWidth={active ? 2 : 1.75}
                  style={{
                    color: active ? 'var(--accent)' : 'currentColor',
                    flexShrink: 0,
                    filter: active ? 'drop-shadow(0 0 10px var(--accent-glow-strong))' : 'none',
                  }}
                />
                <span className="lg:hidden xl:inline leading-none truncate">{label}</span>
              </Link>
            );
          })}
        </nav>

        {profile && user && (
          <div className="app-sidebar-user">
            <AccountMenu placement="sidebar">
              <div className="flex items-center gap-3 rounded-xl px-2.5 py-2.5 hover:bg-[var(--surface-2)] transition-colors cursor-pointer lg:justify-center xl:justify-start">
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
        )}
      </aside>
    </>
  );
}
