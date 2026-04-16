import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { requireRole } from '@/lib/api-auth';

interface Params { id: string }

export async function PATCH(req: NextRequest, { params }: { params: Promise<Params> }) {
  const auth = await requireRole(req, ['admin', 'manager', 'team_member']);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const allowedKeys = [
    'default_currency',
    'invoice_type',
    'quotation_type',
    'contract_type',
    'default_template_style',
    'billing_address',
    'tax_info',
    'notes',
    'invoice_layout_mode',
    'supports_branch_breakdown',
    'default_platforms',
    'default_branch_names',
    'service_description_default',
    'default_fees_logic',
    'default_totals_logic',
    'invoice_template_config',
    'quotation_template_config',
    'contract_template_config',
    'hr_contract_template_config',
    'employees_template_config',
    'accounting_template_config',
  ] as const;
  const updates: Record<string, unknown> = {};
  for (const key of allowedKeys) {
    if (Object.prototype.hasOwnProperty.call(body, key)) updates[key] = body[key];
  }

  const db = getServiceClient();
  const { data, error } = await db
    .from('docs_client_document_profiles')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ profile: data });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<Params> }) {
  const auth = await requireRole(req, ['admin', 'manager', 'team_member']);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const db = getServiceClient();
  const { error } = await db.from('docs_client_document_profiles').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
