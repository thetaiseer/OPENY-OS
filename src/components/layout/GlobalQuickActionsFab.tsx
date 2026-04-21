'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  Plus,
  UserPlus,
  CheckSquare,
  FileText,
  Upload,
} from 'lucide-react';
import { useQuickActions, type QuickActionId } from '@/lib/quick-actions-context';

interface QuickAction {
  id: QuickActionId;
  label: string;
  icon: React.ReactNode;
}

const DEFAULT_ACTIONS: QuickAction[] = [
  { id: 'add-client', label: 'Add Client', icon: <UserPlus size={16} /> },
  { id: 'add-task', label: 'Add Task', icon: <CheckSquare size={16} /> },
  { id: 'add-content', label: 'Add Content', icon: <FileText size={16} /> },
  { id: 'add-asset', label: 'Add Asset', icon: <Upload size={16} /> },
];

function getPriorityAction(pathname: string): QuickActionId | null {
  if (pathname.startsWith('/clients') || pathname.startsWith('/os/clients')) return 'add-client';
  if (pathname.startsWith('/tasks') || pathname.startsWith('/os/tasks')) return 'add-task';
  if (pathname.startsWith('/content') || pathname.startsWith('/os/content')) return 'add-content';
  if (pathname.startsWith('/assets') || pathname.startsWith('/os/assets')) return 'add-asset';
  return null;
}

export default function GlobalQuickActionsFab() {
  const pathname = usePathname() ?? '';
  const { triggerQuickAction } = useQuickActions();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const menuId = 'global-quick-actions-menu';
  const priorityAction = getPriorityAction(pathname);

  const orderedActions = useMemo(() => {
    if (!priorityAction) return DEFAULT_ACTIONS;
    const prioritized = DEFAULT_ACTIONS.find(action => action.id === priorityAction);
    const rest = DEFAULT_ACTIONS.filter(action => action.id !== priorityAction);
    return prioritized ? [prioritized, ...rest] : DEFAULT_ACTIONS;
  }, [priorityAction]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent | TouchEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    if (!open) return;

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick, { passive: true });
    window.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  return (
    /*
     * Wrapper is anchored to the bottom-right corner with enough clearance to:
     *  - clear the mobile browser chrome and bottom navigation bars (80px base)
     *  - respect iOS safe-area-inset-bottom (env() fallback to 0px)
     *
     * Z-index 48 places the FAB:
     *  - above the sidebar / AI panel overlay (z-40)
     *  - below all modals and their backdrops (z-50+)
     *
     * flex-col layout (menu first, button second) with a bottom anchor means
     * the menu always expands UPWARD from the FAB button.
     */
    <div
      ref={wrapperRef}
      className="fixed right-4 z-[48] flex flex-col items-end gap-3"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)' }}
    >
      {/* Quick-action menu — renders above FAB due to flex-col + bottom anchor */}
      <ul
        id={menuId}
        role="menu"
        aria-label="Quick actions"
        className={`w-48 rounded-2xl border p-2 shadow-2xl transition-all duration-200 origin-bottom-right ${
          open
            ? 'translate-y-0 scale-100 opacity-100 pointer-events-auto'
            : 'translate-y-2 scale-95 opacity-0 pointer-events-none'
        }`}
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        {orderedActions.map(action => (
          <li key={action.id} role="none">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                triggerQuickAction(action.id);
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors hover:bg-[var(--surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              style={{ color: 'var(--text)' }}
              aria-label={action.label}
            >
              <span className="shrink-0" style={{ color: 'var(--accent)' }}>{action.icon}</span>
              <span>{action.label}</span>
            </button>
          </li>
        ))}
      </ul>

      {/* FAB button — always sits at the very bottom of the wrapper */}
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={open ? 'Close quick actions menu' : 'Open quick actions menu'}
        className="flex h-14 w-14 items-center justify-center rounded-full text-white shadow-2xl transition-all duration-200 hover:scale-[1.05] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
        style={{ background: 'var(--accent)' }}
      >
        <span
          className="transition-transform duration-200"
          style={{ transform: open ? 'rotate(45deg)' : 'rotate(0deg)' }}
        >
          <Plus size={22} />
        </span>
      </button>
    </div>
  );
}
