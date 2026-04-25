import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { requireModulePermission, requireRole } from '@/lib/api-auth';

export async function GET(req: NextRequest) {
  const auth = await requireModulePermission(req, 'docs', 'accounting', 'read');
  if (auth instanceof NextResponse) return auth;

  const month_key = new URL(req.url).searchParams.get('month_key') ?? '';
  if (!month_key.trim()) {
    return NextResponse.json({ error: 'month_key is required' }, { status: 400 });
  }

  const db = getServiceClient();
  const { data, error } = await db
    .from('docs_accounting_month_meta')
    .select('*')
    .eq('month_key', month_key)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    meta: data ?? { month_key, notes: '', updated_at: new Date().toISOString() },
  });
}

export async function PATCH(req: NextRequest) {
  const moduleAuth = await requireModulePermission(req, 'docs', 'accounting', 'full');
  if (moduleAuth instanceof NextResponse) return moduleAuth;

  const auth = await requireRole(req, ['admin', 'manager', 'team_member']);
  if (auth instanceof NextResponse) return auth;

  let body: { month_key?: string; notes?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const month_key = body.month_key?.trim();
  if (!month_key) return NextResponse.json({ error: 'month_key is required' }, { status: 400 });

  const notes = body.notes ?? '';
  const db = getServiceClient();
  const { data, error } = await db
    .from('docs_accounting_month_meta')
    .upsert({ month_key, notes }, { onConflict: 'month_key' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ meta: data });
}
