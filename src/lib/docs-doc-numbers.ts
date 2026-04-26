import type { SupabaseClient } from '@supabase/supabase-js';

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Parses `PREFIX-0001` (case-insensitive prefix match). */
export function parsePrefixedSequence(value: string, prefix: string): number | null {
  const v = value.trim();
  const m = v.match(new RegExp(`^${escapeRegExp(prefix)}-(\\d+)$`, 'i'));
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) ? n : null;
}

/** Next number after the highest matching `PREFIX-####` in the list (starts at PREFIX-0001). */
export function nextPrefixedSequential(existing: string[], prefix: string, pad = 4): string {
  let max = 0;
  for (const raw of existing) {
    const n = parsePrefixedSequence(raw, prefix);
    if (n != null && n > max) max = n;
  }
  return `${prefix}-${String(max + 1).padStart(pad, '0')}`;
}

type DocsNumberTable =
  | 'docs_invoices'
  | 'docs_quotations'
  | 'docs_client_contracts'
  | 'docs_hr_contracts';

const TABLE_COLUMN: Record<DocsNumberTable, 'invoice_number' | 'quote_number' | 'contract_number'> =
  {
    docs_invoices: 'invoice_number',
    docs_quotations: 'quote_number',
    docs_client_contracts: 'contract_number',
    docs_hr_contracts: 'contract_number',
  };

export async function dbAllocateNextDocNumber(
  db: SupabaseClient,
  table: DocsNumberTable,
  prefix: string,
): Promise<string> {
  const column = TABLE_COLUMN[table];
  const { data, error } = await db.schema('public').from(table).select(column);
  if (error) throw error;
  const values = (data ?? []).map((row) => String((row as Record<string, unknown>)[column] ?? ''));
  return nextPrefixedSequential(values, prefix);
}

export async function dbDocumentNumberIsUnique(
  db: SupabaseClient,
  table: DocsNumberTable,
  value: string,
  excludeId: string,
): Promise<boolean> {
  const column = TABLE_COLUMN[table];
  const { data } = await db
    .schema('public')
    .from(table)
    .select('id')
    .eq(column, value)
    .neq('id', excludeId)
    .maybeSingle();
  return data == null;
}
