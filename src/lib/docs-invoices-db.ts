import type { SupabaseClient } from '@supabase/supabase-js';
import type { InvoiceBranchGroup, InvoiceCampaignRow, InvoicePlatformGroup } from '@/lib/docs-types';
import { PG_UNDEFINED_TABLE } from '@/lib/constants/postgres-errors';

type InvoiceRowRecord = {
  id: string;
  platform_id: string;
  ad_name: string | null;
  date: string | null;
  results: string | null;
  cost: number | null;
  position: number | null;
};

type InvoicePlatformRecord = {
  id: string;
  branch_id: string;
  platform_name: string | null;
  position: number | null;
};

type InvoiceBranchRecord = {
  id: string;
  invoice_id: string;
  branch_name: string | null;
  position: number | null;
};

function groupPush<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const existing = map.get(key);
  if (existing) {
    existing.push(value);
    return;
  }
  map.set(key, [value]);
}

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
              date: r.date || '',
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
  const messageIndicatesMissingDocsTable = (
    /could not find table ['"]public\.docs_invoices['"]/.test(text) ||
    /relation ["']docs_invoices["'] does not exist/.test(text) ||
    /relation ["']docs_invoice_(branches|platforms|rows)["'] does not exist/.test(text)
  );
  return (
    error.code === PG_UNDEFINED_TABLE ||
    error.code === 'PGRST204' ||
    messageIndicatesMissingDocsTable
  );
}

export function mapInvoiceDbError(
  error: { code?: string; message?: string } | null | undefined,
  fallbackMessage: string,
) {
  if (isSchemaIssue(error)) {
    return 'Invoice data tables are unavailable. Please verify invoice migrations and Supabase schema cache.';
  }
  return fallbackMessage;
}

const INVOICE_ROOT_FIELDS = [
  'invoice_number',
  'client_name',
  'campaign_month',
  'invoice_date',
  'total_budget',
  'final_budget',
  'our_fees',
  'grand_total',
  'currency',
  'status',
  'custom_client',
  'custom_project',
  'notes',
  'client_profile_id',
] as const;

type InvoiceRootField = typeof INVOICE_ROOT_FIELDS[number];

export function pickInvoiceRootPayload(source: Record<string, unknown>) {
  const payload: Partial<Record<InvoiceRootField, unknown>> = {};
  INVOICE_ROOT_FIELDS.forEach((field) => {
    const value = source[field];
    if (typeof value === 'undefined') return;
    payload[field] = value;
  });
  return payload;
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

  const rowsByPlatform = new Map<string, InvoiceRowRecord[]>();

  (rows ?? []).forEach((row) => groupPush(rowsByPlatform, row.platform_id, row));

  const platformsByBranch = new Map<string, InvoicePlatformRecord[]>();

  (platforms ?? []).forEach((platform) => groupPush(platformsByBranch, platform.branch_id, platform));

  const branchesByInvoice = new Map<string, InvoiceBranchRecord[]>();

  branches.forEach((branch) => groupPush(branchesByInvoice, branch.invoice_id, branch));

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
  const { data: existingBranches, error: fetchBranchesError } = await db
    .schema('public')
    .from('docs_invoice_branches')
    .select('id')
    .eq('invoice_id', invoiceId);

  if (fetchBranchesError) {
    if (isSchemaIssue(fetchBranchesError)) return;
    throw fetchBranchesError;
  }

  const branchIds = (existingBranches ?? []).map(branch => branch.id as string);
  if (branchIds.length > 0) {
    const { data: existingPlatforms, error: fetchPlatformsError } = await db
      .schema('public')
      .from('docs_invoice_platforms')
      .select('id')
      .in('branch_id', branchIds);

    if (fetchPlatformsError) {
      if (isSchemaIssue(fetchPlatformsError)) return;
      throw fetchPlatformsError;
    }

    const platformIds = (existingPlatforms ?? []).map(platform => platform.id as string);
    if (platformIds.length > 0) {
      const { error: deleteRowsError } = await db
        .schema('public')
        .from('docs_invoice_rows')
        .delete()
        .in('platform_id', platformIds);
      if (deleteRowsError) {
        if (isSchemaIssue(deleteRowsError)) return;
        throw deleteRowsError;
      }

      const { error: deletePlatformsError } = await db
        .schema('public')
        .from('docs_invoice_platforms')
        .delete()
        .in('id', platformIds);
      if (deletePlatformsError) {
        if (isSchemaIssue(deletePlatformsError)) return;
        throw deletePlatformsError;
      }
    }
  }

  const { error: deleteBranchesError } = await db
    .schema('public')
    .from('docs_invoice_branches')
    .delete()
    .eq('invoice_id', invoiceId);

  if (deleteBranchesError) {
    if (isSchemaIssue(deleteBranchesError)) return;
    throw deleteBranchesError;
  }

  const branchPayload = branchGroups.map((branch, branchIndex) => ({
    invoice_id: invoiceId,
    branch_name: branch.branch_name || 'Branch',
    position: branchIndex,
  }));

  if (!branchPayload.length) return;

  const { data: insertedBranches, error: branchInsertError } = await db
    .schema('public')
    .from('docs_invoice_branches')
    .insert(branchPayload)
    .select('id, position');

  if (branchInsertError) throw branchInsertError;

  const branchIdByPosition = new Map<number, string>();
  (insertedBranches ?? []).forEach((branch) => {
    if (typeof branch.position !== 'number') return;
    branchIdByPosition.set(branch.position, branch.id as string);
  });

  const platformSources: Array<{
    branch_id: string;
    platform_position: number;
    platform: InvoicePlatformGroup;
  }> = [];

  branchGroups.forEach((branch, branchIndex) => {
    const branchId = branchIdByPosition.get(branchIndex);
    if (!branchId) return;
    branch.platform_groups.forEach((platform, platformIndex) => {
      platformSources.push({
        branch_id: branchId,
        platform_position: platformIndex,
        platform,
      });
    });
  });

  if (!platformSources.length) return;

  const platformsPayload = platformSources.map((entry) => ({
    branch_id: entry.branch_id,
    platform_name: entry.platform.platform_name || 'Platform',
    position: entry.platform_position,
  }));

  const { data: insertedPlatforms, error: platformsInsertError } = await db
    .schema('public')
    .from('docs_invoice_platforms')
    .insert(platformsPayload)
    .select('id, branch_id, position');

  if (platformsInsertError) throw platformsInsertError;

  const sourceByBranchAndPosition = new Map<string, InvoicePlatformGroup>();
  platformSources.forEach((entry) => {
    sourceByBranchAndPosition.set(`${entry.branch_id}:${entry.platform_position}`, entry.platform);
  });

  const rowsPayload: Array<{
    platform_id: string;
    ad_name: string;
    date: string | null;
    results: string;
    cost: number;
    position: number;
  }> = [];

  (insertedPlatforms ?? []).forEach((insertedPlatform) => {
    if (typeof insertedPlatform.position !== 'number') return;
    const sourcePlatform = sourceByBranchAndPosition.get(
      `${insertedPlatform.branch_id}:${insertedPlatform.position}`,
    );
    if (!sourcePlatform) return;

    sourcePlatform.campaign_rows.forEach((row, rowIndex) => {
      rowsPayload.push({
        platform_id: insertedPlatform.id as string,
        ad_name: row.ad_name || '',
        date: row.date || null,
        results: row.results || '',
        cost: round2(n(row.cost)),
        position: rowIndex,
      });
    });
  });

  if (!rowsPayload.length) return;

  const { error: rowsInsertError } = await db
    .schema('public')
    .from('docs_invoice_rows')
    .insert(rowsPayload);

  if (rowsInsertError) throw rowsInsertError;
}
