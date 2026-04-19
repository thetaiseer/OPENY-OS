'use client';

import {
  LayoutDashboard,
  Users2,
  CheckSquare,
  FolderOpen,
  BarChart2,
  Users,
  Settings,
  CalendarDays,
  Shield,
  FileText,
} from 'lucide-react';
import { useLang } from '@/lib/lang-context';
import AppSidebar, { type AppSidebarGroup, type AppSidebarItem } from './AppSidebar';

const mainNav: Array<{ href: string; base: string; icon: typeof LayoutDashboard; key: string }> = [
  { href: '/os/dashboard', base: '/os/dashboard', icon: LayoutDashboard, key: 'dashboard' },
  { href: '/os/clients',   base: '/os/clients',   icon: Users2,          key: 'clients'   },
  { href: '/os/tasks',     base: '/os/tasks',     icon: CheckSquare,     key: 'tasks'     },
  { href: '/os/content',   base: '/os/content',   icon: FileText,        key: 'content'   },
  { href: '/os/calendar',  base: '/os/calendar',  icon: CalendarDays,    key: 'calendar'  },
  { href: '/os/assets',    base: '/os/assets',    icon: FolderOpen,      key: 'assets'    },
];

const insightsNav = [
  { href: '/os/reports', base: '/os/reports', icon: BarChart2, key: 'reports' },
];

const teamNav = [
  { href: '/os/team', base: '/os/team', icon: Users, key: 'team' },
];

const bottomNav = [
  { href: '/os/security', base: '/os/security', icon: Shield,   key: 'security' },
  { href: '/os/settings', base: '/os/settings', icon: Settings, key: 'settings' },
];

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const { t } = useLang();

  function toItems(
    list: Array<{ href: string; base: string; icon: typeof LayoutDashboard; key: string }>,
  ): AppSidebarItem[] {
    return list.map(({ href, base, icon, key }) => ({ href, base, icon, label: t(key) }));
  }

  const groups: AppSidebarGroup[] = [
    { items: toItems(mainNav) },
    { label: 'Insights', items: toItems(insightsNav) },
    { label: 'Team', items: toItems(teamNav) },
  ];

  return (
    <AppSidebar
      groups={groups}
      bottomItems={toItems(bottomNav)}
      open={open}
      onClose={onClose}
      workspaceTag="OS"
      variant="os"
      profile
    />
  );
}
