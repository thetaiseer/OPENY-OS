'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import {
  OPENY_MENU_PANEL_COMPACT_CLASS,
  OPENY_MENU_ITEM_COMPACT_CLASS,
} from '@/components/ui/menu-system';

type Align = 'start' | 'end';

export type DropdownItem = {
  key: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
};

type DropdownProps = {
  /** Button label when closed */
  label: React.ReactNode;
  items: DropdownItem[];
  align?: Align;
  className?: string;
  /** Extra classes on the trigger */
  triggerClassName?: string;
  disabled?: boolean;
};

export default function Dropdown({
  label,
  items,
  align = 'end',
  className,
  triggerClassName,
  disabled,
}: DropdownProps) {
  const [open, setOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const [rect, setRect] = React.useState<DOMRect | null>(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const measure = () => {
      if (triggerRef.current) setRect(triggerRef.current.getBoundingClientRect());
    };
    measure();
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!triggerRef.current?.contains(t) && !panelRef.current?.contains(t)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const panel =
    open && rect && mounted ? (
      <div
        ref={panelRef}
        className={cn(OPENY_MENU_PANEL_COMPACT_CLASS, 'fixed z-[100] min-w-[10rem]')}
        style={{
          top: rect.bottom + 8,
          left: align === 'start' ? rect.left : undefined,
          right: align === 'end' ? Math.max(8, window.innerWidth - rect.right) : undefined,
          transformOrigin: align === 'end' ? 'top right' : 'top left',
        }}
        role="menu"
      >
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            className={cn(
              OPENY_MENU_ITEM_COMPACT_CLASS,
              item.danger && 'openy-menu-item-danger',
              'w-full text-left',
            )}
            onClick={() => {
              if (!item.disabled) {
                item.onSelect();
                setOpen(false);
              }
            }}
          >
            {item.icon ? (
              <span className="shrink-0 text-[var(--text-secondary)]">{item.icon}</span>
            ) : null}
            {item.label}
          </button>
        ))}
      </div>
    ) : null;

  return (
    <div className={cn('relative inline-block', className)}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--border-glass)] bg-[var(--surface-glass)] px-3 text-sm font-semibold text-[var(--text)] shadow-xs backdrop-blur-glass transition-[transform,box-shadow] duration-200 hover:bg-[var(--surface-elevated)] active:scale-[0.98]',
          triggerClassName,
        )}
      >
        {label}
        <ChevronDown size={16} className="opacity-60" strokeWidth={2} />
      </button>
      {mounted && panel ? createPortal(panel, document.body) : null}
    </div>
  );
}
