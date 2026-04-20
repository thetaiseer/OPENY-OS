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

interface AppSidebarProps {
  items: AppSidebarItem[];
  open?: boolean;
  onClose?: () => void;
  workspaceTag: string;
  variant?: 'os' | 'docs';
  profile?: boolean;
}

export default function AppSidebar({
  items,
  open,
  onClose,
  workspaceTag,
  variant = 'os',
  profile = false,
}: AppSidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const dashboardHref = getWorkspaceDashboardHref(pathname);

  return (
    <>
      {open ? <div className="app-sidebar-backdrop fixed inset-0 z-30 lg:hidden" onClick={onClose} /> : null}

      <aside
        className={clsx(
          'app-sidebar-panel app-sidebar-shell sidebar-glass fixed left-0 top-0 z-40 flex h-full w-[88vw] max-w-[328px] flex-col transition-transform duration-300 lg:static lg:z-auto lg:h-auto lg:w-[280px] lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        <div className="app-sidebar-header">
          <div className="min-w-0">
            <Link href={dashboardHref} onClick={onClose} className="inline-flex items-center">
              <OpenyLogo width={102} height={28} />
            </Link>
            <div className={clsx('app-sidebar-tag mt-3 inline-flex rounded-full px-3 py-1 text-[10px] font-bold tracking-[0.16em]', variant === 'docs' && 'app-sidebar-tag-docs')}>
              {workspaceTag}
            </div>
            <p className="mt-2 text-[11px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Workspace navigation</p>
          </div>
          {onClose ? (
            <button type="button" onClick={onClose} className="btn-icon lg:hidden" aria-label="Close sidebar">
              <X size={16} />
            </button>
          ) : null}
        </div>

        <nav className="app-sidebar-nav flex-1 space-y-2 overflow-y-auto p-3">
          {items.map(({ href, base, icon: Icon, label }) => {
            const active = pathname === href || (base !== '/os/dashboard' && pathname.startsWith(base));
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={clsx(
                  'app-sidebar-item flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-semibold transition-all',
                  active ? 'nav-item-active' : 'text-[var(--text-secondary)]',
                )}
              >
                <span className={clsx('app-sidebar-icon-wrap inline-flex h-9 w-9 items-center justify-center rounded-xl', active && 'app-sidebar-icon-wrap-active')}>
                  <Icon size={16} aria-hidden="true" className="shrink-0" style={{ color: active ? 'var(--accent-secondary)' : 'currentColor' }} />
                </span>
                <span className="truncate">{label}</span>
              </Link>
            );
          })}
        </nav>

        {profile && user ? (
          <div className="app-sidebar-user">
            <AccountMenu placement="sidebar">
              <div className="flex items-center gap-2 rounded-xl p-2 transition-colors hover:bg-[var(--surface-2)]">
                <div className="h-8 w-8 rounded-full bg-[var(--accent)] text-xs font-bold text-white inline-flex items-center justify-center">
                  {(user.name || user.email || 'U').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{user.name || user.email}</p>
                  <p className="truncate text-xs text-[var(--text-secondary)]">{user.role}</p>
                </div>
              </div>
            </AccountMenu>
          </div>
        ) : null}
      </aside>
    </>
  );
}
