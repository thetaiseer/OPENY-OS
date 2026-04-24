'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users2, CheckSquare, Ellipsis } from 'lucide-react';
import clsx from 'clsx';

const left = [
  { href: '/os/dashboard', base: '/os/dashboard', icon: LayoutDashboard, label: 'Home' },
  { href: '/os/clients', base: '/os/clients', icon: Users2, label: 'Clients' },
] as const;

const right = [
  { href: '/os/tasks', base: '/os/tasks', icon: CheckSquare, label: 'Tasks' },
  { href: '/os/activity', base: '/os/activity', icon: Ellipsis, label: 'More' },
] as const;

function linkActive(pathname: string, base: string, href: string) {
  return pathname === href || (base !== '/os/dashboard' && pathname.startsWith(base));
}

export default function MobileBottomNav() {
  const pathname = usePathname() ?? '';
  if (pathname.startsWith('/docs')) return null;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 flex h-[4.25rem] items-center border-t px-2 pb-[env(safe-area-inset-bottom,0px)] pt-1 lg:hidden"
      style={{
        background: 'var(--surface-panel)',
        borderColor: 'var(--border)',
        backdropFilter: 'var(--blur-panel)',
        WebkitBackdropFilter: 'var(--blur-panel)',
      }}
      aria-label="Primary navigation"
    >
      <div className="flex flex-1 justify-around gap-1">
        {left.map(({ href, base, icon: Icon, label }) => {
          const active = linkActive(pathname, base, href);
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex min-h-[48px] min-w-[48px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-semibold transition-colors',
                active ? 'text-[var(--accent)]' : 'text-[var(--text-tertiary)]',
              )}
              style={active ? { background: 'var(--accent-soft)' } : undefined}
            >
              <Icon size={22} strokeWidth={active ? 2.25 : 2} />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
      <div className="w-16 shrink-0" aria-hidden />
      <div className="flex flex-1 justify-around gap-1">
        {right.map(({ href, base, icon: Icon, label }) => {
          const active = linkActive(pathname, base, href);
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex min-h-[48px] min-w-[48px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-semibold transition-colors',
                active ? 'text-[var(--accent)]' : 'text-[var(--text-tertiary)]',
              )}
              style={active ? { background: 'var(--accent-soft)' } : undefined}
            >
              <Icon size={22} strokeWidth={active ? 2.25 : 2} />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
