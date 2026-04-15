import type { SupabaseClient } from '@supabase/supabase-js';
import type { InvoiceBranchGroup, InvoiceCampaignRow, InvoicePlatformGroup } from '@/lib/docs-types';
import { PG_UNDEFINED_TABLE } from '@/lib/constants/postgres-errors';

function n(v: unknown) {
  const parsed = Number(v);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round2(v: number) {
  return Math.round(v * 100) / 100;
}

export function normalizeInvoiceBranchGroups(branchGroups: unknown): InvoiceBranchGroup[] {
  if (!Array.isArray(branchGroups)) return [];

  return branchGroups.map((branch, branchIndex) => {
    const b = branch as Partial<InvoiceBranchGroup>;
    const platformGroups = Array.isArray(b.platform_groups) ? b.platform_groups : [];

    return {
      id: b.id || `branch-${branchIndex + 1}`,
      branch_name: (b.branch_name || 'Branch').trim(),
      platform_groups: platformGroups.map((platform, platformIndex) => {
        const p = platform as Partial<InvoicePlatformGroup>;
        const rows = Array.isArray(p.campaign_rows) ? p.campaign_rows : [];

        return {
          id: p.id || `platform-${branchIndex + 1}-${platformIndex + 1}`,
          platform_name: (p.platform_name || 'Platform').trim(),
          campaign_rows: rows.map((row, rowIndex) => {
            const r = row as Partial<InvoiceCampaignRow>;
            return {
              id: r.id || `row-${branchIndex + 1}-${platformIndex + 1}-${rowIndex + 1}`,
              ad_name: r.ad_name || '',
              date: r.date || null,
              results: r.results || '',
              cost: round2(n(r.cost)),
            };
          }),
        };
      }),
    };
  });
}

export function calculateInvoiceTotals(branchGroups: InvoiceBranchGroup[], ourFees: unknown) {
  const finalBudget = round2(branchGroups.reduce((branchSum, branch) => (
    branchSum + branch.platform_groups.reduce((platformSum, platform) => (
      platformSum + platform.campaign_rows.reduce((rowSum, row) => rowSum + n(row.cost), 0)
    ), 0)
  ), 0));
  const fees = round2(n(ourFees));
  return {
    final_budget: finalBudget,
    total_budget: finalBudget,
    our_fees: fees,
    grand_total: round2(finalBudget + fees),
  };
}

function isSchemaIssue(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  const text = `${error.message ?? ''}`.toLowerCase();
  return (
    error.code === PG_UNDEFINED_TABLE ||
    error.code === 'PGRST204' ||
    text.includes('could not find table') ||
    text.includes('docs_invoice') ||
    text.includes('docs_invoices')
  );
}

export function mapInvoiceDbError(
  error: { code?: string; message?: string } | null | undefined,
  fallbackMessage: string,
) {
  if (isSchemaIssue(error)) {
    return 'Invoice database is not ready yet. Please run the invoice migration and reload the Supabase schema cache.';
  }
  return fallbackMessage;
}

export async function hydrateInvoiceBranchGroups(
  db: SupabaseClient,
  invoices: Array<{ id: string; branch_groups?: unknown }>,
) {
  if (!invoices.length) return invoices;

  const invoiceIds = invoices.map(inv => inv.id);
  const { data: branches, error: branchesErr } = await db
    .schema('public')
    .from('docs_invoice_branches')
    .select('id, invoice_id, branch_name, position')
    .in('invoice_id', invoiceIds)
    .order('position', { ascending: true });

  if (branchesErr) {
    if (isSchemaIssue(branchesErr)) return invoices;
    throw branchesErr;
  }

  if (!branches || branches.length === 0) return invoices;

  const branchIds = branches.map(b => b.id);
  const { data: platforms, error: platformsErr } = await db
    .schema('public')
    .from('docs_invoice_platforms')
    .select('id, branch_id, platform_name, position')
    .in('branch_id', branchIds)
    .order('position', { ascending: true });

  if (platformsErr) {
    if (isSchemaIssue(platformsErr)) return invoices;
    throw platformsErr;
  }

  const platformIds = (platforms ?? []).map(p => p.id);
  const { data: rows, error: rowsErr } = platformIds.length > 0
    ? await db
        .schema('public')
        .from('docs_invoice_rows')
        .select('id, platform_id, ad_name, date, results, cost, position')
        .in('platform_id', platformIds)
        .order('position', { ascending: true })
    : { data: [], error: null };

  if (rowsErr) {
    if (isSchemaIssue(rowsErr)) return invoices;
    throw rowsErr;
  }

  const rowsByPlatform = new Map<string, Array<{
    id: string;
    platform_id: string;
    ad_name: string | null;
    date: string | null;
    results: string | null;
    cost: number | null;
    position: number | null;
  }>>();

  (rows ?? []).forEach((row) => {
    const list = rowsByPlatform.get(row.platform_id) ?? [];
    list.push(row);
    rowsByPlatform.set(row.platform_id, list);
  });

  const platformsByBranch = new Map<string, Array<{
    id: string;
    branch_id: string;
    platform_name: string | null;
    position: number | null;
  }>>();

  (platforms ?? []).forEach((platform) => {
    const list = platformsByBranch.get(platform.branch_id) ?? [];
    list.push(platform);
    platformsByBranch.set(platform.branch_id, list);
  });

  const branchesByInvoice = new Map<string, Array<{
    id: string;
    invoice_id: string;
    branch_name: string | null;
    position: number | null;
  }>>();

  branches.forEach((branch) => {
    const list = branchesByInvoice.get(branch.invoice_id) ?? [];
    list.push(branch);
    branchesByInvoice.set(branch.invoice_id, list);
  });

  return invoices.map((invoice) => {
    const invoiceBranches = branchesByInvoice.get(invoice.id) ?? [];
    if (invoiceBranches.length === 0) return invoice;

    const branchGroups: InvoiceBranchGroup[] = invoiceBranches.map((branch) => {
      const branchPlatforms = platformsByBranch.get(branch.id) ?? [];

      const platformGroups: InvoicePlatformGroup[] = branchPlatforms.map((platform) => {
        const platformRows = rowsByPlatform.get(platform.id) ?? [];
        return {
          id: platform.id,
          platform_name: platform.platform_name || 'Platform',
          campaign_rows: platformRows.map((row) => ({
            id: row.id,
            ad_name: row.ad_name || '',
            date: row.date || '',
            results: row.results || '',
            cost: n(row.cost),
          })),
        };
      });

      return {
        id: branch.id,
        branch_name: branch.branch_name || 'Branch',
        platform_groups: platformGroups,
      };
    });

    return {
      ...invoice,
      branch_groups: branchGroups,
    };
  });
}

export async function replaceInvoiceBranchGroups(
  db: SupabaseClient,
  invoiceId: string,
  branchGroups: InvoiceBranchGroup[],
) {
  const { error: deleteError } = await db
    .schema('public')
    .from('docs_invoice_branches')
    .delete()
    .eq('invoice_id', invoiceId);

  if (deleteError) {
    if (isSchemaIssue(deleteError)) return;
    throw deleteError;
  }

  for (let branchIndex = 0; branchIndex < branchGroups.length; branchIndex++) {
    const branch = branchGroups[branchIndex];
    const { data: branchData, error: branchError } = await db
      .schema('public')
      .from('docs_invoice_branches')
      .insert({
        invoice_id: invoiceId,
        branch_name: branch.branch_name || 'Branch',
        position: branchIndex,
      })
      .select('id')
      .single();

    if (branchError) throw branchError;
    const branchId = branchData.id as string;

    for (let platformIndex = 0; platformIndex < branch.platform_groups.length; platformIndex++) {
      const platform = branch.platform_groups[platformIndex];
      const { data: platformData, error: platformError } = await db
        .schema('public')
        .from('docs_invoice_platforms')
        .insert({
          branch_id: branchId,
          platform_name: platform.platform_name || 'Platform',
          position: platformIndex,
        })
        .select('id')
        .single();

      if (platformError) throw platformError;
      const platformId = platformData.id as string;

      const rowsPayload = platform.campaign_rows.map((row, rowIndex) => ({
        platform_id: platformId,
        ad_name: row.ad_name || '',
        date: row.date || null,
        results: row.results || '',
        cost: round2(n(row.cost)),
        position: rowIndex,
      }));

      if (!rowsPayload.length) continue;

      const { error: rowsInsertError } = await db
        .schema('public')
        .from('docs_invoice_rows')
        .insert(rowsPayload);

      if (rowsInsertError) throw rowsInsertError;
    }
  }
}
