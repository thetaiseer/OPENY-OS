import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { requireRole } from '@/lib/api-auth';

export async function GET(req: NextRequest) {
  const { getApiUser } = await import('@/lib/api-auth');
  const auth = await getApiUser(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status     = searchParams.get('status')      ?? '';
  const client     = searchParams.get('client_name') ?? '';
  const search     = searchParams.get('search')      ?? '';
  const sort       = searchParams.get('sort')        ?? 'created_at';
  const order      = searchParams.get('order')       === 'asc';
  const dateFrom   = searchParams.get('date_from')   ?? '';
  const dateTo     = searchParams.get('date_to')     ?? '';

  const db = getServiceClient();
  let q = db.from('docs_invoices').select('*').order(sort, { ascending: order });

  if (status)   q = q.eq('status', status);
  if (client)   q = q.ilike('client_name', `%${client}%`);
  if (dateFrom) q = q.gte('invoice_date', dateFrom);
  if (dateTo)   q = q.lte('invoice_date', dateTo);
  if (search)   q = q.or(`invoice_number.ilike.%${search}%,client_name.ilike.%${search}%`);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ invoices: data ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'manager', 'team_member']);
  if (auth instanceof NextResponse) return auth;

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { invoice_number, client_name } = body as { invoice_number?: string; client_name?: string };
  if (!invoice_number?.trim()) return NextResponse.json({ error: 'invoice_number is required' }, { status: 400 });
  if (!client_name?.trim())    return NextResponse.json({ error: 'client_name is required' }, { status: 400 });

  const db = getServiceClient();
  const { data, error } = await db
    .from('docs_invoices')
    .insert({ ...body, created_by: auth.profile.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ invoice: data }, { status: 201 });
}
