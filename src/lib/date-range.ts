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
