import { endOfWeek, startOfWeek } from 'date-fns';

export function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function toYmd(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function getDefaultWeekRange(reference = new Date()): { from: Date; to: Date } {
  return {
    from: startOfWeek(reference, { weekStartsOn: 1 }),
    to: endOfWeek(reference, { weekStartsOn: 1 }),
  };
}

export function resolveFromToParams(params: URLSearchParams): {
  fromDate: Date;
  toDate: Date;
  fromYmd: string;
  toYmd: string;
} {
  const defaults = getDefaultWeekRange(new Date());
  const parsedFrom = parseDate(params.get('from'));
  const parsedTo = parseDate(params.get('to'));
  const normalizedFrom = parsedFrom ?? defaults.from;
  const normalizedTo = parsedTo ?? defaults.to;
  const fromDate = normalizedFrom <= normalizedTo ? normalizedFrom : normalizedTo;
  const toDate = normalizedFrom <= normalizedTo ? normalizedTo : normalizedFrom;
  return {
    fromDate,
    toDate,
    fromYmd: toYmd(fromDate),
    toYmd: toYmd(toDate),
  };
}
