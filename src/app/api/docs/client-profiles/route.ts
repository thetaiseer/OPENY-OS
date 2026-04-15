import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { requireRole } from '@/lib/api-auth';
import { buildClientSlug, VIRTUAL_PROFILE_PREFIX } from '@/lib/docs-client-profiles';

function emptyObject(value: unknown) {
  return (value && typeof value === 'object' && !Array.isArray(value)) ? value : {};
}

function emptyArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

export async function GET(req: NextRequest) {
  const { getApiUser } = await import('@/lib/api-auth');
  const auth = await getApiUser(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getServiceClient();
  const [{ data: clients, error: clientsError }, { data: profiles, error: profilesError }] = await Promise.all([
    db.from('clients').select('id,name,slug,status').order('name', { ascending: true }),
    db.from('docs_client_document_profiles').select('*').order('created_at', { ascending: false }),
  ]);

  if (clientsError) return NextResponse.json({ error: clientsError.message }, { status: 500 });
  if (profilesError) return NextResponse.json({ error: profilesError.message }, { status: 500 });

  const profileMap = new Map((profiles ?? []).map(p => [p.client_id as string, p as Record<string, unknown>]));
  const virtualTimestamp = new Date().toISOString();
  const result = (clients ?? [])
    .filter(c => c.status !== 'inactive')
    .map((client) => {
      const profile = profileMap.get(client.id);
      return {
        id: (profile?.id as string | undefined) ?? `${VIRTUAL_PROFILE_PREFIX}${client.id}`,
        client_id: client.id,
        client_name: client.name,
        client_slug: client.slug ?? buildClientSlug(client.name),
        default_currency: (profile?.default_currency as string | undefined) ?? 'SAR',
        invoice_type: (profile?.invoice_type as string | undefined) ?? null,
        quotation_type: (profile?.quotation_type as string | undefined) ?? null,
        contract_type: (profile?.contract_type as string | undefined) ?? null,
        default_template_style: (profile?.default_template_style as string | undefined) ?? null,
        billing_address: (profile?.billing_address as string | undefined) ?? null,
        tax_info: (profile?.tax_info as string | undefined) ?? null,
        notes: (profile?.notes as string | undefined) ?? null,
        invoice_layout_mode: (profile?.invoice_layout_mode as string | undefined) ?? 'branch_platform',
        supports_branch_breakdown: (profile?.supports_branch_breakdown as boolean | undefined) ?? true,
        default_platforms: emptyArray(profile?.default_platforms),
        default_branch_names: emptyArray(profile?.default_branch_names),
        service_description_default: (profile?.service_description_default as string | undefined) ?? null,
        default_fees_logic: emptyObject(profile?.default_fees_logic),
        default_totals_logic: emptyObject(profile?.default_totals_logic),
        invoice_template_config: emptyObject(profile?.invoice_template_config),
        quotation_template_config: emptyObject(profile?.quotation_template_config),
        contract_template_config: emptyObject(profile?.contract_template_config),
        hr_contract_template_config: emptyObject(profile?.hr_contract_template_config),
        employees_template_config: emptyObject(profile?.employees_template_config),
        accounting_template_config: emptyObject(profile?.accounting_template_config),
        created_at: (profile?.created_at as string | undefined) ?? virtualTimestamp,
        updated_at: (profile?.updated_at as string | undefined) ?? virtualTimestamp,
      };
    });

  return NextResponse.json({ profiles: result });
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'manager', 'team_member']);
  if (auth instanceof NextResponse) return auth;

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const client_id = typeof body.client_id === 'string' ? body.client_id : '';
  if (!client_id) return NextResponse.json({ error: 'client_id is required' }, { status: 400 });

  const payload = {
    client_id,
    default_currency: body.default_currency ?? 'SAR',
    invoice_type: body.invoice_type ?? null,
    quotation_type: body.quotation_type ?? null,
    contract_type: body.contract_type ?? null,
    default_template_style: body.default_template_style ?? null,
    billing_address: body.billing_address ?? null,
    tax_info: body.tax_info ?? null,
    notes: body.notes ?? null,
    invoice_layout_mode: body.invoice_layout_mode ?? 'branch_platform',
    supports_branch_breakdown: Boolean(body.supports_branch_breakdown ?? true),
    default_platforms: emptyArray(body.default_platforms),
    default_branch_names: emptyArray(body.default_branch_names),
    service_description_default: body.service_description_default ?? null,
    default_fees_logic: emptyObject(body.default_fees_logic),
    default_totals_logic: emptyObject(body.default_totals_logic),
    invoice_template_config: emptyObject(body.invoice_template_config),
    quotation_template_config: emptyObject(body.quotation_template_config),
    contract_template_config: emptyObject(body.contract_template_config),
    hr_contract_template_config: emptyObject(body.hr_contract_template_config),
    employees_template_config: emptyObject(body.employees_template_config),
    accounting_template_config: emptyObject(body.accounting_template_config),
  };

  const db = getServiceClient();
  const { data, error } = await db
    .from('docs_client_document_profiles')
    .upsert(payload, { onConflict: 'client_id' })
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ profile: data }, { status: 201 });
}
