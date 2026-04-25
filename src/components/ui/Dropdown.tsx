'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';

export type DropdownItem = {
  id: string;
  label: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
};

type DropdownProps = {
  triggerLabel: ReactNode;
  items: DropdownItem[];
  className?: string;
};

export default function Dropdown({ triggerLabel, items, className }: DropdownProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className={cn('relative inline-flex', className)}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex h-10 items-center gap-2 rounded-control border border-border bg-surface px-3 text-sm text-primary"
      >
        {triggerLabel}
        <ChevronDown className="h-4 w-4 text-secondary" />
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-50 mt-1 min-w-[12rem] rounded-control border border-border bg-surface p-1 shadow-soft">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              disabled={item.disabled}
              onClick={() => {
                item.onClick?.();
                setOpen(false);
              }}
              className={cn(
                'flex w-full items-center rounded-control px-3 py-2 text-left text-sm',
                item.danger ? 'text-danger' : 'text-primary',
                item.disabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-elevated',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
