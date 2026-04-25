'use client';

import { Bell, Search, UserCircle2 } from 'lucide-react';

export default function Header() {
  return (
    <header className="bg-base/95 fixed right-0 top-0 z-30 h-16 w-full border-b border-border backdrop-blur-sm md:left-64 md:w-[calc(100%-16rem)]">
      <div className="mx-auto flex h-full max-w-shell items-center justify-between gap-3 px-4 md:px-6">
        <label className="relative hidden w-full max-w-md items-center sm:flex">
          <Search className="pointer-events-none absolute left-3 h-4 w-4 text-secondary" />
          <input
            type="search"
            placeholder="Search..."
            className="h-10 w-full rounded-control border border-border bg-surface pl-9 pr-3 text-sm text-primary outline-none focus:border-accent"
          />
        </label>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-control border border-border bg-surface text-secondary hover:text-primary"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-control border border-border bg-surface text-secondary hover:text-primary"
            aria-label="Profile"
          >
            <UserCircle2 className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
