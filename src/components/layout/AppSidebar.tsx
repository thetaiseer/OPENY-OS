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
  );
}
