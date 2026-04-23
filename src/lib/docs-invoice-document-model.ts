import type { InvoiceBranchGroup } from '@/lib/docs-types';

export const INVOICE_ADDRESS = 'Villa 175, First District, Fifth Settlement';
export const INVOICE_EMAIL = 'info@openytalk.com';
export const INVOICE_WEBSITE = 'openytalk.com';

function n(v: unknown) {
  const parsed = Number(v);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round2(v: number) {
  return Math.round(v * 100) / 100;
}

export interface InvoiceDocumentModelInput {
  invoice_number?: string | null;
  client_name?: string | null;
  campaign_month?: string | null;
  invoice_date?: string | null;
  currency?: string | null;
  our_fees?: number | null;
  notes?: string | null;
  branch_groups?: InvoiceBranchGroup[] | null;
}

export interface InvoiceDocumentRow {
  branch: string;
  platform: string;
  ad_name: string;
  date: string;
  results: string;
  cost: number;
  showPlatform: boolean;
  showBranch: boolean;
  platformSpan: number;
}

export interface InvoiceDocumentBranchTable {
  id: string;
  branchName: string;
  rows: InvoiceDocumentRow[];
  subtotal: number;
}

export interface InvoiceDocumentModel {
  invoiceNumber: string;
  clientName: string;
  campaignMonth: string;
  invoiceDate: string;
  currency: string;
  notes: string;
  address: string;
  email: string;
  branchTables: InvoiceDocumentBranchTable[];
  totals: {
    finalBudget: number;
    ourFees: number;
    grandTotal: number;
  };
}

export function buildInvoiceDocumentModel(
  formState: InvoiceDocumentModelInput,
): InvoiceDocumentModel {
  const branchGroups = Array.isArray(formState.branch_groups) ? formState.branch_groups : [];

  const branchTables: InvoiceDocumentBranchTable[] = branchGroups.map((branch) => {
    const branchRows = branch.platform_groups.flatMap((platform) => {
      const rows = platform.campaign_rows.length
        ? platform.campaign_rows
        : [{ id: 'empty', ad_name: '', date: '', results: '', cost: 0 }];
      return rows.map((row, rowIndex) => ({
        branch: branch.branch_name || '',
        platform: platform.platform_name || '',
        ad_name: row.ad_name || '',
        date: row.date || '',
        results: row.results || '',
        cost: round2(n(row.cost)),
        showPlatform: rowIndex === 0,
        showBranch: false,
        platformSpan: rows.length,
      }));
    });

    if (branchRows[0]) branchRows[0].showBranch = true;

    const subtotal = round2(branchRows.reduce((sum, row) => sum + n(row.cost), 0));
    return {
      id: branch.id,
      branchName: branch.branch_name || 'Branch',
      rows: branchRows,
      subtotal,
    };
  });

  const finalBudget = round2(branchTables.reduce((sum, branch) => sum + branch.subtotal, 0));
  const ourFees = round2(n(formState.our_fees));
  const grandTotal = round2(finalBudget + ourFees);

  return {
    invoiceNumber: formState.invoice_number?.trim() || 'INV-0001',
    clientName: formState.client_name?.trim() || '',
    campaignMonth: formState.campaign_month?.trim() || '',
    invoiceDate: formState.invoice_date?.trim() || '',
    currency: formState.currency?.trim() || 'EGP',
    notes: formState.notes?.trim() || '',
    address: INVOICE_ADDRESS,
    email: INVOICE_EMAIL,
    branchTables,
    totals: {
      finalBudget,
      ourFees,
      grandTotal,
    },
  };
}
