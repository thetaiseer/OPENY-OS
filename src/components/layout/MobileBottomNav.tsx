'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Activity,
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
  Receipt,
  Settings,
  Shield,
  UserSquare2,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import FloatingActionButton from '@/components/ui/FloatingActionButton';
import { useAuth } from '@/context/auth-context';
import { getWorkspaceHomeHref, persistSelectedWorkspace } from '@/lib/auth-workspace';

const osItems = [
  { href: '/dashboard', label: 'Dashboard', icon: Gauge },
  { href: '/clients', label: 'Clients', icon: Users },
  { href: '/projects', label: 'Projects', icon: FolderKanban },
  { href: '/tasks/all', label: 'Tasks', icon: ClipboardList },
  { href: '/content', label: 'Content', icon: FileText },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/assets', label: 'Assets', icon: ImageIcon },
  { href: '/reports/overview', label: 'Reports', icon: FileSpreadsheet },
  { href: '/team', label: 'Team', icon: UserSquare2 },
  { href: '/activity', label: 'Activity', icon: Activity },
  { href: '/security/sessions', label: 'Security', icon: Shield },
  { href: '/settings/profile', label: 'Settings', icon: Settings },
] as const;

const docsItems = [
  { href: '/docs', label: 'Docs Home', icon: FileText },
  { href: '/docs/invoice', label: 'Invoice', icon: Receipt },
  { href: '/docs/quotation', label: 'Quotation', icon: FilePenLine },
  { href: '/docs/client-contract', label: 'Client Contract', icon: Handshake },
  { href: '/docs/hr-contract', label: 'HR Contract', icon: FileBadge2 },
  { href: '/docs/employees', label: 'Employees', icon: Users },
  { href: '/docs/accounting', label: 'Accounting', icon: FileSpreadsheet },
] as const;

export default function MobileBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { workspaceAccess } = useAuth();
  const activeWorkspace = pathname.startsWith('/docs') ? 'docs' : 'os';
  const items = activeWorkspace === 'docs' ? docsItems : osItems;
  const canAccessOs = workspaceAccess.os || workspaceAccess.isGlobalOwner;
  const canAccessDocs = workspaceAccess.docs || workspaceAccess.isGlobalOwner;

  const switchWorkspace = (workspace: 'os' | 'docs') => {
    persistSelectedWorkspace(workspace);
    router.push(getWorkspaceHomeHref(workspace));
  };

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface md:hidden">
        <div className="border-b border-border px-2 py-1.5">
          <div className="grid grid-cols-2 gap-1 rounded-control bg-[color:var(--surface-elevated)] p-1">
            <button
              type="button"
              disabled={!canAccessOs}
              onClick={() => switchWorkspace('os')}
              className={cn(
                'h-7 rounded-control text-[11px] font-semibold',
                activeWorkspace === 'os' ? 'bg-[color:var(--accent)] text-white' : 'text-secondary',
                !canAccessOs && 'opacity-50',
              )}
            >
              OPENY OS
            </button>
            <button
              type="button"
              disabled={!canAccessDocs}
              onClick={() => switchWorkspace('docs')}
              className={cn(
                'h-7 rounded-control text-[11px] font-semibold',
                activeWorkspace === 'docs'
                  ? 'bg-[color:var(--accent)] text-white'
                  : 'text-secondary',
                !canAccessDocs && 'opacity-50',
              )}
            >
              OPENY DOCS
            </button>
          </div>
        </div>
        <ul className="scrollbar-thin flex items-stretch gap-1 overflow-x-auto px-2 py-1.5">
          {items.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
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
