'use client';

/**
 * SelectDropdown — a popover-style select that matches the MonthYearPicker
 * design language exactly.  Use this everywhere a native <select> would
 * otherwise appear (filter bars, form fields, modals, etc.).
 *
 * The popover is rendered via a React portal so it is never clipped by
 * overflow:hidden / overflow:auto ancestors (e.g. modal content wrappers).
 *
 * Props:
 *   value       – currently selected value (empty string → placeholder shown)
 *   onChange    – called with the new value string
 *   options     – array of { value, label } items
 *   placeholder – text shown when value is empty (default "Select…")
 *   disabled    – disables the trigger button
 *   clearable   – shows a clear (×) button when a non-empty value is selected
 *   icon        – optional icon node placed before the label
 *   className   – extra classes applied to the trigger button
 *   fullWidth   – stretches trigger + dropdown to 100% (for form fields)
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, X, Check } from 'lucide-react';
import { OPENY_MENU_ITEM_CLASS, OPENY_MENU_PANEL_CLASS } from '@/components/ui/menu-system';

const SELECT_DROPDOWN_MIN_WIDTH_PX = 180;
const SELECT_DROPDOWN_VIEWPORT_PADDING_PX = 8;
const SELECT_DROPDOWN_VIEWPORT_DOUBLE_PADDING_PX = SELECT_DROPDOWN_VIEWPORT_PADDING_PX * 2;
const SELECT_DROPDOWN_MIN_VIEWPORT_WIDTH_PX = 220;
const SELECT_DROPDOWN_CHAR_WIDTH_ESTIMATE_PX = 8.5;
const SELECT_DROPDOWN_LABEL_PADDING_ESTIMATE_PX = 64;

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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Portal anchor: track the trigger's bounding rect so the portal can position itself
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [mounted, setMounted] = useState(false);

  const selected = options.find((o) => o.value === value);
  const label = selected?.label ?? placeholder;
  const hasValue = !!value;
  const estimatedLongestLabelWidth = useMemo(
    () =>
      Math.max(...options.map((option) => option.label.length), placeholder.length) *
        SELECT_DROPDOWN_CHAR_WIDTH_ESTIMATE_PX +
      SELECT_DROPDOWN_LABEL_PADDING_ESTIMATE_PX,
    [options, placeholder],
  );

  // Track mount state so createPortal is only called client-side
  useEffect(() => {
    setMounted(true);
  }, []);

  // Re-measure trigger position whenever the dropdown opens or on scroll/resize
  useEffect(() => {
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

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        !triggerRef.current?.contains(e.target as Node) &&
        !dropdownRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const handleSelect = (optValue: string) => {
    onChange(optValue);
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
  };

  // Compute portal dropdown position from the trigger's bounding rect
  const portalStyle: React.CSSProperties = rect
    ? (() => {
        const minWidth = Math.max(rect.width, SELECT_DROPDOWN_MIN_WIDTH_PX);
        const viewportMaxWidth = Math.max(
          SELECT_DROPDOWN_MIN_VIEWPORT_WIDTH_PX,
          window.innerWidth - SELECT_DROPDOWN_VIEWPORT_DOUBLE_PADDING_PX,
        );
        const width = Math.min(Math.max(minWidth, estimatedLongestLabelWidth), viewportMaxWidth);
        const unclampedLeft = rect.left;
        const maxLeft = window.innerWidth - width - SELECT_DROPDOWN_VIEWPORT_PADDING_PX;
        const left = Math.max(
          SELECT_DROPDOWN_VIEWPORT_PADDING_PX,
          Math.min(unclampedLeft, maxLeft),
        );
        return {
          position: 'fixed',
          top: rect.bottom + 6,
          left,
          width,
          minWidth,
          maxWidth: viewportMaxWidth,
          zIndex: 9999,
        };
      })()
    : { display: 'none' };

  const popover =
    open && mounted && rect
      ? createPortal(
          <div
            ref={dropdownRef}
            className={`${OPENY_MENU_PANEL_CLASS} overflow-hidden`}
            style={{
              ...portalStyle,
              padding: '0.35rem',
            }}
          >
            <div className="max-h-60 overflow-y-auto py-0.5">
              {options.map((option) => {
                const isSelected = option.value === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleSelect(option.value)}
                    className={`${OPENY_MENU_ITEM_CLASS} justify-between text-left ${isSelected ? 'openy-menu-item-selected' : ''}`}
                    style={{
                      fontWeight: isSelected ? 600 : 400,
                    }}
                  >
                    <span className="whitespace-normal break-words leading-5" title={option.label}>
                      {option.label}
                    </span>
                    {isSelected && (
                      <Check
                        size={13}
                        className="ml-2 shrink-0"
                        style={{ color: 'var(--accent)' }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className={`relative ${fullWidth ? 'w-full' : 'inline-block'}`}>
      {/* Trigger button — same style as MonthYearPicker trigger */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) setOpen((o) => !o);
        }}
        className={`flex h-10 items-center gap-2 rounded-full px-3 text-sm font-medium outline-none transition-all focus:ring-2 focus:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50 ${fullWidth ? 'w-full' : ''} ${className}`}
        style={{
          background: 'var(--surface-shell)',
          color: hasValue ? 'var(--text)' : 'var(--text-secondary)',
          border: `1px solid ${open ? 'var(--accent)' : 'var(--border)'}`,
          boxShadow: 'var(--shadow-xs)',
          whiteSpace: 'nowrap',
        }}
        title={label}
      >
        {icon && (
          <span className="shrink-0" style={{ color: 'var(--text-secondary)' }}>
            {icon}
          </span>
        )}
        <span className="flex-1 truncate text-left">{label}</span>
        {clearable && hasValue ? (
          <span
            role="button"
            tabIndex={0}
            onClick={handleClear}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onChange('');
              }
            }}
            className="shrink-0 opacity-60 transition-opacity hover:opacity-100"
            aria-label="Clear selection"
          >
            <X size={12} />
          </span>
        ) : (
          <ChevronDown
            size={14}
            className={`shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
            style={{ color: 'var(--text-secondary)' }}
          />
        )}
      </button>

      {/* Popover rendered via portal so it escapes overflow:hidden/auto ancestors */}
      {popover}
    </div>
  );
}
