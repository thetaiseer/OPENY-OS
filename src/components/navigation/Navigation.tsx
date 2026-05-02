'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import {
  getSidebarRoutes,
  type NavSectionKey,
  type RouteMeta,
  type UserRoleKey,
} from '@/lib/navigation/routes';
import { useAuth } from '@/context/auth-context';

type SidebarBadgeMap = Partial<Record<string, number>>;

const SECTION_LABELS: Record<NavSectionKey, string> = {
  core: 'Core',
  work: 'Work',
  business: 'Business',
  system: 'System',
};

type NavigationProps = {
  collapsed: boolean;
  iconMap: Record<string, LucideIcon>;
  badges?: SidebarBadgeMap;
  onNavigate?: () => void;
};

function isActivePath(pathname: string, item: RouteMeta): boolean {
  const normalizedPath = pathname.replace(/\/+$/, '') || '/';
  const candidates = [item.href, ...(item.aliases ?? [])].map(
    (value) => value.replace(/\/+$/, '') || '/',
  );
  return candidates.some(
    (candidate) => normalizedPath === candidate || normalizedPath.startsWith(`${candidate}/`),
  );
}

export default function Navigation({ collapsed, iconMap, badges, onNavigate }: NavigationProps) {
  const pathname = usePathname();
  const { role } = useAuth();
  const grouped = useMemo(() => {
    const userRole = (role ?? 'viewer') as UserRoleKey;
    const routes = getSidebarRoutes().filter((route) => {
      if (!route.allowedRoles) return true;
      return route.allowedRoles.includes(userRole);
    });
    const buckets: Record<NavSectionKey, RouteMeta[]> = {
      core: [],
      work: [],
      business: [],
      system: [],
    };
    for (const route of routes) {
      const section = route.section ?? 'core';
      buckets[section].push(route);
    }
    return buckets;
  }, [role]);

  const sectionOrder: NavSectionKey[] = ['core', 'work', 'business', 'system'];

  return (
    <nav className="space-y-3 p-3">
      {sectionOrder.map((sectionKey) => {
        const items = grouped[sectionKey];
        if (!items.length) return null;
        return (
          <section key={sectionKey} className="space-y-1.5">
            {!collapsed ? (
              <p className="px-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
                {SECTION_LABELS[sectionKey]}
              </p>
            ) : null}
            <div className="space-y-1">
              {items.map((item) => {
                if (!item.iconKey) return null;
                const Icon = iconMap[item.iconKey];
                if (!Icon) return null;
                const active = isActivePath(pathname, item);
                const badge = badges?.[item.key] ?? 0;
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'group flex items-center rounded-xl border transition-all duration-150',
                      collapsed ? 'h-10 w-10 justify-center' : 'h-10 gap-2.5 px-3',
                      active
                        ? 'border-[var(--sidebar-active)] bg-[color:var(--sidebar-active)] text-[var(--sidebar-active-foreground)] shadow-[0_8px_24px_var(--openy-glow)]'
                        : 'border-transparent text-[var(--sidebar-foreground)] hover:border-[var(--border)] hover:bg-[color:var(--surface-soft)]',
                    )}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {!collapsed ? (
                      <>
                        <span className="truncate text-sm font-medium">{item.label}</span>
                        {badge > 0 ? (
                          <span className="ms-auto inline-flex min-w-[1.2rem] items-center justify-center rounded-full bg-[var(--color-danger-bg)] px-1.5 text-[10px] font-semibold text-[var(--color-danger)]">
                            {badge > 99 ? '99+' : badge}
                          </span>
                        ) : null}
                      </>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </nav>
  );
}
