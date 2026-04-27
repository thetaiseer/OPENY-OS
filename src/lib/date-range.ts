export function toUtcRangeBounds(from: string, to: string): { startIso: string; endIso: string } {
  const [fromYear, fromMonth, fromDay] = from.split('-').map((part) => Number(part));
  const [toYear, toMonth, toDay] = to.split('-').map((part) => Number(part));

  const startLocal = new Date(fromYear, (fromMonth || 1) - 1, fromDay || 1, 0, 0, 0, 0);
  const endLocal = new Date(toYear, (toMonth || 1) - 1, toDay || 1, 23, 59, 59, 999);

  return {
    startIso: startLocal.toISOString(),
    endIso: endLocal.toISOString(),
  };
}

type RangeFilterQuery = {
  gte: (column: string, value: string) => any;
  lte: (column: string, value: string) => any;
};

export function applyUtcTimestampRange<T extends RangeFilterQuery>(
  query: T,
  column: string,
  from: string,
  to: string,
): T {
  const { startIso, endIso } = toUtcRangeBounds(from, to);
  return query.gte(column, startIso).lte(column, endIso) as T;
}

export function applyDateOnlyRange<T extends RangeFilterQuery>(
  query: T,
  column: string,
  from: string,
  to: string,
): T {
  return query.gte(column, from).lte(column, to) as T;
}
