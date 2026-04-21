export const shouldDebugClientRouting = process.env.NODE_ENV !== 'production';

const INVALID_ROUTE_TOKENS = new Set(['', 'undefined', 'null']);
const CLIENT_ID_UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const sanitizeClientRouteToken = (value?: string | null): string | null => {
  const trimmed = value?.trim() ?? '';
  if (INVALID_ROUTE_TOKENS.has(trimmed.toLowerCase())) return null;
  return trimmed;
};

export const isClientUuid = (value: string): boolean => CLIENT_ID_UUID_REGEX.test(value);

export const getClientRouteKey = (client: { id?: string | null; slug?: string | null }): string | null => {
  const slug = sanitizeClientRouteToken(client.slug);
  if (slug) return encodeURIComponent(slug);
  const id = sanitizeClientRouteToken(client.id);
  if (id) return encodeURIComponent(id);
  return null;
};

export const debugClientRouting = (message: string, payload: Record<string, unknown>) => {
  if (!shouldDebugClientRouting) return;
  console.debug(message, payload);
};

export const warnClientRouting = (message: string, payload: Record<string, unknown>) => {
  if (!shouldDebugClientRouting) return;
  console.warn(message, payload);
};
