// ─────────────────────────────────────────────────────────────────────────────
// OPENY DOCS — Invoice Auto-Generation Algorithms ("Pro icon KSA")
//
// Implements the exact mathematical logic specified for OPENY DOCS:
//   • splitBudget   – distributes a total into N parts with ±5–10% variance
//   • generateDate  – spreads row dates across the first 15 days of a month
//   • generateResults – calculates CPA-based results per platform
//   • autoGenerateProIconKSA – top-level orchestrator (Total Budget → Branches)
// ─────────────────────────────────────────────────────────────────────────────

import type {
  InvoiceBranchGroup,
  InvoiceCampaignRow,
  InvoicePlatformGroup,
} from '@/lib/docs-types';

// ── Helpers ───────────────────────────────────────────────────────────────────

const uid = (): string =>
  (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 11));

// ── 1. splitBudget – variance distribution algorithm ──────────────────────────

/**
 * Distributes `total` into `parts` integers with realistic ±5–10% per-slice
 * variance so the output does NOT look evenly divided.
 *
 * Rules (from spec):
 *  • Each intermediate slice gets avg ± (5–10)% random variance.
 *  • The last slice takes the exact remainder (no drift).
 *  • Result is sorted descending so the largest value comes first.
 */
export function splitBudget(total: number, parts: number): number[] {
  if (parts <= 0) return [];
  if (parts === 1) return [total];

  const splits: number[] = [];
  let remaining = total;

  for (let i = 0; i < parts - 1; i++) {
    const avg = remaining / (parts - i);
    // Magnitude factor: random value in [0.05, 0.10] → 5–10% of avg
    // then applied positively or negatively for realistic human-like variance
    const variance =
      avg *
      (Math.random() * 0.05 + 0.05) *
      (Math.random() > 0.5 ? 1 : -1);
    const current = Math.round(avg + variance);
    splits.push(current);
    remaining -= current;
  }

  // Last part takes the exact remainder
  splits.push(remaining);

  // Always sort descending
  return splits.sort((a, b) => b - a);
}

// ── 2. Date generation ────────────────────────────────────────────────────────

/**
 * Generates a date string in "dd-MMM-yyyy" format, spreading `rowIndex` (0-based)
 * across the first 15 days of the given `campaignMonth` ("Mar-2026" format).
 *
 * Formula (from spec):
 *   step     = totalRows > 1 ? 14 / (totalRows - 1) : 0
 *   baseDay  = Math.round(1 + rowIndex * step)
 *   variance = Math.floor(Math.random() * 3) - 1   // -1, 0, or +1
 *   finalDay = clamp(baseDay + variance, 1, 15)
 */
function generateDate(
  rowIndex: number,
  totalRows: number,
  campaignMonth: string,
): string {
  // Parse "Mar-2026" → monthAbbr="Mar", year="2026"
  const parts = campaignMonth.split('-');
  const monthAbbr = parts[0] ?? 'Jan';
  const year = parts[1] ?? String(new Date().getFullYear());

  const step = totalRows > 1 ? 14 / (totalRows - 1) : 0;
  const baseDay = Math.round(1 + rowIndex * step);
  const variance = Math.floor(Math.random() * 3) - 1; // -1, 0, or +1
  const finalDay = Math.max(1, Math.min(15, baseDay + variance));

  return `${String(finalDay).padStart(2, '0')}-${monthAbbr}-${year}`;
}

// ── 3. CPA / Results generation ───────────────────────────────────────────────

interface PlatformCpaConfig {
  costMin: number;
  costMax: number;
  resultType: string;
}

/**
 * Calculates the "Results" string for a row.
 *
 * Formula (from spec):
 *   progressRatio = totalRows > 1 ? rowIndex / (totalRows - 1) : 0
 *   expectedCPA   = costMin + progressRatio * (costMax - costMin)
 *   randomVariance = 1 + (Math.random() * 0.2 - 0.1)   // ±10%
 *   finalCPA      = clamp(expectedCPA * randomVariance, costMin, costMax)
 *   results       = Math.floor(rowCost / finalCPA)
 */
