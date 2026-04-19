'use client';

import Link from 'next/link';
import {
  LayoutDashboard,
  Users,
  CheckSquare,
  FileText,
  CalendarDays,
  HardDrive,
  BarChart3,
  Shield,
  Settings,
  BookOpen,
  ChevronRight,
} from 'lucide-react';
import { ReactNode } from 'react';

export interface NavItem {
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import { PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import clsx from 'clsx';
import { useState } from 'react';
import OpenyLogo from '@/components/branding/OpenyLogo';
import { getWorkspaceDashboardHref } from '@/lib/workspace-navigation';
import { useAuth } from '@/lib/auth-context';
import AccountMenu from './AccountMenu';
import WorkspaceSwitcher from './WorkspaceSwitcher';

export interface AppSidebarItem {
  href: string;
  label: string;
  icon: ReactNode;
}

const OS_NAV: NavItem[] = [
  { href: '/os/dashboard', label: 'Dashboard',  icon: <LayoutDashboard size={16} /> },
  { href: '/os/clients',   label: 'Clients',    icon: <Users size={16} /> },
  { href: '/os/tasks',     label: 'Tasks',      icon: <CheckSquare size={16} /> },
  { href: '/os/content',   label: 'Content',    icon: <FileText size={16} /> },
  { href: '/os/calendar',  label: 'Calendar',   icon: <CalendarDays size={16} /> },
  { href: '/os/assets',    label: 'Assets',     icon: <HardDrive size={16} /> },
  { href: '/os/reports',   label: 'Reports',    icon: <BarChart3 size={16} /> },
  { href: '/os/team',      label: 'Team',       icon: <Users size={16} /> },
  { href: '/os/security',  label: 'Security',   icon: <Shield size={16} /> },
  { href: '/os/settings',  label: 'Settings',   icon: <Settings size={16} /> },
];

const DOCS_LINK: NavItem = { href: '/docs', label: 'Docs', icon: <BookOpen size={16} /> };

interface AppSidebarProps {
  activePath: string;
}

export function AppSidebar({ activePath }: AppSidebarProps) {
  return (
    <aside className="ui-sidebar">
      {/* Brand */}
      <div className="ui-sidebar-brand">
        <div className="ui-sidebar-logo">O</div>
        <div>
          <div className="ui-sidebar-title">OPENY OS</div>
          <div className="ui-sidebar-subtitle">Workspace</div>
export interface AppSidebarGroup {
  label?: string;
  items: AppSidebarItem[];
}

interface AppSidebarProps {
  /** Flat list of items (displayed as a single group) */
  items?: AppSidebarItem[];
  /** Grouped nav sections — takes precedence over `items` */
  groups?: AppSidebarGroup[];
  /** Items pinned to the bottom above the user row */
  bottomItems?: AppSidebarItem[];
  open?: boolean;
  onClose?: () => void;
  workspaceTag: string;
  variant?: 'os' | 'docs';
  profile?: boolean;
}

export default function AppSidebar({
  items,
  groups,
  bottomItems,
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

  // Resolve groups
  const resolvedGroups: AppSidebarGroup[] = groups ?? (items ? [{ items }] : []);

  function isActive(item: AppSidebarItem) {
    return pathname === item.href || (item.base !== '/os/dashboard' && pathname.startsWith(item.base));
  }

  function NavItem({ item }: { item: AppSidebarItem }) {
    const active = isActive(item);
    return (
      <Link
        href={item.href}
        onClick={onClose}
        className={clsx(
          'app-sidebar-item',
          active ? 'nav-item-active' : '',
        )}
        title={item.label}
      >
        <span className={clsx('app-sidebar-icon-wrap', active && 'app-sidebar-icon-wrap-active')}>
          <item.icon size={16} aria-hidden="true" />
        </span>
        {!isSlim && <span className="truncate">{item.label}</span>}
      </Link>
    );
  }

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="app-sidebar-backdrop fixed inset-0 z-30 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={clsx(
          'app-sidebar-panel fixed left-0 top-0 z-40 transition-[width,transform] duration-200 lg:static lg:translate-x-0',
          isSlim ? 'app-sidebar-slim' : '',
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
        style={{ width: isSlim ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)' }}
      >
        {/* ── Header: logo + collapse button ── */}
        <div className="app-sidebar-header">
          <Link href={dashboardHref} onClick={onClose} className="inline-flex items-center">
            {isSlim ? (
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[11px] font-bold tracking-[0.08em]" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                {variant === 'docs' ? 'D' : 'O'}
              </span>
            ) : (
              <OpenyLogo width={90} height={24} />
            )}
          </Link>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCollapsed(v => !v)}
              className="btn-icon hidden lg:inline-flex"
              aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
            >
              {collapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
            </button>
            {onClose && (
              <button type="button" onClick={onClose} className="btn-icon lg:hidden" aria-label="Close sidebar">
                <X size={15} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main nav */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
        <div className="ui-nav-section">Main</div>
        {OS_NAV.map(item => {
          const isActive =
            activePath === item.href || activePath.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className="ui-nav-item"
              data-active={isActive}
            >
              <span className="ui-nav-icon">{item.icon}</span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {isActive && (
                <ChevronRight size={12} style={{ opacity: 0.5, flexShrink: 0 }} />
              )}
            </Link>
          );
        })}

        <div className="ui-divider" style={{ margin: '8px 0' }} />
        <div className="ui-nav-section">Quick Access</div>
        <Link
          href={DOCS_LINK.href}
          className="ui-nav-item"
          data-active={activePath.startsWith('/docs')}
        >
          <span className="ui-nav-icon">{DOCS_LINK.icon}</span>
          <span style={{ flex: 1 }}>{DOCS_LINK.label}</span>
        </Link>
      </nav>

      {/* Footer */}
      <div className="ui-sidebar-footer">
        <div className="ui-avatar" style={{ fontSize: 11 }}>OP</div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600 }}>OPENY OS</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>v2.0 · Active</div>
        </div>
      </div>
    </aside>
        {/* ── Workspace switcher (slim: hidden) ── */}
        {!isSlim && (
          <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
            <WorkspaceSwitcher />
          </div>
        )}

        {/* ── Main navigation ── */}
        <nav className="flex-1 overflow-y-auto py-2">
          {resolvedGroups.map((group, groupIndex) => (
            <div key={groupIndex}>
              {group.label && !isSlim && (
                <div className="sidebar-group-label">{group.label}</div>
              )}
              {group.items.map(item => <NavItem key={item.href} item={item} />)}
              {groupIndex < resolvedGroups.length - 1 && !isSlim && (
                <div className="sidebar-separator" />
              )}
            </div>
          ))}

          {/* Bottom-pinned nav items (Settings, Security, etc.) */}
          {bottomItems && bottomItems.length > 0 && (
            <>
              <div className="sidebar-separator mt-auto" />
              {bottomItems.map(item => <NavItem key={item.href} item={item} />)}
            </>
          )}
        </nav>

        {/* ── User / account row ── */}
        {profile && user && (
          <div className="app-sidebar-user">
            <AccountMenu placement="sidebar">
              <div className={clsx(
                'flex items-center gap-2.5 rounded-lg p-2 transition-colors hover:bg-[var(--surface-2)] cursor-pointer',
                isSlim && 'justify-center',
              )}>
                <div
                  className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                  style={{ background: 'var(--accent)' }}
                >
                  {(user.name || user.email || 'U').charAt(0).toUpperCase()}
                </div>
                {!isSlim && (
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold leading-tight">{user.name || user.email}</p>
                    <p className="truncate text-[11px] text-[var(--text-secondary)] leading-tight mt-0.5">{user.role}</p>
                  </div>
                )}
              </div>
            </AccountMenu>
          </div>
        )}
      </aside>
    </>
  );
}
