export type InvoiceTemplateId =
  | 'manual'
  | 'pro_icon_ksa'
  | 'pro_icon_global'
  | 'pro_icon_uae'
  | 'sama_travel';

export type PlatformType = 'instagram' | 'snapchat' | 'tiktok' | 'google' | 'other';

export type BranchType = 'riyadh' | 'jeddah' | 'khobar';

export interface TemplateInput {
  totalBudget: number;
  month: string; // YYYY-MM
  currency: string;
  platforms: {
    type: PlatformType;
    percentage: number;
    campaignCount: number;
  }[];
}

export interface CampaignRow {
  date: string;
  adName: string;
  results: number;
  cost: number;
}

export interface PlatformOutput {
  platform: PlatformType;
  budget: number;
  campaigns: CampaignRow[];
}

export interface BranchOutput {
  branch: BranchType;
  totalBudget: number;
  platforms: PlatformOutput[];
}

export interface TemplateOutput {
  fixedFee: number;
  netBudget: number;
  branches: BranchOutput[];
  subtotal: number;
  tax: number;
  total: number;
}
