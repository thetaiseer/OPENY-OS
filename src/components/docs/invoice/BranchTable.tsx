import type { CSSProperties } from 'react';
import type { InvoiceDocumentBranchTable } from '@/lib/docs-invoice-document-model';
import { OPENY_DOC_BLACK } from '@/lib/openy-brand';

const DOC_BLACK = OPENY_DOC_BLACK;
const ROWS_PER_PAGE_CHUNK = 12;

const th: CSSProperties = {
  border: `1px solid ${DOC_BLACK}`,
  borderRight: '1px solid #fff',
  borderBottom: '2px solid #fff',
  padding: '10px 10px',
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: 0.6,
  textTransform: 'uppercase',
  textAlign: 'center',
  verticalAlign: 'middle',
  lineHeight: 1.25,
  whiteSpace: 'nowrap',
};

const td: CSSProperties = {
  border: `1px solid ${DOC_BLACK}`,
  padding: '8px 10px',
  fontSize: 11,
  textAlign: 'center',
  verticalAlign: 'middle',
  background: 'var(--accent-foreground)',
  lineHeight: 1.35,
  whiteSpace: 'nowrap',
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
  const rowChunks =
    rows.length > 0
      ? Array.from({ length: Math.ceil(rows.length / ROWS_PER_PAGE_CHUNK) }, (_, idx) =>
          rows.slice(idx * ROWS_PER_PAGE_CHUNK, (idx + 1) * ROWS_PER_PAGE_CHUNK),
        )
      : [[]];

  return (
    <div style={{ marginBottom: 16 }}>
      {rowChunks.map((chunk, chunkIndex) => {
        const isLastChunk = chunkIndex === rowChunks.length - 1;
        return (
          <div key={`${branchTable.id}-chunk-${chunkIndex}`} className="avoid-break">
            {chunkIndex > 0 ? <div className="html2pdf__page-break" /> : null}
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
              <thead>
                {/* Branch name — full-width black header spanning all columns */}
                <tr style={{ background: DOC_BLACK, color: 'var(--accent-foreground)' }}>
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
                      verticalAlign: 'middle',
                      borderBottom: '2px solid #fff',
                      lineHeight: 1.35,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {branchTable.branchName}
                  </th>
                </tr>

                {/* Column headers */}
                <tr style={{ background: DOC_BLACK, color: 'var(--accent-foreground)' }}>
                  {(['BRANCH', 'PLATFORM', 'AD NAME', 'DATE', 'RESULTS'] as const).map((col) => (
                    <th key={col} style={th}>
                      {col}
                    </th>
                  ))}
                  <th
                    style={{
                      ...th,
                      borderRight: `1px solid ${DOC_BLACK}`,
                    }}
                  >
                    COST ({currency})
                  </th>
                </tr>
              </thead>

              <tbody>
                {chunk.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ ...td, color: '#666', verticalAlign: 'middle' }}>
                      No campaign data.
                    </td>
                  </tr>
                ) : (
                  chunk.map((row, rowIndex) => (
                    <tr
                      key={`${branchTable.id}-c${chunkIndex}-r${rowIndex}`}
                      style={{ pageBreakInside: 'avoid' }}
                    >
                      <td
                        style={{
                          ...td,
                          fontWeight: 600,
                          verticalAlign: 'middle',
                        }}
                      >
                        {row.branch || branchTable.branchName}
                      </td>
                      <td style={{ ...td, verticalAlign: 'middle' }}>{row.platform || '—'}</td>

                      <td style={{ ...td, verticalAlign: 'middle' }}>{row.ad_name || '—'}</td>
                      <td style={{ ...td, verticalAlign: 'middle' }}>{row.date || '—'}</td>
                      <td style={{ ...td, verticalAlign: 'middle' }}>{row.results || '—'}</td>
                      <td
                        style={{
                          ...td,
                          fontWeight: 600,
                          verticalAlign: 'middle',
                        }}
                      >
                        {fmt(row.cost, currency)}
                      </td>
                    </tr>
                  ))
                )}

                {/* Branch subtotal */}
                {isLastChunk ? (
                  <tr>
                    <td
                      colSpan={5}
                      style={{
                        ...td,
                        background: 'var(--border)',
                        fontWeight: 700,
                        verticalAlign: 'middle',
                      }}
                    >
                      {branchTable.branchName} Total
                    </td>
                    <td
                      style={{
                        ...td,
                        background: 'var(--border)',
                        fontWeight: 700,
                        verticalAlign: 'middle',
                      }}
                    >
                      {fmt(branchTable.subtotal, currency)}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
