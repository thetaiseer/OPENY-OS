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
  const { open: openAi } = useAi();

  const breadcrumbs = useMemo(() => {
    const segments = pathname.split('/').filter(Boolean);
    return segments
      .filter((segment, index) => !(index === 0 && WORKSPACE_SEGMENTS.has(segment)))
      .map(formatBreadcrumbLabel)
      .slice(0, 4);
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

  return (
    <header className="os-topbar">
      <div className="os-topbar-left">
        <button type="button" onClick={onMenuClick} className="os-icon-button os-mobile-only" aria-label="Open navigation">
          <Menu size={17} />
        </button>

        <Link href={dashboardHref} className="os-topbar-brand">
          {workspaceLabel}
        </Link>

        <div className="os-breadcrumbs">
          {breadcrumbs.map((crumb, index) => (
            <span key={`${crumb}-${index}`}>
              <ChevronRight size={11} />
              <span>{crumb}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="os-topbar-search">
        <GlobalSearch />
      </div>

      <div className="os-topbar-right">
        <button type="button" onClick={openPalette} className="os-icon-button os-mobile-only" aria-label="Open search">
          <Search size={16} />
        </button>

        <ThemeSwitcher />

        <button type="button" onClick={toggleLang} className="os-icon-button" title="Toggle language">
          <Globe size={15} />
        </button>

        <NotificationDropdown />

        <button type="button" onClick={() => openAi()} className="ds-button ds-button--secondary os-ai-button" title="AI Command Center (⌘J)">
          <Sparkles size={13} />
          <span>AI</span>
        </button>

        <AccountMenu placement="header" triggerAriaLabel="Open account menu">
          <div className="os-topbar-avatar">{(user?.name || user?.email || 'U').charAt(0).toUpperCase()}</div>
        </AccountMenu>
      </div>
    </header>
  );
}
