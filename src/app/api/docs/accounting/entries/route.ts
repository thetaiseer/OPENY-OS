import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { requireModulePermission, requireRole } from '@/lib/api-auth';

export async function GET(req: NextRequest) {
  const auth = await requireModulePermission(req, 'docs', 'accounting', 'read');
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const month_key = searchParams.get('month_key') ?? '';
  const collector = searchParams.get('collector') ?? '';
  const search = searchParams.get('search') ?? '';
  const sort = searchParams.get('sort') ?? 'created_at';
  const order = searchParams.get('order') === 'asc';

  const db = getServiceClient();
  let q = db.from('docs_accounting_entries').select('*').order(sort, { ascending: order });

  if (month_key) q = q.eq('month_key', month_key);
  if (collector) q = q.eq('collector', collector);
  if (search)
    q = q.or(`client_name.ilike.%${search}%,service.ilike.%${search}%,notes.ilike.%${search}%`);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entries: data ?? [] });
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

  const { client_name, month_key } = body as { client_name?: string; month_key?: string };
  if (!client_name?.trim())
    return NextResponse.json({ error: 'client_name is required' }, { status: 400 });
  if (!month_key?.trim())
    return NextResponse.json({ error: 'month_key is required' }, { status: 400 });

  const db = getServiceClient();
  const { data, error } = await db
    .from('docs_accounting_entries')
    .insert({ ...body, created_by: auth.profile.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entry: data }, { status: 201 });
}
