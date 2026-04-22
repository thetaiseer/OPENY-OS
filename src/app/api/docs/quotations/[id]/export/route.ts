import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { requireRole } from '@/lib/api-auth';
import { buildStoragePath, uploadFile } from '@/lib/storage';
import { saveStoredFileMetadata } from '@/lib/storage/metadata';

interface Params { id: string }

export async function GET(req: NextRequest, { params }: { params: Promise<Params> }) {
  const auth = await requireRole(req, ['viewer', 'team_member', 'manager', 'admin']);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const db = getServiceClient();
  const { data, error } = await db.from('docs_quotations').select('*').eq('id', id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data)  return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const q = data as Record<string, unknown> & {
    quote_number:      string;
    client_name:       string;
    company_brand:     string | null;
    project_title:     string | null;
    quote_date:        string | null;
    currency:          string;
    total_value:       number;
    status:            string;
    payment_due_days:  number;
    payment_method:    string | null;
    additional_notes:  string | null;
    deliverables:      Array<{ description: string; quantity: number; unitPrice: number; total: number }>;
  };

  const rows: string[][] = [
    ['Quote No', 'Client', 'Company/Brand', 'Project', 'Date', 'Currency', 'Total Value', 'Status'],
    [
      q.quote_number, q.client_name, q.company_brand ?? '', q.project_title ?? '',
      q.quote_date ?? '', q.currency, String(q.total_value), q.status,
    ],
    [],
    ['Terms'],
    ['Payment Due (days)', 'Payment Method'],
    [String(q.payment_due_days), q.payment_method ?? ''],
    [],
    ['Deliverables'],
    ['Description', 'Qty', 'Unit Price', 'Total'],
    ...(q.deliverables ?? []).map(d => [
      d.description, String(d.quantity), String(d.unitPrice), String(d.total),
    ]),
  ];
  if (q.additional_notes) rows.push([], ['Notes'], [q.additional_notes]);

  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const filename = `${q.quote_number}.csv`;
  const storageKey = buildStoragePath({
    module: 'docs',
    section: 'exports',
    documentType: 'quotations',
    entityId: id,
    filename,
  });
  const payload = Buffer.from(csv, 'utf8');
  const upload = await uploadFile({
    key: storageKey,
    body: payload,
    contentType: 'text/csv; charset=utf-8',
  });

  await saveStoredFileMetadata({
    module: 'docs',
    section: 'exports',
    entityId: id,
    originalName: filename,
    storedName: filename,
    mimeType: 'text/csv; charset=utf-8',
    sizeBytes: payload.byteLength,
    r2Key: storageKey,
    fileUrl: upload.publicUrl,
    uploadedBy: auth.profile.id,
    visibility: 'private',
  });

  const { error: updateError } = await db
    .from('docs_quotations')
    .update({ export_excel_url: upload.publicUrl })
    .eq('id', id);
  if (updateError) {
    throw new Error(`Failed to update quotation export URL: ${updateError.message}`);
  }

  return NextResponse.redirect(upload.publicUrl, 302);
}
