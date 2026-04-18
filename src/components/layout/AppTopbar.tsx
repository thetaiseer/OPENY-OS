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
import OpenyLogo from '@/components/branding/OpenyLogo';
import { getWorkspaceDashboardHref, getWorkspaceFromPathname } from '@/lib/workspace-navigation';
import WorkspaceSwitcher from './WorkspaceSwitcher';
import AccountMenu from './AccountMenu';
import ThemeSwitcher from './ThemeSwitcher';

interface AppTopbarProps {
  onMenuClick?: () => void;
}

const WORKSPACE_SEGMENTS = new Set(['os', 'docs']);

function formatBreadcrumbLabel(segment: string) {
  return decodeURIComponent(segment).replace(/[-_]/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
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
    return segments.filter((segment, index) => !(index === 0 && WORKSPACE_SEGMENTS.has(segment))).map(formatBreadcrumbLabel).slice(0, 4);
  }, [pathname]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        openPalette();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [openPalette]);

  function renderUtilityMenu(closeMenu: () => void, includeNavigation: boolean) {
    return (
      <div className="space-y-2">
        {includeNavigation ? (
          <button type="button" onClick={() => { closeMenu(); onMenuClick?.(); }} className="openy-menu-item flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm">
            <Menu size={15} /> Open navigation
          </button>
        ) : null}
        <div className="rounded-xl border p-2" style={{ borderColor: 'var(--border)' }}>
          <WorkspaceSwitcher />
        </div>
        <div className="rounded-xl border p-2" style={{ borderColor: 'var(--border)' }}>
          <ThemeSwitcher />
        </div>
        <div className="rounded-xl border p-2" style={{ borderColor: 'var(--border)' }}>
          <NotificationDropdown />
        </div>
        <button type="button" onClick={() => { toggleLang(); closeMenu(); }} className="openy-menu-item flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm">
          <Globe size={15} /> Language
        </button>
        <button type="button" onClick={() => { openAi(); closeMenu(); }} className="openy-menu-item flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm">
          <Sparkles size={15} /> AI Command Center
        </button>
      </div>
    );
  }

  return (
    <header className="app-topbar header-glass sticky top-0 z-20 flex items-center gap-2 border-b" style={{ borderColor: 'var(--border-soft)' }}>
      <AccountMenu
        placement="header"
        panelClassName="sm:hidden right-auto left-0"
        menuContent={({ closeMenu }) => renderUtilityMenu(closeMenu, true)}
      >
        <div className="topbar-icon-btn sm:hidden" aria-label="Open mobile menu">
          <Menu size={18} />
        </div>
      </AccountMenu>

      <button type="button" onClick={onMenuClick} className="topbar-icon-btn hidden sm:inline-flex lg:hidden" aria-label="Open menu">
        <Menu size={18} />
      </button>

      <Link href={dashboardHref} className="inline-flex items-center gap-1.5">
        <OpenyLogo width={82} height={24} />
        <span className="text-[10px] font-semibold tracking-wide text-[var(--text-secondary)]">{workspaceLabel}</span>
      </Link>

      <div className="topbar-breadcrumb hidden min-w-0 flex-1 lg:flex">
        <span>{workspaceLabel}</span>
        {breadcrumbs.map((crumb, index) => (
          <span key={`${crumb}-${index}`} className="inline-flex min-w-0 items-center gap-1">
            <ChevronRight size={12} />
            <span className={index === breadcrumbs.length - 1 ? 'topbar-breadcrumb-current truncate' : 'truncate'}>{crumb}</span>
          </span>
        ))}
      </div>

      <button type="button" onClick={openPalette} className="topbar-icon-btn absolute left-1/2 -translate-x-1/2 sm:hidden" aria-label="Open search">
        <Search size={16} />
      </button>

      <div className="hidden min-w-0 flex-1 sm:block sm:max-w-md lg:max-w-xl">
        <GlobalSearch />
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1">
        <div className="hidden items-center gap-1 lg:flex">
          <ThemeSwitcher />
          <WorkspaceSwitcher />

          <button type="button" onClick={toggleLang} className="topbar-icon-btn hidden sm:inline-flex" title="Toggle language">
            <Globe size={16} />
          </button>

          <NotificationDropdown />

          <button
            type="button"
            onClick={() => openAi()}
            className="topbar-ai-btn"
            style={{
              background: aiOpen ? 'linear-gradient(130deg,var(--accent),var(--accent-2))' : 'var(--surface-2)',
              color: aiOpen ? '#fff' : 'var(--accent)',
              border: `1px solid ${aiOpen ? 'transparent' : 'var(--border)'}`,
            }}
            title="AI Command Center (⌘J)"
          >
            <Sparkles size={13} />
            <span className="hidden sm:inline">AI</span>
          </button>
        </div>

        <AccountMenu
          placement="header"
          panelClassName="lg:hidden"
          menuContent={({ closeMenu }) => renderUtilityMenu(closeMenu, false)}
        >
          <div className="topbar-avatar" style={{ background: 'linear-gradient(130deg,var(--accent),var(--accent-2))' }}>
            {(user?.name || user?.email || 'U').charAt(0).toUpperCase()}
          </div>
        </AccountMenu>
      </div>
    </header>
  );
}
