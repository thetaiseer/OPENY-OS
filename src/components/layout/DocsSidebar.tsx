'use client';

import Link from 'next/link';
import { BookOpen, LayoutDashboard, FolderOpen, Settings, ChevronRight } from 'lucide-react';
import { ReactNode } from 'react';

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
}

const DOCS_NAV: NavItem[] = [
  { href: '/docs',           label: 'Docs Home',  icon: <BookOpen size={16} /> },
  { href: '/docs/dashboard', label: 'Dashboard',  icon: <LayoutDashboard size={16} /> },
  { href: '/docs/documents', label: 'Documents',  icon: <FolderOpen size={16} /> },
  { href: '/docs/settings',  label: 'Settings',   icon: <Settings size={16} /> },
];

interface DocsSidebarProps {
  activePath: string;
}

/**
 * DocsSidebar — sidebar for the Docs module.
 * Uses the same .ui-sidebar design language as AppSidebar.
 */
export function DocsSidebar({ activePath }: DocsSidebarProps) {
  return (
    <aside className="ui-sidebar">
      {/* Brand */}
      <div className="ui-sidebar-brand">
        <div
          className="ui-sidebar-logo"
          style={{ background: 'linear-gradient(135deg, #06b6d4, #0284c7)' }}
        >
          D
        </div>
        <div>
          <div className="ui-sidebar-title">OPENY DOCS</div>
          <div className="ui-sidebar-subtitle">Document Hub</div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
        <div className="ui-nav-section">Navigation</div>
        {DOCS_NAV.map(item => {
          const isActive =
            activePath === item.href ||
            (item.href !== '/docs' && activePath.startsWith(item.href + '/'));
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
      </nav>

      {/* Footer — back to OS */}
      <div className="ui-sidebar-footer">
        <Link
          href="/os/dashboard"
          className="ui-btn ui-btn-ghost"
          style={{ fontSize: 12, padding: '0 8px', height: 30, width: '100%' }}
        >
          ← Back to OS
        </Link>
      </div>
    </aside>
  );
}
