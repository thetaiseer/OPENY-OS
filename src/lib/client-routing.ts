export function normalizeClientRouteId(value?: string | null): string | null {
  const normalized = (value ?? '').trim();
  if (!normalized || normalized === 'null' || normalized === 'undefined') return null;
  return normalized;
}
