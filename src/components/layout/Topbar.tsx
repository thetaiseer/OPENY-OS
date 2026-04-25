'use client';

import { Bell, Moon, Search, Sun, UserCircle2 } from 'lucide-react';
import { useTheme } from '@/context/theme-context';
import { cn } from '@/lib/cn';

type TopbarProps = {
  className?: string;
};

export default function Topbar({ className }: TopbarProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <header
      className={cn(
        'openy-glass fixed right-0 top-0 z-30 w-full border-b pt-[env(safe-area-inset-top,0px)] md:left-[240px] md:w-[calc(100%-240px)]',
        className,
      )}
      style={{ borderColor: 'var(--border)' }}
    >
      <div className="mx-auto flex h-16 max-w-shell items-center justify-between gap-2 px-[max(0.75rem,env(safe-area-inset-left,0px))] sm:gap-3 sm:px-4 md:px-6 md:pr-[max(1rem,env(safe-area-inset-right,0px))]">
        <label className="relative flex min-w-0 max-w-md flex-1 items-center">
          <Search className="pointer-events-none absolute left-3 h-4 w-4 text-secondary" />
          <input
            type="search"
            placeholder="Search..."
            className="focus:ring-[color:var(--accent)]/15 min-h-10 w-full rounded-control border border-border bg-surface py-2 pl-9 pr-3 text-sm text-primary outline-none transition-colors focus:border-accent focus:ring-2 sm:h-10 sm:py-0"
          />
        </label>
        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
          <button
            type="button"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-control border border-border bg-surface text-secondary transition-colors hover:bg-[color:var(--surface-elevated)] hover:text-primary sm:h-10 sm:w-10"
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            aria-pressed={theme === 'dark'}
            onClick={toggleTheme}
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </button>
          <button
            type="button"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-control border border-border bg-surface text-secondary transition-colors hover:bg-[color:var(--surface-elevated)] hover:text-primary sm:h-10 sm:w-10"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-control border border-border bg-surface text-secondary transition-colors hover:bg-[color:var(--surface-elevated)] hover:text-primary sm:h-10 sm:w-10"
            aria-label="Profile"
          >
            <UserCircle2 className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
