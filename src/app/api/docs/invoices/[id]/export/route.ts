import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { hydrateInvoiceBranchGroups, mapInvoiceDbError } from '@/lib/docs-invoices-db';

interface Params { id: string }

type BranchGroup = {
  branch_name?: string;
  platform_groups?: Array<{
    platform_name?: string;
    campaign_rows?: Array<{
      ad_name?: string;
      date?: string;
      results?: string;
      cost?: number;
    }>;
  }>;
};

export async function GET(_: NextRequest, { params }: { params: Promise<Params> }) {
  const { id } = await params;
  const db = getServiceClient();
  const { data, error } = await db.schema('public').from('docs_invoices').select('*').eq('id', id).maybeSingle();
  if (error) {
    return NextResponse.json(
      { error: mapInvoiceDbError(error, 'Unable to export invoice right now.') },
      { status: 500 },
    );
  }
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let invoiceData: { id: string; branch_groups?: unknown } | Record<string, unknown> = data as { id: string; branch_groups?: unknown };
  try {
    const [hydrated] = await hydrateInvoiceBranchGroups(db, [data as { id: string; branch_groups?: unknown }]);
    if (hydrated) invoiceData = hydrated;
  } catch (nestedError) {
    return NextResponse.json(
      { error: mapInvoiceDbError(nestedError as { code?: string; message?: string }, 'Unable to export invoice details right now.') },
      { status: 500 },
    );
  }

  const inv = invoiceData as Record<string, unknown> & {
    invoice_number: string;
    client_name: string;
    invoice_date: string | null;
    campaign_month: string | null;
    currency: string;
    status: string;
    total_budget?: number;
    final_budget?: number;
    our_fees?: number;
    grand_total?: number;
    branch_groups?: BranchGroup[];
    platforms?: Array<{ label: string; enabled: boolean; budgetPct: number }>;
  };

  const branchGroups = Array.isArray(inv.branch_groups) ? inv.branch_groups : [];
  const computedFromGroups = branchGroups.reduce((branchSum, branch) => (
    branchSum + (branch.platform_groups ?? []).reduce((platformSum, platform) => (
      platformSum + (platform.campaign_rows ?? []).reduce((rowSum, row) => rowSum + Number(row.cost ?? 0), 0)
    ), 0)
  ), 0);
  const finalBudget = Number(
    inv.final_budget
      ?? (branchGroups.length > 0 ? computedFromGroups : (inv.total_budget ?? 0)),
  );
  const ourFees = Number(inv.our_fees ?? 0);
  const grandTotal = Number(inv.grand_total ?? (finalBudget + ourFees));

  const rows: string[][] = [
    ['Invoice No', 'Client', 'Date', 'Month', 'Currency', 'Final Budget', 'Our Fees', 'Grand Total', 'Status'],
    [
      inv.invoice_number,
      inv.client_name,
      inv.invoice_date ?? '',
      inv.campaign_month ?? '',
      inv.currency,
      String(finalBudget),
      String(ourFees),
      String(grandTotal),
      inv.status,
    ],
    [],
    ['Branch', 'Platform', 'Ad Name', 'Date', 'Results', 'Cost'],
  ];

  if (branchGroups.length > 0) {
    branchGroups.forEach((branch) => {
      const branchName = branch.branch_name ?? '';
      let branchSubtotal = 0;
      (branch.platform_groups ?? []).forEach((platform) => {
        const platformName = platform.platform_name ?? '';
        (platform.campaign_rows ?? []).forEach((row) => {
          const cost = Number(row.cost ?? 0);
          branchSubtotal += cost;
          rows.push([
            branchName,
            platformName,
            row.ad_name ?? '',
            row.date ?? '',
            row.results ?? '',
            String(cost),
          ]);
        });
      });
      rows.push([`${branchName} Subtotal`, '', '', '', '', String(branchSubtotal)]);
    });
  } else {
    (inv.platforms ?? []).filter(p => p.enabled).forEach((platform) => {
      rows.push([
        'Main Branch',
        platform.label,
        `${platform.label} Campaign`,
        inv.invoice_date ?? '',
        '',
        String(Math.round(finalBudget * (Number(platform.budgetPct ?? 0) / 100) * 100) / 100),
      ]);
    });
  }

  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${inv.invoice_number}.csv"`,
    },
  });
}
