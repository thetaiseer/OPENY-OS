'use client';

import { useEffect, useMemo } from 'react';
import { Menu, Globe, Sparkles, ChevronRight, Search } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLang } from '@/lib/lang-context';
import { useAuth } from '@/lib/auth-context';
import NotificationDropdown from '@/components/notifications/NotificationDropdown';
import GlobalSearch from '@/components/search/GlobalSearch';
import { useCommandPalette } from '@/lib/command-palette-context';
import { useAi } from '@/lib/ai-context';
import { getWorkspaceDashboardHref, getWorkspaceFromPathname } from '@/lib/workspace-navigation';
import AccountMenu from './AccountMenu';
import ThemeSwitcher from './ThemeSwitcher';

interface AppTopbarProps {
  onMenuClick?: () => void;
}

const WORKSPACE_SEGMENTS = new Set(['os', 'docs']);

function formatBreadcrumbLabel(segment: string) {
  return decodeURIComponent(segment).replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default function AppTopbar({ onMenuClick }: AppTopbarProps) {
  const pathname = usePathname();
  const dashboardHref = getWorkspaceDashboardHref(pathname);
  const workspaceLabel = getWorkspaceFromPathname(pathname) === 'docs' ? 'DOCS' : 'OS';

  const { toggleLang } = useLang();
  const { user } = useAuth();
  const { open: openPalette } = useCommandPalette();
  const { open: openAi, isOpen: aiOpen } = useAi();

  const breadcrumbs = useMemo(() => {
    const segments = pathname.split('/').filter(Boolean);
    return segments
      .filter((seg, i) => !(i === 0 && WORKSPACE_SEGMENTS.has(seg)))
      .map(formatBreadcrumbLabel)
      .slice(0, 4);
  }, [pathname]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openPalette();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [openPalette]);

  return (
    <header className="app-topbar app-topbar-shell flex items-center gap-2 px-3">
      {/* ── Left: mobile menu + workspace label ── */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Mobile: opens sidebar drawer */}
        <button
          type="button"
          onClick={onMenuClick}
          className="topbar-icon-btn lg:hidden"
          aria-label="Open navigation"
        >
          <Menu size={17} />
        </button>

        <Link href={dashboardHref} className="hidden sm:inline-flex items-center gap-1.5">
          <span className="text-[13px] font-bold tracking-[0.12em] text-[var(--text-secondary)]">
            {workspaceLabel}
          </span>
        </Link>

        {/* Breadcrumbs (large screens) */}
        <div className="topbar-breadcrumb hidden lg:flex items-center gap-1">
          {breadcrumbs.map((crumb, i) => (
            <span key={`${crumb}-${i}`} className="inline-flex items-center gap-1 min-w-0">
              <ChevronRight size={11} className="shrink-0 text-[var(--text-tertiary)]" />
              <span className={i === breadcrumbs.length - 1 ? 'topbar-breadcrumb-current truncate' : 'truncate'}>
                {crumb}
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* ── Centre: search bar ── */}
      <div className="hidden flex-1 min-w-0 sm:block sm:max-w-sm lg:max-w-lg">
        <GlobalSearch />
      </div>

      {/* ── Mobile search icon ── */}
      <button
        type="button"
        onClick={openPalette}
        className="topbar-icon-btn sm:hidden"
        aria-label="Open search"
      >
        <Search size={16} />
      </button>

      {/* ── Right: utility icons ── */}
      <div className="ml-auto flex shrink-0 items-center gap-1">
        <div className="hidden items-center gap-1 lg:flex">
          <ThemeSwitcher />

          <button
            type="button"
            onClick={toggleLang}
            className="topbar-icon-btn"
            title="Toggle language"
          >
            <Globe size={15} />
          </button>

          <NotificationDropdown />

          <button
            type="button"
            onClick={() => openAi()}
            className="topbar-ai-btn"
            style={{
              background: aiOpen ? 'var(--accent)' : 'var(--surface-2)',
              color: aiOpen ? '#fff' : 'var(--text-primary)',
              border: `1px solid ${aiOpen ? 'var(--accent)' : 'var(--border)'}`,
            }}
            title="AI Command Center (⌘J)"
          >
            <Sparkles size={13} />
            <span className="hidden sm:inline text-[13px]">AI</span>
          </button>
        </div>

        {/* Account avatar (all screens) */}
        <AccountMenu
          placement="header"
          triggerAriaLabel="Open account menu"
          menuContent={({ closeMenu }) => (
            <div className="space-y-2">
              <div className="rounded-xl border p-2" style={{ borderColor: 'var(--border)' }}>
                <ThemeSwitcher />
              </div>
              <button type="button" onClick={() => { toggleLang(); closeMenu(); }} className="openy-menu-item flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm">
                <Globe size={14} /> Language
              </button>
              <button type="button" onClick={() => { openAi(); closeMenu(); }} className="openy-menu-item flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm">
                <Sparkles size={14} /> AI Command Center
              </button>
            </div>
          )}
        >
          <div className="topbar-avatar">
            {(user?.name || user?.email || 'U').charAt(0).toUpperCase()}
          </div>
        </AccountMenu>
      </div>
    </header>
  );
}
