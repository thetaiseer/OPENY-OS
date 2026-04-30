'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronDown } from 'lucide-react';
import { DayPicker, type DateRange } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import {
  endOfMonth,
  endOfWeek,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from 'date-fns';
import { cn } from '@/lib/cn';

type PeriodDateRangePickerProps = {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  label?: string;
  className?: string;
};

type Preset = {
  id: string;
  label: string;
  getRange: () => DateRange;
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

function isSameRange(a?: DateRange, b?: DateRange): boolean {
  if (!a?.from || !a?.to || !b?.from || !b?.to) return false;
  return toYmd(a.from) === toYmd(b.from) && toYmd(a.to) === toYmd(b.to);
}

export default function PeriodDateRangePicker({
  from,
  to,
  onChange,
  label = 'Period',
  className,
}: PeriodDateRangePickerProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  const [months, setMonths] = useState(2);
  const [popoverStyle, setPopoverStyle] = useState({
    top: 0,
    left: 0,
    width: 360,
    maxHeight: 420,
  });

  const fromDate = useMemo(() => parseYmd(from), [from]);
  const toDate = useMemo(() => parseYmd(to), [to]);
  const [draftRange, setDraftRange] = useState<DateRange | undefined>({
    from: fromDate,
    to: toDate,
  });
  const [activePreset, setActivePreset] = useState<string | null>(null);

  const presets = useMemo<Preset[]>(() => {
    const now = new Date();
    const today = startOfDay(now);
    const yesterday = startOfDay(subDays(now, 1));
    const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 });
    const thisWeekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const lastWeekBase = subWeeks(now, 1);
    const lastWeekStart = startOfWeek(lastWeekBase, { weekStartsOn: 1 });
    const lastWeekEnd = endOfWeek(lastWeekBase, { weekStartsOn: 1 });
    const thisMonthStart = startOfMonth(now);
    const thisMonthEnd = endOfMonth(now);
    const lastMonthBase = subMonths(now, 1);
    const lastMonthStart = startOfMonth(lastMonthBase);
    const lastMonthEnd = endOfMonth(lastMonthBase);
    const maxStart = new Date(2020, 0, 1);

    return [
      { id: 'today', label: 'Today', getRange: () => ({ from: today, to: today }) },
      { id: 'yesterday', label: 'Yesterday', getRange: () => ({ from: yesterday, to: yesterday }) },
      {
        id: 'last_7_days',
        label: 'Last 7 days',
        getRange: () => ({ from: subDays(today, 6), to: today }),
      },
      {
        id: 'last_14_days',
        label: 'Last 14 days',
        getRange: () => ({ from: subDays(today, 13), to: today }),
      },
      {
        id: 'last_28_days',
        label: 'Last 28 days',
        getRange: () => ({ from: subDays(today, 27), to: today }),
      },
      {
        id: 'last_30_days',
        label: 'Last 30 days',
        getRange: () => ({ from: subDays(today, 29), to: today }),
      },
      {
        id: 'this_week',
        label: 'This week',
        getRange: () => ({ from: startOfDay(thisWeekStart), to: startOfDay(thisWeekEnd) }),
      },
      {
        id: 'last_week',
        label: 'Last week',
        getRange: () => ({ from: startOfDay(lastWeekStart), to: startOfDay(lastWeekEnd) }),
      },
      {
        id: 'this_month',
        label: 'This month',
        getRange: () => ({ from: startOfDay(thisMonthStart), to: startOfDay(thisMonthEnd) }),
      },
      {
        id: 'last_month',
        label: 'Last month',
        getRange: () => ({ from: startOfDay(lastMonthStart), to: startOfDay(lastMonthEnd) }),
      },
      {
        id: 'maximum',
        label: 'Maximum',
        getRange: () => ({ from: startOfDay(maxStart), to: today }),
      },
    ];
  }, []);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    setDraftRange({ from: fromDate, to: toDate });
    setActivePreset(null);
  }, [fromDate, toDate]);

  useEffect(() => {
    if (!draftRange?.from || !draftRange?.to) {
      setActivePreset(null);
      return;
    }
    const found = presets.find((preset) => isSameRange(draftRange, preset.getRange()));
    setActivePreset(found?.id ?? null);
  }, [draftRange, presets]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onEsc = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setDraftRange({ from: fromDate, to: toDate });
      setOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onEsc);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onEsc);
    };
  }, [open, fromDate, toDate]);

  useEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const gutter = 12;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const width = Math.min(720, Math.max(320, viewportWidth - gutter * 2));
      const left = Math.max(gutter, Math.min(rect.right - width, viewportWidth - width - gutter));
      const top = rect.bottom + 8;
      const maxHeight = Math.max(320, viewportHeight - top - gutter);
      setPopoverStyle({ top, left, width, maxHeight });
      setMonths(width >= 680 ? 2 : 1);
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

  const triggerText =
    fromDate && toDate
      ? `${format(fromDate, 'MMM d, yyyy')} - ${format(toDate, 'MMM d, yyyy')}`
      : 'Select range';

  const popover =
    open && portalReady
      ? createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            className="fixed z-[260] overflow-hidden rounded-2xl border shadow-xl"
            style={{
              top: `${popoverStyle.top}px`,
              left: `${popoverStyle.left}px`,
              width: `${popoverStyle.width}px`,
              maxHeight: `${popoverStyle.maxHeight}px`,
              borderColor: 'var(--border)',
              background: 'var(--surface)',
            }}
          >
            <div className="flex max-h-full min-h-0 flex-col md:flex-row">
              <aside
                className="w-full border-b p-2 md:w-[160px] md:shrink-0 md:border-b-0 md:border-e"
                style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
              >
                <div className="flex gap-1.5 overflow-auto md:max-h-[340px] md:flex-col">
                  {presets.map((preset) => {
                    const active = activePreset === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        className={cn(
                          'h-8 rounded-lg border px-2.5 text-left text-xs font-medium md:w-full',
                          active
                            ? 'border-transparent text-[var(--accent-foreground)]'
                            : 'border-[color:var(--border)] text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-soft)]',
                        )}
                        style={
                          active
                            ? { background: 'var(--accent)', minWidth: '9.5rem' }
                            : { minWidth: '9.5rem' }
                        }
                        onClick={() => {
                          setDraftRange(preset.getRange());
                          setActivePreset(preset.id);
                        }}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </aside>

              <div className="flex min-h-0 flex-1 flex-col">
                <div className="min-h-0 flex-1 overflow-auto p-2 md:p-3">
                  <DayPicker
                    mode="range"
                    numberOfMonths={months}
                    defaultMonth={draftRange?.from ?? fromDate ?? new Date()}
                    selected={draftRange}
                    onSelect={(range) => {
                      setDraftRange(range);
                      setActivePreset(null);
                    }}
                    classNames={{
                      months: 'flex flex-col gap-3 sm:flex-row sm:gap-4',
                      month: 'min-w-[236px] space-y-2',
                      caption:
                        'relative flex items-center justify-center pt-1 text-sm font-semibold text-[color:var(--text)]',
                      caption_label: 'text-sm font-semibold text-[color:var(--text)]',
                      nav: 'absolute inset-x-0 top-0.5 flex items-center justify-between px-1',
                      button_previous:
                        'inline-flex h-7 w-7 items-center justify-center rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-soft)]',
                      button_next:
                        'inline-flex h-7 w-7 items-center justify-center rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-soft)]',
                      table: 'w-full border-collapse',
                      head_cell:
                        'h-8 w-8 text-center text-[11px] font-medium text-[color:var(--text-secondary)]',
                      cell: 'h-8 w-8 p-0 text-center align-middle',
                      day: 'inline-flex h-8 w-8 items-center justify-center rounded-md text-sm text-[color:var(--text)] hover:bg-[color:var(--surface-soft)]',
                      today: 'border border-[color:var(--accent)] text-[color:var(--accent)]',
                      selected:
                        'bg-[color:var(--accent)] text-[var(--accent-foreground)] hover:bg-[color:var(--accent)] hover:text-[var(--accent-foreground)]',
                      range_start: 'bg-[color:var(--accent)] text-[var(--accent-foreground)]',
                      range_end: 'bg-[color:var(--accent)] text-[var(--accent-foreground)]',
                      range_middle: 'bg-[color:var(--accent-soft)] text-[color:var(--text)]',
                      outside: 'text-[color:var(--text-disabled)] opacity-40',
                    }}
                  />
                </div>

                <div
                  className="flex items-center justify-end gap-2 border-t px-3 py-2"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <button
                    type="button"
                    className="h-9 rounded-lg border px-3 text-sm font-medium text-[color:var(--text-secondary)]"
                    style={{ borderColor: 'var(--border)' }}
                    onClick={() => {
                      setDraftRange({ from: fromDate, to: toDate });
                      setOpen(false);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="h-9 rounded-lg px-3 text-sm font-medium text-[var(--accent-foreground)] disabled:opacity-60"
                    style={{ background: 'var(--accent)' }}
                    disabled={!draftRange?.from || !draftRange?.to}
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
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex h-9 items-center gap-2 rounded-control border border-border bg-surface px-2.5 text-xs text-primary hover:bg-[color:var(--surface-elevated)]"
      >
        <CalendarDays className="h-3.5 w-3.5 text-secondary" />
        <span className="hidden text-[11px] font-medium text-secondary sm:inline">{label}</span>
        <span className="max-w-[14rem] truncate font-medium">{triggerText}</span>
        <ChevronDown className="h-3.5 w-3.5 text-secondary" />
      </button>
      {popover}
    </div>
  );
}
