'use client';

import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  clearable?: boolean;
  icon?: React.ReactNode;
  className?: string;
  fullWidth?: boolean;
}

export default function SelectDropdown({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  disabled = false,
  clearable = false,
  icon,
  className = '',
  fullWidth = false,
}: SelectDropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedOption = useMemo(() => options.find((option) => option.value === value) ?? null, [options, value]);
  const selectedIndex = useMemo(() => options.findIndex((option) => option.value === value), [options, value]);

  const getNextIndex = (direction: 'down' | 'up') => {
    const current = selectedIndex >= 0 ? selectedIndex : direction === 'down' ? -1 : 0;
    return direction === 'down'
      ? Math.min(options.length - 1, current + 1)
      : Math.max(0, current - 1);
  };

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onEscape);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const activeIndex = selectedIndex >= 0 ? selectedIndex : 0;
    const active = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    active?.scrollIntoView({ block: 'nearest' });
  }, [open, selectedIndex]);

  const onKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      const next = getNextIndex(event.key === 'ArrowDown' ? 'down' : 'up');
      const opt = options[next];
      if (opt) onChange(opt.value);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setOpen((current) => !current);
    }
  };

  const selectValue = (nextValue: string) => {
    onChange(nextValue);
    setOpen(false);
    buttonRef.current?.focus();
  };

  return (
    <div ref={rootRef} className={`relative ${fullWidth ? 'w-full' : 'inline-block'}`}>
      <div className={`openy-select-trigger openy-filter-control relative flex h-11 items-center gap-2 rounded-lg px-3 ${className}`} style={{ width: fullWidth ? '100%' : undefined }}>
        {icon ? <span className="shrink-0 text-[var(--text-secondary)]">{icon}</span> : null}
        <button
          ref={buttonRef}
          type="button"
          disabled={disabled}
          onClick={() => setOpen((current) => !current)}
          onKeyDown={onKeyDown}
          className="min-w-0 flex-1 bg-transparent pr-6 text-left text-sm font-medium outline-none"
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <span className="block truncate" style={{ color: selectedOption ? 'var(--text)' : 'var(--text-secondary)' }}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </button>

        {clearable && value ? (
          <button
            type="button"
            onClick={() => {
              onChange('');
              setOpen(false);
            }}
            className="absolute right-2 shrink-0 rounded p-0.5 text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-3)]"
            aria-label="Clear selection"
          >
            <X size={12} />
          </button>
        ) : (
          <ChevronDown size={14} aria-hidden="true" className={`absolute right-2.5 shrink-0 text-[var(--text-secondary)] transition-transform ${open ? 'rotate-180' : ''}`} />
        )}
      </div>

      {open ? (
        <div ref={listRef} role="listbox" className="openy-select-menu openy-menu-panel openy-dropdown-menu absolute left-0 right-0 top-full z-40 mt-2 max-h-64 overflow-auto rounded-xl p-1.5 animate-openy-slide-down">
          {options.map((option, index) => {
            const active = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={active}
                data-index={index}
                onClick={() => selectValue(option.value)}
                  className={`openy-menu-item flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium ${active ? 'openy-menu-item-active' : ''}`}
                >
                <span className="truncate">{option.label}</span>
                {active ? <Check size={14} style={{ color: 'var(--accent-primary)' }} /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
