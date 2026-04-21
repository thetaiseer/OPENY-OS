import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { requireRole } from '@/lib/api-auth';

interface Params { id: string }

export async function GET(req: NextRequest, { params }: { params: Promise<Params> }) {
  const auth = await requireRole(req, ['viewer', 'team_member', 'manager', 'admin']);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const db = getServiceClient();
  const { data, error } = await db
    .from('docs_employees')
    .select('*, salary_adjustments:docs_salary_adjustments(*)')
    .eq('id', id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data)  return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ employee: data });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<Params> }) {
  const auth = await requireRole(req, ['admin', 'manager', 'team_member']);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const db = getServiceClient();
  const { data: existing } = await db
    .from('docs_employees')
    .select('salary')
    .eq('id', id)
    .maybeSingle();

  const { data, error } = await db
    .from('docs_employees')
    .update(body)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (existing && typeof body.salary === 'number' && body.salary !== existing.salary) {
    const diff = (body.salary as number) - existing.salary;
    await db.from('docs_salary_adjustments').insert({
      employee_id:    id,
      new_salary:     body.salary,
      change_amount:  Math.abs(diff),
      change_type:    diff > 0 ? 'increase' : 'decrease',
      effective_date: new Date().toISOString().slice(0, 10),
      notes:          'Salary updated via employee edit',
      created_by:     auth.profile.id,
    });
  }

  return NextResponse.json({ employee: data });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<Params> }) {
  const auth = await requireRole(req, ['admin', 'manager', 'team_member']);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const db = getServiceClient();
  const { error } = await db.from('docs_employees').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
