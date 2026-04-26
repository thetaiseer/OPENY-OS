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

const STORAGE_KEY = 'openy-selected-period-ym';

export function calendarMonthNow(): string {
  return new Date().toISOString().slice(0, 7);
}

function isValidYm(s: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
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
  periodYm: string;
  setPeriodYm: (v: string) => void;
  periodStart: string;
  periodEnd: string;
  inputMinYm: string;
  inputMaxYm: string;
};

const AppPeriodContext = createContext<AppPeriodContextValue | null>(null);

export function AppPeriodProvider({ children }: { children: ReactNode }) {
  const [periodYm, setPeriodYmState] = useState(calendarMonthNow);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw && isValidYm(raw)) {
        setPeriodYmState(clampYmToWindow(raw));
      }
    } catch {
      /* ignore */
    }
  }, []);

  const setPeriodYm = useCallback((v: string) => {
    if (!isValidYm(v)) return;
    const next = clampYmToWindow(v);
    setPeriodYmState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const { periodStart, periodEnd, inputMinYm, inputMaxYm } = useMemo(() => {
    const { start, end } = monthDayBounds(periodYm);
    const now = new Date();
    const minY = now.getFullYear() - 10;
    const maxY = now.getFullYear() + 2;
    return {
      periodStart: start,
      periodEnd: end,
      inputMinYm: `${minY}-01`,
      inputMaxYm: `${maxY}-12`,
    };
  }, [periodYm]);

  const value = useMemo(
    () => ({ periodYm, setPeriodYm, periodStart, periodEnd, inputMinYm, inputMaxYm }),
    [periodYm, setPeriodYm, periodStart, periodEnd, inputMinYm, inputMaxYm],
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
