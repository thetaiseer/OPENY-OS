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

interface Params { id: string }

export async function GET(req: NextRequest, { params }: { params: Promise<Params> }) {
  const { getApiUser } = await import('@/lib/api-auth');
  const auth = await getApiUser(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = getServiceClient();
  const { data, error } = await db.schema('public').from('docs_invoices').select('*').eq('id', id).maybeSingle();
  if (error) {
    console.error('[docs/invoices/:id][GET] Failed to load invoice:', { id, error });
    return NextResponse.json(
      { error: mapInvoiceDbError(error, 'Unable to load invoice right now.') },
      { status: 500 },
    );
  }
  if (!data)  return NextResponse.json({ error: 'Not found' }, { status: 404 });
  try {
    const [invoice] = await hydrateInvoiceBranchGroups(db, [data as { id: string; branch_groups?: unknown }]);
    return NextResponse.json({ invoice });
  } catch (nestedError) {
    console.error('[docs/invoices/:id][GET] Failed to hydrate invoice branch groups:', { id, nestedError });
    return NextResponse.json(
      { error: mapInvoiceDbError(nestedError as { code?: string; message?: string }, 'Unable to load invoice details right now.') },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<Params> }) {
  const auth = await requireRole(req, ['admin', 'manager', 'team_member']);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const branchGroups = normalizeInvoiceBranchGroups(body.branch_groups);
  const totals = calculateInvoiceTotals(branchGroups, body.our_fees);
  const payload = {
    id,
    ...body,
    branch_groups: branchGroups,
    ...totals,
  };

  const db = getServiceClient();
  const { data, error } = await db
    .schema('public')
    .from('docs_invoices')
    .upsert(payload, { onConflict: 'id' })
    .select()
    .single();

  if (error) {
    console.error('[docs/invoices/:id][PATCH] Failed to upsert invoice root record:', { id, error, payload });
    return NextResponse.json(
      { error: mapInvoiceDbError(error, 'Unable to update invoice right now.') },
      { status: 500 },
    );
  }
  try {
    await replaceInvoiceBranchGroups(db, id, branchGroups);
    const [invoice] = await hydrateInvoiceBranchGroups(db, [data as { id: string; branch_groups?: unknown }]);
    return NextResponse.json({ invoice });
  } catch (nestedError) {
    console.error('[docs/invoices/:id][PATCH] Failed to replace nested invoice rows:', {
      id,
      nestedError,
      branchGroupsCount: branchGroups.length,
    });
    return NextResponse.json(
      { error: mapInvoiceDbError(nestedError as { code?: string; message?: string }, 'Invoice updated, but line items could not be saved.') },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<Params> }) {
  const auth = await requireRole(req, ['admin', 'manager', 'team_member']);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const db = getServiceClient();
  const { error } = await db.schema('public').from('docs_invoices').delete().eq('id', id);
  if (error) {
    console.error('[docs/invoices/:id][DELETE] Failed to delete invoice:', { id, error });
    return NextResponse.json(
      { error: mapInvoiceDbError(error, 'Unable to delete invoice right now.') },
      { status: 500 },
    );
  }
  return NextResponse.json({ success: true });
}
