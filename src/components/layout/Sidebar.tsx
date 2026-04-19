import Link from 'next/link';
import { ReactNode } from 'react';

export interface SidebarNavItem {
  href: string;
  label: string;
  icon?: ReactNode;
}

interface SidebarProps {
  title: string;
  subtitle?: string;
  logoChar?: string;
  nav: SidebarNavItem[];
  activePath: string;
  footer?: ReactNode;
}

/**
 * Sidebar — generic, reusable sidebar component.
 * AppSidebar and DocsSidebar are pre-configured wrappers around this.
 */
export function Sidebar({
  title,
  subtitle,
  logoChar,
  nav,
  activePath,
  footer,
}: SidebarProps) {
  return (
    <aside className="ui-sidebar">
      {/* Brand */}
      <div className="ui-sidebar-brand">
        <div className="ui-sidebar-logo">
          {logoChar ?? title.charAt(0).toUpperCase()}
        </div>
        <div>
          <div className="ui-sidebar-title">{title}</div>
          {subtitle && <div className="ui-sidebar-subtitle">{subtitle}</div>}
        </div>
      </div>

      {/* Nav */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
        {nav.map(item => {
          const isActive =
            activePath === item.href || activePath.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className="ui-nav-item"
              data-active={isActive}
            >
              {item.icon && <span className="ui-nav-icon">{item.icon}</span>}
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Optional footer slot */}
      {footer && (
        <div className="ui-sidebar-footer" style={{ display: 'block' }}>
          {footer}
        </div>
      )}
    </aside>
  );
}
