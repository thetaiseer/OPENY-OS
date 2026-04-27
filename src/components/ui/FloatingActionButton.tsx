'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { CheckSquare, FileText, FolderKanban, ImageIcon, Plus, Users } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useQuickActions, type QuickActionId } from '@/context/quick-actions-context';
import { useLang } from '@/context/lang-context';

type FloatingActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: ReactNode;
};

export default function FloatingActionButton({
  icon = <Plus className="h-6 w-6" />,
  className,
  ...props
}: FloatingActionButtonProps) {
  const { triggerQuickAction } = useQuickActions();
  const { t } = useLang();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const actionConfig = useMemo(() => {
    const path = pathname ?? '';
    if (path.startsWith('/clients') || path.startsWith('/os/clients')) {
      return { label: t('newClient'), id: 'add-client' as QuickActionId, icon: Users };
    }
    if (path.startsWith('/projects') || path.startsWith('/os/projects')) {
      return { label: t('newProject'), id: 'add-project' as QuickActionId, icon: FolderKanban };
    }
    if (path.startsWith('/tasks') || path.startsWith('/my-tasks') || path.startsWith('/os/tasks')) {
      return { label: t('newTask'), id: 'add-task' as QuickActionId, icon: CheckSquare };
    }
    if (path.startsWith('/content') || path.startsWith('/os/content')) {
      return { label: t('newContent'), id: 'add-content' as QuickActionId, icon: FileText };
    }
    if (path.startsWith('/assets') || path.startsWith('/os/assets')) {
      return { label: t('uploadAsset'), id: 'add-asset' as QuickActionId, icon: ImageIcon };
    }
    if (path.startsWith('/team') || path.startsWith('/os/team')) {
      return { label: t('teamInviteMember'), navigateTo: '/team?invite=1', icon: Users };
    }
    if (path.startsWith('/docs')) {
      return {
        label: t('newDocAction') || 'New document',
        navigateTo: '/docs/invoice',
        icon: FileText,
      };
    }
    return null;
  }, [pathname, t]);

  const defaultActions = useMemo(
    () =>
      [
        { id: 'add-task' as QuickActionId, label: t('newTask'), icon: CheckSquare },
        { id: 'add-client' as QuickActionId, label: t('newClient'), icon: Users },
        { id: 'add-project' as QuickActionId, label: t('newProject'), icon: FolderKanban },
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

  if (!actionConfig) return null;

  return (
    <div ref={rootRef} className={cn('relative z-50 flex flex-col items-end gap-2', className)}>
      {open ? (
        <div
          className="min-w-[12rem] overflow-hidden rounded-2xl border p-1.5"
          style={{
            background: 'color-mix(in srgb, var(--surface) 94%, white 6%)',
            borderColor: 'var(--border)',
            boxShadow: '0 16px 40px rgba(15,23,42,0.16)',
            backdropFilter: 'blur(10px)',
          }}
        >
          {defaultActions.map((action) => (
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
        onClick={() => {
          if (actionConfig.id) {
            triggerQuickAction(actionConfig.id);
            return;
          }
          if (actionConfig.navigateTo) {
            router.push(actionConfig.navigateTo);
            return;
          }
          setOpen((v) => !v);
        }}
        className="inline-flex h-14 min-h-14 w-14 min-w-14 shrink-0 items-center justify-center rounded-full border border-[color:var(--primary)] bg-[color:var(--primary)] text-[color:var(--primary-foreground)] shadow-soft-md transition-[filter,box-shadow] hover:shadow-lg hover:brightness-105 active:brightness-95"
        title={actionConfig.label}
        aria-label={actionConfig.label}
        aria-expanded={open && !actionConfig.id && !actionConfig.navigateTo}
        aria-haspopup={actionConfig.id || actionConfig.navigateTo ? undefined : 'menu'}
      >
        {actionConfig.icon ? <actionConfig.icon className="h-6 w-6" /> : icon}
      </button>
    </div>
  );
}
