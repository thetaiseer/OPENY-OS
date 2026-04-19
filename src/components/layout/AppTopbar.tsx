'use client';

import { Bell, Search, Plus } from 'lucide-react';

interface AppTopbarProps {
  context?: string;
  pageTitle: string;
}

/**
 * AppTopbar — sticky top navigation bar.
 * Shows the current page context, a search affordance, notifications, and user avatar.
 */
export function AppTopbar({ context = 'OPENY OS', pageTitle }: AppTopbarProps) {
  return (
    <header className="ui-topbar">
      {/* Left — page identity */}
      <div className="ui-topbar-left">
        <div className="ui-topbar-context">{context}</div>
        <div className="ui-topbar-title">{pageTitle}</div>
      </div>

      {/* Right — actions */}
      <div className="ui-topbar-right">
        {/* Search */}
        <div className="ui-topbar-search" role="search" aria-label="Search">
          <Search size={14} style={{ flexShrink: 0 }} />
          <span>Search…</span>
          <kbd
            style={{
              marginLeft: 'auto',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '.04em',
              color: 'var(--text-muted)',
              background: 'var(--bg-soft)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 4,
              padding: '1px 5px',
            }}
          >
            ⌘K
          </kbd>
        </div>

        {/* Quick create */}
        <button className="ui-btn ui-btn-primary" aria-label="Create new">
          <Plus size={14} />
          New
        </button>

        {/* Notifications */}
        <button className="ui-icon-btn" aria-label="Notifications">
          <Bell size={15} />
        </button>

        {/* User */}
        <div className="ui-avatar" role="img" aria-label="User">OP</div>
      </div>
    </header>
  );
}

