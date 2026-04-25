import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { requireRole } from '@/lib/api-auth';

interface Params {
  id: string;
}

export async function GET(req: NextRequest, { params }: { params: Promise<Params> }) {
  const auth = await requireRole(req, ['manager', 'admin']);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const db = getServiceClient();
  const { data, error } = await db
    .from('docs_salary_history')
    .select('*')
    .eq('employee_id', id)
    .order('effective_date', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ adjustments: data ?? [] });
}

export async function POST(req: NextRequest, { params }: { params: Promise<Params> }) {
  const auth = await requireRole(req, ['admin', 'manager', 'team_member']);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { new_salary } = body as { new_salary?: number };
  if (typeof new_salary !== 'number' || new_salary < 0) {
    return NextResponse.json(
      { error: 'new_salary must be a non-negative number' },
      { status: 400 },
    );
  }

  const db = getServiceClient();
  const { data: emp } = await db.from('docs_employees').select('salary').eq('id', id).maybeSingle();
  const oldSalary = emp?.salary ?? 0;
  const diff = new_salary - oldSalary;

  const { data: adj, error: adjErr } = await db
    .from('docs_salary_history')
    .insert({
      employee_id: id,
      new_salary,
      change_amount: Math.abs(diff),
      change_type: diff > 0 ? 'increase' : diff < 0 ? 'decrease' : 'initial',
      effective_date: body.effective_date ?? new Date().toISOString().slice(0, 10),
      notes: body.notes ?? null,
      created_by: auth.profile.id,
    })
    .select()
    .single();

  if (adjErr) return NextResponse.json({ error: adjErr.message }, { status: 500 });

  await db.from('docs_employees').update({ salary: new_salary }).eq('id', id);

  return NextResponse.json({ adjustment: adj }, { status: 201 });
}
