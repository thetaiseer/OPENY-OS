import type { CSSProperties } from 'react';
import type { InvoiceDocumentModel } from '@/lib/docs-invoice-document-model';
import { OPENY_DOC_BLACK } from '@/lib/openy-brand';

const DOC_BLACK = OPENY_DOC_BLACK;

const labelCell: CSSProperties = {
  border: `1px solid ${DOC_BLACK}`,
  padding: '8px 10px',
  fontWeight: 700,
  textAlign: 'left',
};

const valueCell: CSSProperties = {
  border: `1px solid ${DOC_BLACK}`,
  padding: '8px 10px',
  fontWeight: 700,
  textAlign: 'right',
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
      style={{ pageBreakInside: 'avoid', display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}
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
            <td style={{ ...valueCell, whiteSpace: 'nowrap' }}>
              {fmt(totals.ourFees, currency)}
            </td>
          </tr>
          <tr>
            <td
              style={{
                ...labelCell,
                fontWeight: 900,
                background: DOC_BLACK,
                color: '#fff',
                textAlign: 'center',
                fontSize: 12,
              }}
            >
              GRAND TOTAL
            </td>
            <td
              style={{
                ...valueCell,
                fontWeight: 900,
                background: DOC_BLACK,
                color: '#fff',
                textAlign: 'center',
                fontSize: 12,
                whiteSpace: 'nowrap',
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
