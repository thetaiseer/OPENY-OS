'use client';

import {
  type ReactNode,
  type SelectHTMLAttributes,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Field } from '@/components/ui/Input';

export type SelectOption = {
  value: string;
  label: ReactNode;
  disabled?: boolean;
};

type SelectDropdownProps = Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  'onChange' | 'value' | 'children' | 'multiple' | 'size'
> & {
  value?: string | number | null;
  options?: SelectOption[];
  onChange?: (value: string) => void;
  placeholder?: string;
  label?: ReactNode;
  error?: ReactNode;
  fullWidth?: boolean;
  clearable?: boolean;
};

function norm(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '';
  return String(v);
}

export default function SelectDropdown({
  value,
  options = [],
  onChange,
  placeholder,
  label,
  error,
  fullWidth = false,
  clearable = false,
  className,
  style,
  id,
  name,
  disabled,
  required,
  autoFocus,
  form,
  title,
  tabIndex,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
}: SelectDropdownProps) {
  const autoDomId = useId();
  const domId = id ?? autoDomId;
  const listboxId = `${domId}-listbox`;

  const normalizedOptions = useMemo(() => {
    const seen = new Set<string>();
    const out: SelectOption[] = [];
    for (const option of options) {
      const normalizedValue = norm(option.value);
      if (seen.has(normalizedValue)) continue;
      seen.add(normalizedValue);
      out.push({ ...option, value: normalizedValue });
    }
    return out;
  }, [options]);

  const stringValue = norm(value);
  const hasEmptyOption = useMemo(
    () => normalizedOptions.some((o) => o.value === ''),
    [normalizedOptions],
  );
  /** Synthetic "clear" row only when clearable; `placeholder` alone styles the trigger, not an extra menu row. */
  const showEmptyRow = Boolean(clearable) && !hasEmptyOption;

  const selectedOption = useMemo(
    () => normalizedOptions.find((o) => o.value === stringValue),
    [normalizedOptions, stringValue],
  );

  const displayContent = useMemo(() => {
    if (selectedOption) return selectedOption.label;
    if (stringValue === '' && showEmptyRow) {
      return <span className="text-secondary">{placeholder ?? 'Select an option'}</span>;
    }
    if (stringValue === '' && hasEmptyOption) {
      const emptyOpt = normalizedOptions.find((o) => o.value === '');
      if (emptyOpt) return emptyOpt.label;
    }
    if (placeholder) return <span className="text-secondary">{placeholder}</span>;
    return <span className="text-secondary">Select an option</span>;
  }, [selectedOption, stringValue, showEmptyRow, placeholder, hasEmptyOption, normalizedOptions]);

  const rowCount = (showEmptyRow ? 1 : 0) + normalizedOptions.length;

  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [panelStyle, setPanelStyle] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 0,
  });

  const initialHighlight = useMemo(() => {
    if (showEmptyRow && stringValue === '') return 0;
    const idx = normalizedOptions.findIndex((o) => o.value === stringValue);
    if (idx >= 0) return (showEmptyRow ? 1 : 0) + idx;
    return 0;
  }, [showEmptyRow, stringValue, normalizedOptions]);

  useEffect(() => {
    if (open) setHighlight(initialHighlight);
  }, [open, initialHighlight]);

  useLayoutEffect(() => {
    if (!open) return;
    rowRefs.current[highlight]?.scrollIntoView({ block: 'nearest' });
  }, [open, highlight]);

  useEffect(() => {
    if (autoFocus && triggerRef.current) triggerRef.current.focus();
  }, [autoFocus]);

  const positionPanel = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const estimatedHeight = Math.min(320, Math.max(44, rowCount * 42 + 12));
    const openAbove = spaceBelow < Math.min(estimatedHeight, 220) && rect.top > spaceBelow;
    const top = openAbove
      ? Math.max(8, rect.top - Math.min(estimatedHeight, rect.top - 8))
      : rect.bottom + 8;
    setPanelStyle({
      top,
      left: Math.max(8, rect.left),
      width: Math.max(140, rect.width),
    });
  }, [rowCount]);

  useLayoutEffect(() => {
    if (!open) return;
    positionPanel();
  }, [open, positionPanel]);

  useEffect(() => {
    if (!open) return;
    const handleReposition = () => positionPanel();
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);
    return () => {
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [open, positionPanel]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const targetNode = event.target as Node;
      if (rootRef.current?.contains(targetNode)) return;
      if (panelRef.current?.contains(targetNode)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (!open) return;
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setHighlight((h) => Math.min(rowCount - 1, h + 1));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setHighlight((h) => Math.max(0, h - 1));
      } else if (event.key === 'Home') {
        event.preventDefault();
        setHighlight(0);
      } else if (event.key === 'End') {
        event.preventDefault();
        setHighlight(Math.max(0, rowCount - 1));
      } else if (event.key === 'Enter') {
        event.preventDefault();
        if (showEmptyRow && highlight === 0) {
          onChange?.('');
          setOpen(false);
          triggerRef.current?.focus();
          return;
        }
        const optIdx = highlight - (showEmptyRow ? 1 : 0);
        const opt = normalizedOptions[optIdx];
        if (opt && !opt.disabled) {
          onChange?.(opt.value);
          setOpen(false);
          triggerRef.current?.focus();
        }
      }
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, highlight, rowCount, showEmptyRow, normalizedOptions, onChange]);

  const selectOptionAt = (idx: number) => {
    if (showEmptyRow && idx === 0) {
      onChange?.('');
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }
    const optIdx = idx - (showEmptyRow ? 1 : 0);
    const opt = normalizedOptions[optIdx];
    if (opt && !opt.disabled) {
      onChange?.(opt.value);
      setOpen(false);
      triggerRef.current?.focus();
    }
  };

  const triggerClass = cn(
    'openy-control flex h-11 w-full items-center justify-between gap-2 px-4 text-left text-sm text-primary outline-none',
    'focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/15',
    'disabled:cursor-not-allowed disabled:opacity-60',
    fullWidth ? 'w-full' : 'min-w-[10rem]',
    error
      ? 'border-danger focus-visible:border-danger focus-visible:ring-[color:var(--danger)]/20'
      : '',
    className,
  );

  const panelClass =
    'max-h-64 overflow-auto rounded-[18px] border border-border bg-[color:var(--surface)] p-1.5 shadow-[0_20px_44px_rgba(15,23,42,0.14)]';

  const rowClass = (active: boolean) =>
    cn(
      'flex w-full items-center justify-between gap-2 rounded-[12px] px-3 py-2.5 text-left text-sm transition-colors',
      active
        ? 'bg-[color:var(--accent-soft)] text-primary'
        : 'text-primary hover:bg-[color:var(--surface-elevated)]',
    );

  const core = (
    <div
      ref={rootRef}
      className={cn(
        'relative',
        /** When open, stack above following siblings (e.g. filter bar Card vs pipeline grid below). */
        open && 'z-50',
        fullWidth ? 'w-full' : 'inline-block min-w-[10rem]',
      )}
    >
      {name ? (
        <input
          type="hidden"
          name={name}
          value={stringValue}
          disabled={disabled}
          form={form}
          readOnly
        />
      ) : null}
      <button
        ref={triggerRef}
        id={domId}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-haspopup="listbox"
        aria-required={required}
        aria-invalid={error ? true : undefined}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        disabled={disabled}
        title={title}
        tabIndex={tabIndex}
        className={triggerClass}
        style={style}
        onClick={() => {
          if (disabled) return;
          setOpen((o) => !o);
        }}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === 'Escape') {
            e.preventDefault();
            setOpen(false);
            return;
          }
          if (!open && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            setOpen(true);
          }
          if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span className="min-w-0 flex-1 truncate">{displayContent}</span>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-secondary transition-transform',
            open && 'rotate-180',
          )}
          aria-hidden
        />
      </button>

      {open && !disabled && rowCount > 0
        ? createPortal(
            <div
              ref={panelRef}
              id={listboxId}
              role="listbox"
              className={cn(panelClass, 'fixed z-[1400]')}
              style={{
                top: panelStyle.top,
                left: panelStyle.left,
                width: panelStyle.width,
                maxWidth: 'calc(100vw - 16px)',
              }}
            >
              {showEmptyRow ? (
                <button
                  key="__placeholder__"
                  type="button"
                  role="option"
                  aria-selected={stringValue === ''}
                  ref={(el) => {
                    rowRefs.current[0] = el;
                  }}
                  className={rowClass(highlight === 0)}
                  onMouseEnter={() => setHighlight(0)}
                  onClick={() => selectOptionAt(0)}
                >
                  <span className="min-w-0 flex-1 truncate text-secondary">
                    {placeholder ?? 'Select an option'}
                  </span>
                  {stringValue === '' ? (
                    <Check className="h-4 w-4 shrink-0 text-accent" aria-hidden />
                  ) : null}
                </button>
              ) : null}
              {normalizedOptions.map((option, i) => {
                const idx = (showEmptyRow ? 1 : 0) + i;
                const selected = option.value === stringValue;
                return (
                  <button
                    key={`${option.value}-${i}`}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    disabled={option.disabled}
                    ref={(el) => {
                      rowRefs.current[idx] = el;
                    }}
                    className={cn(
                      rowClass(highlight === idx),
                      option.disabled ? 'cursor-not-allowed opacity-50 hover:bg-transparent' : '',
                    )}
                    onMouseEnter={() => setHighlight(idx)}
                    onClick={() => selectOptionAt(idx)}
                  >
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                    {selected ? (
                      <Check className="h-4 w-4 shrink-0 text-accent" aria-hidden />
                    ) : null}
                  </button>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </div>
  );

  if (!label && !error) return core;
  return (
    <Field label={label} error={error} htmlFor={label ? domId : undefined}>
      {core}
    </Field>
  );
}
