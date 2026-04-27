'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { replaceHistoryWithPeriod } from '@/lib/period-url-history';
import { getDefaultWeekRange, parseDate, toYmd } from '@/lib/url-date';

export function calendarMonthNow(): string {
  return new Date().toISOString().slice(0, 7);
}

function isValidYm(s: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
}

function isValidYmd(s: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(s);
}

function formatYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseYmd(s: string): Date | null {
  if (!isValidYmd(s)) return null;
  const [y, m, d] = s.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime())) return null;
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return date;
}

function getCurrentMonthRange(): { from: string; to: string } {
  const defaults = getDefaultWeekRange();
  return { from: toYmd(defaults.from), to: toYmd(defaults.to) };
}

/** First / last calendar day of `YYYY-MM` as `YYYY-MM-DD` (local). */
export function monthDayBounds(ym: string): { start: string; end: string } {
  const [y, mo] = ym.split('-').map(Number);
  const pad = (n: number) => String(n).padStart(2, '0');
  if (!y || !mo || mo < 1 || mo > 12) {
    const d = new Date();
    const yy = d.getFullYear();
    const mm = d.getMonth() + 1;
    const last = new Date(yy, mm, 0).getDate();
    return { start: `${yy}-${pad(mm)}-01`, end: `${yy}-${pad(mm)}-${pad(last)}` };
  }
  const last = new Date(y, mo, 0).getDate();
  return { start: `${y}-${pad(mo)}-01`, end: `${y}-${pad(mo)}-${pad(last)}` };
}

function clampYmToWindow(ym: string): string {
  const [y, mo] = ym.split('-').map(Number);
  const d = new Date(y, mo - 1, 1);
  const min = new Date();
  min.setFullYear(min.getFullYear() - 10);
  min.setDate(1);
  const max = new Date();
  max.setFullYear(max.getFullYear() + 2);
  max.setMonth(11, 1);
  if (d < min) {
    return `${min.getFullYear()}-${String(min.getMonth() + 1).padStart(2, '0')}`;
  }
  if (d > max) {
    return `${max.getFullYear()}-${String(max.getMonth() + 1).padStart(2, '0')}`;
  }
  return ym;
}

export type AppPeriodContextValue = {
  periodFrom: string;
  periodTo: string;
  setPeriodRange: (from: string, to: string) => void;
  periodYm: string;
  setPeriodYm: (v: string) => void;
  periodStart: string;
  periodEnd: string;
  inputMinYm: string;
  inputMaxYm: string;
};

const AppPeriodContext = createContext<AppPeriodContextValue | null>(null);

export function AppPeriodProvider({ children }: { children: ReactNode }) {
  const currentMonthRange = useMemo(getCurrentMonthRange, []);
  const [periodRange, setPeriodRangeState] = useState<{ from: string; to: string }>(
    currentMonthRange,
  );

  const setPeriodRange = useCallback((from: string, to: string) => {
    const parsedFrom = parseYmd(from);
    const parsedTo = parseYmd(to);
    if (!parsedFrom || !parsedTo) return;
    const start = parsedFrom <= parsedTo ? parsedFrom : parsedTo;
    const end = parsedFrom <= parsedTo ? parsedTo : parsedFrom;
    const next = { from: formatYmd(start), to: formatYmd(end) };
    setPeriodRangeState(next);
    replaceHistoryWithPeriod(next.from, next.to);
  }, []);

  const setPeriodYm = useCallback(
    (v: string) => {
      if (!isValidYm(v)) return;
      const nextYm = clampYmToWindow(v);
      const { start, end } = monthDayBounds(nextYm);
      setPeriodRange(start, end);
    },
    [setPeriodRange],
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const syncFromUrl = () => {
      const url = new URL(window.location.href);
      const fromQuery = url.searchParams.get('from');
      const toQuery = url.searchParams.get('to');
      const start = parseDate(fromQuery);
      const end = parseDate(toQuery);
      if (start && end) {
        const normalized =
          start <= end
            ? { from: formatYmd(start), to: formatYmd(end) }
            : { from: formatYmd(end), to: formatYmd(start) };
        setPeriodRangeState(normalized);
        return;
      }
      setPeriodRangeState(currentMonthRange);
    };
    syncFromUrl();
    window.addEventListener('popstate', syncFromUrl);
    return () => window.removeEventListener('popstate', syncFromUrl);
  }, [currentMonthRange]);

  const { periodYm, periodStart, periodEnd, inputMinYm, inputMaxYm } = useMemo(() => {
    const periodStart = periodRange.from;
    const periodEnd = periodRange.to;
    const periodYm = periodStart.slice(0, 7);
    const now = new Date();
    const minY = now.getFullYear() - 10;
    const maxY = now.getFullYear() + 2;
    return {
      periodYm,
      periodStart,
      periodEnd,
      inputMinYm: `${minY}-01`,
      inputMaxYm: `${maxY}-12`,
    };
  }, [periodRange]);

  const value = useMemo(
    () => ({
      periodFrom: periodRange.from,
      periodTo: periodRange.to,
      setPeriodRange,
      periodYm,
      setPeriodYm,
      periodStart,
      periodEnd,
      inputMinYm,
      inputMaxYm,
    }),
    [
      periodRange.from,
      periodRange.to,
      setPeriodRange,
      periodYm,
      setPeriodYm,
      periodStart,
      periodEnd,
      inputMinYm,
      inputMaxYm,
    ],
  );

  return <AppPeriodContext.Provider value={value}>{children}</AppPeriodContext.Provider>;
}

export function useAppPeriod(): AppPeriodContextValue {
  const ctx = useContext(AppPeriodContext);
  if (!ctx) {
    throw new Error('useAppPeriod must be used within AppPeriodProvider');
  }
  return ctx;
}
