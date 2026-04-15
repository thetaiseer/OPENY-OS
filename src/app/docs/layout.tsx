'use client';

import { useState } from 'react';
import DocsSidebar from '@/components/layout/DocsSidebar';
import OpenyLogo from '@/components/branding/OpenyLogo';
import { Menu, Moon, Sun } from 'lucide-react';
import { useTheme } from '@/lib/theme-context';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getWorkspaceDashboardHref } from '@/lib/workspace-navigation';

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const pathname = usePathname();
  const dashboardHref = getWorkspaceDashboardHref(pathname);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>
      <DocsSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 min-w-0 overflow-hidden flex flex-col">
        <header
          className="h-16 px-4 sm:px-5 lg:px-6 border-b sticky top-0 z-20 flex items-center gap-3"
          style={{ background: 'var(--header-bg)', borderColor: 'var(--border)' }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-lg hover:bg-[var(--surface-2)] transition-colors"
            style={{ color: 'var(--text-secondary)' }}
          >
            <Menu size={20} />
          </button>
          <div className="flex lg:hidden items-center gap-2">
            <Link
              href={dashboardHref}
              onClick={() => setSidebarOpen(false)}
              aria-label="Go to OPENY DOCS dashboard"
              className="cursor-pointer transition-opacity duration-150 hover:opacity-85"
            >
              <OpenyLogo width={80} height={24} />
            </Link>
            <span className="text-[10px] sm:text-xs font-semibold tracking-wide" style={{ color: 'var(--text-secondary)' }}>DOCS</span>
          </div>
          <div className="flex-1" />
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-[var(--surface-2)] transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <Link href="/select-workspace" className="text-xs sm:text-sm font-medium px-3 py-2 rounded-lg border hover:bg-[var(--surface-2)] transition-colors" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
            Switch workspace
          </Link>
        </header>
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
