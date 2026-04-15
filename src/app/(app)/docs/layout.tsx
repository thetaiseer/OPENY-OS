'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  FileText, ClipboardList, FileSignature, Users, BookOpen, BarChart2,
  ChevronRight, BookMarked,
} from 'lucide-react';
import clsx from 'clsx';

const DOCS_NAV = [
  { href: '/docs/invoice',         label: 'Invoice',         icon: FileText        },
  { href: '/docs/quotation',       label: 'Quotation',       icon: ClipboardList   },
  { href: '/docs/client-contract', label: 'Client Contract', icon: FileSignature   },
  { href: '/docs/hr-contract',     label: 'HR Contract',     icon: BookOpen        },
  { href: '/docs/employees',       label: 'Employees',       icon: Users           },
  { href: '/docs/accounting',      label: 'Accounting',      icon: BarChart2       },
];

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLanding = pathname === '/docs';

  return (
    <div className="flex flex-col h-full">
      {/* OPENY DOCS top navigation */}
      <header
        className="shrink-0 border-b px-4 sm:px-6"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-1 h-12 overflow-x-auto no-scrollbar">
          {/* Brand crumb */}
          <Link
            href="/docs"
            className="flex items-center gap-1.5 mr-2 shrink-0"
          >
            <BookMarked size={16} style={{ color: 'var(--accent)' }} />
            <span className="text-sm font-bold" style={{ color: 'var(--text)' }}>OPENY DOCS</span>
          </Link>
          {!isLanding && <ChevronRight size={14} style={{ color: 'var(--text-secondary)' }} className="shrink-0 mr-1" />}

          {DOCS_NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors shrink-0',
                  active
                    ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--surface-2)]',
                )}
              >
                <Icon size={14} strokeWidth={1.8} />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </div>
      </header>

      {/* Module content */}
      <div className="flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  );
}
