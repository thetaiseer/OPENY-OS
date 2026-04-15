'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { BookOpenText, NotepadText, FileText, FolderTree, Shield, Archive, Settings, Grid2X2 } from 'lucide-react';
import OpenyLogo from '@/components/branding/OpenyLogo';

const docsNav = [
  { href: '/docs/dashboard', label: 'Dashboard', icon: Grid2X2 },
  { href: '/docs/notes', label: 'Notes', icon: NotepadText },
  { href: '/docs/documents', label: 'Documents', icon: FileText },
  { href: '/docs/folders', label: 'Folders', icon: FolderTree },
  { href: '/docs/private-assets', label: 'Private Assets', icon: Shield },
  { href: '/docs/archive', label: 'Archive', icon: Archive },
  { href: '/docs/settings', label: 'Settings', icon: Settings },
];

export default function DocsSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r h-screen hidden lg:flex lg:flex-col" style={{ background: 'var(--sidebar-bg)', borderColor: 'var(--sidebar-border)' }}>
      <div className="h-16 px-5 border-b flex items-center" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2.5">
          <OpenyLogo width={96} height={28} />
          <span className="text-xs font-semibold tracking-wide" style={{ color: 'var(--text-secondary)' }}>DOCS</span>
        </div>
      </div>
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {docsNav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'text-[var(--accent)] bg-[var(--accent-soft)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--surface-2)]',
              )}
            >
              <Icon size={17} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t" style={{ borderColor: 'var(--border)' }}>
        <Link href="/select-workspace" className="text-xs inline-flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
          <BookOpenText size={13} /> Switch workspace
        </Link>
      </div>
    </aside>
  );
}
