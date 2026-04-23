// ─────────────────────────────────────────────────────────────────────────────
// OPENY DOCS — TypeScript types for all document modules
// ─────────────────────────────────────────────────────────────────────────────

import type { BaseDocument } from '@/lib/types';

// ── Invoice ───────────────────────────────────────────────────────────────────

export type DocsCurrency = 'SAR' | 'USD' | 'EUR' | 'AED' | 'EGP' | 'KWD' | 'QAR';

export type DocsStatus = 'paid' | 'unpaid';

export type DocsContractStatus = 'draft' | 'active' | 'expired' | 'terminated' | 'signed';

export type DocsEmployeeStatus = 'active' | 'inactive' | 'terminated';

export type DocsEmploymentType = 'full_time' | 'part_time' | 'contract' | 'freelance';

export type DocsCollectionType = 'local' | 'overseas';

export interface InvoicePlatform {
  key: string;
  label: string;
  enabled: boolean;
  count: number;
  budgetPct: number;
  budget: number;
}

export interface InvoiceDeliverable {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface InvoiceCampaignRow {
  id: string;
  ad_name: string;
  date: string;
  results: string;
  cost: number;
}

export interface InvoicePlatformGroup {
  id: string;
  platform_name: string;
  campaign_rows: InvoiceCampaignRow[];
}

export interface InvoiceBranchGroup {
  id: string;
  branch_name: string;
  platform_groups: InvoicePlatformGroup[];
}

export interface DocsInvoice extends BaseDocument {
  invoice_number: string;
  invoice_template?:
    | 'manual'
    | 'pro_icon_ksa'
    | 'Manual'
    | 'Pro icon KSA Template'
    | 'Pro icon UAE Template'
    | 'Pro icon Global Template'
    | 'SAMA Travel Template'
    | null;
  client_name: string;
  campaign_month: string | null;
  invoice_date: string | null;
  total_budget: number;
  final_budget?: number | null;
  our_fees?: number | null;
  grand_total?: number | null;
  currency: DocsCurrency;
  status: DocsStatus;
  branch_groups?: InvoiceBranchGroup[];
  platforms: InvoicePlatform[];
  deliverables: InvoiceDeliverable[];
  custom_client: string | null;
  custom_project: string | null;
  notes: string | null;
  export_excel_url: string | null;
  is_duplicate: boolean;
  original_id: string | null;
}

// ── Quotation ─────────────────────────────────────────────────────────────────

export interface QuotationDeliverable {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface DocsQuotation extends BaseDocument {
  quote_number: string;
  quote_date: string | null;
  currency: DocsCurrency;
  client_name: string;
  company_brand: string | null;
  project_title: string | null;
  project_description: string | null;
  deliverables: QuotationDeliverable[];
  total_value: number;
  payment_due_days: number;
  payment_method: string | null;
  custom_payment_method: string | null;
  additional_notes: string | null;
  status: DocsStatus;
  export_excel_url: string | null;
  is_duplicate: boolean;
  original_id: string | null;
}

// ── Client Contract ───────────────────────────────────────────────────────────

export interface ContractClause {
  id: string;
  title: string;
  content: string;
}

export interface DocsClientContract extends BaseDocument {
  contract_number: string;
  contract_date: string | null;
  duration_months: number;
  status: DocsContractStatus;
  currency: DocsCurrency;
  language: 'ar' | 'en';
  party1_company_name: string | null;
  party1_representative: string | null;
  party1_address: string | null;
  party1_email: string | null;
  party1_phone: string | null;
  party1_website: string | null;
  party1_tax_reg: string | null;
  party2_client_name: string | null;
  party2_contact_person: string | null;
  party2_address: string | null;
  party2_email: string | null;
  party2_phone: string | null;
  party2_website: string | null;
  party2_tax_reg: string | null;
  services: string[];
  total_value: number;
  payment_method: string | null;
  payment_terms: string | null;
  notes: string | null;
  legal_clauses: ContractClause[];
  sig_party1: string | null;
  sig_party2: string | null;
  sig_date: string | null;
  sig_place: string | null;
  export_doc_url: string | null;
  is_duplicate: boolean;
  original_id: string | null;
}

// ── HR Contract ───────────────────────────────────────────────────────────────

export interface DocsHrContract extends BaseDocument {
  contract_number: string;
  contract_date: string | null;
  duration: string | null;
  status: DocsContractStatus;
  currency: DocsCurrency;
  language: 'ar' | 'en';
  company_name: string | null;
  company_representative: string | null;
  company_address: string | null;
  company_email: string | null;
  company_phone: string | null;
  employee_full_name: string;
  employee_national_id: string | null;
  employee_address: string | null;
  employee_phone: string | null;
  employee_email: string | null;
  employee_nationality: string | null;
  employee_marital_status: string | null;
  job_title: string | null;
  department: string | null;
  direct_manager: string | null;
  employment_type: string | null;
  start_date: string | null;
  contract_duration: string | null;
  probation_period: string | null;
  workplace: string | null;
  salary: number;
  payment_method: string | null;
  payment_date: string | null;
  benefits: string[];
  daily_hours: number;
  work_days: string | null;
  annual_leave: number;
  legal_clauses: ContractClause[];
  sig_company_rep: string | null;
  sig_employee_name: string | null;
  sig_date: string | null;
  sig_place: string | null;
  export_doc_url: string | null;
  is_duplicate: boolean;
  original_id: string | null;
}

// ── Employees ─────────────────────────────────────────────────────────────────

export interface DocsEmployee extends BaseDocument {
  employee_id: string;
  full_name: string;
  date_of_birth: string | null;
  phone: string | null;
  address: string | null;
  job_title: string | null;
  employment_type: DocsEmploymentType;
  hire_date: string | null;
  status: DocsEmployeeStatus;
  daily_hours: number;
  contract_duration: string | null;
  salary: number;
  salary_adjustments?: DocsSalaryAdjustment[];
}

export interface DocsSalaryAdjustment {
  id: string;
  employee_id: string;
  new_salary: number;
  change_amount: number | null;
  change_type: 'increase' | 'decrease' | 'initial';
  effective_date: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

// ── Accounting ────────────────────────────────────────────────────────────────

export interface DocsAccountingEntry extends BaseDocument {
  client_name: string;
  service: string | null;
  amount: number;
  currency: DocsCurrency;
  collection_type: DocsCollectionType;
  collector: string | null;
  entry_date: string;
  month_key: string;
  notes: string | null;
}

export interface DocsAccountingExpense {
  id: string;
  description: string;
  amount: number;
  currency: DocsCurrency;
  expense_date: string;
  month_key: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ── Accounting Summary ────────────────────────────────────────────────────────

export interface DocsAccountingSummary {
  totalRevenue: number;
  localCollections: number;
  overseasCollections: number;
  totalExpenses: number;
  netResult: number;
  byCollector: { collector: string; amount: number; type: DocsCollectionType }[];
}

// ── Backup ────────────────────────────────────────────────────────────────────

export type DocsBackupModule =
  | 'invoices'
  | 'quotations'
  | 'client_contracts'
  | 'hr_contracts'
  | 'employees'
  | 'accounting';

export interface DocsBackup {
  id: string;
  module: DocsBackupModule;
  label: string | null;
  data: unknown;
  created_by: string | null;
  created_at: string;
}

// ── Default platform list for invoices ────────────────────────────────────────

export const DEFAULT_INVOICE_PLATFORMS: InvoicePlatform[] = [
  { key: 'instagram', label: 'Instagram', enabled: false, count: 1, budgetPct: 0, budget: 0 },
  { key: 'snapchat', label: 'Snapchat', enabled: false, count: 1, budgetPct: 0, budget: 0 },
  { key: 'tiktok', label: 'TikTok', enabled: false, count: 1, budgetPct: 0, budget: 0 },
  { key: 'google_ads', label: 'Google Ads', enabled: false, count: 1, budgetPct: 0, budget: 0 },
  { key: 'salla', label: 'Salla', enabled: false, count: 1, budgetPct: 0, budget: 0 },
];

export const DOCS_CURRENCIES: DocsCurrency[] = ['SAR', 'USD', 'EUR', 'AED', 'EGP', 'KWD', 'QAR'];

export const DOCS_PAYMENT_METHODS = [
  'Bank Transfer',
  'Cash',
  'Cheque',
  'Online Payment',
  'Credit Card',
  'Custom',
];

export const DOCS_EMPLOYMENT_TYPES: { value: DocsEmploymentType; label: string }[] = [
  { value: 'full_time', label: 'Full Time' },
  { value: 'part_time', label: 'Part Time' },
  { value: 'contract', label: 'Contract' },
  { value: 'freelance', label: 'Freelance' },
];

export const DOCS_MARITAL_STATUSES = ['Single', 'Married', 'Divorced', 'Widowed'];

// ── Accounting partners ────────────────────────────────────────────────────────
// Taiseer: local/Egypt; Ahmed: overseas/international

export const ACCOUNTING_COLLECTORS = ['Taiseer Mahmoud', 'Ahmed Mansour'];

export function getAccountingCollectorByType(type: DocsCollectionType | string) {
  const [localCollector = 'Taiseer Mahmoud', overseasCollector = 'Ahmed Mansour'] =
    ACCOUNTING_COLLECTORS;
  return type === 'local' ? localCollector : overseasCollector;
}
