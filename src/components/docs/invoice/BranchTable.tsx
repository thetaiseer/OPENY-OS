import type { CSSProperties, ReactNode } from 'react';
import type { InvoiceDocumentBranchTable } from '@/lib/docs-invoice-document-model';
import { OPENY_DOC_BLACK } from '@/lib/openy-brand';

const DOC_BLACK = OPENY_DOC_BLACK;
const ROWS_PER_PAGE_CHUNK = 999;
const GRID_LINE = '#c7c7c7';
const SUBTOTAL_BG = '#f1f1f1';

const th: CSSProperties = {
  border: `1px solid ${GRID_LINE}`,
  padding: 0,
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: 0.6,
  textTransform: 'uppercase',
  textAlign: 'center',
  verticalAlign: 'middle',
  lineHeight: 1.15,
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
  wordBreak: 'normal',
};

const td: CSSProperties = {
  border: `1px solid ${GRID_LINE}`,
  padding: 0,
  fontSize: 11,
  textAlign: 'center',
  verticalAlign: 'middle',
  background: 'var(--accent-foreground)',
  lineHeight: 1.2,
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
  wordBreak: 'normal',
};

const cellBox: CSSProperties = {
  boxSizing: 'border-box',
  display: 'table',
  minHeight: 34,
  width: '100%',
  padding: '7px 8px',
  textAlign: 'center',
  lineHeight: 1.15,
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
  wordBreak: 'normal',
};

const cellText: CSSProperties = {
  display: 'table-cell',
  maxWidth: '100%',
  textAlign: 'center',
  verticalAlign: 'middle',
};

function fmt(v: number, cur: string) {
  return `${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v || 0)} ${cur}`;
}

function formatInvoiceDate(value: string) {
  if (!value) return '—';
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date
    .toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    })
    .replace(/ /g, '-');
}

function CellContent({
  children,
  strong = false,
  compact = false,
}: {
  children: ReactNode;
  strong?: boolean;
  compact?: boolean;
}) {
  return (
    <div
      style={{
        ...cellBox,
        minHeight: compact ? 30 : cellBox.minHeight,
        padding: compact ? '6px 6px' : cellBox.padding,
        fontWeight: strong ? 700 : undefined,
      }}
    >
      <span style={cellText}>{children}</span>
    </div>
  );
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
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                tableLayout: 'fixed',
                border: `1px solid ${GRID_LINE}`,
              }}
            >
              <colgroup>
                <col style={{ width: '12%' }} />
                <col style={{ width: '13%' }} />
                <col style={{ width: '32%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '17%' }} />
              </colgroup>
              <thead>
                {/* Branch name — full-width black header spanning all columns */}
                <tr style={{ background: DOC_BLACK, color: 'var(--accent-foreground)' }}>
                  <th
                    colSpan={6}
                    style={{
                      border: `1px solid ${DOC_BLACK}`,
                      padding: 0,
                      fontSize: 11,
                      fontWeight: 800,
                      letterSpacing: 1.2,
                      textTransform: 'uppercase',
                      textAlign: 'center',
                      verticalAlign: 'middle',
                      borderBottom: `1px solid ${GRID_LINE}`,
                      lineHeight: 1.15,
                      whiteSpace: 'normal',
                      overflowWrap: 'anywhere',
                      wordBreak: 'normal',
                    }}
                  >
                    <CellContent strong>{branchTable.branchName} Branch</CellContent>
                  </th>
                </tr>

                {/* Column headers */}
                <tr style={{ background: DOC_BLACK, color: 'var(--accent-foreground)' }}>
                  {(['BRANCH', 'PLATFORM', 'AD NAME', 'DATE', 'RESULTS'] as const).map((col) => (
                    <th key={col} style={th}>
                      <CellContent strong compact>
                        {col}
                      </CellContent>
                    </th>
                  ))}
                  <th
                    style={{
                      ...th,
                    }}
                  >
                    <CellContent strong compact>
                      COST ({currency})
                    </CellContent>
                  </th>
                </tr>
              </thead>

              <tbody>
                {chunk.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ ...td, color: '#666', verticalAlign: 'middle' }}>
                      <CellContent>No campaign data.</CellContent>
                    </td>
                  </tr>
                ) : (
                  chunk.map((row, rowIndex) => (
                    <tr
                      key={`${branchTable.id}-c${chunkIndex}-r${rowIndex}`}
                      style={{ pageBreakInside: 'avoid' }}
                    >
                      {row.showBranch ? (
                        <td
                          rowSpan={rows.length}
                          style={{
                            ...td,
                            fontWeight: 600,
                            verticalAlign: 'middle',
                          }}
                        >
                          <CellContent strong>{row.branch || branchTable.branchName}</CellContent>
                        </td>
                      ) : null}
                      {row.showPlatform ? (
                        <td rowSpan={row.platformSpan} style={{ ...td, verticalAlign: 'middle' }}>
                          <CellContent>{row.platform || '—'}</CellContent>
                        </td>
                      ) : null}

                      <td style={{ ...td, verticalAlign: 'middle' }}>
                        <CellContent>{row.ad_name || '—'}</CellContent>
                      </td>
                      <td style={{ ...td, verticalAlign: 'middle' }}>
                        <CellContent compact>{formatInvoiceDate(row.date)}</CellContent>
                      </td>
                      <td style={{ ...td, verticalAlign: 'middle' }}>
                        <CellContent>{row.results || '—'}</CellContent>
                      </td>
                      <td
                        style={{
                          ...td,
                          fontWeight: 600,
                          verticalAlign: 'middle',
                        }}
                      >
                        <CellContent strong>{fmt(row.cost, currency)}</CellContent>
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
                        background: SUBTOTAL_BG,
                        fontWeight: 700,
                        verticalAlign: 'middle',
                      }}
                    >
                      <CellContent strong>{branchTable.branchName} Branch Total</CellContent>
                    </td>
                    <td
                      style={{
                        ...td,
                        background: SUBTOTAL_BG,
                        fontWeight: 700,
                        verticalAlign: 'middle',
                      }}
                    >
                      <CellContent strong>{fmt(branchTable.subtotal, currency)}</CellContent>
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
