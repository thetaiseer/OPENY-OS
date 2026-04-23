'use client';

import {
  OpenyDocumentPage,
  OpenyDocumentHeader,
  OpenyClientBlock,
} from '@/components/docs/DocumentDesign';
import type { InvoiceDocumentModel } from '@/lib/docs-invoice-document-model';
import BranchTable from './BranchTable';
import TotalsSection from './TotalsSection';

/**
 * Branch names that trigger a PDF page-break before them (for multi-branch invoices).
 * Matches the OPENY-DOCS reference behaviour.
 */
const PAGE_BREAK_BRANCHES = ['jeddah', 'khobar'];

function shouldBreakBeforeBranch(index: number, branchName: string): boolean {
  if (index <= 0) return false;
  const normalized = branchName.trim().toLowerCase();
  return PAGE_BREAK_BRANCHES.some((b) => normalized.includes(b));
}

/**
 * Full live invoice preview.
 *
 * Takes the computed `InvoiceDocumentModel` (built from form state via
 * `buildInvoiceDocumentModel`) and renders an A4-sized document preview.
 *
 * Structure:
 *   OpenyDocumentPage (A4 white canvas)
 *   └─ OpenyDocumentHeader  — logo | INVOICE | REF + DATE
 *   └─ OpenyClientBlock     — BILLED TO + campaign month
 *   └─ BranchTable × N      — per-branch rows via PlatformBlock
 *   └─ TotalsSection        — Final Budget | Our Fees | GRAND TOTAL
 *   └─ Notes                — optional free-text
 */
export default function InvoicePreview({ model }: { model: InvoiceDocumentModel }) {
  return (
    <OpenyDocumentPage id="invoice-preview">
      <OpenyDocumentHeader title="INVOICE" number={model.invoiceNumber} date={model.invoiceDate} />

      <OpenyClientBlock
        label="BILLED TO"
        name={model.clientName}
        subtext={model.campaignMonth ? `Campaign Month: ${model.campaignMonth}` : undefined}
      />

      {model.branchTables.map((branchTable, branchIndex) => (
        <div key={branchTable.id}>
          {shouldBreakBeforeBranch(branchIndex, branchTable.branchName) && (
            <div className="html2pdf__page-break" />
          )}
          <BranchTable branchTable={branchTable} currency={model.currency} />
        </div>
      ))}

      <TotalsSection totals={model.totals} currency={model.currency} />

      {model.notes.trim() && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 4 }}>NOTES</div>
          <div style={{ fontSize: 11 }}>{model.notes}</div>
        </div>
      )}
    </OpenyDocumentPage>
  );
}
