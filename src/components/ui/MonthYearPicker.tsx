'use client';

/**
 * MonthYearPicker — a modern, calendar-style month & year selector.
 *
 * Replaces the native <input type="month"> with a polished popover UI
 * that lets users navigate years and pick a month from a 3×4 grid.
 *
 * Props:
 *   value       – "YYYY-MM" string (or "" for no selection)
 *   onChange    – called with a "YYYY-MM" string when selection changes
 *   placeholder – text shown when value is empty
 *   disabled    – disables the trigger button
 *   className   – extra class names for the trigger button
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar, X } from 'lucide-react';

const MONTH_NAMES = [
  'January', 'February', 'March',    'April',
  'May',     'June',     'July',     'August',
  'September','October', 'November', 'December',
] as const;

const MONTH_SHORT = [
  'Jan','Feb','Mar','Apr','May','Jun',
  'Jul','Aug','Sep','Oct','Nov','Dec',
] as const;

interface MonthYearPickerProps {
  value: string;                  // "YYYY-MM" or ""
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  clearable?: boolean;
}

export default function MonthYearPicker({
  value,
  onChange,
  placeholder = 'Select month',
  disabled = false,
  className = '',
  clearable = false,
}: MonthYearPickerProps) {
  const today = useMemo(() => new Date(), []);
  const [open, setOpen] = useState(false);

  // Parse value into year/month
  const parsedYear  = value ? parseInt(value.slice(0, 4), 10) : today.getFullYear();
  const parsedMonth = value ? parseInt(value.slice(5, 7), 10) - 1 : -1; // 0-based

  // Navigation year (may differ from selected year while browsing)
  const [viewYear, setViewYear] = useState(parsedYear);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Sync view year when value changes
  useEffect(() => {
    if (value) setViewYear(parseInt(value.slice(0, 4), 10));
  }, [value]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        !triggerRef.current?.contains(e.target as Node) &&
        !popoverRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleSelect = (monthIndex: number) => {
    const mm = String(monthIndex + 1).padStart(2, '0');
    onChange(`${viewYear}-${mm}`);
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
  };

  // Display label
  const label = value
    ? `${MONTH_NAMES[parsedMonth]} ${parsedYear}`
    : placeholder;

  return (
    <div className={`relative ${className.includes('w-full') ? 'w-full' : 'inline-block'}`}>
      {/* Trigger button */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(o => !o)}
        data-open={open}
        className={`openy-select-trigger flex items-center gap-2 px-3 h-10 rounded-lg text-sm font-medium transition-all outline-none focus:ring-2 focus:ring-[var(--accent)] disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
        style={{
          color:        value ? 'var(--text)' : 'var(--text-secondary)',
          boxShadow:    open ? 'var(--glow-focus)' : 'inset 0 1px 0 rgba(255,255,255,0.08)',
          whiteSpace:   'nowrap',
        }}
      >
        <Calendar size={14} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
        <span className="flex-1 text-left truncate">{label}</span>
        {clearable && value && (
          <span
            role="button"
            tabIndex={0}
            onClick={handleClear}
            onKeyDown={e => e.key === 'Enter' && handleClear(e as unknown as React.MouseEvent)}
            className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
            aria-label="Clear month filter"
          >
            <X size={12} />
          </span>
        )}
      </button>

      {/* Popover */}
      {open && (
        <div
          ref={popoverRef}
          className="openy-menu-panel absolute top-full left-0 mt-2 z-50 rounded-2xl overflow-hidden animate-openy-slide-down"
          style={{
            minWidth:     260,
          }}
        >
          {/* Year navigation */}
          <div
            className="flex items-center justify-between px-4 py-3 border-b"
            style={{ borderColor: 'var(--border)' }}
          >
            <button
              type="button"
              onClick={() => setViewYear(y => y - 1)}
              className="btn-icon flex items-center justify-center w-7 h-7 rounded-lg"
              style={{ color: 'var(--text)' }}
              aria-label="Previous year"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--text)' }}>
              {viewYear}
            </span>
            <button
              type="button"
              onClick={() => setViewYear(y => y + 1)}
              className="btn-icon flex items-center justify-center w-7 h-7 rounded-lg"
              style={{ color: 'var(--text)' }}
              aria-label="Next year"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Month grid */}
          <div className="grid grid-cols-3 gap-1.5 p-3">
            {MONTH_SHORT.map((abbr, i) => {
              const isSelected = value
                ? parsedYear === viewYear && parsedMonth === i
                : false;
              const isToday =
                today.getFullYear() === viewYear && today.getMonth() === i;

              return (
                <button
                  key={abbr}
                  type="button"
                  onClick={() => handleSelect(i)}
                  className="relative h-9 rounded-xl text-xs font-semibold transition-all hover:scale-[1.03]"
                  style={{
                    background: isSelected
                      ? 'var(--accent)'
                      : isToday
                      ? 'var(--accent-soft)'
                      : 'var(--surface-2)',
                    color: isSelected
                      ? '#ffffff'
                      : isToday
                      ? 'var(--accent)'
                      : 'var(--text)',
                    border: isToday && !isSelected
                      ? '1.5px solid var(--accent)'
                      : '1.5px solid transparent',
                    fontWeight: isSelected || isToday ? 700 : 500,
                  }}
                  aria-label={`${MONTH_NAMES[i]} ${viewYear}`}
                  aria-pressed={isSelected}
                >
                  {abbr}
                </button>
              );
            })}
          </div>

          {/* Footer: clear or close */}
          <div
            className="flex justify-end px-3 pb-3 pt-0"
          >
            {value ? (
              <button
                type="button"
                onClick={() => { onChange(''); setOpen(false); }}
                className="btn-danger text-xs px-3 py-1.5 rounded-lg"
              >
                Clear
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="btn-secondary text-xs px-3 py-1.5 rounded-lg"
              >
                Close
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
