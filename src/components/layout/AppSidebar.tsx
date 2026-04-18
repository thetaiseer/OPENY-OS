'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import { PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import clsx from 'clsx';
import { useState } from 'react';
import OpenyLogo from '@/components/branding/OpenyLogo';
import { getWorkspaceDashboardHref } from '@/lib/workspace-navigation';
import { useAuth } from '@/lib/auth-context';
import AccountMenu from './AccountMenu';

const MAX_DOCK_ITEMS_PER_ROW = 5;

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
  const [collapsed, setCollapsed] = useState(false);
  const isSlim = collapsed && !open;
  const itemCount = items.length;
  const dockRows = Math.ceil(itemCount / MAX_DOCK_ITEMS_PER_ROW);

  return (
    <>
      {open ? <div className="app-sidebar-backdrop fixed inset-0 z-30 lg:hidden" onClick={onClose} /> : null}

      <aside
        className={clsx(
          'app-sidebar-panel app-sidebar-shell sidebar-glass fixed left-3 top-3 z-40 flex h-[calc(100%-1.5rem)] w-[88vw] max-w-[328px] flex-col transition-[transform,width] duration-300 lg:sticky lg:top-4 lg:left-auto lg:z-20 lg:h-[calc(100dvh-2rem)] lg:max-w-none lg:translate-x-0',
          isSlim ? 'lg:w-[92px]' : 'lg:w-[264px]',
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        <div className="app-sidebar-header">
          <div className="min-w-0 flex-1">
            <Link href={dashboardHref} onClick={onClose} className="inline-flex items-center">
              {isSlim ? (
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl border text-[11px] font-bold tracking-[0.08em]">OY</span>
              ) : (
                <OpenyLogo width={104} height={28} />
              )}
            </Link>
            {!isSlim ? (
              <>
                <div className={clsx('app-sidebar-tag mt-3 inline-flex rounded-full px-3 py-1 text-[10px] font-bold tracking-[0.16em]', variant === 'docs' && 'app-sidebar-tag-docs')}>
                  {workspaceTag}
                </div>
                <p className="mt-2 text-[11px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Workspace navigation</p>
              </>
            ) : null}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCollapsed((value) => !value)}
              className="btn-icon hidden lg:inline-flex"
              aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
            >
              {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            </button>
            {onClose ? (
              <button type="button" onClick={onClose} className="btn-icon lg:hidden" aria-label="Close sidebar">
                <X size={16} />
              </button>
            ) : null}
          </div>
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
                  'app-sidebar-item flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold transition-all',
                  isSlim && 'justify-center px-2',
                  active ? 'nav-item-active' : 'text-[var(--text-secondary)]',
                )}
                title={label}
              >
                <span className={clsx('app-sidebar-icon-wrap inline-flex h-9 w-9 items-center justify-center rounded-xl', active && 'app-sidebar-icon-wrap-active')}>
                  <Icon size={16} aria-hidden="true" className="shrink-0" style={{ color: active ? 'var(--accent-secondary)' : 'currentColor' }} />
                </span>
                {!isSlim ? <span className="truncate">{label}</span> : null}
              </Link>
            );
          })}
        </nav>

        {profile && user && !isSlim ? (
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

      <nav
        className="app-bottom-dock fixed bottom-3 left-1/2 z-30 grid w-[min(96vw,560px)] -translate-x-1/2 gap-1.5 rounded-2xl border px-2 py-2 lg:hidden"
        style={{ gridTemplateColumns: `repeat(${Math.min(MAX_DOCK_ITEMS_PER_ROW, itemCount)}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${dockRows}, minmax(0, 1fr))` }}
      >
        {items.map(({ href, base, icon: Icon, label }) => {
          const active = pathname === href || (base !== '/os/dashboard' && pathname.startsWith(base));
          return (
            <Link
              key={`dock-${href}`}
              href={href}
              onClick={onClose}
              className={clsx(
                'app-dock-item flex h-12 items-center justify-center rounded-xl text-xs font-semibold',
                active ? 'nav-item-active' : 'text-[var(--text-secondary)]',
              )}
              title={label}
            >
              <Icon size={17} aria-hidden="true" />
            </Link>
          );
        })}
      </nav>
    </>
  );
}
