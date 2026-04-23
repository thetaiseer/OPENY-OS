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
import { OPENY_MENU_PANEL_CLASS } from '@/components/ui/menu-system';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

interface MonthYearPickerProps {
  value: string; // "YYYY-MM" or ""
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
  const parsedYear = value ? parseInt(value.slice(0, 4), 10) : today.getFullYear();
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
  const label = value ? `${MONTH_NAMES[parsedMonth]} ${parsedYear}` : placeholder;

  return (
    <div className="relative inline-block">
      {/* Trigger button */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={`flex h-10 items-center gap-2 rounded-full px-3 text-sm font-medium outline-none transition-all focus:ring-2 focus:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
        style={{
          background: 'var(--surface-shell)',
          color: value ? 'var(--text)' : 'var(--text-secondary)',
          border: `1px solid ${open ? 'var(--accent)' : 'var(--border)'}`,
          boxShadow: 'var(--shadow-xs)',
          whiteSpace: 'nowrap',
        }}
      >
        <Calendar size={14} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
        <span className="flex-1 truncate text-left">{label}</span>
        {clearable && value && (
          <span
            role="button"
            tabIndex={0}
            onClick={handleClear}
            onKeyDown={(e) => e.key === 'Enter' && handleClear(e as unknown as React.MouseEvent)}
            className="shrink-0 opacity-60 transition-opacity hover:opacity-100"
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
          className={`absolute left-0 top-full z-50 mt-2 overflow-hidden ${OPENY_MENU_PANEL_CLASS}`}
          style={{
            padding: '0.35rem',
            minWidth: 260,
          }}
        >
          {/* Year navigation */}
          <div
            className="flex items-center justify-between border-b px-4 py-3"
            style={{ borderColor: 'var(--border)' }}
          >
            <button
              type="button"
              onClick={() => setViewYear((y) => y - 1)}
              className="flex h-7 w-7 items-center justify-center rounded-lg transition-opacity hover:opacity-70"
              style={{ background: 'var(--surface-2)', color: 'var(--text)' }}
              aria-label="Previous year"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--text)' }}>
              {viewYear}
            </span>
            <button
              type="button"
              onClick={() => setViewYear((y) => y + 1)}
              className="flex h-7 w-7 items-center justify-center rounded-lg transition-opacity hover:opacity-70"
              style={{ background: 'var(--surface-2)', color: 'var(--text)' }}
              aria-label="Next year"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Month grid */}
          <div className="grid grid-cols-3 gap-1.5 p-3">
            {MONTH_SHORT.map((abbr, i) => {
              const isSelected = value ? parsedYear === viewYear && parsedMonth === i : false;
              const isToday = today.getFullYear() === viewYear && today.getMonth() === i;

              return (
                <button
                  key={abbr}
                  type="button"
                  onClick={() => handleSelect(i)}
                  className="relative h-9 rounded-xl text-xs font-semibold transition-all hover:scale-105"
                  style={{
                    background: isSelected
                      ? 'var(--accent)'
                      : isToday
                        ? 'var(--accent-soft)'
                        : 'var(--surface-2)',
                    color: isSelected ? '#ffffff' : isToday ? 'var(--accent)' : 'var(--text)',
                    border:
                      isToday && !isSelected
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
          <div className="flex justify-end px-3 pb-3 pt-0">
            {value ? (
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  setOpen(false);
                }}
                className="rounded-lg px-3 py-1.5 text-xs transition-opacity hover:opacity-80"
                style={{ color: '#ef4444', background: 'rgba(239,68,68,0.08)' }}
              >
                Clear
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-1.5 text-xs transition-opacity hover:opacity-80"
                style={{ color: 'var(--text-secondary)', background: 'var(--surface-2)' }}
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
