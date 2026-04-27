'use client';

import { useEffect, useRef, useState } from 'react';
import { EllipsisVertical, Pencil, Trash2, Archive, Loader2 } from 'lucide-react';

type EntityAction = {
  id: string;
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
};

type EntityActionsMenuProps = {
  onEdit?: () => void;
  onDelete?: () => void;
  onArchive?: () => void;
  editLabel?: string;
  deleteLabel?: string;
  archiveLabel?: string;
  customActions?: EntityAction[];
  disabled?: boolean;
  loading?: boolean;
};

export default function EntityActionsMenu({
  onEdit,
  onDelete,
  onArchive,
  editLabel = 'Edit',
  deleteLabel = 'Delete',
  archiveLabel = 'Archive',
  customActions = [],
  disabled = false,
  loading = false,
}: EntityActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

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

  const actions: EntityAction[] = [
    ...(onEdit ? [{ id: 'edit', label: editLabel, onClick: onEdit }] : []),
    ...(onArchive ? [{ id: 'archive', label: archiveLabel, onClick: onArchive }] : []),
    ...customActions,
    ...(onDelete ? [{ id: 'delete', label: deleteLabel, onClick: onDelete, danger: true }] : []),
  ];

  if (!actions.length) return null;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors hover:bg-[var(--surface-2)] disabled:cursor-not-allowed disabled:opacity-60"
        style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Open actions menu"
        title="Actions"
        disabled={disabled || loading}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : <EllipsisVertical size={15} />}
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute end-0 top-9 z-50 min-w-[11rem] overflow-hidden rounded-xl border bg-[var(--surface)] p-1.5 shadow-xl"
          style={{ borderColor: 'var(--border)' }}
        >
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              role="menuitem"
              disabled={action.disabled || loading}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-[var(--surface-2)] disabled:cursor-not-allowed disabled:opacity-50"
              style={{ color: action.danger ? 'var(--color-danger)' : 'var(--text)' }}
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                action.onClick();
              }}
            >
              {action.id === 'edit' ? <Pencil size={14} /> : null}
              {action.id === 'archive' ? <Archive size={14} /> : null}
              {action.id === 'delete' ? <Trash2 size={14} /> : null}
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
