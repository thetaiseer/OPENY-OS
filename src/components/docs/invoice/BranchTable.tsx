import type { CSSProperties } from 'react';
import type { InvoiceDocumentBranchTable, InvoiceDocumentRow } from '@/lib/docs-invoice-document-model';
import { OPENY_DOC_BLACK } from '@/lib/openy-brand';
import PlatformBlock from './PlatformBlock';

const DOC_BLACK = OPENY_DOC_BLACK;

const headerCell: CSSProperties = {
  border: `1px solid ${DOC_BLACK}`,
  borderRight: '1px solid #fff',
  padding: 12,
  textAlign: 'left',
  fontSize: 10,
  letterSpacing: 1.2,
  fontWeight: 800,
  textTransform: 'uppercase',
};

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

/** Split flat model rows into per-platform groups using the showPlatform flag. */
function groupByPlatform(rows: InvoiceDocumentRow[]): InvoiceDocumentRow[][] {
  const groups: InvoiceDocumentRow[][] = [];
  for (const row of rows) {
    if (row.showPlatform || groups.length === 0) {
      groups.push([row]);
    } else {
      groups[groups.length - 1]!.push(row);
    }
  }
  return groups;
}

/**
 * Renders one branch section: a black header bar followed by a table of
 * campaign rows grouped by platform via PlatformBlock.
 */
export default function BranchTable({
  branchTable,
  currency,
}: {
  branchTable: InvoiceDocumentBranchTable;
  currency: string;
}) {
  const platformGroups = groupByPlatform(branchTable.rows);

  return (
    <div style={{ marginBottom: 16 }}>
      {/* Branch header bar */}
      <div
        style={{
          background: DOC_BLACK,
          color: '#fff',
          fontWeight: 700,
          fontSize: 12,
          padding: '6px 10px',
        }}
      >
        {branchTable.branchName || 'Branch'}
      </div>

      {/* Campaign rows table */}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: DOC_BLACK, color: '#fff' }}>
            <th style={headerCell}>BRANCH</th>
            <th style={headerCell}>PLATFORM</th>
            <th style={headerCell}>AD NAME</th>
            <th style={headerCell}>DATE</th>
            <th style={headerCell}>RESULTS</th>
            <th style={{ ...headerCell, textAlign: 'right' }}>COST ({currency})</th>
          </tr>
        </thead>
        <tbody>
          {platformGroups.length === 0 ? (
            /* Empty state row */
            <tr>
              <td style={bodyCell}>{branchTable.branchName}</td>
              <td style={bodyCell}>—</td>
              <td style={bodyCell}>—</td>
              <td style={bodyCell}>—</td>
              <td style={bodyCell}>—</td>
              <td style={{ ...bodyCell, textAlign: 'right' }}>{fmt(0, currency)}</td>
            </tr>
          ) : (
            platformGroups.map((rows, platformIndex) => (
              <PlatformBlock
                key={`${branchTable.id}-platform-${platformIndex}`}
                rows={rows}
                currency={currency}
                branchTableId={branchTable.id}
                platformIndex={platformIndex}
              />
            ))
          )}

          {/* Branch subtotal row */}
          <tr>
            <td
              colSpan={5}
              style={{
                ...bodyCell,
                background: '#E5E7EB',
                textAlign: 'right',
                fontWeight: 700,
              }}
            >
              Subtotal ({branchTable.branchName || 'Branch'})
            </td>
            <td
              style={{
                ...bodyCell,
                background: '#E5E7EB',
                textAlign: 'right',
                fontWeight: 700,
                whiteSpace: 'nowrap',
              }}
            >
              {fmt(branchTable.subtotal, currency)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
