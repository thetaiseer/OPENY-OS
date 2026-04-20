'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Plus,
  X,
  UserPlus,
  CheckSquare,
  FileText,
  Upload,
} from 'lucide-react';

type QuickActionId = 'add-client' | 'add-task' | 'add-content' | 'add-asset';

interface QuickAction {
  id: QuickActionId;
  label: string;
  href: string;
  icon: React.ReactNode;
}

const DEFAULT_ACTIONS: QuickAction[] = [
  { id: 'add-client', label: 'Add Client', href: '/clients?quickAction=add-client', icon: <UserPlus size={16} /> },
  { id: 'add-task', label: 'Add Task', href: '/tasks/all?quickAction=add-task', icon: <CheckSquare size={16} /> },
  { id: 'add-content', label: 'Add Content', href: '/content?quickAction=add-content', icon: <FileText size={16} /> },
  { id: 'add-asset', label: 'Add Asset', href: '/assets?quickAction=add-asset', icon: <Upload size={16} /> },
];

function getPriorityAction(pathname: string): QuickActionId | null {
  if (pathname.startsWith('/clients')) return 'add-client';
  if (pathname.startsWith('/tasks')) return 'add-task';
  if (pathname.startsWith('/content')) return 'add-content';
  if (pathname.startsWith('/assets')) return 'add-asset';
  return null;
}

export default function GlobalQuickActionsFab() {
  const router = useRouter();
  const pathname = usePathname() ?? '';
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

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick, { passive: true });
    window.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
      window.removeEventListener('keydown', handleEscape);
    };
  }, []);

  return (
    <div
      ref={wrapperRef}
      className="fixed right-4 sm:right-6 z-[45] flex flex-col items-end gap-2"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)' }}
    >
      <ul
        id={menuId}
        role="menu"
        aria-label="Quick actions"
        className={`w-48 rounded-2xl border p-2 shadow-xl backdrop-blur-sm transition-all duration-200 origin-bottom-right ${
          open ? 'translate-y-0 scale-100 opacity-100 pointer-events-auto' : 'translate-y-2 scale-95 opacity-0 pointer-events-none'
        }`}
        style={{ background: 'color-mix(in srgb, var(--surface) 94%, transparent)', borderColor: 'var(--border)' }}
      >
        {orderedActions.map(action => (
          <li key={action.id} role="none">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                router.push(action.href);
              }}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors hover:bg-[var(--surface-2)]"
              style={{ color: 'var(--text)' }}
              aria-label={action.label}
            >
              <span className="shrink-0" style={{ color: 'var(--text-secondary)' }}>{action.icon}</span>
              <span>{action.label}</span>
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={open ? 'Close quick actions menu' : 'Open quick actions menu'}
        className="flex h-14 w-14 items-center justify-center rounded-full text-white shadow-xl transition-transform hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
        style={{ background: 'var(--accent)' }}
      >
        {open ? <X size={22} /> : <Plus size={22} />}
      </button>
    </div>
  );
}
