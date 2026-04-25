import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { requireModulePermission, requireRole } from '@/lib/api-auth';

export async function GET(req: NextRequest) {
  const auth = await requireModulePermission(req, 'docs', 'accounting', 'read');
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const month_key = searchParams.get('month_key') ?? '';
  const sort = searchParams.get('sort') ?? 'created_at';
  const order = searchParams.get('order') === 'asc';

  const db = getServiceClient();
  let q = db.from('docs_accounting_expenses').select('*').order(sort, { ascending: order });
  if (month_key) q = q.eq('month_key', month_key);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ expenses: data ?? [] });
}

export async function POST(req: NextRequest) {
  const moduleAuth = await requireModulePermission(req, 'docs', 'accounting', 'full');
  if (moduleAuth instanceof NextResponse) return moduleAuth;

  const auth = await requireRole(req, ['admin', 'manager', 'team_member']);
  if (auth instanceof NextResponse) return auth;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { description, month_key } = body as { description?: string; month_key?: string };
  if (!description?.trim())
    return NextResponse.json({ error: 'description is required' }, { status: 400 });
  if (!month_key?.trim())
    return NextResponse.json({ error: 'month_key is required' }, { status: 400 });

  const db = getServiceClient();
  const { data, error } = await db
    .from('docs_accounting_expenses')
    .insert({ ...body, created_by: auth.profile.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ expense: data }, { status: 201 });
}
