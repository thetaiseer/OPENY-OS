import type {
  InvoiceBranchGroup,
  InvoiceCampaignRow,
  InvoicePlatformGroup,
} from '@/lib/docs-types';

export type InvoiceTemplateName =
  | 'Manual'
  | 'Pro icon KSA Template'
  | 'Pro icon UAE Template'
  | 'Pro icon Global Template'
  | 'SAMA Travel Template';

interface PlatformTemplateSpec {
  name: 'Instagram' | 'Snapchat' | 'TikTok';
  rows: number;
  weight: number;
  resultSuffix: string;
  cpaRange: [number, number];
}

interface InvoiceTemplateSpec {
  name: InvoiceTemplateName;
  clientName: string;
  branches: readonly string[];
  branchWeights: readonly number[];
  platforms: readonly PlatformTemplateSpec[];
  defaultFinalBudget: number;
  defaultFees: number;
}

export const INVOICE_TEMPLATES: Record<InvoiceTemplateName, InvoiceTemplateSpec> = {
  Manual: {
    name: 'Manual',
    clientName: '',
    branches: [],
    branchWeights: [],
    platforms: [],
    defaultFinalBudget: 0,
    defaultFees: 0,
  },
  'Pro icon KSA Template': {
    name: 'Pro icon KSA Template',
    clientName: 'Pro icon KSA',
    branches: ['Riyadh', 'Jeddah', 'Khobar'],
    branchWeights: [0.4, 0.33, 0.27],
    platforms: [
      { name: 'Instagram', rows: 6, weight: 0.5, resultSuffix: 'Messages', cpaRange: [20, 28] },
      { name: 'Snapchat', rows: 4, weight: 0.3, resultSuffix: 'Visits', cpaRange: [4, 8] },
      { name: 'TikTok', rows: 2, weight: 0.2, resultSuffix: 'Visits', cpaRange: [5, 10] },
    ],
    defaultFinalBudget: 49500,
    defaultFees: 500,
  },
  'Pro icon UAE Template': {
    name: 'Pro icon UAE Template',
    clientName: 'Pro icon UAE',
    branches: ['Dubai', 'Abu Dhabi'],
    branchWeights: [0.62, 0.38],
    platforms: [
      { name: 'Instagram', rows: 5, weight: 0.5, resultSuffix: 'Messages', cpaRange: [18, 25] },
      { name: 'Snapchat', rows: 3, weight: 0.3, resultSuffix: 'Visits', cpaRange: [4, 7] },
      { name: 'TikTok', rows: 2, weight: 0.2, resultSuffix: 'Visits', cpaRange: [5, 9] },
    ],
    defaultFinalBudget: 42000,
    defaultFees: 500,
  },
  'Pro icon Global Template': {
    name: 'Pro icon Global Template',
    clientName: 'Pro icon Global',
    branches: ['Global'],
    branchWeights: [1],
    platforms: [
      { name: 'Instagram', rows: 4, weight: 0.45, resultSuffix: 'Leads', cpaRange: [22, 30] },
      { name: 'Snapchat', rows: 3, weight: 0.3, resultSuffix: 'Visits', cpaRange: [5, 8] },
      { name: 'TikTok', rows: 3, weight: 0.25, resultSuffix: 'Visits', cpaRange: [6, 10] },
    ],
    defaultFinalBudget: 56000,
    defaultFees: 750,
  },
  'SAMA Travel Template': {
    name: 'SAMA Travel Template',
    clientName: 'SAMA Travel',
    branches: ['Riyadh', 'Jeddah'],
    branchWeights: [0.55, 0.45],
    platforms: [
      { name: 'Instagram', rows: 4, weight: 0.45, resultSuffix: 'Inquiries', cpaRange: [18, 26] },
      { name: 'Snapchat', rows: 3, weight: 0.35, resultSuffix: 'Visits', cpaRange: [4, 7] },
      { name: 'TikTok', rows: 2, weight: 0.2, resultSuffix: 'Visits', cpaRange: [5, 9] },
    ],
    defaultFinalBudget: 36000,
    defaultFees: 500,
  },
};

export const INVOICE_TEMPLATE_OPTIONS: InvoiceTemplateName[] = [
  'Manual',
  'Pro icon KSA Template',
  'Pro icon UAE Template',
  'Pro icon Global Template',
  'SAMA Travel Template',
];

