'use client';

import {
  LayoutDashboard, Users2, CheckSquare, FolderOpen,
  BarChart2, Users, Settings, CalendarDays, Shield, FileText,
} from 'lucide-react';
import { useLang } from '@/lib/lang-context';
import AppSidebar from './AppSidebar';

const navItems = [
  { href: '/os/dashboard',      base: '/os/dashboard',     icon: LayoutDashboard, key: 'dashboard'     },
  { href: '/os/clients',        base: '/os/clients',       icon: Users2,          key: 'clients'        },
  { href: '/os/tasks',          base: '/os/tasks',         icon: CheckSquare,     key: 'tasks'          },
  { href: '/os/content',        base: '/os/content',       icon: FileText,        key: 'content'        },
  { href: '/os/calendar',       base: '/os/calendar',      icon: CalendarDays,    key: 'calendar'       },
  { href: '/os/assets',         base: '/os/assets',        icon: FolderOpen,      key: 'assets'         },
  { href: '/os/reports',        base: '/os/reports',       icon: BarChart2,       key: 'reports'        },
  { href: '/os/team',           base: '/os/team',          icon: Users,           key: 'team'           },
  { href: '/os/security',       base: '/os/security',      icon: Shield,          key: 'security'       },
  { href: '/os/settings',       base: '/os/settings',      icon: Settings,        key: 'settings'       },
];

interface SidebarProps { open?: boolean; onClose?: () => void; }

export default function Sidebar({ open, onClose }: SidebarProps) {
  const { t } = useLang();
  const items = navItems.map(({ href, base, icon, key }) => ({
    href,
    base,
    icon,
    label: t(key),
  }));

  return (
    <AppSidebar
      items={items}
      open={open}
      onClose={onClose}
      workspaceTag="OS"
      variant="os"
      profile
    />
  );
}
