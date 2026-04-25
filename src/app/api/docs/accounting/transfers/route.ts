import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { requireModulePermission, requireRole } from '@/lib/api-auth';
import { ACCOUNTING_COLLECTORS } from '@/lib/docs-types';

export async function GET(req: NextRequest) {
  const auth = await requireModulePermission(req, 'docs', 'accounting', 'read');
  if (auth instanceof NextResponse) return auth;

  const month_key = new URL(req.url).searchParams.get('month_key') ?? '';
  if (!month_key.trim()) {
    return NextResponse.json({ error: 'month_key is required' }, { status: 400 });
  }

  const db = getServiceClient();
  const { data, error } = await db
    .from('docs_accounting_transfers')
    .select('*')
    .eq('month_key', month_key)
    .order('transfer_date', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ transfers: data ?? [] });
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

  const month_key = (body.month_key as string)?.trim();
  const from_partner = (body.from_partner as string)?.trim();
  const to_partner = (body.to_partner as string)?.trim();
  const amount = Number(body.amount);

  if (!month_key) return NextResponse.json({ error: 'month_key is required' }, { status: 400 });
  if (!from_partner || !to_partner)
    return NextResponse.json(
      { error: 'from_partner and to_partner are required' },
      { status: 400 },
    );
  if (from_partner === to_partner)
    return NextResponse.json({ error: 'from and to must differ' }, { status: 400 });
  const names = ACCOUNTING_COLLECTORS as readonly string[];
  if (!names.includes(from_partner) || !names.includes(to_partner)) {
    return NextResponse.json({ error: 'Invalid partner name' }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 });
  }

  const db = getServiceClient();
  const { data, error } = await db
    .from('docs_accounting_transfers')
    .insert({
      month_key,
      from_partner,
      to_partner,
      amount,
      currency: (body.currency as string) ?? 'SAR',
      transfer_date: (body.transfer_date as string) ?? new Date().toISOString().slice(0, 10),
      notes: (body.notes as string) ?? null,
      created_by: auth.profile.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ transfer: data }, { status: 201 });
}
