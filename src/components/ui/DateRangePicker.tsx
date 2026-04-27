'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronDown } from 'lucide-react';
import { DayPicker, type DateRange } from 'react-day-picker';
import { format } from 'date-fns';
import { cn } from '@/lib/cn';

type DateRangePickerProps = {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  label?: string;
  className?: string;
};

function parseYmd(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d)
    return undefined;
  return date;
}

function toYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function DateRangePicker({
  from,
  to,
  onChange,
  label = 'Period',
  className,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const fromDate = useMemo(() => parseYmd(from), [from]);
  const toDate = useMemo(() => parseYmd(to), [to]);
  const [draftRange, setDraftRange] = useState<DateRange | undefined>({
    from: fromDate,
    to: toDate,
  });

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) setOpen(false);
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

  useEffect(() => {
    setDraftRange({ from: fromDate, to: toDate });
  }, [fromDate, toDate]);

  const triggerText =
    fromDate && toDate
      ? `${format(fromDate, 'MMM d, yyyy')} - ${format(toDate, 'MMM d, yyyy')}`
      : 'Select range';

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="inline-flex h-9 items-center gap-2 rounded-control border border-border bg-surface px-2.5 text-xs text-primary transition-colors hover:bg-[color:var(--surface-elevated)]"
      >
        <CalendarDays className="h-3.5 w-3.5 text-secondary" />
        <span className="hidden text-[11px] font-medium text-secondary sm:inline">{label}</span>
        <span className="max-w-[14rem] truncate font-medium">{triggerText}</span>
        <ChevronDown className="h-3.5 w-3.5 text-secondary" />
      </button>
      {open ? (
        <div
          role="dialog"
          className="absolute end-0 top-full z-[220] mt-2 w-[min(calc(100vw-1.5rem),640px)] rounded-2xl border p-3 shadow-lg"
          style={{
            background: 'color-mix(in srgb, var(--surface) 95%, white 5%)',
            borderColor: 'var(--border)',
            boxShadow: '0 16px 40px rgba(15,23,42,0.16)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <DayPicker
            mode="range"
            numberOfMonths={2}
            defaultMonth={fromDate}
            selected={draftRange}
            onSelect={setDraftRange}
          />
          <div className="mt-3 flex items-center justify-end gap-2 border-t border-border pt-3">
            <button
              type="button"
              className="rounded-lg border px-3 py-1.5 text-xs font-semibold"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
              onClick={() => {
                setDraftRange({ from: fromDate, to: toDate });
                setOpen(false);
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
              style={{ background: 'var(--accent)' }}
              onClick={() => {
                if (!draftRange?.from || !draftRange?.to) return;
                onChange(toYmd(draftRange.from), toYmd(draftRange.to));
                setOpen(false);
              }}
            >
              Apply
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
