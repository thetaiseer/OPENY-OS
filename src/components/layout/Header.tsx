'use client';

import { Bell, Moon, Search, Sun, UserCircle2 } from 'lucide-react';
import { useTheme } from '@/context/theme-context';

export default function Header() {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="bg-base/95 border-border fixed right-0 top-0 z-30 h-16 w-full border-b backdrop-blur-sm md:left-64 md:w-[calc(100%-16rem)]">
      <div className="max-w-shell mx-auto flex h-full items-center justify-between gap-3 px-4 md:px-6">
        <label className="relative hidden w-full max-w-md items-center sm:flex">
          <Search className="text-secondary pointer-events-none absolute left-3 h-4 w-4" />
          <input
            type="search"
            placeholder="Search..."
            className="rounded-control border-border bg-surface text-primary focus:border-accent h-10 w-full border pl-9 pr-3 text-sm outline-none"
          />
        </label>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            className="rounded-control border-border bg-surface text-secondary hover:text-primary inline-flex h-10 w-10 items-center justify-center border"
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            onClick={toggleTheme}
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </button>
          <button
            type="button"
            className="rounded-control border-border bg-surface text-secondary hover:text-primary inline-flex h-10 w-10 items-center justify-center border"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="rounded-control border-border bg-surface text-secondary hover:text-primary inline-flex h-10 w-10 items-center justify-center border"
            aria-label="Profile"
          >
            <UserCircle2 className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
