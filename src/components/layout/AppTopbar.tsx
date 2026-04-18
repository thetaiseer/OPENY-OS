'use client';

import { Menu, Moon, Sun } from 'lucide-react';
import { useTheme } from '@/lib/theme-context';

interface AppTopbarProps {
  onMenuClick?: () => void;
}

export default function AppTopbar({ onMenuClick }: AppTopbarProps) {
  const { theme, setTheme } = useTheme();
  const dark = theme !== 'light';

  return (
    <header className="workspace-topbar">
      <button type="button" className="workspace-icon-btn workspace-mobile-only" onClick={onMenuClick} aria-label="Open menu">
        <Menu size={16} />
      </button>
      <div className="workspace-topbar-title">
        <strong>Workspace Canvas</strong>
        <span>Block-based operating layer</span>
      </div>
      <button
        type="button"
        className="workspace-icon-btn"
        onClick={() => setTheme(dark ? 'light' : 'dark')}
        aria-label="Toggle theme"
      >
        {dark ? <Sun size={16} /> : <Moon size={16} />}
      </button>
    </header>
  );
}
