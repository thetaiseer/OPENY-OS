'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  BarChart3,
  CalendarDays,
  ClipboardList,
  FileText,
  FolderKanban,
  Gauge,
  ImageIcon,
  LayoutDashboard,
  Shield,
  Settings,
  Users,
  UserSquare2,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { useLang } from '@/context/lang-context';
import OpenyLogo from '@/components/branding/OpenyLogo';
import { openyMarketingLogoDimensions } from '@/lib/openy-brand';

/** Single unified nav: operations + Docs hub + document tools in one shell. */
const primaryNavItems = [
  { href: '/dashboard', label: 'Dashboard', icon: Gauge },
  { href: '/clients', label: 'Clients', icon: Users },
  { href: '/projects', label: 'Projects', icon: FolderKanban },
  { href: '/tasks/all', label: 'Tasks', icon: ClipboardList },
  { href: '/content', label: 'Content', icon: FileText },
  { href: '/docs', label: 'Docs', icon: LayoutDashboard },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/assets', label: 'Assets', icon: ImageIcon },
  { href: '/reports/overview', label: 'Reports', icon: BarChart3 },
  { href: '/team', label: 'Team', icon: UserSquare2 },
  { href: '/activity', label: 'Activity', icon: Activity },
  { href: '/security/sessions', label: 'Security', icon: Shield },
  { href: '/settings/profile', label: 'Settings', icon: Settings },
] as const;

export default function Sidebar() {
  const pathname = usePathname();
  const { t } = useLang();

  return (
    <aside className="openy-glass fixed inset-y-0 start-0 z-40 hidden w-[240px] overflow-y-auto border-e md:block">
      <div className="flex h-16 min-w-0 shrink-0 items-center border-b border-border px-3">
        <Link
          href="/dashboard"
          className="flex min-w-0 max-w-full items-center py-1"
          aria-label={t('dashboard')}
        >
          <OpenyLogo {...openyMarketingLogoDimensions(38)} className="min-w-0" />
        </Link>
      </div>
      <nav className="space-y-1.5 p-3 pb-8 pt-4">
        {primaryNavItems.map((item) => {
          const Icon = item.icon;
          const isDocsHome = item.href === '/docs';
          const active = isDocsHome
            ? pathname === '/docs' || pathname === '/docs/' || pathname.startsWith('/docs/')
            : pathname === item.href ||
              pathname.startsWith(`${item.href}/`) ||
              (item.href === '/reports/overview' && pathname === '/reports') ||
              (item.href === '/security/sessions' && pathname === '/security');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2 rounded-control border px-3 py-2.5 text-sm leading-normal transition-colors',
                active
                  ? 'border-[color:var(--accent)] bg-[color:var(--accent)] text-white shadow-soft'
                  : 'border-transparent text-secondary hover:border-border hover:bg-[color:var(--surface-elevated)] hover:text-primary',
              )}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center">
                <Icon className="h-4 w-4" />
              </span>
              <span>{t(item.label.toLowerCase())}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
