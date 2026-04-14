'use client';

import { useEffect } from 'react';
import { Sun, Moon, Menu, Globe } from 'lucide-react';
import { useTheme } from '@/lib/theme-context';
import { useLang } from '@/lib/lang-context';
import { useAuth } from '@/lib/auth-context';
import AccountMenu from './AccountMenu';
import NotificationDropdown from '@/components/notifications/NotificationDropdown';
import GlobalSearch from '@/components/search/GlobalSearch';
import { useCommandPalette } from '@/lib/command-palette-context';

interface HeaderProps { onMenuClick?: () => void; }

export default function Header({ onMenuClick }: HeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const { toggleLang } = useLang();
  const { user } = useAuth();
  const { open: openPalette } = useCommandPalette();

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
      className="h-16 px-4 sm:px-6 flex items-center gap-3 border-b sticky top-0 z-20"
      style={{ background: 'var(--header-bg)', borderColor: 'var(--border)' }}
    >
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-lg hover:bg-[var(--surface-2)] transition-colors shrink-0"
      >
        <Menu size={20} style={{ color: 'var(--text-secondary)' }} />
      </button>

      {/* Global search — replaces the dead input */}
      <div className="flex-1 max-w-sm">
        <GlobalSearch />
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-1">
        <button
          onClick={toggleLang}
          className="p-2 rounded-lg hover:bg-[var(--surface-2)] transition-colors hidden sm:flex"
          style={{ color: 'var(--text-secondary)' }}
          title="Toggle language"
        >
          <Globe size={18} />
        </button>

        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg hover:bg-[var(--surface-2)] transition-colors"
          style={{ color: 'var(--text-secondary)' }}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <NotificationDropdown />

        <AccountMenu placement="header">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white ml-1 cursor-pointer hover:opacity-80 transition-opacity"
            style={{ background: 'var(--accent)' }}
          >
            {user ? (user.name || user.email).charAt(0).toUpperCase() : 'U'}
          </div>
        </AccountMenu>
      </div>
    </header>
  );
}
