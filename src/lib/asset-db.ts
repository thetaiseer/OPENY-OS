/**
 * src/lib/asset-db.ts
 *
 * Shared helpers for inserting asset rows into the Supabase `assets` table.
 *
 * The main export `insertWithColumnFallback` handles the case where optional
 * migration files have not yet been applied to the database.  When PostgreSQL
 * returns error code 42703 ("undefined_column"), the helper identifies the
 * missing column from the error message, removes it from the payload, and
 * retries automatically — up to MAX_COLUMN_RETRIES times.
 */

/** Maximum number of columns that can be stripped per insert attempt. */
export const MAX_COLUMN_RETRIES = 10;

/** Return type shared by both upload route files. */
export interface InsertResult {
  data:     Record<string, unknown> | null;
  error:    { message: string; code: string; details?: string; hint?: string } | null;
  /** The payload that was ultimately used for the final insert attempt. */
  finalRow: Record<string, unknown>;
}

/**
 * Extract the column name from a PostgreSQL 42703 "undefined_column" error.
 * The message typically reads: column "xyz" of relation "table" does not exist
 */
export function extractMissingColumn(
  err: { message?: string; details?: string },
): string | null {
  const text = `${err.message ?? ''} ${err.details ?? ''}`;
  const m = text.match(/column "([^"]+)"/);
  return m?.[1] ?? null;
}

/**
 * Minimal callable that executes one insert attempt.
 * Passing a factory function decouples the helper from Supabase's generic types.
 */
type InsertAttemptFn = (row: Record<string, unknown>) => PromiseLike<{
  data:  unknown;
  error: { code: string; message: string; details?: string; hint?: string } | null;
}>;

/**
 * Insert a row into the `assets` table, automatically retrying without any
 * column that PostgreSQL reports as undefined (error code 42703).
 *
 * This makes uploads resilient against schema migrations that have not yet been
 * applied to the database.  Each stripped column is logged with a hint to run
 * `supabase-migration-missing-columns.sql`.
 *
 * @param attemptInsert Factory that performs one insert attempt and returns
 *                      `{ data, error }`.  Typically:
 *                      `(row) => supabase.from('assets').insert(row).select().single()`
 * @param row           The full insert payload.
 * @param logPrefix     A string prefix used in console messages (e.g. '[upload]').
 */
export async function insertWithColumnFallback(
  attemptInsert: InsertAttemptFn,
  row: Record<string, unknown>,
  logPrefix: string,
): Promise<InsertResult> {
  let currentRow = { ...row };
  let result = await attemptInsert(currentRow);
  let attempts = 0;

  while (result.error?.code === '42703' && attempts < MAX_COLUMN_RETRIES) {
    const col = extractMissingColumn(result.error as { message?: string; details?: string });
    if (!col || !(col in currentRow)) break; // unrecognisable error — stop retrying
    console.warn(
      `${logPrefix} ⚠️  Column "${col}" does not exist in the assets table — ` +
      'removing from insert payload and retrying. ' +
      'Run supabase-migration-missing-columns.sql to add the missing column.',
    );
    // Strip the missing column using destructuring (avoids mutating a shared object)
    const { [col]: _dropped, ...stripped } = currentRow;
    void _dropped; // suppress unused-variable lint
    currentRow = stripped;
    result = await attemptInsert(currentRow);
    attempts++;
  }

  return {
    data:     result.data as Record<string, unknown> | null,
    error:    result.error as InsertResult['error'],
    finalRow: currentRow,
  };
}

/**
 * Serialize a Supabase / PostgrestError object to a readable JSON string.
 *
 * Designed for the error shape returned by Supabase client calls:
 * `{ message, code, details, hint }`.  Pass the raw error object from
 * `supabase.from(...).insert(...)` — all present properties are included.
 *
 * Use this helper instead of `console.log(error)` to avoid "[object Object]".
 */
export function serializeDbError(
  err: { message?: string; code?: string; details?: string; hint?: string } | null | undefined,
): string {
  if (!err) return 'null';
  return JSON.stringify(err, null, 2);
}
