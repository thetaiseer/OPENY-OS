import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';

export async function GET(req: NextRequest) {
  const { getApiUser } = await import('@/lib/api-auth');
  const auth = await getApiUser(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month_key = searchParams.get('month_key') ?? new Date().toISOString().slice(0, 7).replace('-', '');

  const db = getServiceClient();
  const [{ data: entriesData }, { data: expensesData }] = await Promise.all([
    db.from('docs_accounting_entries').select('*').eq('month_key', month_key).order('entry_date'),
    db.from('docs_accounting_expenses').select('*').eq('month_key', month_key).order('expense_date'),
  ]);

  const entries = (entriesData ?? []) as Array<{
    client_name: string; service: string | null; amount: number;
    currency: string; collection_type: string; collector: string | null;
    entry_date: string; notes: string | null;
  }>;
  const expenses = (expensesData ?? []) as Array<{
    description: string; amount: number; currency: string;
    expense_date: string; notes: string | null;
  }>;

  const totalRevenue  = entries.reduce((s, e) => s + e.amount, 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

  const rows: string[][] = [
    [`Accounting Report — ${month_key}`, '', '', '', '', '', ''],
    [],
    ['REVENUE ENTRIES'],
    ['Client', 'Service', 'Amount', 'Currency', 'Collection Type', 'Collector', 'Date', 'Notes'],
    ...entries.map(e => [
      e.client_name, e.service ?? '', String(e.amount), e.currency,
      e.collection_type, e.collector ?? '', e.entry_date, e.notes ?? '',
    ]),
    [],
    ['EXPENSES'],
    ['Description', 'Amount', 'Currency', 'Date', 'Notes'],
    ...expenses.map(e => [e.description, String(e.amount), e.currency, e.expense_date, e.notes ?? '']),
    [],
    ['SUMMARY'],
    ['Total Revenue', String(totalRevenue)],
    ['Total Expenses', String(totalExpenses)],
    ['Net Result', String(totalRevenue - totalExpenses)],
  ];

  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="accounting-${month_key}.csv"`,
    },
  });
}
