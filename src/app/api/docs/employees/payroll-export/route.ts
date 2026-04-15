import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';

export async function GET(req: NextRequest) {
  const { getApiUser } = await import('@/lib/api-auth');
  const auth = await getApiUser(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month') ?? new Date().toISOString().slice(0, 7);

  const db = getServiceClient();
  const { data, error } = await db
    .from('docs_employees')
    .select('*')
    .eq('status', 'active')
    .order('full_name', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const employees = (data ?? []) as Array<{
    employee_id:     string;
    full_name:       string;
    job_title:       string | null;
    employment_type: string;
    salary:          number;
    daily_hours:     number;
    hire_date:       string | null;
  }>;

  const rows: string[][] = [
    [`Payroll Sheet — ${month}`, '', '', '', '', ''],
    [],
    ['Employee ID', 'Full Name', 'Job Title', 'Employment Type', 'Daily Hours', 'Monthly Salary (SAR)', 'Hire Date'],
    ...employees.map(e => [
      e.employee_id, e.full_name, e.job_title ?? '', e.employment_type,
      String(e.daily_hours), String(e.salary), e.hire_date ?? '',
    ]),
    [],
    ['', '', '', '', '', `Total: ${employees.reduce((s, e) => s + e.salary, 0)} SAR`, ''],
  ];

  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="payroll-${month}.csv"`,
    },
  });
}
