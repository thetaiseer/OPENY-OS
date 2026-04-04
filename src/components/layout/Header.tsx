'use client';

import { useState } from 'react';
import { Sun, Moon, Bell, Menu, Globe } from 'lucide-react';
import Link from 'next/link';
import { useTheme } from '@/lib/theme-context';
import { useLang } from '@/lib/lang-context';
import { useAuth } from '@/lib/auth-context';
import AccountMenu from './AccountMenu';

interface HeaderProps { onMenuClick?: () => void; }

export default function Header({ onMenuClick }: HeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const { toggleLang, t } = useLang();
  const { user } = useAuth();
  const [search, setSearch] = useState('');

  return (
    <header
      className="h-16 px-6 flex items-center gap-4 border-b sticky top-0 z-20"
      style={{ background: 'var(--header-bg)', borderColor: 'var(--border)' }}
    >
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-lg hover:bg-[var(--surface-2)] transition-colors"
      >
        <Menu size={20} style={{ color: 'var(--text-secondary)' }} />
      </button>

      <div className="flex-1 max-w-sm">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('search')}
          className="w-full h-9 px-4 rounded-lg text-sm outline-none transition-colors"
          style={{
            background: 'var(--surface-2)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
          }}
        />
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-1">
        <button
          onClick={toggleLang}
          className="p-2 rounded-lg hover:bg-[var(--surface-2)] transition-colors"
          style={{ color: 'var(--text-secondary)' }}
          title="Toggle language"
        >
          <Globe size={18} />
        </button>

        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg hover:bg-[var(--surface-2)] transition-colors"
          style={{ color: 'var(--text-secondary)' }}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <Link
          href="/notifications"
          className="p-2 rounded-lg hover:bg-[var(--surface-2)] transition-colors"
          style={{ color: 'var(--text-secondary)' }}
        >
          <Bell size={18} />
        </Link>

        <AccountMenu placement="header">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white ml-2 cursor-pointer hover:opacity-80 transition-opacity"
            style={{ background: 'var(--accent)' }}
          >
            {user ? (user.name || user.email).charAt(0).toUpperCase() : 'U'}
          </div>
        </AccountMenu>
      </div>
    </header>
  );
}
