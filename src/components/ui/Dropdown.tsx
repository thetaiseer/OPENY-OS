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
        className="rounded-control border-border bg-surface text-primary inline-flex h-10 items-center gap-2 border px-3 text-sm"
      >
        {triggerLabel}
        <ChevronDown className="text-secondary h-4 w-4" />
      </button>

      {open ? (
        <div className="rounded-control border-border bg-surface shadow-soft absolute right-0 top-full z-50 mt-1 min-w-[12rem] border p-1">
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
                'rounded-control flex w-full items-center px-3 py-2 text-left text-sm',
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
