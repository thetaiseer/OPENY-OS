'use client';

import { useEffect, useMemo } from 'react';
import { Sun, Moon, Menu, Globe, Sparkles, ChevronRight } from 'lucide-react';
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

interface AppTopbarProps { onMenuClick?: () => void; }
const WORKSPACE_SEGMENTS = new Set(['os', 'docs']);
const MAX_VISIBLE_BREADCRUMBS = 4;
const WORKSPACE_DISPLAY_LABEL: Record<string, string> = {
  DOCS: 'Docs',
  OS: 'OS',
};

function formatBreadcrumbLabel(segment: string) {
  const decoded = decodeURIComponent(segment);
  return decoded
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}

export default function AppTopbar({ onMenuClick }: AppTopbarProps) {
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
  const breadcrumbs = useMemo(() => {
    const segments = pathname.split('/').filter(Boolean);
    return segments
      .filter((segment, index) => !(index === 0 && WORKSPACE_SEGMENTS.has(segment)))
      .map(formatBreadcrumbLabel);
  }, [pathname]);
  const visibleBreadcrumbs = breadcrumbs.slice(0, MAX_VISIBLE_BREADCRUMBS);
  const isBreadcrumbTruncated = breadcrumbs.length > MAX_VISIBLE_BREADCRUMBS;

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
    <header className="app-topbar h-16 flex items-center gap-2 sm:gap-3 border-b sticky top-0 z-20 header-glass">
      <button onClick={onMenuClick} className="lg:hidden topbar-icon-btn shrink-0" aria-label="Open menu">
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

      <div className="topbar-breadcrumb hidden md:flex flex-1 min-w-0 max-w-[46vw]">
        <span>{WORKSPACE_DISPLAY_LABEL[workspaceLabel] ?? workspaceLabel}</span>
        {isBreadcrumbTruncated && (
          <span className="inline-flex items-center gap-1 min-w-0">
            <ChevronRight size={12} />
            <span className="truncate">…</span>
          </span>
        )}
        {visibleBreadcrumbs.map((crumb, index) => (
          <span key={index} className="inline-flex items-center gap-1 min-w-0">
            <ChevronRight size={12} />
            <span className={index === visibleBreadcrumbs.length - 1 ? 'topbar-breadcrumb-current truncate' : 'truncate'}>
              {crumb}
            </span>
          </span>
        ))}
      </div>

      <div className="flex-1 min-w-0 max-w-[52vw] sm:max-w-md">
        <GlobalSearch />
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-1 shrink-0">
        <WorkspaceSwitcher />

        <button
          onClick={toggleLang}
          className="topbar-icon-btn hidden sm:flex"
          style={{ color: 'var(--text-secondary)' }}
          title="Toggle language"
        >
          <Globe size={18} />
        </button>

        <button
          onClick={toggleTheme}
          className="topbar-icon-btn"
          style={{ color: 'var(--text-secondary)' }}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <NotificationDropdown />

        <button
          onClick={() => openAi()}
          className="topbar-ai-btn"
          style={{
            background: aiOpen
              ? 'linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%)'
              : 'linear-gradient(135deg, var(--accent-soft) 0%, transparent 100%)',
            color: aiOpen ? '#fff' : 'var(--accent)',
            border: `1px solid ${aiOpen ? 'rgba(255,255,255,0.35)' : 'var(--accent-glow)'}`,
            boxShadow: aiOpen ? '0 6px 14px var(--accent-glow)' : 'inset 0 0 0 1px var(--accent-soft)',
          }}
          title="AI Command Center (⌘J)"
        >
          <Sparkles size={13} />
          <span className="hidden sm:inline">AI</span>
        </button>

        <AccountMenu placement="header">
          <div
            className="topbar-avatar"
            style={{ background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%)' }}
          >
            {user ? (user.name || user.email).charAt(0).toUpperCase() : 'U'}
          </div>
        </AccountMenu>
      </div>
    </header>
  );
}
