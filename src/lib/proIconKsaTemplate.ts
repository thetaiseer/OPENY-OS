import type {
  InvoiceBranchGroup,
  InvoiceCampaignRow,
  InvoicePlatformGroup,
} from '@/lib/docs-types';

export const PRO_ICON_KSA_TEMPLATE_KEY = 'pro_icon_ksa' as const;
export const PRO_ICON_KSA_TEMPLATE_LABEL = 'Pro icon KSA';

export interface ProIconKsaResultRule {
  resultLabel: string;
  minCpa: number;
  maxCpa: number;
  variancePct: number;
}

export interface ProIconKsaPlatformRuleConfig {
  key: string;
  defaultEnabled: boolean;
  defaultAllocationPct: number;
  defaultCampaignCount: number;
  resultRule: ProIconKsaResultRule;
}

export interface ProIconKsaTemplateConfig {
  key: typeof PRO_ICON_KSA_TEMPLATE_KEY;
  label: string;
  clientName: string;
  defaultCurrency: string;
  defaultTotalBudget: number;
  defaultFees: number;
  deduction: {
    type: 'none' | 'fixed';
    fixedAmount: number;
  };
  fixedBranches: readonly string[];
  defaultBranchAllocationPct: readonly number[];
  defaultPlatforms: readonly ProIconKsaPlatformRuleConfig[];
  fallbackResultRule: ProIconKsaResultRule;
}

export interface ProIconKsaBranchPlatformConfig {
  id: string;
  name: string;
  enabled: boolean;
  campaignCount: number;
  allocationPct: number;
}

export interface ProIconKsaBranchConfig {
  id: string;
  name: string;
  enabled: boolean;
  allocationPct: number;
  platforms: ProIconKsaBranchPlatformConfig[];
}

export interface GenerateProIconKsaInvoiceParams {
  campaignMonth: string;
  invoiceDate?: string;
  totalBudget: number;
  fees?: number;
  clientName?: string;
  branchConfigs: ProIconKsaBranchConfig[];
  seedSalt?: string;
}

export interface GeneratedProIconKsaInvoice {
  templateKey: typeof PRO_ICON_KSA_TEMPLATE_KEY;
  clientName: string;
  totalBudgetInput: number;
  deductionAmount: number;
  finalBudget: number;
  fees: number;
  grandTotal: number;
  branchGroups: InvoiceBranchGroup[];
}

export const PRO_ICON_KSA_TEMPLATE_CONFIG: ProIconKsaTemplateConfig = {
  key: PRO_ICON_KSA_TEMPLATE_KEY,
  label: PRO_ICON_KSA_TEMPLATE_LABEL,
  clientName: 'Pro icon KSA',
  defaultCurrency: 'SAR',
  defaultTotalBudget: 49500,
  defaultFees: 500,
  deduction: {
    type: 'none',
    fixedAmount: 0,
  },
  fixedBranches: ['Riyadh', 'Jeddah', 'Khobar'],
  defaultBranchAllocationPct: [40, 33, 27],
  defaultPlatforms: [
    {
      key: 'Instagram',
      defaultEnabled: true,
      defaultAllocationPct: 50,
      defaultCampaignCount: 2,
      resultRule: {
        resultLabel: 'Messages',
        minCpa: 20,
        maxCpa: 28,
        variancePct: 0.1,
      },
    },
    {
      key: 'Snapchat',
      defaultEnabled: true,
      defaultAllocationPct: 30,
      defaultCampaignCount: 1,
      resultRule: {
        resultLabel: 'Visits',
        minCpa: 4,
        maxCpa: 8,
        variancePct: 0.1,
      },
    },
    {
      key: 'TikTok',
      defaultEnabled: true,
      defaultAllocationPct: 20,
      defaultCampaignCount: 1,
      resultRule: {
        resultLabel: 'Visits',
        minCpa: 5,
        maxCpa: 10,
        variancePct: 0.1,
      },
    },
  ],
  fallbackResultRule: {
    resultLabel: 'Visits',
    minCpa: 6,
    maxCpa: 12,
    variancePct: 0.1,
  },
};

const MAX_SPREAD_DAY = 28;

const uid = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 11);