function generateResults(
  rowCost: number,
  rowIndex: number,
  totalRows: number,
  config: PlatformCpaConfig,
): string {
  const { costMin, costMax, resultType } = config;

  const progressRatio = totalRows > 1 ? rowIndex / (totalRows - 1) : 0;
  const expectedCPA = costMin + progressRatio * (costMax - costMin);
  const randomVariance = 1 + (Math.random() * 0.2 - 0.1); // ±10%
  const finalCPA = Math.max(
    costMin,
    Math.min(costMax, expectedCPA * randomVariance),
  );

  const results = Math.floor(rowCost / finalCPA);
  return `${results} ${resultType}`;
}

// ── 4. Platform configuration ─────────────────────────────────────────────────

interface PlatformSpec {
  name: string;
  budgetPct: number;
  cpa: PlatformCpaConfig;
}

const PLATFORM_SPECS: PlatformSpec[] = [
  {
    name: 'Instagram',
    budgetPct: 0.5,
    cpa: { costMin: 20, costMax: 25, resultType: 'Messages' },
  },
  {
    name: 'Snapchat',
    budgetPct: 0.3,
    cpa: { costMin: 2, costMax: 4, resultType: 'Visits' },
  },
  {
    name: 'TikTok',
    budgetPct: 0.2,
    cpa: { costMin: 2, costMax: 4, resultType: 'Visits' },
  },
];

// ── 5. Public interface ───────────────────────────────────────────────────────

export interface AutoGenRowCounts {
  instagram: number;
  snapchat: number;
  tiktok: number;
}

export interface AutoGenParams {
  /** Total budget the client is charged (e.g. 50 000). */
  totalBudget: number;
  /** Fixed fees deducted before distributing ad-spend (typically 500). */
  fees: number;
  /** "Mar-2026" format — used to build row dates. */
  campaignMonth: string;
  /** How many campaign rows to generate per platform. */
  rowCounts?: AutoGenRowCounts;
}

const DEFAULT_ROW_COUNTS: AutoGenRowCounts = {
  instagram: 6,
  snapchat: 4,
  tiktok: 2,
};

// ── 6. Main orchestrator ──────────────────────────────────────────────────────

/**
 * Top-down budget distribution for the "Pro icon KSA" client type.
 *
 * 1. Net Budget = Total Budget − Fees
 * 2. Split Net Budget into 3 branch budgets (Riyadh, Jeddah, Khobar) via splitBudget
 * 3. For each branch, split into platforms (IG 50%, Snap 30%, TikTok 20%)
 * 4. For each platform, split platform budget into N rows via splitBudget
 * 5. Generate date and results (CPA-based) for every row
 */
export function autoGenerateProIconKSA(
  params: AutoGenParams,
): InvoiceBranchGroup[] {
  const { totalBudget, fees, campaignMonth } = params;
  const rowCounts: AutoGenRowCounts = {
    ...DEFAULT_ROW_COUNTS,
    ...(params.rowCounts ?? {}),
  };

  // Step 1 – Net Budget
  const netBudget = totalBudget - fees;

  // Step 2 – Split into 3 branch budgets, sorted descending (Riyadh gets most)
  const branchNames = ['Riyadh Branch', 'Jeddah Branch', 'Khobar Branch'];
  const branchBudgets = splitBudget(netBudget, 3);

  // Steps 3–5 – Build branches
  return branchBudgets.map((branchBudget, bi): InvoiceBranchGroup => {
    const platformCounts = [rowCounts.instagram, rowCounts.snapchat, rowCounts.tiktok];

    const platformGroups: InvoicePlatformGroup[] = PLATFORM_SPECS.map(
      (spec, pi): InvoicePlatformGroup => {
        const nRows = platformCounts[pi] ?? 1;

        // Step 3 – Platform budget = branch budget × platform percentage
        const platformBudget = Math.round(branchBudget * spec.budgetPct);

        // Step 4 – Split platform budget into N rows
        const rowBudgets = splitBudget(platformBudget, nRows);

        // Step 5 – Generate each campaign row
        const campaignRows: InvoiceCampaignRow[] = rowBudgets.map(
          (rowCost, ri): InvoiceCampaignRow => ({
            id: uid(),
            ad_name: `${spec.name} Ad ${ri + 1}`,
            date: generateDate(ri, nRows, campaignMonth),
            results: generateResults(rowCost, ri, nRows, spec.cpa),
            cost: rowCost,
          }),
        );

        return {
          id: uid(),
          platform_name: spec.name,
          campaign_rows: campaignRows,
        };
      },
    );

    return {
      id: uid(),
      branch_name: branchNames[bi] ?? `Branch ${bi + 1}`,
      platform_groups: platformGroups,
    };
  });
}
