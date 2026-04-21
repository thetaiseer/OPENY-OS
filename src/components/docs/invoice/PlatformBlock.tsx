import type { CSSProperties } from 'react';
import type { InvoiceDocumentRow } from '@/lib/docs-invoice-document-model';
import { OPENY_DOC_BLACK } from '@/lib/openy-brand';

const DOC_BLACK = OPENY_DOC_BLACK;

const bodyCell: CSSProperties = {
  border: `1px solid ${DOC_BLACK}`,
  padding: 6,
  fontSize: 11,
  verticalAlign: 'top',
};

function fmt(v: number, cur: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: cur,
    minimumFractionDigits: 2,
  }).format(v || 0);
}

/**
 * Renders the table rows for a single platform group inside a BranchTable <tbody>.
 * Must be used as a direct child of a <tbody> element.
 */
export default function PlatformBlock({
  rows,
  currency,
  branchTableId,
  platformIndex,
}: {
  rows: InvoiceDocumentRow[];
  currency: string;
  branchTableId: string;
  platformIndex: number;
}) {
  if (rows.length === 0) return null;

  return (
    <>
      {rows.map((row, rowIndex) => (
        <tr key={`${branchTableId}-p${platformIndex}-r${rowIndex}`}>
          {/* Branch column: shown only on first row of the branch (showBranch flag) */}
          <td
            style={{
              ...bodyCell,
              fontWeight: 600,
              borderTopColor: row.showBranch ? DOC_BLACK : 'transparent',
            }}
          >
            {row.showBranch ? row.branch || '—' : ''}
          </td>

          {/* Platform column: shown only on first row of each platform (showPlatform flag) */}
          <td
            style={{
              ...bodyCell,
              borderTopColor: row.showPlatform ? DOC_BLACK : 'transparent',
            }}
          >
            {row.showPlatform ? row.platform || '—' : ''}
          </td>

          <td style={bodyCell}>{row.ad_name || '—'}</td>
          <td style={{ ...bodyCell, whiteSpace: 'nowrap' }}>{row.date || '—'}</td>
          <td style={bodyCell}>{row.results || '—'}</td>
          <td style={{ ...bodyCell, textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>
            {fmt(row.cost, currency)}
          </td>
        </tr>
      ))}
    </>
  );
}
