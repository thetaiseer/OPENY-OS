'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { type DateRange } from 'react-day-picker';
import {
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isWithinInterval,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from 'date-fns';
import { cn } from '@/lib/cn';
import type { Granularity } from '@/context/app-period-context';

type PeriodDateRangePickerProps = {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  granularity?: Granularity;
  onGranularityChange?: (g: Granularity) => void;
  label?: string;
  className?: string;
};

type Preset = {
  id: string;
  label: string;
  getRange: () => DateRange;
};

const GRANULARITY_OPTIONS: { value: Granularity; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
];

const WEEK_DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

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

function getCalendarDays(month: Date): (Date | null)[] {
  const start = startOfMonth(month);
  const end = endOfMonth(month);
  const days: (Date | null)[] = [];
  // pad start
  for (let i = 0; i < start.getDay(); i++) days.push(null);
  for (
    let d = new Date(start);
    d <= end;
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
  ) {
    days.push(new Date(d));
  }
  // pad end to complete grid
  while (days.length % 7 !== 0) days.push(null);
  return days;
}

function MiniCalendar({
  month,
  range,
  hoverDate,
  onDayClick,
  onDayHover,
  onDayLeave,
  onPrev,
  onNext,
  showPrev = true,
  showNext = true,
}: {
  month: Date;
  range?: DateRange;
  hoverDate?: Date | null;
  onDayClick: (d: Date) => void;
  onDayHover: (d: Date) => void;
  onDayLeave: () => void;
  onPrev: () => void;
  onNext: () => void;
  showPrev?: boolean;
  showNext?: boolean;
}) {
  const today = startOfDay(new Date());
  const days = getCalendarDays(month);

  const effectiveEnd = range?.from && !range?.to && hoverDate ? hoverDate : range?.to;
  const selFrom = range?.from ? startOfDay(range.from) : null;
  const selTo = effectiveEnd ? startOfDay(effectiveEnd) : null;

  return (
    <div className="w-full">
      {/* Month header */}
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={onPrev}
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-[color:var(--surface-soft)]',
            !showPrev && 'invisible',
          )}
        >
          <ChevronLeft className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
        </button>
        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          {format(month, 'MMMM yyyy')}
        </span>
        <button
          type="button"
          onClick={onNext}
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-[color:var(--surface-soft)]',
            !showNext && 'invisible',
          )}
        >
          <ChevronRight className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
        </button>
      </div>

      {/* Week day headers */}
      <div className="mb-1 grid grid-cols-7">
        {WEEK_DAYS.map((d) => (
          <div
            key={d}
            className="flex h-8 items-center justify-center text-[11px] font-medium"
            style={{ color: 'var(--text-secondary)' }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          if (!day) return <div key={i} />;

          const isToday = isSameDay(day, today);
          const isStart = selFrom && isSameDay(day, selFrom);
          const isEnd = selTo && isSameDay(day, selTo);
          const isSelected = isStart || isEnd;
          const isInRange =
            selFrom && selTo && isWithinInterval(startOfDay(day), { start: selFrom, end: selTo });
          const isRangeStart = isStart && selTo && !isSameDay(selFrom!, selTo);
          const isRangeEnd = isEnd && selFrom && !isSameDay(selFrom!, selTo!);
          const isMiddle = isInRange && !isStart && !isEnd;

          return (
            <div
              key={i}
              className={cn(
                'relative flex h-8 items-center justify-center',
                isMiddle && 'bg-[color:var(--surface-soft)]',
              )}
              style={
                isRangeStart
                  ? { background: 'var(--surface-soft)', borderRadius: '50% 0 0 50%' }
                  : isRangeEnd
                    ? { background: 'var(--surface-soft)', borderRadius: '0 50% 50% 0' }
                    : {}
              }
            >
              <button
                type="button"
                onMouseEnter={() => onDayHover(day)}
                onMouseLeave={onDayLeave}
                onClick={() => onDayClick(day)}
                className={cn(
                  'relative z-10 flex h-7 w-7 items-center justify-center rounded-full text-[13px] transition-colors',
                  isSelected
                    ? 'font-semibold text-[color:var(--accent-foreground)]'
                    : isToday
                      ? 'font-semibold'
                      : 'hover:bg-[color:var(--surface-soft)]',
                )}
                style={
                  isSelected
                    ? { background: 'var(--accent)', color: 'var(--accent-foreground)' }
                    : isToday
                      ? { color: 'var(--accent)' }
                      : { color: 'var(--text-primary)' }
                }
              >
                {day.getDate()}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function PeriodDateRangePicker({
  from,
  to,
  onChange,
  granularity = 'day',
  onGranularityChange,
  label = 'Period',
  className,
}: PeriodDateRangePickerProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState({ top: 0, left: 0 });
  const [draftGranularity, setDraftGranularity] = useState<Granularity>(granularity);
  const [hoverDate, setHoverDate] = useState<Date | null>(null);
  const [selectingEnd, setSelectingEnd] = useState(false);

  const fromDate = useMemo(() => parseYmd(from), [from]);
  const toDate = useMemo(() => parseYmd(to), [to]);
  const [draftRange, setDraftRange] = useState<DateRange | undefined>({
    from: fromDate,
    to: toDate,
  });
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [viewMonth, setViewMonth] = useState<Date>(fromDate ?? new Date());

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

    return [
      { id: 'today', label: 'Today', getRange: () => ({ from: today, to: today }) },
      { id: 'yesterday', label: 'Yesterday', getRange: () => ({ from: yesterday, to: yesterday }) },
      {
        id: 'last_7',
        label: 'Last 7 days',
        getRange: () => ({ from: subDays(today, 6), to: today }),
      },
      {
        id: 'last_14',
        label: 'Last 14 days',
        getRange: () => ({ from: subDays(today, 13), to: today }),
      },
      {
        id: 'last_30',
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
        label: 'All time',
        getRange: () => ({ from: startOfDay(new Date(2020, 0, 1)), to: today }),
      },
    ];
  }, []);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    setDraftRange({ from: fromDate, to: toDate });
    setActivePreset(null);
    setSelectingEnd(false);
    if (fromDate) setViewMonth(fromDate);
  }, [fromDate, toDate]);

  useEffect(() => {
    setDraftGranularity(granularity);
  }, [granularity]);

  useEffect(() => {
    if (!draftRange?.from || !draftRange?.to) {
      setActivePreset(null);
      return;
    }
    const found = presets.find((p) => isSameRange(draftRange, p.getRange()));
    setActivePreset(found?.id ?? null);
  }, [draftRange, presets]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || popoverRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setDraftRange({ from: fromDate, to: toDate });
      setDraftGranularity(granularity);
      setOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onEsc);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onEsc);
    };
  }, [open, fromDate, toDate, granularity]);

  useEffect(() => {
    if (!open) return;
    const updatePos = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const popoverWidth = 320;
      const gutter = 12;
      const vw = window.innerWidth;
      let left = rect.right - popoverWidth;
      if (left < gutter) left = gutter;
      if (left + popoverWidth > vw - gutter) left = vw - popoverWidth - gutter;
      setPopoverStyle({ top: rect.bottom + 8, left });
    };
    updatePos();
    window.addEventListener('resize', updatePos);
    window.addEventListener('scroll', updatePos, true);
    return () => {
      window.removeEventListener('resize', updatePos);
      window.removeEventListener('scroll', updatePos, true);
    };
  }, [open]);

  function handleDayClick(day: Date) {
    if (!selectingEnd || !draftRange?.from) {
      setDraftRange({ from: day, to: undefined });
      setSelectingEnd(true);
      setActivePreset(null);
    } else {
      const from = draftRange.from;
      const [start, end] = day < from ? [day, from] : [from, day];
      setDraftRange({ from: start, to: end });
      setSelectingEnd(false);
      setActivePreset(null);
    }
  }

  const rangeForCalendar: DateRange | undefined =
    selectingEnd && draftRange?.from && hoverDate
      ? {
          from: hoverDate < draftRange.from ? hoverDate : draftRange.from,
          to: hoverDate < draftRange.from ? draftRange.from : hoverDate,
        }
      : draftRange;

  const triggerText =
    fromDate && toDate
      ? `${format(fromDate, 'MMM d, yyyy')} – ${format(toDate, 'MMM d, yyyy')}`
      : 'Select range';

  const granularityLabel = GRANULARITY_OPTIONS.find((o) => o.value === granularity)?.label ?? '';

  const popover =
    open && portalReady
      ? createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            className="fixed z-[260] w-80 overflow-hidden rounded-2xl border shadow-xl"
            style={{
              top: `${popoverStyle.top}px`,
              left: `${popoverStyle.left}px`,
              borderColor: 'var(--border)',
              background: 'var(--surface)',
            }}
          >
            {/* Granularity row */}
            {onGranularityChange && (
              <div
                className="flex items-center gap-1.5 border-b px-3 py-2.5"
                style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
              >
                <span
                  className="me-1 text-xs font-medium"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  View by
                </span>
                {GRANULARITY_OPTIONS.map((opt) => {
                  const active = draftGranularity === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setDraftGranularity(opt.value)}
                      className={cn(
                        'rounded-lg px-3 py-1 text-xs font-semibold transition-all',
                        active
                          ? 'text-[color:var(--accent-foreground)]'
                          : 'text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]',
                      )}
                      style={
                        active
                          ? { background: 'var(--accent)' }
                          : { background: 'var(--surface-soft)' }
                      }
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Presets — horizontal scrollable chips */}
            <div
              className="scrollbar-none flex gap-1.5 overflow-x-auto border-b px-3 py-2.5"
              style={{ borderColor: 'var(--border)' }}
            >
              {presets.map((preset) => {
                const active = activePreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      const range = preset.getRange();
                      setDraftRange(range);
                      setActivePreset(preset.id);
                      setSelectingEnd(false);
                      if (range.from) setViewMonth(range.from);
                    }}
                    className={cn(
                      'shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                      active
                        ? 'border-transparent text-[color:var(--accent-foreground)]'
                        : 'border-[color:var(--border)] text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-soft)]',
                    )}
                    style={active ? { background: 'var(--accent)' } : {}}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            {/* Calendar */}
            <div className="px-3 py-3">
              <MiniCalendar
                month={viewMonth}
                range={rangeForCalendar}
                hoverDate={hoverDate}
                onDayClick={handleDayClick}
                onDayHover={(d) => selectingEnd && setHoverDate(d)}
                onDayLeave={() => setHoverDate(null)}
                onPrev={() => setViewMonth((m) => addMonths(m, -1))}
                onNext={() => setViewMonth((m) => addMonths(m, 1))}
              />
            </div>

            {/* Selected range display */}
            <div
              className="border-t px-3 py-2"
              style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
            >
              <p
                className="text-center text-[12px] font-medium"
                style={{ color: 'var(--text-secondary)' }}
              >
                {draftRange?.from && draftRange?.to ? (
                  <>
                    <span style={{ color: 'var(--text-primary)' }}>
                      {format(draftRange.from, 'MMM d, yyyy')}
                    </span>{' '}
                    —{' '}
                    <span style={{ color: 'var(--text-primary)' }}>
                      {format(draftRange.to, 'MMM d, yyyy')}
                    </span>
                  </>
                ) : draftRange?.from ? (
                  <>
                    <span style={{ color: 'var(--text-primary)' }}>
                      {format(draftRange.from, 'MMM d, yyyy')}
                    </span>
                    <span> — pick end date</span>
                  </>
                ) : (
                  'Pick a start date'
                )}
              </p>
            </div>

            {/* Footer actions */}
            <div
              className="flex items-center justify-end gap-2 border-t px-3 py-2.5"
              style={{ borderColor: 'var(--border)' }}
            >
              <button
                type="button"
                onClick={() => {
                  setDraftRange({ from: fromDate, to: toDate });
                  setDraftGranularity(granularity);
                  setSelectingEnd(false);
                  setOpen(false);
                }}
                className="h-8 rounded-xl border px-3 text-xs font-medium transition-colors hover:bg-[color:var(--surface-soft)]"
                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!draftRange?.from || !draftRange?.to}
                onClick={() => {
                  if (!draftRange?.from || !draftRange?.to) return;
                  onChange(toYmd(draftRange.from), toYmd(draftRange.to));
                  if (onGranularityChange && draftGranularity !== granularity) {
                    onGranularityChange(draftGranularity);
                  }
                  setOpen(false);
                }}
                className="h-8 rounded-xl px-3 text-xs font-semibold transition-opacity hover:opacity-90 disabled:opacity-40"
                style={{ background: 'var(--accent)', color: 'var(--accent-foreground)' }}
              >
                Apply
              </button>
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
        className="inline-flex h-9 items-center gap-2 rounded-control border border-border bg-surface px-2.5 text-xs text-primary transition-colors hover:bg-[color:var(--surface-elevated)]"
      >
        <CalendarDays className="h-3.5 w-3.5 text-secondary" />
        <span className="hidden text-[11px] font-medium text-secondary sm:inline">{label}</span>
        <span className="max-w-[14rem] truncate font-medium">{triggerText}</span>
        {onGranularityChange && (
          <span
            className="hidden rounded-md border px-1.5 py-0.5 text-[10px] font-semibold sm:inline"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
          >
            {granularityLabel}
          </span>
        )}
      </button>
      {popover}
    </div>
  );
}
