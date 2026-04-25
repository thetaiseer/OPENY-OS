'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  CalendarDays,
  ClipboardList,
  FilePenLine,
  FileSpreadsheet,
  FileText,
  FolderKanban,
  Gauge,
  ImageIcon,
  LayoutDashboard,
  Receipt,
  Settings,
  Shield,
  UserSquare2,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import FloatingActionButton from '@/components/ui/FloatingActionButton';

/** Same unified surface as desktop sidebar (horizontal strip). */
const mobileNavItems = [
  { href: '/dashboard', label: 'Home', icon: Gauge },
  { href: '/clients', label: 'Clients', icon: Users },
  { href: '/projects', label: 'Projects', icon: FolderKanban },
  { href: '/tasks/all', label: 'Tasks', icon: ClipboardList },
  { href: '/content', label: 'Content', icon: FileText },
  { href: '/docs', label: 'Docs', icon: LayoutDashboard },
  { href: '/calendar', label: 'Cal', icon: CalendarDays },
  { href: '/assets', label: 'Assets', icon: ImageIcon },
  { href: '/reports/overview', label: 'Reports', icon: FileSpreadsheet },
  { href: '/team', label: 'Team', icon: UserSquare2 },
  { href: '/activity', label: 'Activity', icon: Activity },
  { href: '/security/sessions', label: 'Security', icon: Shield },
  { href: '/docs/invoice', label: 'Invoice', icon: Receipt },
  { href: '/docs/quotation', label: 'Quote', icon: FilePenLine },
  { href: '/docs/accounting', label: 'Books', icon: FileSpreadsheet },
  { href: '/settings/profile', label: 'Settings', icon: Settings },
] as const;

export default function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface md:hidden">
        <ul className="scrollbar-thin flex items-stretch gap-1 overflow-x-auto px-2 py-1.5">
          {mobileNavItems.map((item) => {
            const Icon = item.icon;
            const isDocsHome = item.href === '/docs';
            const active = isDocsHome
              ? pathname === '/docs' || pathname === '/docs/'
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <li key={item.href} className="shrink-0">
                <Link
                  href={item.href}
                  className={cn(
                    'flex min-w-[72px] flex-col items-center justify-center gap-1 rounded-control px-2 py-2 text-[11px]',
                    active
                      ? 'bg-[color:var(--accent-soft)] text-[color:var(--accent)]'
                      : 'text-secondary',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <FloatingActionButton aria-label="Quick action" />
    </>
  );
}
