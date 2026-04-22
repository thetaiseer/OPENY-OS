import { NextRequest, NextResponse } from 'next/server';
import { Workbook } from 'exceljs';
import { getServiceClient } from '@/lib/supabase/service-client';
import { sanitizeDocCode } from '@/lib/docs-client-profiles';
import { ACCOUNTING_COLLECTORS, getAccountingCollectorByType } from '@/lib/docs-types';
import { buildStoragePath, uploadFile } from '@/lib/storage';
import { saveStoredFileMetadata } from '@/lib/storage/metadata';

function num(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export async function GET(req: NextRequest) {
  const { getApiUser } = await import('@/lib/api-auth');
  const auth = await getApiUser(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month_key = searchParams.get('month_key') ?? new Date().toISOString().slice(0, 7).replace('-', '');
  const documentCode = (searchParams.get('document_code') ?? '').trim();

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
  const netResult = totalRevenue - totalExpenses;
  const eachShare = netResult / 2;
  const p1 = ACCOUNTING_COLLECTORS[0] ?? 'Taiseer Mahmoud';
  const p2 = ACCOUNTING_COLLECTORS[1] ?? 'Ahmed Mansour';
  const p1Total = entries
    .filter((e) => (e.collector ?? getAccountingCollectorByType(e.collection_type)) === p1)
    .reduce((s, e) => s + e.amount, 0);
  const settlementDiff = p1Total - eachShare;
  const settlementFrom = settlementDiff > 0 ? p1 : p2;
  const settlementTo = settlementDiff > 0 ? p2 : p1;

  const workbook = new Workbook();
  const sheet = workbook.addWorksheet('Accounting');
  sheet.columns = [
    { width: 26 },
    { width: 24 },
    { width: 15 },
    { width: 12 },
    { width: 24 },
    { width: 20 },
    { width: 26 },
    { width: 24 },
  ];

  sheet.mergeCells('A1:D2');
  sheet.getCell('A1').value = 'OPENY';
  sheet.getCell('A1').font = { bold: true, size: 20 };
  sheet.getCell('A1').alignment = { vertical: 'middle', horizontal: 'left' };
  sheet.mergeCells('E1:H2');
  sheet.getCell('E1').value = `ACCOUNTING — ${month_key}`;
  sheet.getCell('E1').font = { bold: true, size: 18 };
  sheet.getCell('E1').alignment = { vertical: 'middle', horizontal: 'right' };
  sheet.addRow([]);

  const revenueTitle = sheet.addRow(['REVENUE ENTRIES']);
  sheet.mergeCells(`A${revenueTitle.number}:H${revenueTitle.number}`);
  revenueTitle.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  revenueTitle.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } };

  const revenueHeader = sheet.addRow(['Client', 'Service', 'Amount', 'Currency', 'Payment Type', 'Collector', 'Date', 'Notes']);
  revenueHeader.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' }, bottom: { style: 'thin' } };
  });

  for (const e of entries) {
    const row = sheet.addRow([
      e.client_name,
      e.service ?? '—',
      num(e.amount),
      e.currency,
      getAccountingCollectorByType(e.collection_type),
      e.collector ?? getAccountingCollectorByType(e.collection_type),
      e.entry_date,
      e.notes ?? '',
    ]);
    row.getCell(3).numFmt = '#,##0.00';
    row.eachCell((cell, i) => {
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' }, bottom: { style: 'thin' } };
      cell.alignment = { vertical: 'middle', horizontal: i === 3 ? 'right' : 'left' };
    });
  }

  sheet.addRow([]);
  const expensesTitle = sheet.addRow(['EXPENSES']);
  sheet.mergeCells(`A${expensesTitle.number}:H${expensesTitle.number}`);
  expensesTitle.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  expensesTitle.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } };

  const expensesHeader = sheet.addRow(['Description', '', 'Amount', 'Currency', 'Date', 'Notes', '', '']);
  expensesHeader.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111827' } };
    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' }, bottom: { style: 'thin' } };
  });

  for (const e of expenses) {
    const row = sheet.addRow([e.description, '', num(e.amount), e.currency, e.expense_date, e.notes ?? '', '', '']);
    row.getCell(3).numFmt = '#,##0.00';
    row.eachCell((cell, i) => {
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' }, bottom: { style: 'thin' } };
      cell.alignment = { vertical: 'middle', horizontal: i === 3 ? 'right' : 'left' };
    });
  }

  sheet.addRow([]);
  const summaryTitle = sheet.addRow(['SUMMARY']);
  summaryTitle.getCell(1).font = { bold: true };
  const summaryRows = [
    ['Total Revenue', num(totalRevenue)],
    ['Total Expenses', num(totalExpenses)],
    ['Net Result', num(netResult)],
    ['Equal Share Per Partner', num(eachShare)],
    ['Settlement Amount', num(Math.abs(settlementDiff))],
    ['Settlement Direction', `${settlementFrom} → ${settlementTo}`],
  ] as const;
  for (const [label, value] of summaryRows) {
    const row = sheet.addRow([label, value]);
    row.getCell(1).font = { bold: true };
    if (typeof value === 'number') {
      row.getCell(2).numFmt = '#,##0.00';
      row.getCell(2).alignment = { horizontal: 'right' };
    }
  }

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
