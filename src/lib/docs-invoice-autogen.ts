import type {
  InvoiceBranchGroup,
  InvoiceCampaignRow,
  InvoicePlatformGroup,
} from '@/lib/docs-types';

export type InvoiceTemplateName = 'Manual' | 'Pro icon KSA Template';

interface PlatformTemplateSpec {
  name: 'Instagram' | 'Snapchat' | 'TikTok';
  rows: number;
  weight: number;
  resultSuffix: 'Messages' | 'Visits';
  cpaRange: [number, number];
}

interface InvoiceTemplateSpec {
  name: InvoiceTemplateName;
  clientName: string;
  branches: readonly string[];
  platforms: readonly PlatformTemplateSpec[];
  defaultFinalBudget: number;
  defaultFees: number;
}

export const INVOICE_TEMPLATES: Record<InvoiceTemplateName, InvoiceTemplateSpec> = {
  Manual: {
    name: 'Manual',
    clientName: '',
    branches: [],
    platforms: [],
    defaultFinalBudget: 0,
    defaultFees: 0,
  },
  'Pro icon KSA Template': {
    name: 'Pro icon KSA Template',
    clientName: 'Pro icon KSA',
    branches: ['Riyadh', 'Jeddah', 'Khobar'],
    platforms: [
      { name: 'Instagram', rows: 6, weight: 0.5, resultSuffix: 'Messages', cpaRange: [20, 28] },
      { name: 'Snapchat', rows: 4, weight: 0.3, resultSuffix: 'Visits', cpaRange: [4, 8] },
      { name: 'TikTok', rows: 2, weight: 0.2, resultSuffix: 'Visits', cpaRange: [5, 10] },
    ],
    defaultFinalBudget: 49500,
    defaultFees: 500,
  },
};

export interface GenerateInvoiceFromTemplateParams {
  templateName: InvoiceTemplateName;
  campaignMonth: string;
  invoiceDate?: string;
  finalBudget?: number;
  fees?: number;
}

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

function generateRowDays(rowCount: number, rng: () => number) {
  if (rowCount <= 0) return [];
  if (rowCount === 1) return [1];
  const step = 14 / (rowCount - 1);
  const days = Array.from({ length: rowCount }, (_, i) => {
    const base = Math.round(1 + (i * step));
    const jitter = Math.floor(rng() * 3) - 1;
    return clamp(base + jitter, 1, 15);
  }).sort((a, b) => a - b);
  for (let i = 1; i < days.length; i += 1) {
    if (days[i]! <= days[i - 1]!) days[i] = clamp(days[i - 1]! + 1, 1, 15);
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

  const branchBudgets = splitBudgetWithWeights(finalBudget, [0.4, 0.33, 0.27], rng, 0.07);

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
        Array.from({ length: platform.rows }, (_, i) => platform.rows - i),
        rng,
        0.1,
      );
      const rowDays = generateRowDays(platform.rows, rng);
      const rows: InvoiceCampaignRow[] = rowBudgets.map((cost, rowIndex) => ({
        id: uid(),
        ad_name: `${branchName} ${formattedMonth} ${platform.name} ${rowIndex + 1}`,
        date: formatRowDate(rowDays[rowIndex] ?? 1, formattedMonth, params.invoiceDate),
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

export function generateInvoiceFromTemplate(
  params: GenerateInvoiceFromTemplateParams,
): GeneratedInvoiceTemplate {
  if (params.templateName === 'Pro icon KSA Template') {
    return generateProIconKsaTemplate(params);
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
