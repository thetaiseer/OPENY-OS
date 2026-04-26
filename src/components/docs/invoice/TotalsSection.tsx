import type { CSSProperties } from 'react';
import type { InvoiceDocumentModel } from '@/lib/docs-invoice-document-model';
import { OPENY_DOC_BLACK } from '@/lib/openy-brand';

const DOC_BLACK = OPENY_DOC_BLACK;

const labelCell: CSSProperties = {
  border: `1px solid ${DOC_BLACK}`,
  borderRight: '1px solid #fff',
  padding: '10px 12px',
  fontWeight: 700,
  fontSize: 11,
  textAlign: 'right',
  background: '#fff',
  width: '60%',
  verticalAlign: 'middle',
  lineHeight: 1.35,
  wordBreak: 'break-word',
  overflowWrap: 'break-word',
};

const valueCell: CSSProperties = {
  border: `1px solid ${DOC_BLACK}`,
  padding: '10px 12px',
  fontWeight: 700,
  fontSize: 11,
  textAlign: 'center',
  background: '#fff',
  overflowWrap: 'anywhere',
  width: '40%',
  verticalAlign: 'middle',
  lineHeight: 1.35,
};

function fmt(v: number, cur: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: cur,
    minimumFractionDigits: 2,
  }).format(v || 0);
}

/**
 * Renders the right-aligned totals table: Final Budget, Our Fees, Grand Total.
 */
export default function TotalsSection({
  totals,
  currency,
}: {
  totals: InvoiceDocumentModel['totals'];
  currency: string;
}) {
  return (
    <div
      className="avoid-break"
      style={{
        pageBreakInside: 'avoid',
        display: 'flex',
        justifyContent: 'flex-end',
        marginTop: 16,
      }}
    >
      <table style={{ width: 300, borderCollapse: 'collapse' }}>
        <tbody>
          <tr>
            <td style={labelCell}>Final Budget (Ad Spend)</td>
            <td style={{ ...valueCell, whiteSpace: 'nowrap' }}>
              {fmt(totals.finalBudget, currency)}
            </td>
          </tr>
          <tr>
            <td style={labelCell}>Our Fees</td>
            <td style={{ ...valueCell, whiteSpace: 'nowrap' }}>{fmt(totals.ourFees, currency)}</td>
          </tr>
          <tr>
            <td
              style={{
                ...labelCell,
                borderRight: `1px solid ${DOC_BLACK}`,
                fontWeight: 900,
                background: DOC_BLACK,
                color: '#fff',
                textAlign: 'center',
                fontSize: 12,
                letterSpacing: 1.2,
                textTransform: 'uppercase',
                verticalAlign: 'middle',
              }}
            >
              Grand Total
            </td>
            <td
              style={{
                ...valueCell,
                fontWeight: 900,
                background: DOC_BLACK,
                color: '#fff',
                fontSize: 12,
                verticalAlign: 'middle',
              }}
            >
              {fmt(totals.grandTotal, currency)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
