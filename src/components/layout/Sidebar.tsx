'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  BarChart3,
  CalendarDays,
  ChevronsLeft,
  ChevronsRight,
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
import { useAuth } from '@/context/auth-context';
import { useQuery } from '@tanstack/react-query';
import OpenyLogo from '@/components/branding/OpenyLogo';
import { openyAppChromeLogoDimensions } from '@/lib/openy-brand';
import Navigation from '@/components/navigation/Navigation';
import { getSidebarRoutes, type NavIconKey } from '@/lib/navigation/routes';
import { createClient } from '@/lib/supabase/client';

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

const SIDEBAR_COLLAPSED_KEY = 'openy.sidebar.collapsed';

export default function Sidebar() {
  const { t } = useLang();
  const { workspaceAccess } = useAuth();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const primaryNavItems = getSidebarRoutes();

  const { data: overdueCount = 0 } = useQuery({
    queryKey: ['sidebar-overdue-count'],
    queryFn: async () => {
      const sb = createClient();
      const today = new Date().toISOString().slice(0, 10);
      const { count, error } = await sb
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .lt('due_date', today)
        .not('status', 'in', '("done","delivered","completed","published","cancelled")');
      if (error) return 0;
      return count ?? 0;
    },
    staleTime: 60_000,
    gcTime: 10 * 60_000,
  });

  useEffect(() => {
    const saved = window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    const nextCollapsed = saved === '1';
    setCollapsed(nextCollapsed);
  }, []);

  useEffect(() => {
    const width = collapsed ? '80px' : '240px';
    document.documentElement.style.setProperty('--openy-sidebar-width', width);
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      const digit = Number(event.key);
      if (!Number.isInteger(digit) || digit < 1 || digit > 9) return;
      const target = primaryNavItems[digit - 1];
      if (!target) return;
      event.preventDefault();
      router.push(target.href);
    };
    window.addEventListener('keydown', onShortcut);
    return () => window.removeEventListener('keydown', onShortcut);
  }, [primaryNavItems, router]);

  const workspaceLabel = useMemo(() => {
    if (workspaceAccess.os && workspaceAccess.docs) return 'OPENY Workspace';
    if (workspaceAccess.os) return 'OPENY OS';
    if (workspaceAccess.docs) return 'OPENY Docs';
    return 'Workspace';
  }, [workspaceAccess.docs, workspaceAccess.os]);

  const badges = useMemo(() => ({ tasks: overdueCount }), [overdueCount]);

  return (
    <aside
      className="openy-glass fixed inset-y-0 start-0 z-40 hidden overflow-y-auto border-e md:block"
      style={{ width: 'var(--openy-sidebar-width)' }}
    >
      <div
        className="flex h-16 min-w-0 shrink-0 items-center border-b border-border px-3"
        style={{ justifyContent: collapsed ? 'center' : 'space-between' }}
      >
        <Link
          href="/dashboard"
          className="flex min-w-0 max-w-full items-center py-1"
          aria-label={t('dashboard')}
        >
          <OpenyLogo {...openyAppChromeLogoDimensions(38)} className="min-w-0" />
        </Link>
        {!collapsed ? (
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-2)]"
            aria-label="Collapse sidebar"
          >
            <ChevronsLeft className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      <div className="px-3 pt-3">
        <div
          className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2"
          title={workspaceLabel}
        >
          {collapsed ? (
            <span className="mx-auto block h-2.5 w-2.5 rounded-full bg-[var(--accent)]" />
          ) : (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
                Workspace
              </p>
              <p className="truncate text-xs font-medium text-[var(--text)]">{workspaceLabel}</p>
            </>
          )}
        </div>
      </div>
      {collapsed ? (
        <div className="px-3 pt-2">
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className="inline-flex h-8 w-full items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-2)]"
            aria-label="Expand sidebar"
          >
            <ChevronsRight className="h-4 w-4" />
          </button>
        </div>
      ) : null}
      <Navigation collapsed={collapsed} iconMap={ICON_MAP} badges={badges} />
    </aside>
  );
}
