'use client';

import { useState, useEffect } from 'react';
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
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const fetchUnread = async () => {
      try {
        const res = await fetch(`/api/notifications?unread=true&user_id=${user.id}&limit=1`);
        if (!res.ok || cancelled) return;
        const json = await res.json() as { unreadCount?: number };
        if (!cancelled) setUnreadCount(json.unreadCount ?? 0);
      } catch { /* silent */ }
    };
    void fetchUnread();
    const interval = setInterval(fetchUnread, 60_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [user]);

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
          className="relative p-2 rounded-lg hover:bg-[var(--surface-2)] transition-colors"
          style={{ color: 'var(--text-secondary)' }}
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span
              className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full text-white flex items-center justify-center"
              style={{ background: '#ef4444', fontSize: '10px', fontWeight: 700, lineHeight: 1 }}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
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
