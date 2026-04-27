'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronDown } from 'lucide-react';
import { DayPicker, type DateRange } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import {
  endOfDay,
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

type PresetDef = {
  id: string;
  label: string;
  getRange: () => DateRange;
};

function sameRange(a?: DateRange, b?: DateRange): boolean {
  if (!a?.from || !a?.to || !b?.from || !b?.to) return false;
  return toYmd(a.from) === toYmd(b.from) && toYmd(a.to) === toYmd(b.to);
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
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const fromDate = useMemo(() => parseYmd(from), [from]);
  const toDate = useMemo(() => parseYmd(to), [to]);
  const [draftRange, setDraftRange] = useState<DateRange | undefined>({
    from: fromDate,
    to: toDate,
  });
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [portalReady, setPortalReady] = useState(false);
  const [numberOfMonths, setNumberOfMonths] = useState(2);
  const [popoverStyle, setPopoverStyle] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  }>({
    top: 0,
    left: 0,
    width: 0,
    maxHeight: 0,
  });

  const presets = useMemo<PresetDef[]>(() => {
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
    // Project-wide max fallback range if inception date is unknown.
    const projectInception = new Date(2020, 0, 1);

    return [
      { id: 'today', label: 'Today', getRange: () => ({ from: today, to: today }) },
      {
        id: 'yesterday',
        label: 'Yesterday',
        getRange: () => ({ from: yesterday, to: yesterday }),
      },
      {
        id: 'today_yesterday',
        label: 'Today and yesterday',
        getRange: () => ({ from: yesterday, to: today }),
      },
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
        getRange: () => ({ from: startOfDay(thisWeekStart), to: endOfDay(thisWeekEnd) }),
      },
      {
        id: 'last_week',
        label: 'Last week',
        getRange: () => ({ from: startOfDay(lastWeekStart), to: endOfDay(lastWeekEnd) }),
      },
      {
        id: 'this_month',
        label: 'This month',
        getRange: () => ({ from: startOfDay(thisMonthStart), to: endOfDay(thisMonthEnd) }),
      },
      {
        id: 'last_month',
        label: 'Last month',
        getRange: () => ({ from: startOfDay(lastMonthStart), to: endOfDay(lastMonthEnd) }),
      },
      {
        id: 'maximum',
        label: 'Maximum',
        getRange: () => ({ from: startOfDay(projectInception), to: today }),
      },
    ];
  }, []);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
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
    setActivePresetId(null);
  }, [fromDate, toDate]);

  useEffect(() => {
    if (!open) return;

    const updatePopoverLayout = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const gutter = 12;
      const desiredDesktopWidth = 920;
      const desiredMobileWidth = 680;
      const maxAllowedWidth = Math.max(280, viewportWidth - gutter * 2);
      const preferredWidth = viewportWidth >= 768 ? desiredDesktopWidth : desiredMobileWidth;
      const width = Math.min(preferredWidth, maxAllowedWidth);

      const triggerAlignedLeft = Math.round(rect.right - width);
      const left = Math.max(gutter, Math.min(triggerAlignedLeft, viewportWidth - width - gutter));
      const top = Math.round(rect.bottom + 8);
      const maxHeight = Math.max(320, viewportHeight - top - gutter);

      // Keep 2 months only when there is enough space.
      const twoMonthMinWidth = 860;
      setNumberOfMonths(width >= twoMonthMinWidth ? 2 : 1);
      setPopoverStyle({ top, left, width, maxHeight });
    };

    updatePopoverLayout();
    window.addEventListener('resize', updatePopoverLayout);
    window.addEventListener('scroll', updatePopoverLayout, true);
    return () => {
      window.removeEventListener('resize', updatePopoverLayout);
      window.removeEventListener('scroll', updatePopoverLayout, true);
    };
  }, [open]);

  useEffect(() => {
    if (!draftRange?.from || !draftRange?.to) {
      setActivePresetId(null);
      return;
    }
    const matched = presets.find((preset) => sameRange(draftRange, preset.getRange()));
    setActivePresetId(matched?.id ?? null);
  }, [draftRange, presets]);

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
            className="z-[220] rounded-2xl border p-0 shadow-lg"
            style={{
              position: 'fixed',
              top: `${popoverStyle.top}px`,
              left: `${popoverStyle.left}px`,
              width: `${popoverStyle.width}px`,
              maxHeight: `${popoverStyle.maxHeight}px`,
              background: 'color-mix(in srgb, var(--surface) 95%, white 5%)',
              borderColor: 'var(--border)',
              boxShadow: '0 16px 40px rgba(15,23,42,0.16)',
              backdropFilter: 'blur(10px)',
            }}
          >
            <div
              className="flex min-h-0 flex-col overflow-hidden md:flex-row"
              style={{ maxHeight: `${popoverStyle.maxHeight}px` }}
            >
              <aside
                className="w-full border-b md:w-[240px] md:shrink-0 md:border-b-0 md:border-e"
                style={{ borderColor: 'var(--border)', background: 'var(--surface-elevated)' }}
              >
                <div className="max-h-[220px] space-y-1 overflow-y-auto p-3 md:max-h-none">
                  {presets.map((preset) => {
                    const active = activePresetId === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        className={cn(
                          'w-full rounded-lg border px-3 py-2 text-left text-xs font-semibold transition-colors',
                          active
                            ? 'border-transparent text-white'
                            : 'border-[color:var(--border)] text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-soft)]',
                        )}
                        style={active ? { background: 'var(--accent)' } : undefined}
                        onClick={() => {
                          const next = preset.getRange();
                          setDraftRange(next);
                          setActivePresetId(preset.id);
                        }}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </aside>

              <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                <div className="min-h-0 flex-1 overflow-auto p-3 md:p-4">
                  <DayPicker
                    mode="range"
                    numberOfMonths={numberOfMonths}
                    defaultMonth={draftRange?.from ?? fromDate ?? new Date()}
                    selected={draftRange}
                    onSelect={(next) => {
                      setDraftRange(next);
                      setActivePresetId(null);
                    }}
                    classNames={{
                      months: 'flex flex-col gap-4 sm:flex-row sm:gap-6',
                      month: 'min-w-[260px] space-y-3',
                      caption:
                        'relative flex items-center justify-center pt-1 text-sm font-semibold text-[color:var(--text-primary)]',
                      caption_label: 'text-sm font-semibold text-[color:var(--text-primary)]',
                      nav: 'pointer-events-none absolute inset-x-0 top-1 flex items-center justify-between px-1',
                      button_previous:
                        'pointer-events-auto inline-flex h-8 w-8 items-center justify-center rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-soft)]',
                      button_next:
                        'pointer-events-auto inline-flex h-8 w-8 items-center justify-center rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-soft)]',
                      table: 'w-full border-collapse',
                      head_row: '',
                      row: '',
                      head_cell:
                        'h-9 w-9 border-b border-[color:var(--border)] text-center text-[11px] font-medium text-[color:var(--text-secondary)]',
                      cell: 'relative h-9 w-9 p-0 text-center align-middle',
                      day: 'inline-flex h-9 w-9 items-center justify-center rounded-md border border-transparent p-0 text-sm font-medium text-[color:var(--text-primary)] hover:border-[color:var(--border)] hover:bg-[color:var(--surface-soft)]',
                      today: 'border-[color:var(--accent)] text-[color:var(--accent)]',
                      selected:
                        'bg-[color:var(--accent)] text-white hover:bg-[color:var(--accent)] hover:text-white',
                      range_start:
                        'bg-[color:var(--accent)] text-white rounded-md hover:bg-[color:var(--accent)]',
                      range_end:
                        'bg-[color:var(--accent)] text-white rounded-md hover:bg-[color:var(--accent)]',
                      range_middle:
                        'bg-[color:var(--accent-soft)] text-[color:var(--text-primary)] rounded-md',
                      outside: 'text-[color:var(--text-disabled)] opacity-50',
                      disabled: 'text-[color:var(--text-disabled)] opacity-40',
                    }}
                  />
                </div>

                <div className="mt-auto flex items-center justify-end gap-2 border-t border-border px-4 py-3">
                  <button
                    type="button"
                    className="rounded-lg border px-3 py-1.5 text-xs font-semibold"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                    onClick={() => {
                      setDraftRange({ from: fromDate, to: toDate });
                      setActivePresetId(null);
                      setOpen(false);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
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
      {popover}
    </div>
  );
}
