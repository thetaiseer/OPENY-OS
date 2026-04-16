import type ExcelJS from 'exceljs';
import type { InvoiceDocumentModel } from '@/lib/docs-invoice-document-model';

function fmtForExcel(value: number) {
  return Math.round(value * 100) / 100;
}

export function writeInvoiceWorksheet(
  worksheet: ExcelJS.Worksheet,
  model: InvoiceDocumentModel,
) {
  worksheet.columns = [
    { width: 24 },
    { width: 20 },
    { width: 30 },
    { width: 14 },
    { width: 22 },
    { width: 16 },
  ];

  worksheet.mergeCells('A1:C2');
  worksheet.getCell('A1').value = 'OPENY';
  worksheet.getCell('A1').font = { bold: true, size: 18 };
  worksheet.getCell('A1').alignment = { vertical: 'middle', horizontal: 'left' };

  worksheet.mergeCells('D1:F2');
  worksheet.getCell('D1').value = 'INVOICE';
  worksheet.getCell('D1').font = { bold: true, size: 20 };
  worksheet.getCell('D1').alignment = { vertical: 'middle', horizontal: 'right' };

  worksheet.addRow([]);
  worksheet.addRow(['Invoice #', model.invoiceNumber, '', 'Date', model.invoiceDate || '—', '']);
  worksheet.addRow(['Billed To', model.clientName || '—', '', 'Campaign Month', model.campaignMonth || '—', '']);
  worksheet.addRow([]);

  let rowCursor = worksheet.rowCount + 1;
  model.branchTables.forEach((branch) => {
    worksheet.mergeCells(`A${rowCursor}:F${rowCursor}`);
    const branchHeaderCell = worksheet.getCell(`A${rowCursor}`);
    branchHeaderCell.value = branch.branchName || 'Branch';
    branchHeaderCell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    branchHeaderCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF000000' },
    };
    rowCursor += 1;

    const headerRow = worksheet.getRow(rowCursor);
    headerRow.values = ['BRANCH', 'PLATFORM', 'AD NAME', 'DATE', 'RESULTS', `COST (${model.currency})`];
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF000000' },
      };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
    });
    rowCursor += 1;

    const rows = branch.rows.length
      ? branch.rows
      : [{ branch: branch.branchName, platform: '', ad_name: '', date: '', results: '', cost: 0, showPlatform: true, platformSpan: 1 }];

    const branchDataStart = rowCursor;
    rows.forEach((row) => {
      const dataRow = worksheet.getRow(rowCursor);
      dataRow.values = [
        row.branch || '—',
        row.platform || '—',
        row.ad_name || '—',
        row.date || '—',
        row.results || '—',
        fmtForExcel(row.cost),
      ];
      dataRow.getCell(6).numFmt = '#,##0.00';
      dataRow.eachCell((cell, cellNo) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
        cell.alignment = { vertical: 'top', horizontal: cellNo === 6 ? 'right' : 'left' };
      });
      rowCursor += 1;
    });

    if (rows.length > 1) {
      worksheet.mergeCells(`A${branchDataStart}:A${rowCursor - 1}`);
    }

    let platformGroupStart = branchDataStart;
    rows.forEach((row, index) => {
      if (row.showPlatform) platformGroupStart = branchDataStart + index;
      if (row.platformSpan > 1 && row.showPlatform) {
        const end = platformGroupStart + row.platformSpan - 1;
        worksheet.mergeCells(`B${platformGroupStart}:B${end}`);
      }
    });

    const subtotalRow = worksheet.getRow(rowCursor);
    worksheet.mergeCells(`A${rowCursor}:E${rowCursor}`);
    subtotalRow.getCell(1).value = `Subtotal (${branch.branchName || 'Branch'})`;
    subtotalRow.getCell(6).value = fmtForExcel(branch.subtotal);
    subtotalRow.getCell(6).numFmt = '#,##0.00';
    subtotalRow.eachCell((cell, cellNo) => {
      cell.font = { bold: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF1F1F1' },
      };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
      cell.alignment = { horizontal: cellNo === 6 ? 'right' : 'left' };
    });
    rowCursor += 2;
  });

  worksheet.addRow(['', '', '', 'Final Budget (Ad Spend)', fmtForExcel(model.totals.finalBudget), '']);
  worksheet.addRow(['', '', '', 'Our Fees', fmtForExcel(model.totals.ourFees), '']);
  worksheet.addRow(['', '', '', 'GRAND TOTAL', fmtForExcel(model.totals.grandTotal), '']);

  const totalsStart = worksheet.rowCount - 2;
  for (let i = totalsStart; i <= worksheet.rowCount; i += 1) {
    worksheet.mergeCells(`D${i}:E${i}`);
    const labelCell = worksheet.getCell(`D${i}`);
    const valueCell = worksheet.getCell(`F${i}`);
    labelCell.font = { bold: true };
    valueCell.font = { bold: true };
    valueCell.numFmt = '#,##0.00';
    labelCell.alignment = { horizontal: 'right' };
    valueCell.alignment = { horizontal: 'right' };
    labelCell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
    valueCell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
  }

  const grandTotalRow = worksheet.rowCount;
  ['D', 'E', 'F'].forEach((col) => {
    const cell = worksheet.getCell(`${col}${grandTotalRow}`);
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF000000' },
    };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  });

  if (model.notes) {
    worksheet.addRow([]);
    const notesLabelRow = worksheet.addRow(['NOTES']);
    notesLabelRow.getCell(1).font = { bold: true };
    worksheet.mergeCells(`A${worksheet.rowCount + 1}:F${worksheet.rowCount + 1}`);
    worksheet.addRow([model.notes]);
  }
}