export interface GenerateInvoiceFromTemplateParams {
  templateName: InvoiceTemplateName;
  campaignMonth: string;
  invoiceDate?: string;
  finalBudget?: number;
  fees?: number;
}

export interface SmartInvoicePlatformInput {
  name: 'Instagram' | 'Snapchat' | 'TikTok';
  enabled: boolean;
  campaignCount: number;
  allocationPct: number;
}

export interface GenerateSmartInvoiceParams {
  campaignMonth: string;
  invoiceDate?: string;
  finalBudget: number;
  fees?: number;
  clientName?: string;
  platforms: SmartInvoicePlatformInput[];
  seedSalt?: string;
}

const MAX_SPREAD_DAY = 28;
const DAY_SPAN = MAX_SPREAD_DAY - 1;

export interface GeneratedInvoiceTemplate {
  templateName: InvoiceTemplateName;
  clientName: string;
  finalBudget: number;
  fees: number;
  grandTotal: number;
  branchGroups: InvoiceBranchGroup[];
}

const uid = (): string =>
  (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 11));

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

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function normalizeMonth(campaignMonth: string, invoiceDate?: string) {
  const direct = campaignMonth.trim();
  const monthMap: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };
  const mmmMatch = /^([a-z]{3})-(\d{4})$/i.exec(direct);
  if (mmmMatch) {
    const month = monthMap[mmmMatch[1]!.toLowerCase()] ?? 0;
    return { month, year: Number(mmmMatch[2]) };
  }
  const isoMonthMatch = /^(\d{4})[-/](\d{1,2})$/.exec(direct);
  if (isoMonthMatch) {
    return { month: clamp(Number(isoMonthMatch[2]) - 1, 0, 11), year: Number(isoMonthMatch[1]) };
  }
  const fromDate = (invoiceDate && !Number.isNaN(Date.parse(invoiceDate)))
    ? new Date(invoiceDate)
    : new Date();
  return { month: fromDate.getMonth(), year: fromDate.getFullYear() };
}

function formatCampaignMonth(campaignMonth: string, invoiceDate?: string) {
  const { month, year } = normalizeMonth(campaignMonth, invoiceDate);
  const d = new Date(Date.UTC(year, month, 1));
  const monthLabel = d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
  return `${monthLabel}-${year}`;
}

function formatRowDate(day: number, campaignMonth: string, invoiceDate?: string) {
  const { month, year } = normalizeMonth(campaignMonth, invoiceDate);
  const d = new Date(Date.UTC(year, month, clamp(day, 1, 28)));
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mmm = d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
  return `${dd}-${mmm}-${d.getUTCFullYear()}`;
}

function splitBudgetWithWeights(
  total: number,
  weights: number[],
  rng: () => number,
  variance = 0.08,
) {
  if (weights.length === 0) return [];
  if (total <= 0) return weights.map(() => 0);
  const safeWeights = weights.map((w) => (Number.isFinite(w) && w > 0 ? w : 1));
  const sum = safeWeights.reduce((s, w) => s + w, 0);
  const noisy = safeWeights.map((w) => {
    const base = w / sum;
    const v = 1 + ((rng() * 2 - 1) * variance);
    return Math.max(0.001, base * v);
  });
  const noisySum = noisy.reduce((s, w) => s + w, 0);
  const raw = noisy.map((w) => (w / noisySum) * total);
  const rounded = raw.map((n) => Math.floor(n));
  let remainder = total - rounded.reduce((s, v) => s + v, 0);
  const fracOrder = raw
    .map((n, i) => ({ i, frac: n - Math.floor(n) }))
    .sort((a, b) => b.frac - a.frac);
  let idx = 0;
  while (remainder > 0 && fracOrder.length > 0) {
    rounded[fracOrder[idx % fracOrder.length]!.i] += 1;
    remainder -= 1;
    idx += 1;
  }
  return rounded;
}

function splitBudgetByPercent(total: number, percentages: number[]) {
  if (percentages.length === 0) return [];
  if (total <= 0) return percentages.map(() => 0);
  const safe = percentages.map((percentage) => (Number.isFinite(percentage) && percentage > 0 ? percentage : 0));
  const sum = safe.reduce((s, v) => s + v, 0);
  if (sum <= 0) return safe.map(() => 0);
  const raw = safe.map((percentage) => (percentage / sum) * total);
  const rounded = raw.map((value) => Math.floor(value));
  let remainder = total - rounded.reduce((s, v) => s + v, 0);
  const fracOrder = raw
    .map((value, index) => ({ index, frac: value - Math.floor(value) }))
    .sort((a, b) => b.frac - a.frac);
  let cursor = 0;
  while (remainder > 0 && fracOrder.length > 0) {
    const entry = fracOrder[cursor % fracOrder.length];
    if (!entry) break;
    rounded[entry.index] += 1;
    remainder -= 1;
    cursor += 1;
  }
  return rounded;
}