function n(v: unknown) {
  const parsed = Number(v);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizePercentages(values: number[], total = 100) {
  if (values.length === 0) return [];
  const safe = values.map((value) => (Number.isFinite(value) && value > 0 ? value : 0));
  const sum = safe.reduce((acc, current) => acc + current, 0);
  if (sum <= 0) {
    const even = Math.floor(total / safe.length);
    const result = Array.from({ length: safe.length }, () => even);
    let remainder = total - even * safe.length;
    let index = 0;
    while (remainder > 0) {
      result[index % result.length] += 1;
      remainder -= 1;
      index += 1;
    }
    return result;
  }
  const scaled = safe.map((value) => (value / sum) * total);
  const floored = scaled.map((value) => Math.floor(value));
  let remainder = total - floored.reduce((acc, current) => acc + current, 0);
  const rank = scaled
    .map((value, index) => ({ index, frac: value - Math.floor(value) }))
    .sort((a, b) => b.frac - a.frac);
  let cursor = 0;
  while (remainder > 0 && rank.length > 0) {
    floored[rank[cursor % rank.length]!.index] += 1;
    remainder -= 1;
    cursor += 1;
  }
  return floored;
}

function splitBudgetByPercent(total: number, percentages: number[]) {
  if (percentages.length === 0) return [];
  if (total <= 0) return percentages.map(() => 0);
  const normalized = normalizePercentages(percentages);
  const raw = normalized.map((pct) => (pct / 100) * total);
  const floored = raw.map((value) => Math.floor(value));
  let remainder = total - floored.reduce((acc, current) => acc + current, 0);
  const rank = raw
    .map((value, index) => ({ index, frac: value - Math.floor(value) }))
    .sort((a, b) => b.frac - a.frac);
  let cursor = 0;
  while (remainder > 0 && rank.length > 0) {
    floored[rank[cursor % rank.length]!.index] += 1;
    remainder -= 1;
    cursor += 1;
  }
  return floored;
}

function hashString(input: string) {
  let h = 1779033703 ^ input.length;
  for (let i = 0; i < input.length; i += 1) {
    h = Math.imul(h ^ input.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

function createSeededRandom(seed: string) {
  const next = hashString(seed);
  return () => next() / 4294967296;
}

function normalizeMonth(campaignMonth: string, invoiceDate?: string) {
  const direct = campaignMonth.trim();
  const isoMonthMatch = /^(\d{4})[-/](\d{1,2})$/.exec(direct);
  if (isoMonthMatch) {
    return {
      month: clamp(Number(isoMonthMatch[2]) - 1, 0, 11),
      year: Number(isoMonthMatch[1]),
    };
  }
  const mmmMatch = /^([a-z]{3})-(\d{4})$/i.exec(direct);
  if (mmmMatch) {
    const monthMap: Record<string, number> = {
      jan: 0,
      feb: 1,
      mar: 2,
      apr: 3,
      may: 4,
      jun: 5,
      jul: 6,
      aug: 7,
      sep: 8,
      oct: 9,
      nov: 10,
      dec: 11,
    };
    return { month: monthMap[mmmMatch[1]!.toLowerCase()] ?? 0, year: Number(mmmMatch[2]) };
  }
  const baseDate =
    invoiceDate && !Number.isNaN(Date.parse(invoiceDate)) ? new Date(invoiceDate) : new Date();
  return { month: baseDate.getMonth(), year: baseDate.getFullYear() };
}

function formatCampaignMonth(campaignMonth: string, invoiceDate?: string) {
  const { month, year } = normalizeMonth(campaignMonth, invoiceDate);
  const d = new Date(Date.UTC(year, month, 1));
  const monthLabel = d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
  return `${monthLabel}-${year}`;
}

function formatIsoDate(day: number, campaignMonth: string, invoiceDate?: string) {
  const { month, year } = normalizeMonth(campaignMonth, invoiceDate);
  const d = new Date(Date.UTC(year, month, clamp(day, 1, MAX_SPREAD_DAY)));
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function generateRowDays(rowCount: number, rng: () => number) {
  if (rowCount <= 0) return [];
  if (rowCount === 1) return [1];
  const step = (MAX_SPREAD_DAY - 1) / (rowCount - 1);
  const days = Array.from({ length: rowCount }, (_, index) => {
    const base = Math.round(1 + index * step);
    const jitter = Math.floor(rng() * 5) - 2;
    return clamp(base + jitter, 1, MAX_SPREAD_DAY);
  }).sort((a, b) => a - b);
  for (let i = 1; i < days.length; i += 1) {
    if (days[i]! <= days[i - 1]!) days[i] = clamp(days[i - 1]! + 1, 1, MAX_SPREAD_DAY);
  }
  return days;
}

function splitBudgetWithVariance(total: number, rowCount: number, rng: () => number) {
  if (rowCount <= 0) return [];
  if (total <= 0) return Array.from({ length: rowCount }, () => 0);
  const rowWeights = Array.from(
    { length: rowCount },
    (_, index) => (rowCount - index) * (1 + (rng() * 2 - 1) * 0.1),
  );
  const safeWeights = rowWeights.map((value) => Math.max(0.001, value));
  const sum = safeWeights.reduce((acc, current) => acc + current, 0);
  const raw = safeWeights.map((weight) => (weight / sum) * total);
  const floored = raw.map((value) => Math.floor(value));
  let remainder = total - floored.reduce((acc, current) => acc + current, 0);
  const rank = raw
    .map((value, index) => ({ index, frac: value - Math.floor(value) }))
    .sort((a, b) => b.frac - a.frac);
  let cursor = 0;
  while (remainder > 0 && rank.length > 0) {
    floored[rank[cursor % rank.length]!.index] += 1;
    remainder -= 1;
    cursor += 1;
  }
  return floored;
}

function normalizeBranchConfigs(branches: ProIconKsaBranchConfig[]) {
  const enabledBranches = branches.filter((branch) => branch.enabled);
  const normalizedBranchPct = normalizePercentages(
    enabledBranches.map((branch) => branch.allocationPct),
  );
  let enabledBranchIndex = 0;
  const withBranchPct = branches.map((branch) => {
    if (!branch.enabled) {
      return { ...branch, allocationPct: 0 };
    }
    const allocationPct = normalizedBranchPct[enabledBranchIndex] ?? 0;
    enabledBranchIndex += 1;
    const enabledPlatforms = branch.platforms.filter((platform) => platform.enabled);
    const normalizedPlatformPct = normalizePercentages(
      enabledPlatforms.map((platform) => platform.allocationPct),
    );
    let enabledPlatformIndex = 0;
    const platforms = branch.platforms.map((platform) => {
      if (!platform.enabled) {
        return {
          ...platform,
          allocationPct: 0,
          campaignCount: Math.max(1, platform.campaignCount || 1),
        };
      }
      const nextAllocation = normalizedPlatformPct[enabledPlatformIndex] ?? 0;
      enabledPlatformIndex += 1;
      return {
        ...platform,
        campaignCount: Math.max(1, Math.round(platform.campaignCount || 1)),
        allocationPct: nextAllocation,
      };
    });
    return {
      ...branch,
      allocationPct,
      platforms,
    };
  });
  return withBranchPct;
}

function pickResultRule(platformName: string) {
  const found = PRO_ICON_KSA_TEMPLATE_CONFIG.defaultPlatforms.find(
    (platform) => platform.key.toLowerCase() === platformName.trim().toLowerCase(),
  );
  return found?.resultRule ?? PRO_ICON_KSA_TEMPLATE_CONFIG.fallbackResultRule;
}

function buildResultValue(
  platformName: string,
  cost: number,
  rowIndex: number,
  rowCount: number,
  rng: () => number,
) {
  const rule = pickResultRule(platformName);
  const ratio = rowCount > 1 ? rowIndex / (rowCount - 1) : 0;
  const targetCpa = rule.minCpa + (rule.maxCpa - rule.minCpa) * ratio;
  const jitter = 1 + (rng() * 2 - 1) * rule.variancePct;
  const effectiveCpa = clamp(targetCpa * jitter, rule.minCpa, rule.maxCpa);
  const count = Math.max(1, Math.round(cost / Math.max(1, effectiveCpa)));
  return `${count} ${rule.resultLabel}`;
}

function sumBranchGroupsCost(branchGroups: InvoiceBranchGroup[]) {
  return Math.round(
    branchGroups.reduce(
      (branchSum, branch) =>
        branchSum +
        branch.platform_groups.reduce(
          (platformSum, platform) =>
            platformSum +
            platform.campaign_rows.reduce((rowSum, row) => rowSum + (Number(row.cost) || 0), 0),
          0,
        ),
      0,
    ),
  );
}

function sumBranchCost(branch: InvoiceBranchGroup) {
  return Math.round(
    branch.platform_groups.reduce(
      (platformSum, platform) =>
        platformSum +
        platform.campaign_rows.reduce((rowSum, row) => rowSum + (Number(row.cost) || 0), 0),
      0,
    ),
  );
}

function sumPlatformCost(platform: InvoicePlatformGroup) {
  return Math.round(platform.campaign_rows.reduce((sum, row) => sum + (Number(row.cost) || 0), 0));
}

export function createDefaultProIconKsaBranchConfigs(): ProIconKsaBranchConfig[] {
  return PRO_ICON_KSA_TEMPLATE_CONFIG.fixedBranches.map((branchName, branchIndex) => ({
    id: uid(),
    name: branchName,
    enabled: true,
    allocationPct: PRO_ICON_KSA_TEMPLATE_CONFIG.defaultBranchAllocationPct[branchIndex] ?? 0,
    platforms: PRO_ICON_KSA_TEMPLATE_CONFIG.defaultPlatforms.map((platform) => ({
      id: uid(),
      name: platform.key,
      enabled: platform.defaultEnabled,
      campaignCount: platform.defaultCampaignCount,
      allocationPct: platform.defaultAllocationPct,
    })),
  }));
}

export function deriveProIconKsaBranchConfigs(
  branchGroups: InvoiceBranchGroup[] = [],
  finalBudget = 0,
): ProIconKsaBranchConfig[] {
  const fixedBranches = PRO_ICON_KSA_TEMPLATE_CONFIG.fixedBranches.map((name) =>
    name.toLowerCase(),
  );
  const groups = branchGroups.filter((branch) =>
    fixedBranches.includes(branch.branch_name.trim().toLowerCase()),
  );
  if (!groups.length) return createDefaultProIconKsaBranchConfigs();

  const total = finalBudget > 0 ? finalBudget : sumBranchGroupsCost(groups);

  const derived = PRO_ICON_KSA_TEMPLATE_CONFIG.fixedBranches.map((fixedName) => {
    const group = groups.find(
      (branch) => branch.branch_name.trim().toLowerCase() === fixedName.toLowerCase(),
    );
    if (!group) {
      return {
        id: uid(),
        name: fixedName,
        enabled: false,
        allocationPct: 0,
        platforms: PRO_ICON_KSA_TEMPLATE_CONFIG.defaultPlatforms.map((platform) => ({
          id: uid(),
          name: platform.key,
          enabled: platform.defaultEnabled,
          campaignCount: platform.defaultCampaignCount,
          allocationPct: platform.defaultAllocationPct,
        })),
      };
    }
    const branchTotal = sumBranchCost(group);
    const defaultMap = new Map(
      PRO_ICON_KSA_TEMPLATE_CONFIG.defaultPlatforms.map((platform) => [
        platform.key.toLowerCase(),
        platform,
      ]),
    );
    const knownPlatformNames = new Set<string>([
      ...PRO_ICON_KSA_TEMPLATE_CONFIG.defaultPlatforms.map((platform) =>
        platform.key.toLowerCase(),
      ),
      ...group.platform_groups.map((platform) => platform.platform_name.trim().toLowerCase()),
    ]);

    const platforms = Array.from(knownPlatformNames).map((nameLower) => {
      const existing = group.platform_groups.find(
        (platform) => platform.platform_name.trim().toLowerCase() === nameLower,
      );
      const fallback = defaultMap.get(nameLower);
      const platformTotal = existing ? sumPlatformCost(existing) : 0;
      return {
        id: uid(),
        name: existing?.platform_name || fallback?.key || nameLower,
        enabled: !!existing && existing.campaign_rows.length > 0,
        campaignCount: Math.max(
          1,
          existing?.campaign_rows.length || fallback?.defaultCampaignCount || 1,
        ),
        allocationPct:
          branchTotal > 0
            ? Math.round((platformTotal / branchTotal) * 100)
            : fallback?.defaultAllocationPct || 0,
      };
    });

    return {
      id: uid(),
      name: group.branch_name,
      enabled: group.platform_groups.length > 0,
      allocationPct: total > 0 ? Math.round((branchTotal / total) * 100) : 0,
      platforms,
    };
  });

  return normalizeBranchConfigs(derived);
}

export function generateProIconKsaInvoice(
  params: GenerateProIconKsaInvoiceParams,
): GeneratedProIconKsaInvoice {
  const totalBudget = Math.max(0, Math.round(params.totalBudget || 0));
  const deductionAmount =
    PRO_ICON_KSA_TEMPLATE_CONFIG.deduction.type === 'fixed'
      ? Math.max(0, Math.round(PRO_ICON_KSA_TEMPLATE_CONFIG.deduction.fixedAmount))
      : 0;
  const usableBudget = Math.max(0, totalBudget - deductionAmount);
  const fees = Math.max(0, Math.round(params.fees ?? 0));
  const normalized = normalizeBranchConfigs(params.branchConfigs);
  const enabledBranches = normalized.filter(
    (branch) =>
      branch.enabled &&
      branch.platforms.some((platform) => platform.enabled && platform.campaignCount > 0),
  );

  const seed = [
    PRO_ICON_KSA_TEMPLATE_KEY,
    params.campaignMonth,
    params.invoiceDate ?? '',
    String(totalBudget),
    String(fees),
    JSON.stringify(enabledBranches),
    params.seedSalt ?? '',
  ].join('|');
  const rng = createSeededRandom(seed);
  const branchBudgets = splitBudgetByPercent(
    usableBudget,
    enabledBranches.map((branch) => branch.allocationPct),
  );
  const formattedMonth = formatCampaignMonth(params.campaignMonth, params.invoiceDate);

  const branchGroups: InvoiceBranchGroup[] = enabledBranches.map((branchConfig, branchIndex) => {
    const branchBudget = branchBudgets[branchIndex] ?? 0;
    const enabledPlatforms = branchConfig.platforms.filter(
      (platform) => platform.enabled && platform.campaignCount > 0 && platform.allocationPct > 0,
    );
    const platformBudgets = splitBudgetByPercent(
      branchBudget,
      enabledPlatforms.map((platform) => platform.allocationPct),
    );

    const platformGroups: InvoicePlatformGroup[] = enabledPlatforms.map(
      (platformConfig, platformIndex) => {
        const platformBudget = platformBudgets[platformIndex] ?? 0;
        const rowCosts = splitBudgetWithVariance(platformBudget, platformConfig.campaignCount, rng);
        const rowDays = generateRowDays(platformConfig.campaignCount, rng);

        const rows: InvoiceCampaignRow[] = rowCosts.map((cost, rowIndex) => ({
          id: uid(),
          ad_name: `${branchConfig.name} ${formattedMonth} ${platformConfig.name} ${rowIndex + 1}`,
          date: formatIsoDate(rowDays[rowIndex] ?? 1, params.campaignMonth, params.invoiceDate),
          results: buildResultValue(
            platformConfig.name,
            cost,
            rowIndex,
            platformConfig.campaignCount,
            rng,
          ),
          cost,
        }));

        return {
          id: uid(),
          platform_name: platformConfig.name,
          campaign_rows: rows,
        };
      },
    );

    return {
      id: uid(),
      branch_name: branchConfig.name,
      platform_groups: platformGroups,
    };
  });

  const finalBudget = Math.max(0, sumBranchGroupsCost(branchGroups));
  return {
    templateKey: PRO_ICON_KSA_TEMPLATE_KEY,
    clientName: params.clientName || PRO_ICON_KSA_TEMPLATE_CONFIG.clientName,
    totalBudgetInput: totalBudget,
    deductionAmount,
    finalBudget,
    fees,
    grandTotal: finalBudget + fees,
    branchGroups,
  };
}

export function getProIconKsaPlatformPreviewBudget(
  totalBudget: number,
  branchConfig: ProIconKsaBranchConfig,
  platformConfig: ProIconKsaBranchPlatformConfig,
) {
  if (!branchConfig.enabled || !platformConfig.enabled) return 0;
  const normalizedBranches = normalizeBranchConfigs([branchConfig]);
  const branchPct = normalizedBranches[0]?.allocationPct ?? 0;
  const branchBudget = Math.round((Math.max(0, totalBudget) * branchPct) / 100);
  const normalizedPlatforms = normalizePercentages(
    branchConfig.platforms
      .filter((platform) => platform.enabled)
      .map((platform) => platform.allocationPct),
  );
  const enabledPlatforms = branchConfig.platforms.filter((platform) => platform.enabled);
  const index = enabledPlatforms.findIndex((platform) => platform.id === platformConfig.id);
  if (index < 0) return 0;
  return Math.round((branchBudget * (normalizedPlatforms[index] ?? 0)) / 100);
}

export function toPositiveInt(value: number, fallback = 1) {
  return Math.max(1, Math.round(n(value) || fallback));
}
