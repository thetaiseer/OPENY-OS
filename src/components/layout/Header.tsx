'use client';

import { useEffect } from 'react';
import { Sun, Moon, Menu, Globe, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from '@/lib/theme-context';
import { useLang } from '@/lib/lang-context';
import { useAuth } from '@/lib/auth-context';
import AccountMenu from './AccountMenu';
import NotificationDropdown from '@/components/notifications/NotificationDropdown';
import GlobalSearch from '@/components/search/GlobalSearch';
import { useCommandPalette } from '@/lib/command-palette-context';
import { useAi } from '@/lib/ai-context';
import OpenyLogo from '@/components/branding/OpenyLogo';
import { getWorkspaceDashboardHref, getWorkspaceFromPathname } from '@/lib/workspace-navigation';
import WorkspaceSwitcher from './WorkspaceSwitcher';

interface HeaderProps { onMenuClick?: () => void; }

export default function Header({ onMenuClick }: HeaderProps) {
  const pathname = usePathname();
  const dashboardHref = getWorkspaceDashboardHref(pathname);
  const workspaceLabel = getWorkspaceFromPathname(pathname) === 'docs' ? 'DOCS' : 'OS';
  const dashboardAriaLabel = dashboardHref === '/docs/dashboard'
    ? 'Go to OPENY DOCS dashboard'
    : 'Go to OPENY OS dashboard';
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
    <header
      className="h-16 px-3 sm:px-4 lg:px-5 flex items-center gap-2 sm:gap-3 border-b sticky top-0 z-20 header-glass"
    >
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-lg hover:bg-[var(--surface-2)] transition-colors shrink-0"
      >
        <Menu size={20} style={{ color: 'var(--text-secondary)' }} />
      </button>
      <Link
        href={dashboardHref}
        aria-label={dashboardAriaLabel}
        className="lg:hidden inline-flex items-center gap-1.5 shrink-0 cursor-pointer transition-opacity duration-150 hover:opacity-85"
      >
        <OpenyLogo width={82} height={24} />
        <span className="text-[10px] font-semibold tracking-wide" style={{ color: 'var(--text-secondary)' }}>{workspaceLabel}</span>
      </Link>

      {/* Global search — replaces the dead input */}
      <div className="flex-1 min-w-0 max-w-[52vw] sm:max-w-sm">
        <GlobalSearch />
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
        <WorkspaceSwitcher />

        <button
          onClick={toggleLang}
          className="p-2 rounded-xl hover:bg-[var(--surface)] transition-all hidden sm:flex border border-transparent hover:border-[var(--border)]"
          style={{ color: 'var(--text-secondary)' }}
          title="Toggle language"
        >
          <Globe size={18} />
        </button>

        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl hover:bg-[var(--surface)] transition-all border border-transparent hover:border-[var(--border)]"
          style={{ color: 'var(--text-secondary)' }}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <NotificationDropdown />

        {/* AI Command Center button */}
        <button
          onClick={() => openAi()}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold transition-all hover:-translate-y-0.5"
          style={{
            background: aiOpen
              ? 'linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%)'
              : 'linear-gradient(135deg, var(--accent-soft) 0%, transparent 100%)',
            color: aiOpen ? '#fff' : 'var(--accent)',
            border: `1px solid ${aiOpen ? 'rgba(255,255,255,0.35)' : 'var(--accent-glow)'}`,
            boxShadow: aiOpen ? '0 10px 22px var(--accent-glow)' : 'inset 0 0 0 1px var(--accent-soft)',
          }}
          title="AI Command Center (⌘J)"
        >
          <Sparkles size={13} />
          <span className="hidden sm:inline">AI</span>
        </button>

        <AccountMenu placement="header">
          <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ml-1 cursor-pointer hover:opacity-80 transition-opacity shadow-sm"
        style={{ background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%)' }}
      >
            {user ? (user.name || user.email).charAt(0).toUpperCase() : 'U'}
          </div>
        </AccountMenu>
      </div>
    </header>
  );
}
