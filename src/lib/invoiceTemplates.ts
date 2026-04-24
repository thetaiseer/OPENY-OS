import type { InvoiceBranchGroup } from '@/lib/docs-types';
import { generateProIconKsa, type TemplateInput } from '@/lib/invoice-templates';
import {
  createDefaultProIconKsaBranchConfigs,
  PRO_ICON_KSA_TEMPLATE_CONFIG,
  PRO_ICON_KSA_TEMPLATE_KEY,
  type ProIconKsaBranchConfig,
} from '@/lib/proIconKsaTemplate';

export type InvoiceTemplateKey = 'manual' | typeof PRO_ICON_KSA_TEMPLATE_KEY;
export type LegacyInvoiceTemplateName =
  | 'Manual'
  | 'Pro icon KSA Template'
  | 'Pro icon UAE Template'
  | 'Pro icon Global Template'
  | 'SAMA Travel Template';

export type InvoiceTemplateName = InvoiceTemplateKey | LegacyInvoiceTemplateName;

export interface InvoiceTemplateOption {
  key: InvoiceTemplateKey;
  label: string;
}

export interface AppliedInvoiceTemplate {
  templateKey: InvoiceTemplateKey;
  clientName: string;
  totalBudget: number;
  fees: number;
  grandTotal: number;
  branchGroups: InvoiceBranchGroup[];
  defaultBranchConfigs?: ProIconKsaBranchConfig[];
}

export const INVOICE_TEMPLATE_OPTIONS: InvoiceTemplateOption[] = [
  { key: 'manual', label: 'Standard Manual Invoice' },
  { key: PRO_ICON_KSA_TEMPLATE_KEY, label: PRO_ICON_KSA_TEMPLATE_CONFIG.label },
];

export const INVOICE_TEMPLATES = {
  manual: {
    key: 'manual' as const,
    label: 'Standard Manual Invoice',
    clientName: '',
  },
  [PRO_ICON_KSA_TEMPLATE_KEY]: PRO_ICON_KSA_TEMPLATE_CONFIG,
};

export function normalizeInvoiceTemplateName(value: string | null | undefined): InvoiceTemplateKey {
  if (!value) return 'manual';
  const normalized = value.trim().toLowerCase();
  if (normalized === 'manual') return 'manual';
  if (normalized === PRO_ICON_KSA_TEMPLATE_KEY) return PRO_ICON_KSA_TEMPLATE_KEY;
  if (normalized === 'pro icon ksa template') return PRO_ICON_KSA_TEMPLATE_KEY;
  return 'manual';
}

export interface ApplyInvoiceTemplateParams {
  templateKey: InvoiceTemplateKey;
  campaignMonth: string;
  invoiceDate?: string;
  totalBudget?: number;
  fees?: number;
}

const DEFAULT_PRO_ICON_KSA_PLATFORMS: TemplateInput['platforms'] = [
  { type: 'instagram', percentage: 50, campaignCount: 2 },
  { type: 'snapchat', percentage: 30, campaignCount: 1 },
  { type: 'tiktok', percentage: 20, campaignCount: 1 },
];

function normalizePlatformLabel(platform: string) {
  return platform
    .split('_')
    .map((segment) => segment.slice(0, 1).toUpperCase() + segment.slice(1))
    .join(' ');
}

function templateOutputToBranchGroups(output: Awaited<ReturnType<typeof generateProIconKsa>>): InvoiceBranchGroup[] {
  return output.branches.map((branch, branchIndex) => ({
    id: `branch-${branchIndex}-${branch.branch}`,
    branch_name: normalizePlatformLabel(branch.branch),
    platform_groups: branch.platforms.map((platform, platformIndex) => ({
      id: `platform-${branchIndex}-${platformIndex}-${platform.platform}`,
      platform_name: normalizePlatformLabel(String(platform.platform)),
      campaign_rows: platform.campaigns.map((campaign, campaignIndex) => ({
        id: `row-${branchIndex}-${platformIndex}-${campaignIndex}`,
        ad_name: campaign.adName,
        date: campaign.date,
        results: String(campaign.results),
        cost: campaign.cost,
      })),
    })),
  }));
}

export function applyInvoiceTemplate(params: ApplyInvoiceTemplateParams): AppliedInvoiceTemplate {
  if (params.templateKey === PRO_ICON_KSA_TEMPLATE_KEY) {
    const defaultBranchConfigs = createDefaultProIconKsaBranchConfigs();
    const generated = generateProIconKsa({
      totalBudget: params.totalBudget ?? PRO_ICON_KSA_TEMPLATE_CONFIG.defaultTotalBudget,
      month: params.campaignMonth,
      currency: PRO_ICON_KSA_TEMPLATE_CONFIG.defaultCurrency,
      platforms: DEFAULT_PRO_ICON_KSA_PLATFORMS,
    });

    return {
      templateKey: PRO_ICON_KSA_TEMPLATE_KEY,
      clientName: PRO_ICON_KSA_TEMPLATE_CONFIG.clientName,
      totalBudget: params.totalBudget ?? PRO_ICON_KSA_TEMPLATE_CONFIG.defaultTotalBudget,
      fees: generated.fixedFee,
      grandTotal: Number((generated.total + generated.fixedFee).toFixed(2)),
      branchGroups: templateOutputToBranchGroups(generated),
      defaultBranchConfigs,
    };
  }

  return {
    templateKey: 'manual',
    clientName: '',
    totalBudget: 0,
    fees: 0,
    grandTotal: 0,
    branchGroups: [],
  };
}
