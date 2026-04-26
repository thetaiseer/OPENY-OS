import type { CSSProperties } from 'react';
import type { InvoiceDocumentBranchTable } from '@/lib/docs-invoice-document-model';
import { OPENY_DOC_BLACK } from '@/lib/openy-brand';

const DOC_BLACK = OPENY_DOC_BLACK;

const th: CSSProperties = {
  border: `1px solid ${DOC_BLACK}`,
  borderRight: '1px solid #fff',
  padding: '10px 12px',
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: 1.2,
  textTransform: 'uppercase',
  textAlign: 'left',
};

const td: CSSProperties = {
  border: `1px solid ${DOC_BLACK}`,
  padding: '6px 8px',
  fontSize: 11,
  verticalAlign: 'middle',
  background: '#fff',
};

function fmt(v: number, cur: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: cur,
    minimumFractionDigits: 2,
  }).format(v || 0);
}

/**
 * Renders one branch section exactly matching the OPENY-DOCS invoice layout:
 *  - Full-width black branch-name header row (colspan 6) inside <thead>
 *  - Column headers row (Branch / Platform / Ad Name / Date / Results / Cost)
 *  - Campaign rows with proper rowSpan for the branch cell and platform cell
 *  - Grey subtotal row at the bottom
 */
export default function BranchTable({
  branchTable,
  currency,
}: {
  branchTable: InvoiceDocumentBranchTable;
  currency: string;
}) {
  const rows = branchTable.rows;
  const totalRows = rows.length;

  return (
    <div style={{ marginBottom: 16 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: '12%' }} />
          <col style={{ width: '13%' }} />
          <col style={{ width: '33%' }} />
          <col style={{ width: '12%' }} />
          <col style={{ width: '14%' }} />
          <col style={{ width: '16%' }} />
        </colgroup>

        <thead>
          {/* Branch name — full-width black header spanning all columns */}
          <tr style={{ background: DOC_BLACK, color: '#fff' }}>
            <th
              colSpan={6}
              style={{
                border: `1px solid ${DOC_BLACK}`,
                padding: '10px 12px',
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: 1.2,
                textTransform: 'uppercase',
                textAlign: 'center',
              }}
            >
              {branchTable.branchName}
            </th>
          </tr>

          {/* Column headers */}
          <tr style={{ background: DOC_BLACK, color: '#fff' }}>
            {(['BRANCH', 'PLATFORM', 'AD NAME', 'DATE', 'RESULTS'] as const).map((col) => (
              <th key={col} style={th}>
                {col}
              </th>
            ))}
            <th
              style={{
                ...th,
                borderRight: `1px solid ${DOC_BLACK}`,
                textAlign: 'right',
              }}
            >
              COST ({currency})
            </th>
          </tr>
        </thead>

        <tbody>
          {totalRows === 0 ? (
            <tr>
              <td colSpan={6} style={{ ...td, textAlign: 'center', color: '#666' }}>
                No campaign data.
              </td>
            </tr>
          ) : (
            rows.map((row, rowIndex) => (
              <tr key={`${branchTable.id}-r${rowIndex}`} style={{ pageBreakInside: 'avoid' }}>
                {/* Branch cell — rowSpan covers all rows in this branch */}
                {rowIndex === 0 && (
                  <td rowSpan={totalRows} style={{ ...td, textAlign: 'center', fontWeight: 600 }}>
                    {row.branch || branchTable.branchName}
                  </td>
                )}

                {/* Platform cell — rowSpan covers all rows for this platform */}
                {row.showPlatform && (
                  <td rowSpan={row.platformSpan} style={{ ...td, textAlign: 'center' }}>
                    {row.platform || '—'}
                  </td>
                )}

                <td style={td}>{row.ad_name || '—'}</td>
                <td style={{ ...td, overflowWrap: 'anywhere' }}>{row.date || '—'}</td>
                <td style={td}>{row.results || '—'}</td>
                <td
                  style={{
                    ...td,
                    textAlign: 'right',
                    fontWeight: 600,
                    overflowWrap: 'anywhere',
                  }}
                >
                  {fmt(row.cost, currency)}
                </td>
              </tr>
            ))
          )}

          {/* Branch subtotal */}
          <tr>
            <td
              colSpan={5}
              style={{
                ...td,
                background: '#E5E7EB',
                fontWeight: 700,
                textAlign: 'right',
              }}
            >
              {branchTable.branchName} Total
            </td>
            <td
              style={{
                ...td,
                background: '#E5E7EB',
                fontWeight: 700,
                textAlign: 'right',
                overflowWrap: 'anywhere',
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
