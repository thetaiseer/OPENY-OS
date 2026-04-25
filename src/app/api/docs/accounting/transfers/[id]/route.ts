import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { requireModulePermission, requireRole } from '@/lib/api-auth';
import { ACCOUNTING_COLLECTORS } from '@/lib/docs-types';

interface Params {
  id: string;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<Params> }) {
  const moduleAuth = await requireModulePermission(req, 'docs', 'accounting', 'full');
  if (moduleAuth instanceof NextResponse) return moduleAuth;

  const auth = await requireRole(req, ['admin', 'manager', 'team_member']);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const from_partner = (body.from_partner as string | undefined)?.trim();
  const to_partner = (body.to_partner as string | undefined)?.trim();
  if (from_partner && to_partner && from_partner === to_partner) {
    return NextResponse.json({ error: 'from and to must differ' }, { status: 400 });
  }
  const names = ACCOUNTING_COLLECTORS as readonly string[];
  if (from_partner && !names.includes(from_partner)) {
    return NextResponse.json({ error: 'Invalid from_partner' }, { status: 400 });
  }
  if (to_partner && !names.includes(to_partner)) {
    return NextResponse.json({ error: 'Invalid to_partner' }, { status: 400 });
  }

  const db = getServiceClient();
  const { data, error } = await db
    .from('docs_accounting_transfers')
    .update(body)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ transfer: data });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<Params> }) {
  const moduleAuth = await requireModulePermission(req, 'docs', 'accounting', 'full');
  if (moduleAuth instanceof NextResponse) return moduleAuth;

  const auth = await requireRole(req, ['admin', 'manager', 'team_member']);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const db = getServiceClient();
  const { error } = await db.from('docs_accounting_transfers').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
