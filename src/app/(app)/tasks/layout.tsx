'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';

export default function TasksLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAll = pathname.startsWith('/tasks/all') || pathname === '/tasks';
  const isMy = pathname.startsWith('/tasks/my');

  return (
    <div className="space-y-6">
      {/* Tab navigation */}
      <div className="flex gap-1 border-b" style={{ borderColor: 'var(--border)' }}>
        <Link
          href="/tasks/all"
          className={clsx('-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors')}
          style={{
            color: isAll ? 'var(--accent)' : 'var(--text-secondary)',
            borderColor: isAll ? 'var(--accent)' : 'transparent',
          }}
        >
          All Tasks
        </Link>
        <Link
          href="/tasks/my"
          className={clsx('-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors')}
          style={{
            color: isMy ? 'var(--accent)' : 'var(--text-secondary)',
            borderColor: isMy ? 'var(--accent)' : 'transparent',
          }}
        >
          My Tasks
        </Link>
      </div>

      {children}
    </div>
  );
}
