'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  BarChart3,
  CalendarDays,
  ClipboardList,
  FileBadge2,
  FilePenLine,
  FileSpreadsheet,
  FileText,
  FolderKanban,
  Gauge,
  Handshake,
  ImageIcon,
  LayoutDashboard,
  Receipt,
  Shield,
  Settings,
  Users,
  UserSquare2,
} from 'lucide-react';
import { cn } from '@/lib/cn';

const osNavItems = [
  { href: '/dashboard', label: 'Dashboard', icon: Gauge },
  { href: '/clients', label: 'Clients', icon: Users },
  { href: '/projects', label: 'Projects', icon: FolderKanban },
  { href: '/tasks/all', label: 'Tasks', icon: ClipboardList },
  { href: '/content', label: 'Content', icon: FileText },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/assets', label: 'Assets', icon: ImageIcon },
  { href: '/reports/overview', label: 'Reports', icon: BarChart3 },
  { href: '/team', label: 'Team', icon: UserSquare2 },
  { href: '/activity', label: 'Activity', icon: Activity },
  { href: '/security/sessions', label: 'Security', icon: Shield },
  { href: '/settings/profile', label: 'Settings', icon: Settings },
] as const;

const docsNavItems = [
  { href: '/docs', label: 'Docs Home', icon: LayoutDashboard },
  { href: '/docs/invoice', label: 'Invoice', icon: Receipt },
  { href: '/docs/quotation', label: 'Quotation', icon: FilePenLine },
  { href: '/docs/client-contract', label: 'Client Contract', icon: Handshake },
  { href: '/docs/hr-contract', label: 'HR Contract', icon: FileBadge2 },
  { href: '/docs/employees', label: 'Employees', icon: Users },
  { href: '/docs/accounting', label: 'Accounting', icon: FileSpreadsheet },
] as const;

export default function Sidebar() {
  const pathname = usePathname();
  const activeWorkspace = pathname.startsWith('/docs') ? 'docs' : 'os';
  const navItems = activeWorkspace === 'docs' ? docsNavItems : osNavItems;

  return (
    <aside className="openy-glass fixed inset-y-0 left-0 z-40 hidden w-[240px] border-r md:block">
      <div className="flex h-16 items-center border-b border-border px-4">
        <span className="text-lg font-semibold tracking-tight text-primary">OPENY</span>
      </div>
      <nav className="space-y-1.5 p-3 pt-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href ||
            pathname.startsWith(`${item.href}/`) ||
            (item.href === '/reports/overview' && pathname === '/reports') ||
            (item.href === '/security/sessions' && pathname === '/security');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2 rounded-control border px-2.5 py-2 text-sm transition-colors',
                active
                  ? 'border-[color:var(--accent)] bg-[color:var(--accent)] text-white shadow-soft'
                  : 'border-transparent text-secondary hover:border-border hover:bg-[color:var(--surface-elevated)] hover:text-primary',
              )}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center">
                <Icon className="h-4 w-4" />
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
