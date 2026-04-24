'use client';

import { useEffect } from 'react';
import { Sun, Moon, Menu, Globe, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from '@/context/theme-context';
import { useLang } from '@/context/lang-context';
import { useAuth } from '@/context/auth-context';
import AccountMenu from './AccountMenu';
import NotificationDropdown from '@/components/notifications/NotificationDropdown';
import GlobalSearch from '@/components/search/GlobalSearch';
import { useCommandPalette } from '@/context/command-palette-context';
import { useAi } from '@/context/ai-context';
import OpenyLogo from '@/components/branding/OpenyLogo';
import { getWorkspaceDashboardHref, getWorkspaceFromPathname } from '@/lib/workspace-navigation';
import WorkspaceSwitcher from './WorkspaceSwitcher';

interface HeaderProps {
  onMenuClick?: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const pathname = usePathname();
  const dashboardHref = getWorkspaceDashboardHref(pathname);
  const workspaceLabel = getWorkspaceFromPathname(pathname) === 'docs' ? 'DOCS' : 'OS';
  const dashboardAriaLabel =
    dashboardHref === '/docs' ? 'Go to OPENY DOCS dashboard' : 'Go to OPENY OS dashboard';
  const { theme, toggleTheme } = useTheme();
  const { toggleLang } = useLang();
  const { user } = useAuth();
  const { open: openPalette } = useCommandPalette();
  const { open: openAi, isOpen: aiOpen } = useAi();

  // Global CMD+K / Ctrl+K shortcut
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        openPalette();
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [openPalette]);

  return (
    <header className="sticky top-0 z-20 px-2 pb-0 pt-3 sm:px-3 lg:px-4">
      <div
        className="flex h-14 items-center gap-2 rounded-2xl border px-3 sm:h-16 sm:gap-3 sm:px-4 lg:px-5"
        style={{
          background: 'var(--gradient-card-glass)',
          borderColor: 'var(--border-glass)',
          boxShadow: 'var(--shadow-card), var(--highlight-inset)',
          backdropFilter: 'var(--blur-panel)',
          WebkitBackdropFilter: 'var(--blur-panel)',
        }}
      >
        <button
          onClick={onMenuClick}
          className="shrink-0 rounded-full p-2 transition-colors hover:bg-[var(--surface-2)] lg:hidden"
          style={{ color: 'var(--text-secondary)' }}
        >
          <Menu size={20} />
        </button>
        <Link
          href={dashboardHref}
          aria-label={dashboardAriaLabel}
          className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 transition-opacity duration-150 hover:opacity-85 lg:hidden"
        >
          <OpenyLogo width={82} height={24} />
          <span
            className="rounded-full px-1.5 py-0.5 text-[10px] font-bold tracking-wider"
            style={{
              background: 'var(--accent-soft)',
              color: 'var(--accent)',
            }}
          >
            {workspaceLabel}
          </span>
        </Link>

        {/* Global search */}
        <div className="min-w-0 max-w-[52vw] flex-1 sm:max-w-sm lg:max-w-md">
          <GlobalSearch />
        </div>

        <div className="flex-1" />

        <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
          <WorkspaceSwitcher />

          {/* Lang toggle */}
          <button
            onClick={toggleLang}
            className="hidden rounded-full p-2 transition-colors hover:bg-[var(--surface-2)] sm:flex"
            style={{ color: 'var(--text-secondary)' }}
            title="Toggle language"
          >
            <Globe size={18} />
          </button>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="rounded-full p-2 transition-colors hover:bg-[var(--surface-2)]"
            style={{ color: 'var(--text-secondary)' }}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <NotificationDropdown />

          {/* AI Command Center button */}
          <button
            onClick={() => openAi()}
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold transition-all sm:px-3"
            style={{
              background: aiOpen
                ? 'linear-gradient(135deg, var(--accent) 0%, var(--accent-3) 100%)'
                : 'var(--accent-soft)',
              color: aiOpen ? '#fff' : 'var(--accent)',
              border: `1px solid ${aiOpen ? 'transparent' : 'var(--border)'}`,
              boxShadow: aiOpen ? 'var(--glow-accent-sm)' : 'none',
            }}
            title="AI Command Center (⌘J)"
          >
            <Sparkles size={13} />
            <span className="hidden sm:inline">AI</span>
          </button>

          <AccountMenu placement="header">
            <div
              className="ml-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-xs font-bold text-white transition-all hover:opacity-80"
              style={{
                background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-3) 100%)',
                boxShadow: 'var(--glow-accent-sm)',
              }}
            >
              {user ? (user.name || user.email).charAt(0).toUpperCase() : 'U'}
            </div>
          </AccountMenu>
        </div>
      </div>
    </header>
  );
}
