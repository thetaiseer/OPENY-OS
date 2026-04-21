import { NextRequest, NextResponse } from 'next/server';
import { Workbook } from 'exceljs';
import { getServiceClient } from '@/lib/supabase/service-client';
import { requireRole } from '@/lib/api-auth';
import { buildInvoiceDocumentModel } from '@/lib/docs-invoice-document-model';
import { writeInvoiceWorksheet } from '@/lib/docs-invoice-excel';
import { hydrateInvoiceBranchGroups, mapInvoiceDbError } from '@/lib/docs-invoices-db';
import { sanitizeDocCode } from '@/lib/docs-client-profiles';

interface Params { id: string }

export async function GET(req: NextRequest, { params }: { params: Promise<Params> }) {
  const auth = await requireRole(req, ['viewer', 'team_member', 'manager', 'admin']);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const db = getServiceClient();
  const { data, error } = await db.schema('public').from('docs_invoices').select('*').eq('id', id).maybeSingle();
  if (error) {
    console.error('[docs/invoices/:id/export][GET] Failed to load invoice:', { id, error });
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
    console.error('[docs/invoices/:id/export][GET] Failed to hydrate invoice branch groups:', { id, nestedError });
    return NextResponse.json(
      { error: mapInvoiceDbError(nestedError as { code?: string; message?: string }, 'Unable to export invoice details right now.') },
      { status: 500 },
    );
  }

  const model = buildInvoiceDocumentModel(invoiceData as Parameters<typeof buildInvoiceDocumentModel>[0]);

  try {
    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet('Invoice');
    writeInvoiceWorksheet(worksheet, model);
    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `${sanitizeDocCode(model.invoiceNumber, 'invoice')}.xlsx`;

    return new NextResponse(Buffer.from(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (exportError) {
    console.error('[docs/invoices/:id/export][GET] Failed to generate xlsx export:', { id, exportError });
    return NextResponse.json(
      { error: 'Unable to generate invoice Excel file right now.' },
      { status: 500 },
    );
  }
}
