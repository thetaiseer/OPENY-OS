import { NextRequest, NextResponse } from 'next/server';
import { Workbook } from 'exceljs';
import { getServiceClient } from '@/lib/supabase/service-client';
import { sanitizeDocCode } from '@/lib/docs-client-profiles';
import { ACCOUNTING_COLLECTORS } from '@/lib/docs-types';
import { computeAccountingSettlement } from '@/lib/accounting-settlement';
import { buildStoragePath, uploadFile } from '@/lib/storage';
import { saveStoredFileMetadata } from '@/lib/storage/metadata';
import { requireModulePermission } from '@/lib/api-auth';

function num(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function monthLabel(monthKey: string) {
  if (monthKey.length !== 6) return monthKey;
  const y = monthKey.slice(0, 4);
  const m = monthKey.slice(4, 6);
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

export async function GET(req: NextRequest) {
  const auth = await requireModulePermission(req, 'docs', 'accounting', 'read');
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const month_key =
    searchParams.get('month_key') ?? new Date().toISOString().slice(0, 7).replace('-', '');
  const documentCode = (searchParams.get('document_code') ?? '').trim();

  const db = getServiceClient();
  const [entriesRes, expensesRes, transfersRes, metaRes] = await Promise.all([
    db.from('docs_accounting_entries').select('*').eq('month_key', month_key).order('entry_date'),
    db
      .from('docs_accounting_expenses')
      .select('*')
      .eq('month_key', month_key)
      .order('expense_date'),
    db
      .from('docs_accounting_transfers')
      .select('*')
      .eq('month_key', month_key)
      .order('transfer_date'),
    db.from('docs_accounting_month_meta').select('*').eq('month_key', month_key).maybeSingle(),
  ]);

  const entries = (entriesRes.data ?? []) as Array<{
    client_name: string;
    service: string | null;
    amount: number;
    currency: string;
    collector: string | null;
    entry_date: string;
    notes: string | null;
  }>;
  const expenses = (expensesRes.data ?? []) as Array<{
    description: string;
    amount: number;
    currency: string;
    expense_date: string;
    paid_by_partner: string | null;
    notes: string | null;
  }>;
  const transfers = (transfersRes.data ?? []) as Array<{
    from_partner: string;
    to_partner: string;
    amount: number;
    currency: string;
    transfer_date: string;
    notes: string | null;
  }>;
  const monthNotes = (metaRes.data as { notes?: string } | null)?.notes ?? '';

  const settlement = computeAccountingSettlement({
    entries: entries.map((e) => ({ amount: e.amount, collector: e.collector })),
    expenses: expenses.map((x) => ({
      amount: x.amount,
      paid_by_partner: x.paid_by_partner,
    })),
  });

  const workbook = new Workbook();
  const sheet = workbook.addWorksheet('Settlement');
  const thin = {
    top: { style: 'thin' as const },
    left: { style: 'thin' as const },
    right: { style: 'thin' as const },
    bottom: { style: 'thin' as const },
  };

  sheet.columns = [
    { width: 26 },
    { width: 20 },
    { width: 14 },
    { width: 10 },
    { width: 22 },
    { width: 12 },
    { width: 32 },
  ];

  sheet.mergeCells('A1:G2');
  sheet.getCell('A1').value = 'OPENY — Monthly partner settlement';
  sheet.getCell('A1').font = { bold: true, size: 16 };
  sheet.getCell('A1').alignment = { vertical: 'middle', horizontal: 'left' };

  sheet.mergeCells('A3:G3');
  sheet.getCell('A3').value = `Period: ${monthLabel(month_key)} (${month_key})`;
  sheet.getCell('A3').font = { bold: true, size: 12 };

  const summaryTitle = sheet.addRow(['SETTLEMENT SUMMARY']);
  sheet.mergeCells(`A${summaryTitle.number}:G${summaryTitle.number}`);
  summaryTitle.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  summaryTitle.getCell(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0F172A' },
  };

  const summaryRows: [string, string | number][] = [
    ['Total revenue', num(settlement.totalRevenue)],
    ['Total expenses', num(settlement.totalExpenses)],
    ['Net profit (revenue − expenses)', num(settlement.netProfit)],
    ['Partner share (net profit ÷ 2)', num(settlement.partnerShare)],
    [
      `Collected — ${settlement.partners[0]}`,
      num(settlement.collectedBy[settlement.partners[0]] ?? 0),
    ],
    [
      `Collected — ${settlement.partners[1]}`,
      num(settlement.collectedBy[settlement.partners[1]] ?? 0),
    ],
    [
      `Expenses paid — ${settlement.partners[0]}`,
      num(settlement.expensesPaidBy[settlement.partners[0]] ?? 0),
    ],
    [
      `Expenses paid — ${settlement.partners[1]}`,
      num(settlement.expensesPaidBy[settlement.partners[1]] ?? 0),
    ],
    [
      `Net in hand — ${settlement.partners[0]}`,
      num(settlement.netInHand[settlement.partners[0]] ?? 0),
    ],
    [
      `Net in hand — ${settlement.partners[1]}`,
      num(settlement.netInHand[settlement.partners[1]] ?? 0),
    ],
    [
      'Settlement direction',
      settlement.debtor ? `${settlement.debtor} → ${settlement.creditor}` : 'Balanced',
    ],
    ['Settlement amount', settlement.debtor ? num(settlement.settlementAmount) : 0],
  ];
  for (const [label, value] of summaryRows) {
    const row = sheet.addRow([label, value, '', '', '', '', '']);
    sheet.mergeCells(`A${row.number}:B${row.number}`);
    row.getCell(1).font = { bold: true };
    if (typeof value === 'number') {
      row.getCell(2).numFmt = '#,##0.00';
      row.getCell(2).alignment = { horizontal: 'right' };
    }
    row.eachCell((cell, col) => {
      if (col <= 2) {
        cell.border = thin;
      }
    });
  }

  sheet.addRow([]);
  const revTitle = sheet.addRow(['REVENUES']);
  sheet.mergeCells(`A${revTitle.number}:G${revTitle.number}`);
  revTitle.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  revTitle.getCell(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF000000' },
  };

  const revHeader = sheet.addRow([
    'Client',
    'Service',
    'Amount',
    'Currency',
    'Collected by',
    'Date',
    'Notes',
  ]);
  revHeader.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    cell.border = thin;
  });

  for (const e of entries) {
    const row = sheet.addRow([
      e.client_name,
      e.service ?? '—',
      num(e.amount),
      e.currency,
      e.collector ?? ACCOUNTING_COLLECTORS[0],
      e.entry_date,
      e.notes ?? '',
    ]);
    row.getCell(3).numFmt = '#,##0.00';
    row.eachCell((cell, i) => {
      cell.border = thin;
      cell.alignment = { vertical: 'middle', horizontal: i === 3 ? 'right' : 'left' };
    });
  }

  sheet.addRow([]);
  const expTitle = sheet.addRow(['EXPENSES']);
  sheet.mergeCells(`A${expTitle.number}:G${expTitle.number}`);
  expTitle.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  expTitle.getCell(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF000000' },
  };

  const expHeader = sheet.addRow([
    'Description',
    'Amount',
    'Currency',
    'Paid by partner',
    'Date',
    'Notes',
  ]);
  expHeader.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    cell.border = thin;
  });

  for (const e of expenses) {
    const row = sheet.addRow([
      e.description,
      num(e.amount),
      e.currency,
      e.paid_by_partner ?? ACCOUNTING_COLLECTORS[1],
      e.expense_date,
      e.notes ?? '',
    ]);
    row.getCell(2).numFmt = '#,##0.00';
    row.eachCell((cell, i) => {
      cell.border = thin;
      cell.alignment = { vertical: 'middle', horizontal: i === 2 ? 'right' : 'left' };
    });
  }

  sheet.addRow([]);
  const trTitle = sheet.addRow(['PARTNER TRANSFERS (record)']);
  sheet.mergeCells(`A${trTitle.number}:G${trTitle.number}`);
  trTitle.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  trTitle.getCell(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF000000' },
  };

  const trHeader = sheet.addRow(['From', 'To', 'Amount', 'Currency', 'Date', 'Notes']);
  trHeader.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    cell.border = thin;
  });

  if (transfers.length === 0) {
    const row = sheet.addRow(['—', '—', 0, 'SAR', '—', 'No transfers logged']);
    row.eachCell((cell) => {
      cell.border = thin;
    });
  } else {
    for (const t of transfers) {
      const row = sheet.addRow([
        t.from_partner,
        t.to_partner,
        num(t.amount),
        t.currency,
        t.transfer_date,
        t.notes ?? '',
      ]);
      row.getCell(3).numFmt = '#,##0.00';
      row.eachCell((cell, i) => {
        cell.border = thin;
        cell.alignment = { vertical: 'middle', horizontal: i === 3 ? 'right' : 'left' };
      });
    }
  }

  sheet.addRow([]);
  const notesTitle = sheet.addRow(['MONTH NOTES']);
  sheet.mergeCells(`A${notesTitle.number}:G${notesTitle.number}`);
  notesTitle.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  notesTitle.getCell(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0F172A' },
  };
  const notesRow = sheet.addRow([monthNotes || '—']);
  sheet.mergeCells(`A${notesRow.number}:G${notesRow.number + 2}`);
  notesRow.getCell(1).alignment = { wrapText: true, vertical: 'top' };
  notesRow.getCell(1).border = thin;

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `${sanitizeDocCode(documentCode, `accounting-${month_key}`)}.xlsx`;
  const storageKey = buildStoragePath({
    module: 'docs',
    section: 'exports',
    documentType: 'accounting',
    entityId: month_key,
    filename,
  });
  const payload = Buffer.from(buffer);
  const upload = await uploadFile({
    key: storageKey,
    body: payload,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  await saveStoredFileMetadata({
    module: 'docs',
    section: 'exports',
    entityId: month_key,
    originalName: filename,
    storedName: filename,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    sizeBytes: payload.byteLength,
    r2Key: storageKey,
    fileUrl: upload.publicUrl,
    uploadedBy: auth.profile.id,
    visibility: 'private',
  });

  return NextResponse.redirect(upload.publicUrl, 302);
}