function splitIntegerByWeights(total: number, weights: number[]) {
  if (weights.length === 0) return [];
  if (total <= 0) return weights.map(() => 0);
  const safe = weights.map((weight) => (Number.isFinite(weight) && weight > 0 ? weight : 0));
  const sum = safe.reduce((s, v) => s + v, 0);
  if (sum <= 0) {
    const even = Math.floor(total / weights.length);
    const out = Array.from({ length: weights.length }, () => even);
    let rem = total - (even * weights.length);
    let i = 0;
    while (rem > 0) {
      out[i % out.length] += 1;
      rem -= 1;
      i += 1;
    }
    return out;
  }
  const raw = safe.map((w) => (w / sum) * total);
  const rounded = raw.map((value) => Math.floor(value));
  let remainder = total - rounded.reduce((s, v) => s + v, 0);
  const fracOrder = raw
    .map((value, index) => ({ index, frac: value - Math.floor(value) }))
    .sort((a, b) => b.frac - a.frac);
  let cursor = 0;
  while (remainder > 0 && fracOrder.length > 0) {
    const entry = fracOrder[cursor % fracOrder.length];
    if (!entry) break;
    rounded[entry.index] += 1;
    remainder -= 1;
    cursor += 1;
  }
  return rounded;
}

function generateRowDays(rowCount: number, rng: () => number) {
  if (rowCount <= 0) return [];
  if (rowCount === 1) return [1];
  const step = DAY_SPAN / (rowCount - 1);
  const days = Array.from({ length: rowCount }, (_, i) => {
    const base = Math.round(1 + (i * step));
    const jitter = Math.floor(rng() * 5) - 2;
    return clamp(base + jitter, 1, MAX_SPREAD_DAY);
  }).sort((a, b) => a - b);
  for (let i = 1; i < days.length; i += 1) {
    if (days[i]! <= days[i - 1]!) days[i] = clamp(days[i - 1]! + 1, 1, MAX_SPREAD_DAY);
  }
  return days;
}

function buildResults(
  platform: PlatformTemplateSpec,
  spend: number,
  rowIndex: number,
  rowCount: number,
  rng: () => number,
) {
  const [minCpa, maxCpa] = platform.cpaRange;
  const ratio = rowCount > 1 ? rowIndex / (rowCount - 1) : 0;
  const targetCpa = minCpa + ((maxCpa - minCpa) * ratio);
  const variance = 1 + ((rng() * 2 - 1) * 0.1);
  const finalCpa = clamp(targetCpa * variance, minCpa, maxCpa);
  const count = Math.max(1, Math.round(spend / finalCpa));
  return `${count} ${platform.resultSuffix}`;
}

