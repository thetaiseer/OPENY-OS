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

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, X, Check } from 'lucide-react';

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

  const selected = options.find(o => o.value === value);
  const label = selected?.label ?? placeholder;
  const hasValue = !!value;

  // Track mount state so createPortal is only called client-side
  useEffect(() => { setMounted(true); }, []);

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
    ? {
        position: 'fixed',
        top: rect.bottom + 6,
        left: rect.left,
        width: rect.width,
        zIndex: 9999,
      }
    : { display: 'none' };

  const popover = open && mounted && rect
    ? createPortal(
        <div
          ref={dropdownRef}
          className="rounded-2xl border shadow-2xl overflow-hidden"
          style={{
            ...portalStyle,
            background: 'var(--surface)',
            borderColor: 'var(--border)',
          }}
        >
          <div className="py-1.5 max-h-60 overflow-y-auto">
            {options.map(option => {
              const isSelected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className="flex items-center justify-between w-full px-3 h-9 text-sm text-left transition-colors hover:bg-[var(--surface-2)]"
                  style={{
                    background: isSelected ? 'var(--accent-soft, rgba(109,40,217,0.08))' : 'transparent',
                    color:      isSelected ? 'var(--accent)' : 'var(--text)',
                    fontWeight: isSelected ? 600 : 400,
                  }}
                >
                  <span className="truncate">{option.label}</span>
                  {isSelected && (
                    <Check size={13} className="shrink-0 ml-2" style={{ color: 'var(--accent)' }} />
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
        onClick={e => { e.stopPropagation(); if (!disabled) setOpen(o => !o); }}
        className={`flex items-center gap-2 px-3 h-9 rounded-lg text-sm font-medium transition-all outline-none focus:ring-2 focus:ring-[var(--accent)] disabled:opacity-50 disabled:cursor-not-allowed ${fullWidth ? 'w-full' : ''} ${className}`}
        style={{
          background:  'var(--surface-2)',
          color:       hasValue ? 'var(--text)' : 'var(--text-secondary)',
          border:      `1px solid ${open ? 'var(--accent)' : 'var(--border)'}`,
          whiteSpace:  'nowrap',
        }}
      >
        {icon && (
          <span className="shrink-0" style={{ color: 'var(--text-secondary)' }}>
            {icon}
          </span>
        )}
        <span className="flex-1 text-left truncate">{label}</span>
        {clearable && hasValue ? (
          <span
            role="button"
            tabIndex={0}
            onClick={handleClear}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChange(''); } }}
            className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
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
