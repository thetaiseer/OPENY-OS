'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  CalendarDays,
  ClipboardList,
  FileSpreadsheet,
  FileText,
  FolderKanban,
  Gauge,
  ImageIcon,
  LayoutDashboard,
  Settings,
  Shield,
  UserSquare2,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import FloatingActionButton from '@/components/ui/FloatingActionButton';
import { useLang } from '@/context/lang-context';

/** Same unified surface as desktop sidebar (horizontal strip). */
const mobileNavItems = [
  { href: '/dashboard', key: 'home', icon: Gauge },
  { href: '/clients', key: 'clients', icon: Users },
  { href: '/projects', key: 'projects', icon: FolderKanban },
  { href: '/tasks/all', key: 'tasks', icon: ClipboardList },
  { href: '/content', key: 'content', icon: FileText },
  { href: '/docs', key: 'docs', icon: LayoutDashboard },
  { href: '/calendar', key: 'calendar', icon: CalendarDays },
  { href: '/assets', key: 'assets', icon: ImageIcon },
  { href: '/reports/overview', key: 'reports', icon: FileSpreadsheet },
  { href: '/team', key: 'team', icon: UserSquare2 },
  { href: '/activity', key: 'activity', icon: Activity },
  { href: '/security/sessions', key: 'security', icon: Shield },
  { href: '/settings/profile', key: 'settings', icon: Settings },
] as const;

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { t } = useLang();

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface pb-[env(safe-area-inset-bottom,0px)] md:hidden">
        <ul className="scrollbar-thin flex min-h-12 items-stretch gap-1 overflow-x-auto px-2 py-2">
          {mobileNavItems.map((item) => {
            const Icon = item.icon;
            const isDocsHome = item.href === '/docs';
            const active = isDocsHome
              ? pathname === '/docs' || pathname === '/docs/' || pathname.startsWith('/docs/')
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <li key={item.href} className="shrink-0">
                <Link
                  href={item.href}
                  className={cn(
                    'flex min-h-11 min-w-[4.5rem] max-w-[5.5rem] flex-col items-center justify-center gap-0.5 rounded-control px-1.5 py-1.5 text-[clamp(10px,2.8vw,12px)] leading-tight xs:min-w-[4.75rem]',
                    active
                      ? 'bg-[color:var(--accent-soft)] text-[color:var(--accent)]'
                      : 'text-secondary',
                  )}
                >
                  <Icon className="h-[1.125rem] w-[1.125rem] shrink-0 xs:h-5 xs:w-5" />
                  {t(item.key)}
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
