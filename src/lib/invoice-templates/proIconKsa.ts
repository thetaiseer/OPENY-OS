import type { BranchOutput, PlatformOutput, TemplateInput, TemplateOutput } from './types';
import { distributeWithVariance, generateCPAResults, generateDates } from './shared';

const FIXED_FEE = 500;
const BRANCHES = ['riyadh', 'jeddah', 'khobar'] as const;
const PLATFORM_LABELS = {
  instagram: 'Instagram',
  snapchat: 'Snapchat',
  tiktok: 'TikTok',
  google: 'Google',
  other: 'Other',
} as const;

function formatPlatformName(platform: TemplateInput['platforms'][number]['type']): string {
  return PLATFORM_LABELS[platform] ?? String(platform);
}

export function generateProIconKsa(input: TemplateInput): TemplateOutput {
  const totalBudget = Math.max(0, Math.round(input.totalBudget));
  const fixedFee = FIXED_FEE;
  const netBudget = Math.max(0, totalBudget - fixedFee);
  const branchBudgets = distributeWithVariance(netBudget, BRANCHES.length);

  const branches: BranchOutput[] = BRANCHES.map((branch, index) => {
    const branchBudget = branchBudgets[index] ?? 0;
    const platforms: PlatformOutput[] = input.platforms
      .filter((platform) => platform.percentage > 0 && platform.campaignCount > 0)
      .map((platform) => {
        const platformBudget = Math.round((branchBudget * platform.percentage) / 100);
        const campaignCosts = distributeWithVariance(platformBudget, platform.campaignCount);
        const campaignDates = generateDates(input.month, platform.campaignCount);

        const campaigns = campaignCosts.map((cost, campaignIndex) => ({
          date:
            campaignDates[campaignIndex] ??
            campaignDates[campaignDates.length - 1] ??
            `${input.month}-01`,
          adName: `${branch} ${input.month} ${formatPlatformName(platform.type)} ${campaignIndex + 1}`,
          results: generateCPAResults(cost, platform.type),
          cost,
        }));

        return {
          platform: platform.type,
          budget: campaigns.reduce((sum, row) => sum + row.cost, 0),
          campaigns,
        };
      });

    return {
      branch,
      totalBudget: branchBudget,
      platforms,
    };
  });

  const subtotal = branches.reduce(
    (branchSum, branch) =>
      branchSum +
      branch.platforms.reduce(
        (platformSum, platform) =>
          platformSum + platform.campaigns.reduce((rowSum, row) => rowSum + row.cost, 0),
        0,
      ),
    0,
  );

  const tax = Number((subtotal * 0.15).toFixed(2));
  const total = Number((subtotal + tax).toFixed(2));

  return {
    fixedFee,
    netBudget,
    branches,
    subtotal,
    tax,
    total,
  };
}
