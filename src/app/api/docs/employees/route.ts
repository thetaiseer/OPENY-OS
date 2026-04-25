import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { requireRole } from '@/lib/api-auth';

export async function GET(req: NextRequest) {
  const { getApiUser } = await import('@/lib/api-auth');
  const auth = await getApiUser(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') ?? '';
  const employment_type = searchParams.get('employment_type') ?? '';
  const search = searchParams.get('search') ?? '';
  const sort = searchParams.get('sort') ?? 'created_at';
  const order = searchParams.get('order') === 'asc';

  const db = getServiceClient();
  let q = db
    .from('docs_employees')
    .select('*, salary_adjustments:docs_salary_adjustments(*)')
    .order(sort, { ascending: order });

  if (status) q = q.eq('status', status);
  if (employment_type) q = q.eq('employment_type', employment_type);
  if (search)
    q = q.or(
      `full_name.ilike.%${search}%,employee_id.ilike.%${search}%,job_title.ilike.%${search}%,phone.ilike.%${search}%`,
    );

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ employees: data ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'manager', 'team_member']);
  if (auth instanceof NextResponse) return auth;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { employee_id, full_name } = body as { employee_id?: string; full_name?: string };
  if (!employee_id?.trim())
    return NextResponse.json({ error: 'employee_id is required' }, { status: 400 });
  if (!full_name?.trim())
    return NextResponse.json({ error: 'full_name is required' }, { status: 400 });

  const db = getServiceClient();
  const { data, error } = await db
    .from('docs_employees')
    .insert({ ...body, created_by: auth.profile.id })
    .select()
    .single();

  if (error) {
    if (error.code === '23505')
      return NextResponse.json({ error: 'Employee ID already exists' }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (data && typeof body.salary === 'number' && body.salary > 0) {
    await db.from('docs_salary_history').insert({
      employee_id: data.id,
      new_salary: body.salary,
      change_amount: body.salary,
      change_type: 'initial',
      effective_date: body.hire_date ?? new Date().toISOString().slice(0, 10),
      notes: 'Initial salary on hire',
      created_by: auth.profile.id,
    });
  }

  return NextResponse.json({ employee: data }, { status: 201 });
}
