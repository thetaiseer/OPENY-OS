'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  CalendarDays,
  ClipboardList,
  FolderKanban,
  Gauge,
  ImageIcon,
  Settings,
  Users,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/cn';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: Gauge },
  { href: '/clients', label: 'Clients', icon: Users },
  { href: '/tasks/all', label: 'Tasks', icon: ClipboardList },
  { href: '/projects', label: 'Projects', icon: FolderKanban },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/assets', label: 'Assets', icon: ImageIcon },
  { href: '/docs', label: 'Docs', icon: FileText },
  { href: '/settings/profile', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="border-border bg-surface fixed inset-y-0 left-0 z-40 hidden w-64 border-r md:block">
      <div className="border-border flex h-16 items-center border-b px-4">
        <span className="text-primary text-lg font-semibold">OPENY</span>
      </div>
      <nav className="space-y-1 p-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'rounded-control flex items-center gap-2 px-3 py-2 text-sm transition-colors',
                active
                  ? 'bg-accent text-white'
                  : 'text-secondary hover:bg-elevated hover:text-primary',
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
