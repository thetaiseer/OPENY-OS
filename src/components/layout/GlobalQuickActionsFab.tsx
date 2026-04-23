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
import { AnimatePresence, motion } from 'framer-motion';
import { useQuickActions, type QuickActionId } from '@/context/quick-actions-context';
import { motionTransition } from '@/lib/motion';
import {
  OPENY_MENU_ICON_CHIP_CLASS,
  OPENY_MENU_ITEM_CLASS,
  OPENY_MENU_PANEL_CLASS,
} from '@/components/ui/menu-system';

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
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' }}
    >
      {/* Quick-action menu — renders above FAB due to flex-col + bottom anchor */}
      <AnimatePresence>
        {open && (
          <motion.ul
            id={menuId}
            role="menu"
            aria-label="Quick actions"
            className={`${OPENY_MENU_PANEL_CLASS} w-52 origin-bottom-right`}
            style={{
              transformOrigin: 'bottom right',
            }}
            initial={{ opacity: 0, scale: 0.95, y: 10, filter: 'blur(6px)' }}
            animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.95, y: 8, filter: 'blur(6px)' }}
            transition={motionTransition.ui}
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
                  className={OPENY_MENU_ITEM_CLASS}
                  style={{ color: 'var(--text)' }}
                  aria-label={action.label}
                >
                  <span
                    className={`${OPENY_MENU_ICON_CHIP_CLASS} transition-transform`}
                    style={{
                      transitionDuration: 'var(--motion-duration-ui)',
                      transitionTimingFunction: 'var(--motion-ease-standard)',
                    }}
                  >
                    {action.icon}
                  </span>
                  <span>{action.label}</span>
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>

      {/* FAB button — always sits at the very bottom of the wrapper */}
      <motion.button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={open ? 'Close quick actions menu' : 'Open quick actions menu'}
        className="fab-motion group flex h-14 w-14 items-center justify-center rounded-full text-white shadow-2xl transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e3a5f] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
        style={{
          background: 'linear-gradient(135deg, #1e3a5f 0%, #16304f 100%)',
          boxShadow: '0 16px 30px rgba(30,58,95,0.45), 0 0 24px rgba(30,58,95,0.3)',
          transitionDuration: 'var(--motion-duration-ui)',
          transitionTimingFunction: 'var(--motion-ease-standard)',
        }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.97 }}
        transition={motionTransition.micro}
      >
        <motion.span
          className="transition-transform"
          style={{
            transitionDuration: 'var(--motion-duration-ui)',
            transitionTimingFunction: 'var(--motion-ease-standard)',
          }}
          animate={{ rotate: open ? 45 : 0 }}
          transition={motionTransition.ui}
        >
          <Plus size={22} />
        </motion.span>
      </motion.button>
    </div>
  );
}