function generateProIconKsaTemplate(
  params: Omit<GenerateInvoiceFromTemplateParams, 'templateName'>,
): GeneratedInvoiceTemplate {
  const template = INVOICE_TEMPLATES['Pro icon KSA Template'];
  const formattedMonth = formatCampaignMonth(params.campaignMonth, params.invoiceDate);
  const finalBudget = Math.max(0, Math.round(params.finalBudget ?? template.defaultFinalBudget));
  const fees = Math.max(0, Math.round(params.fees ?? template.defaultFees));
  const seed = [
    template.name,
    formattedMonth,
    params.invoiceDate ?? '',
    String(finalBudget),
    String(fees),
  ].join('|');
  const rng = createSeededRandom(seed);

  const branchWeights = template.branchWeights.length === template.branches.length
    ? template.branchWeights
    : Array.from({ length: template.branches.length }, () => 1);
  const branchBudgets = splitBudgetWithWeights(finalBudget, [...branchWeights], rng, 0.07);

  const branchGroups: InvoiceBranchGroup[] = template.branches.map((branchName, branchIndex) => {
    const branchBudget = branchBudgets[branchIndex] ?? 0;
    const platformBudgets = splitBudgetWithWeights(
      branchBudget,
      template.platforms.map((platform) => platform.weight),
      rng,
      0.08,
    );

    const platformGroups: InvoicePlatformGroup[] = template.platforms.map((platform, platformIndex) => {
      const platformBudget = platformBudgets[platformIndex] ?? 0;
      const rowBudgets = splitBudgetWithWeights(
        platformBudget,
        // Descending per-row weights intentionally front-load spend on early rows,
        // creating realistic pacing while preserving exact platform totals.
        Array.from({ length: platform.rows }, (_, i) => platform.rows - i),
        rng,
        0.1,
      );
      const rowDays = generateRowDays(platform.rows, rng);
      const rows: InvoiceCampaignRow[] = rowBudgets.map((cost, rowIndex) => ({
        id: uid(),
        ad_name: `${branchName} ${formattedMonth} ${platform.name} ${rowIndex + 1}`,
        date: formatRowDate(rowDays[rowIndex] ?? 1, params.campaignMonth, params.invoiceDate),
        results: buildResults(platform, cost, rowIndex, platform.rows, rng),
        cost,
      }));
      return {
        id: uid(),
        platform_name: platform.name,
        campaign_rows: rows,
      };
    });

    return {
      id: uid(),
      branch_name: branchName,
      platform_groups: platformGroups,
    };
  });

  return {
    templateName: 'Pro icon KSA Template',
    clientName: template.clientName,
    finalBudget,
    fees,
    grandTotal: finalBudget + fees,
    branchGroups,
  };
}

function generatePresetTemplate(
  templateName: Exclude<InvoiceTemplateName, 'Manual' | 'Pro icon KSA Template'>,
  params: Omit<GenerateInvoiceFromTemplateParams, 'templateName'>,
): GeneratedInvoiceTemplate {
  const template = INVOICE_TEMPLATES[templateName];
  const formattedMonth = formatCampaignMonth(params.campaignMonth, params.invoiceDate);
  const finalBudget = Math.max(0, Math.round(params.finalBudget ?? template.defaultFinalBudget));
  const fees = Math.max(0, Math.round(params.fees ?? template.defaultFees));
  const branchWeights = template.branchWeights.length === template.branches.length
    ? [...template.branchWeights]
    : Array.from({ length: template.branches.length }, () => 1);
  const branchBudgets = splitBudgetByPercent(finalBudget, branchWeights.map((weight) => weight * 100));

  const branchGroups: InvoiceBranchGroup[] = template.branches.map((branchName, branchIndex) => {
    const branchBudget = branchBudgets[branchIndex] ?? 0;
    const platformBudgets = splitBudgetByPercent(
      branchBudget,
      template.platforms.map((platform) => platform.weight * 100),
    );
    const platformGroups: InvoicePlatformGroup[] = template.platforms.map((platform, platformIndex) => {
      const platformBudget = platformBudgets[platformIndex] ?? 0;
      const rowBudgets = splitBudgetByPercent(
        platformBudget,
        Array.from({ length: platform.rows }, () => 1),
      );
      const rows: InvoiceCampaignRow[] = rowBudgets.map((cost, rowIndex) => {
        const day = clamp(Math.round(((rowIndex + 1) * MAX_SPREAD_DAY) / (platform.rows + 1)), 1, MAX_SPREAD_DAY);
        const estimatedResults = Math.max(1, Math.round(cost / Math.max(1, platform.cpaRange[0])));
        return {
          id: uid(),
          ad_name: `${branchName} ${formattedMonth} ${platform.name} ${rowIndex + 1}`,
          date: formatRowDate(day, params.campaignMonth, params.invoiceDate),
          results: `${estimatedResults} ${platform.resultSuffix}`,
          cost,
        };
      });
      return {
        id: uid(),
        platform_name: platform.name,
        campaign_rows: rows,
      };
    });
    return {
      id: uid(),
      branch_name: branchName,
      platform_groups: platformGroups,
    };
  });

  return {
    templateName,
    clientName: template.clientName,
    finalBudget,
    fees,
    grandTotal: finalBudget + fees,
    branchGroups,
  };
}

