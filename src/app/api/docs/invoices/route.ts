import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { requireRole } from '@/lib/api-auth';
import {
  calculateInvoiceTotals,
  hydrateInvoiceBranchGroups,
  mapInvoiceDbError,
  normalizeInvoiceBranchGroups,
  replaceInvoiceBranchGroups,
} from '@/lib/docs-invoices-db';

export async function GET(req: NextRequest) {
  const { getApiUser } = await import('@/lib/api-auth');
  const auth = await getApiUser(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') ?? '';
  const client = searchParams.get('client_name') ?? '';
  const search = searchParams.get('search') ?? '';
  const sort = searchParams.get('sort') ?? 'created_at';
  const order = searchParams.get('order') === 'asc';
  const dateFrom = searchParams.get('date_from') ?? '';
  const dateTo = searchParams.get('date_to') ?? '';

  const db = getServiceClient();
  let q = db.schema('public').from('docs_invoices').select('*').order(sort, { ascending: order });

  if (status) q = q.eq('status', status);
  if (client) q = q.ilike('client_name', `%${client}%`);
  if (dateFrom) q = q.gte('invoice_date', dateFrom);
  if (dateTo) q = q.lte('invoice_date', dateTo);
  if (search) q = q.or(`invoice_number.ilike.%${search}%,client_name.ilike.%${search}%`);

  const { data, error } = await q;
  if (error) {
    console.error('[docs/invoices][GET] Failed to load invoices:', error);
    return NextResponse.json(
      { error: mapInvoiceDbError(error, 'Unable to load invoices right now.') },
      { status: 500 },
    );
  }

  try {
    const invoices = await hydrateInvoiceBranchGroups(
      db,
      (data ?? []) as Array<{ id: string; branch_groups?: unknown }>,
    );
    return NextResponse.json({ invoices });
  } catch (nestedError) {
    console.error('[docs/invoices][GET] Failed to hydrate invoice branch groups:', nestedError);
    return NextResponse.json(
      {
        error: mapInvoiceDbError(
          nestedError as { code?: string; message?: string },
          'Unable to load invoice details right now.',
        ),
      },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'manager', 'team_member']);
  if (auth instanceof NextResponse) return auth;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { invoice_number, client_name } = body as { invoice_number?: string; client_name?: string };
  if (!invoice_number?.trim())
    return NextResponse.json({ error: 'invoice_number is required' }, { status: 400 });
  if (!client_name?.trim())
    return NextResponse.json({ error: 'client_name is required' }, { status: 400 });

  const branchGroups = normalizeInvoiceBranchGroups(body.branch_groups);
  const totals = calculateInvoiceTotals(branchGroups, body.our_fees);
  const payload = {
    ...body,
    branch_groups: branchGroups,
    ...totals,
  };

  const db = getServiceClient();
  const { data, error } = await db
    .schema('public')
    .from('docs_invoices')
    .upsert({ ...payload, created_by: auth.profile.id }, { onConflict: 'id' })
    .select()
    .single();

  if (error) {
    console.error('[docs/invoices][POST] Failed to upsert invoice root record:', error, payload);
    return NextResponse.json(
      { error: mapInvoiceDbError(error, 'Unable to save invoice right now.') },
      { status: 500 },
    );
  }

  try {
    await replaceInvoiceBranchGroups(db, data.id as string, branchGroups);
    const hydrated = await hydrateInvoiceBranchGroups(db, [
      data as { id: string; branch_groups?: unknown },
    ]);
    return NextResponse.json({ invoice: hydrated[0] }, { status: 201 });
  } catch (nestedError) {
    // DB-level ON DELETE CASCADE is defined in supabase-migration-docs-invoice-nested-tables.sql,
    // so deleting docs_invoices also removes docs_invoice_branches/platforms/rows.
    const { error: rollbackError } = await db
      .schema('public')
      .from('docs_invoices')
      .delete()
      .eq('id', data.id);
    if (rollbackError) {
      console.error(
        '[docs/invoices] Failed to rollback invoice after nested save error:',
        rollbackError,
      );
    }
    console.error(
      '[docs/invoices][POST] Failed to save invoice branch/platform/rows:',
      nestedError,
      {
        invoiceId: data.id,
        branchGroupsCount: branchGroups.length,
      },
    );
    return NextResponse.json(
      {
        error: mapInvoiceDbError(
          nestedError as { code?: string; message?: string },
          'Unable to save invoice line items right now.',
        ),
      },
      { status: 500 },
    );
  }
}
