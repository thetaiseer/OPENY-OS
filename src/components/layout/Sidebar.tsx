'use client';

import Link from 'next/link';
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
  type LucideIcon,
} from 'lucide-react';
import { useLang } from '@/context/lang-context';
import OpenyLogo from '@/components/branding/OpenyLogo';
import { openyAppChromeLogoDimensions } from '@/lib/openy-brand';
import SidebarItem from '@/components/ui/navigation/SidebarItem';
import { getSidebarRoutes, type NavIconKey } from '@/lib/navigation/routes';

const ICON_MAP: Record<NavIconKey, LucideIcon> = {
  dashboard: Gauge,
  clients: Users,
  projects: FolderKanban,
  tasks: ClipboardList,
  content: FileText,
  docs: LayoutDashboard,
  calendar: CalendarDays,
  assets: ImageIcon,
  reports: BarChart3,
  team: UserSquare2,
  activity: Activity,
  security: Shield,
  settings: Settings,
};

export default function Sidebar() {
  const { t } = useLang();
  const primaryNavItems = getSidebarRoutes();

  return (
    <aside className="openy-glass fixed inset-y-0 start-0 z-40 hidden w-[240px] overflow-y-auto border-e md:block">
      <div className="flex h-16 min-w-0 shrink-0 items-center justify-center border-b border-border px-3">
        <Link
          href="/dashboard"
          className="flex w-full min-w-0 max-w-full items-center justify-center py-1"
          aria-label={t('dashboard')}
        >
          <OpenyLogo {...openyAppChromeLogoDimensions(38)} className="min-w-0" />
        </Link>
      </div>
      <nav className="space-y-1.5 p-3 pb-8 pt-4">
        {primaryNavItems.map((item) => {
          if (!item.iconKey) return null;
          const icon = ICON_MAP[item.iconKey];
          if (!icon) return null;
          return (
            <SidebarItem
              key={item.href}
              href={item.href}
              label={t(item.label.toLowerCase()) || item.label}
              icon={icon}
              aliases={item.aliases ? [...item.aliases] : []}
            />
          );
        })}
      </nav>
    </aside>
  );
}