export function generateInvoiceFromTemplate(
  params: GenerateInvoiceFromTemplateParams,
): GeneratedInvoiceTemplate {
  if (params.templateName === 'Pro icon KSA Template') {
    return generateProIconKsaTemplate(params);
  }
  if (params.templateName === 'Pro icon UAE Template') {
    return generatePresetTemplate('Pro icon UAE Template', params);
  }
  if (params.templateName === 'Pro icon Global Template') {
    return generatePresetTemplate('Pro icon Global Template', params);
  }
  if (params.templateName === 'SAMA Travel Template') {
    return generatePresetTemplate('SAMA Travel Template', params);
  }
  return {
    templateName: 'Manual',
    clientName: '',
    finalBudget: 0,
    fees: 0,
    grandTotal: 0,
    branchGroups: [],
  };
}

export function generateSmartInvoice(params: GenerateSmartInvoiceParams): GeneratedInvoiceTemplate {
  const template = INVOICE_TEMPLATES['Pro icon KSA Template'];
  const finalBudget = Math.max(0, Math.round(params.finalBudget || 0));
  const fees = Math.max(0, Math.round(params.fees || 0));
  const formattedMonth = formatCampaignMonth(params.campaignMonth, params.invoiceDate);
  const normalizedPlatforms = params.platforms
    .filter((platform) => platform.enabled && platform.campaignCount > 0 && platform.allocationPct > 0)
    .map((platform) => ({
      ...platform,
      campaignCount: Math.max(1, Math.round(platform.campaignCount)),
      allocationPct: Math.max(0, platform.allocationPct),
    }));

  const seed = [
    'smart',
    formattedMonth,
    params.invoiceDate ?? '',
    String(finalBudget),
    String(fees),
    JSON.stringify(normalizedPlatforms),
    params.seedSalt ?? '',
  ].join('|');
  const rng = createSeededRandom(seed);

  const platformSpecs = template.platforms.reduce<Record<string, PlatformTemplateSpec>>((acc, item) => {
    acc[item.name] = item;
    return acc;
  }, {});

  const platformBudgets = splitBudgetByPercent(
    finalBudget,
    normalizedPlatforms.map((platform) => platform.allocationPct),
  );
  const branchWeights = template.branchWeights.length === template.branches.length
    ? [...template.branchWeights]
    : Array.from({ length: template.branches.length }, () => 1);

  const branchMap = new Map<string, InvoicePlatformGroup[]>(
    template.branches.map((branch) => [branch, []]),
  );

  normalizedPlatforms.forEach((platform, platformIndex) => {
    const spec = platformSpecs[platform.name] ?? {
      name: platform.name,
      rows: platform.campaignCount,
      weight: 1,
      resultSuffix: platform.name === 'Instagram' ? 'Messages' : 'Visits',
      cpaRange: platform.name === 'Instagram' ? [20, 25] : [4, 9],
    };
    const platformBudget = platformBudgets[platformIndex] ?? 0;
    const countsByBranch = splitIntegerByWeights(platform.campaignCount, branchWeights);
    const budgetByBranch = splitBudgetWithWeights(platformBudget, countsByBranch, rng, 0.05);

    template.branches.forEach((branchName, branchIndex) => {
      const rowsCount = countsByBranch[branchIndex] ?? 0;
      if (rowsCount <= 0) return;
      const rowBudgets = splitBudgetWithWeights(
        budgetByBranch[branchIndex] ?? 0,
        Array.from({ length: rowsCount }, (_, idx) => rowsCount - idx),
        rng,
        0.1,
      );
      const rowDays = generateRowDays(rowsCount, rng);
      const rows: InvoiceCampaignRow[] = rowBudgets.map((cost, rowIndex) => ({
        id: uid(),
        ad_name: `${branchName} ${formattedMonth} ${platform.name} ${rowIndex + 1}`,
        date: formatRowDate(rowDays[rowIndex] ?? 1, params.campaignMonth, params.invoiceDate),
        results: buildResults(spec, cost, rowIndex, rowsCount, rng),
        cost,
      }));

      const branchPlatforms = branchMap.get(branchName) ?? [];
      branchPlatforms.push({
        id: uid(),
        platform_name: platform.name,
        campaign_rows: rows,
      });
      branchMap.set(branchName, branchPlatforms);
    });
  });

  const branchGroups: InvoiceBranchGroup[] = template.branches
    .map((branchName) => ({
      id: uid(),
      branch_name: branchName,
      platform_groups: branchMap.get(branchName) ?? [],
    }))
    .filter((branch) => branch.platform_groups.length > 0);

  return {
    templateName: 'Pro icon KSA Template',
    clientName: params.clientName ?? template.clientName,
    finalBudget,
    fees,
    grandTotal: finalBudget + fees,
    branchGroups,
  };
}
