// ============================================================
// OPENY OS – Supabase Shared Helpers
// Utilities shared across all Supabase service-layer files.
// ============================================================

// ── camelCase ↔ snake_case converters ────────────────────────

function toCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

function toSnake(str: string): string {
  return str.replace(/[A-Z]/g, (c: string) => "_" + c.toLowerCase());
}

/**
 * Converts a PostgreSQL row (snake_case keys) to a JS object (camelCase keys).
 * Arrays and nested objects in JSONB columns are returned as-is.
 */
export function rowToCamel(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    out[toCamel(key)] = value;
  }
  return out;
}

/**
 * Converts a JS object (camelCase keys) to a PostgreSQL row (snake_case keys).
 * Strips undefined values so they are not sent as NULL on partial updates.
 */
export function objToSnake(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      out[toSnake(key)] = value;
    }
  }
  return out;
}

const DEV = process.env.NODE_ENV !== "production";

export function dbLog(prefix: string, ...args: unknown[]) {
  if (DEV) console.log(`[OPENY:${prefix}]`, ...args);
}

export function dbError(prefix: string, ...args: unknown[]) {
  console.error(`[OPENY:${prefix}]`, ...args);
}
