'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';
import { CheckSquare, FileText, FolderKanban, ImageIcon, Plus, Users } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useQuickActions, type QuickActionId } from '@/context/quick-actions-context';
import { useLang } from '@/context/lang-context';

type FloatingActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: ReactNode;
};

export default function FloatingActionButton({
  icon = <Plus className="h-5 w-5" />,
  className,
  ...props
}: FloatingActionButtonProps) {
  const { triggerQuickAction } = useQuickActions();
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const actions = useMemo(
    () =>
      [
        { id: 'add-task' as QuickActionId, label: t('newTask'), icon: CheckSquare },
        { id: 'add-client' as QuickActionId, label: t('newClient'), icon: Users },
        { id: 'add-project' as QuickActionId, label: t('newProject'), icon: FolderKanban },
        { id: 'add-note' as QuickActionId, label: t('newNote'), icon: FileText },
        { id: 'add-content' as QuickActionId, label: t('newContent'), icon: FileText },
        { id: 'add-asset' as QuickActionId, label: t('uploadAsset'), icon: ImageIcon },
      ] as const,
    [t],
  );

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onEscape);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onEscape);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={cn(
        'fixed bottom-[calc(4.35rem+env(safe-area-inset-bottom,0px))] right-[max(0.75rem,env(safe-area-inset-right,0px))] z-50',
        className,
      )}
    >
      {open ? (
        <div
          className="mb-2 min-w-[12rem] overflow-hidden rounded-2xl border p-1.5"
          style={{
            background: 'color-mix(in srgb, var(--surface) 94%, white 6%)',
            borderColor: 'var(--border)',
            boxShadow: '0 16px 40px rgba(15,23,42,0.16)',
            backdropFilter: 'blur(10px)',
          }}
        >
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              onClick={() => {
                setOpen(false);
                triggerQuickAction(action.id);
              }}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors hover:bg-[color:var(--surface-elevated)]"
              style={{ color: 'var(--text)' }}
            >
              <action.icon size={16} style={{ color: 'var(--accent)' }} />
              {action.label}
            </button>
          ))}
        </div>
      ) : null}

      <button
        type="button"
        {...props}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-12 min-h-12 w-12 min-w-12 items-center justify-center rounded-full border border-[color:var(--accent)] bg-[color:var(--accent)] text-white shadow-soft-md transition-transform hover:scale-[1.03] active:scale-[0.97]"
        title={t('quickActions')}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {icon}
      </button>
    </div>
  );
}
