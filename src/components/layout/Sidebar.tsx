'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  CalendarDays,
  CheckSquare,
  FileText,
  FolderOpen,
  LayoutDashboard,
  Users2,
} from 'lucide-react';

const navItems = [
  { href: '/os/dashboard', label: 'Workspace', icon: LayoutDashboard },
  { href: '/os/tasks', label: 'Tasks', icon: CheckSquare },
  { href: '/os/clients', label: 'Clients', icon: Users2 },
  { href: '/os/assets', label: 'Assets', icon: FolderOpen },
  { href: '/os/content', label: 'Content', icon: FileText },
  { href: '/os/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/os/reports', label: 'Stats', icon: BarChart3 },
];

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ open = false, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      <button
        type="button"
        className={`workspace-backdrop ${open ? 'is-open' : ''}`}
        aria-label="Close navigation"
        onClick={onClose}
      />
      <aside className={`workspace-sidebar ${open ? 'is-open' : ''}`}>
        <div className="workspace-sidebar-head">
          <p>OPENY OS</p>
          <small>Modular workspace</small>
        </div>
        <nav className="workspace-nav">
          {navItems.map(item => {
            const active = pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} className={`workspace-nav-item ${active ? 'is-active' : ''}`} onClick={onClose}>
                <item.icon size={16} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
