import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';

interface Params { id: string }

export async function GET(_: NextRequest, { params }: { params: Promise<Params> }) {
  const { id } = await params;
  const db = getServiceClient();
  const { data, error } = await db.from('docs_invoices').select('*').eq('id', id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data)  return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const inv = data as Record<string, unknown> & {
    invoice_number: string;
    client_name:    string;
    invoice_date:   string | null;
    campaign_month: string | null;
    currency:       string;
    total_budget:   number;
    status:         string;
    notes:          string | null;
    deliverables:   Array<{ description: string; quantity: number; unitPrice: number; total: number }>;
    platforms:      Array<{ label: string; enabled: boolean; count: number; budgetPct: number }>;
  };

  const rows: string[][] = [
    ['Invoice No', 'Client', 'Date', 'Month', 'Currency', 'Total Budget', 'Status'],
    [
      inv.invoice_number, inv.client_name,
      inv.invoice_date ?? '', inv.campaign_month ?? '',
      inv.currency, String(inv.total_budget), inv.status,
    ],
    [],
    ['Deliverables'],
    ['Description', 'Qty', 'Unit Price', 'Total'],
    ...(inv.deliverables ?? []).map(d => [
      d.description, String(d.quantity), String(d.unitPrice), String(d.total),
    ]),
    [],
    ['Platform Allocation'],
    ['Platform', 'Campaigns', 'Allocation %', 'Budget'],
    ...(inv.platforms ?? []).filter(p => p.enabled).map(p => [
      p.label, String(p.count), `${p.budgetPct}%`,
      String(Math.round(inv.total_budget * p.budgetPct / 100 * 100) / 100),
    ]),
  ];
  if (inv.notes) rows.push([], ['Notes'], [inv.notes]);

  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${inv.invoice_number}.csv"`,
    },
  });
}
