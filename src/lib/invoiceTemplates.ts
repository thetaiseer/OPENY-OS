import {
  createDefaultProIconKsaBranchConfigs,
  generateProIconKsaInvoice,
  PRO_ICON_KSA_TEMPLATE_CONFIG,
  PRO_ICON_KSA_TEMPLATE_KEY,
  type InvoiceBranchGroup,
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

export function applyInvoiceTemplate(params: ApplyInvoiceTemplateParams): AppliedInvoiceTemplate {
  if (params.templateKey === PRO_ICON_KSA_TEMPLATE_KEY) {
    const defaultBranchConfigs = createDefaultProIconKsaBranchConfigs();
    const generated = generateProIconKsaInvoice({
      campaignMonth: params.campaignMonth,
      invoiceDate: params.invoiceDate,
      totalBudget: params.totalBudget ?? PRO_ICON_KSA_TEMPLATE_CONFIG.defaultTotalBudget,
      fees: params.fees ?? PRO_ICON_KSA_TEMPLATE_CONFIG.defaultFees,
      clientName: PRO_ICON_KSA_TEMPLATE_CONFIG.clientName,
      branchConfigs: defaultBranchConfigs,
    });
    return {
      templateKey: PRO_ICON_KSA_TEMPLATE_KEY,
      clientName: generated.clientName,
      totalBudget: generated.totalBudgetInput,
      fees: generated.fees,
      grandTotal: generated.grandTotal,
      branchGroups: generated.branchGroups,
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
