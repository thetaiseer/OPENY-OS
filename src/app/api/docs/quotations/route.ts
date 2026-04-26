import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { requireModulePermission, requireRole } from '@/lib/api-auth';
import { dbAllocateNextDocNumber } from '@/lib/docs-doc-numbers';

export async function GET(req: NextRequest) {
  const auth = await requireModulePermission(req, 'docs', 'quotation', 'read');
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') ?? '';
  const client = searchParams.get('client_name') ?? '';
  const search = searchParams.get('search') ?? '';
  const sort = searchParams.get('sort') ?? 'created_at';
  const order = searchParams.get('order') === 'asc';
  const dateFrom = searchParams.get('date_from') ?? '';
  const dateTo = searchParams.get('date_to') ?? '';

  const db = getServiceClient();
  let q = db.from('docs_quotations').select('*').order(sort, { ascending: order });

  if (status) q = q.eq('status', status);
  if (client) q = q.ilike('client_name', `%${client}%`);
  if (dateFrom) q = q.gte('quote_date', dateFrom);
  if (dateTo) q = q.lte('quote_date', dateTo);
  if (search)
    q = q.or(
      `quote_number.ilike.%${search}%,client_name.ilike.%${search}%,project_title.ilike.%${search}%`,
    );

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ quotations: data ?? [] });
}

export async function POST(req: NextRequest) {
  const moduleAuth = await requireModulePermission(req, 'docs', 'quotation', 'full');
  if (moduleAuth instanceof NextResponse) return moduleAuth;

  const auth = await requireRole(req, ['admin', 'manager', 'team_member']);
  if (auth instanceof NextResponse) return auth;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { client_name } = body as { client_name?: string };
  if (!client_name?.trim())
    return NextResponse.json({ error: 'client_name is required' }, { status: 400 });

  const db = getServiceClient();
  const quote_number = await dbAllocateNextDocNumber(db, 'docs_quotations', 'QUO');
  const { data, error } = await db
    .from('docs_quotations')
    .insert({ ...body, quote_number, created_by: auth.profile.id })
    .select()
    .single();

  if (error) {
    const dup = error.code === '23505';
    return NextResponse.json(
      {
        error: dup
          ? 'This document number is already in use. Choose a different number.'
          : error.message,
        ...(dup ? { code: 'duplicate_document_number' as const } : {}),
      },
      { status: dup ? 409 : 500 },
    );
  }
  return NextResponse.json({ quotation: data }, { status: 201 });
}
