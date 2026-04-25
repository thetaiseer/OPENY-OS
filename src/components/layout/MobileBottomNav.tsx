'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Plus, Home, ListChecks, FolderKanban, FileText } from 'lucide-react';
import { cn } from '@/lib/cn';

const items = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/tasks/all', label: 'Tasks', icon: ListChecks },
  { href: '/projects', label: 'Projects', icon: FolderKanban },
  { href: '/docs', label: 'Docs', icon: FileText },
];

export default function MobileBottomNav() {
  const pathname = usePathname();
  return (
    <>
      <nav className="border-border bg-surface fixed inset-x-0 bottom-0 z-40 border-t md:hidden">
        <ul className="grid grid-cols-4">
          {items.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex flex-col items-center justify-center gap-1 py-2 text-xs',
                    active ? 'text-accent' : 'text-secondary',
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
      <button
        type="button"
        className="bg-accent shadow-soft fixed bottom-16 right-4 z-50 inline-flex h-12 w-12 items-center justify-center rounded-full text-white md:hidden"
        aria-label="Quick action"
      >
        <Plus className="h-5 w-5" />
      </button>
    </>
  );
}
