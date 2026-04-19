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
import WorkspaceSwitcher from './WorkspaceSwitcher';

export interface AppSidebarItem {
  href: string;
  base: string;
  label: string;
  icon: LucideIcon;
}

export interface AppSidebarGroup {
  label?: string;
  items: AppSidebarItem[];
}

interface AppSidebarProps {
  items?: AppSidebarItem[];
  groups?: AppSidebarGroup[];
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
  variant = 'os',
  profile = false,
}: AppSidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const dashboardHref = getWorkspaceDashboardHref(pathname);
  const [collapsed, setCollapsed] = useState(false);
  const slim = collapsed && !open;

  const resolvedGroups: AppSidebarGroup[] = groups ?? (items ? [{ items }] : []);

  function isActive(item: AppSidebarItem) {
    return pathname === item.href || (item.base !== '/os/dashboard' && pathname.startsWith(item.base));
  }

  function NavItem({ item }: { item: AppSidebarItem }) {
    const active = isActive(item);

    return (
      <Link href={item.href} onClick={onClose} className={clsx('os-nav-item', active && 'is-active')} title={item.label}>
        <span className="os-nav-item-icon">
          <item.icon size={16} aria-hidden="true" />
        </span>
        {!slim ? <span>{item.label}</span> : null}
      </Link>
    );
  }

  return (
    <>
      {open ? <button type="button" className="os-sidebar-overlay" onClick={onClose} aria-label="Close navigation overlay" /> : null}

      <aside className={clsx('os-sidebar', open && 'is-open', slim && 'is-slim')}>
        <div className="os-sidebar-header">
          <Link href={dashboardHref} onClick={onClose} className="os-sidebar-brand">
            {slim ? <span className="os-sidebar-brand-mini">{variant === 'docs' ? 'D' : 'O'}</span> : <OpenyLogo width={88} height={24} />}
          </Link>

          <div className="os-sidebar-controls">
            <button
              type="button"
              onClick={() => setCollapsed(value => !value)}
              className="os-icon-button os-sidebar-collapse"
              aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
            >
              {collapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
            </button>
            {onClose ? (
              <button type="button" onClick={onClose} className="os-icon-button os-sidebar-close" aria-label="Close sidebar">
                <X size={15} />
              </button>
            ) : null}
          </div>
        </div>

        {!slim ? <div className="os-sidebar-switcher"><WorkspaceSwitcher /></div> : null}

        <nav className="os-nav-groups">
          {resolvedGroups.map((group, groupIndex) => (
            <div key={groupIndex} className="os-nav-group">
              {group.label && !slim ? <p className="os-nav-group-label">{group.label}</p> : null}
              {group.items.map(item => <NavItem key={item.href} item={item} />)}
            </div>
          ))}

          {bottomItems && bottomItems.length > 0 ? (
            <div className="os-nav-group os-nav-group--bottom">
              {bottomItems.map(item => <NavItem key={item.href} item={item} />)}
            </div>
          ) : null}
        </nav>

        {profile && user ? (
          <div className="os-sidebar-profile">
            <AccountMenu placement="sidebar">
              <div className="os-profile-trigger">
                <div className="os-profile-avatar">{(user.name || user.email || 'U').charAt(0).toUpperCase()}</div>
                {!slim ? (
                  <div className="os-profile-meta">
                    <p>{user.name || user.email}</p>
                    <p>{user.role}</p>
                  </div>
                ) : null}
              </div>
            </AccountMenu>
          </div>
        ) : null}
      </aside>
    </>
  );
}
