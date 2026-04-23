import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { sanitizeDocCode } from '@/lib/docs-client-profiles';
import { buildStoragePath, uploadFile } from '@/lib/storage';
import { saveStoredFileMetadata } from '@/lib/storage/metadata';

export async function GET(req: NextRequest) {
  const { getApiUser } = await import('@/lib/api-auth');
  const auth = await getApiUser(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month') ?? new Date().toISOString().slice(0, 7);
  const documentCode = (searchParams.get('document_code') ?? '').trim();

  const db = getServiceClient();
  const { data, error } = await db
    .from('docs_employees')
    .select('*')
    .eq('status', 'active')
    .order('full_name', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const employees = (data ?? []) as Array<{
    employee_id: string;
    full_name: string;
    job_title: string | null;
    employment_type: string;
    salary: number;
    daily_hours: number;
    hire_date: string | null;
  }>;

  const rows: string[][] = [
    [`Payroll Sheet — ${month}`, '', '', '', '', ''],
    [],
    [
      'Employee ID',
      'Full Name',
      'Job Title',
      'Employment Type',
      'Daily Hours',
      'Monthly Salary (SAR)',
      'Hire Date',
    ],
    ...employees.map((e) => [
      e.employee_id,
      e.full_name,
      e.job_title ?? '',
      e.employment_type,
      String(e.daily_hours),
      String(e.salary),
      e.hire_date ?? '',
    ]),
    [],
    ['', '', '', '', '', `Total: ${employees.reduce((s, e) => s + e.salary, 0)} SAR`, ''],
  ];

  const csv = rows
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\r\n');
  const filename = `${sanitizeDocCode(documentCode, 'payroll')}-${month}.csv`;
  const storageKey = buildStoragePath({
    module: 'docs',
    section: 'exports',
    documentType: 'employees',
    entityId: month,
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
    entityId: month,
    originalName: filename,
    storedName: filename,
    mimeType: 'text/csv; charset=utf-8',
    sizeBytes: payload.byteLength,
    r2Key: storageKey,
    fileUrl: upload.publicUrl,
    uploadedBy: auth.profile.id,
    visibility: 'private',
  });

  return NextResponse.redirect(upload.publicUrl, 302);
}
