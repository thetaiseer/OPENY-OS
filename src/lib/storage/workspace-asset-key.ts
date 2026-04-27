/**
 * Deterministic R2 keys for OPENY OS workspace assets.
 * Pattern: workspaces/{workspaceId}/clients/{clientId|uncategorized}/{year}/{month}/{safeFileName}
 */

const UNCATEGORIZED = 'uncategorized';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Lowercase, spaces → hyphen, strip unsafe chars; preserve extension in `ext` (includes leading dot or empty). */
export function splitNameAndExtension(displayName: string): { stem: string; ext: string } {
  const trimmed = displayName.trim();
  const lastDot = trimmed.lastIndexOf('.');
  if (lastDot <= 0 || lastDot >= trimmed.length - 1) {
    return { stem: trimmed, ext: '' };
  }
  const ext = trimmed.slice(lastDot).toLowerCase();
  const stem = trimmed.slice(0, lastDot);
  return { stem, ext };
}

export function safeFileStem(stem: string): string {
  return (
    stem
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9._-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^[-.]+|[-.]+$/g, '') || 'file'
  );
}

export function buildSafeDisplayFileName(
  originalStem: string,
  ext: string,
  uniqueSuffix?: string,
): string {
  const base = safeFileStem(originalStem);
  const suf = uniqueSuffix ? `-${uniqueSuffix.replace(/[^a-z0-9]/gi, '').slice(0, 8)}` : '';
  const e = ext && ext.startsWith('.') ? ext.toLowerCase() : ext ? `.${ext.toLowerCase()}` : '';
  return `${base}${suf}${e}`;
}

export function parseMonthKey(monthKey: string): { year: string; month: string } {
  if (/^\d{4}-\d{2}$/.test(monthKey)) {
    const [y, m] = monthKey.split('-');
    return { year: y, month: pad2(parseInt(m, 10)) };
  }
  const d = new Date();
  return { year: String(d.getUTCFullYear()), month: pad2(d.getUTCMonth() + 1) };
}

export function buildWorkspaceAssetR2Key(params: {
  workspaceId: string;
  clientId: string | null;
  monthKey: string;
  originalDisplayName: string;
  uniqueSuffix?: string;
}): string {
  const { workspaceId, clientId, monthKey, originalDisplayName, uniqueSuffix } = params;
  const { year, month } = parseMonthKey(monthKey);
  const { stem, ext } = splitNameAndExtension(originalDisplayName);
  const clientSegment = (clientId ?? '').trim() || UNCATEGORIZED;
  const safeName = buildSafeDisplayFileName(stem, ext, uniqueSuffix);
  return `workspaces/${workspaceId}/clients/${clientSegment}/${year}/${month}/${safeName}`;
}

export function randomKeySuffix(): string {
  return Math.random().toString(36).slice(2, 10);
}
