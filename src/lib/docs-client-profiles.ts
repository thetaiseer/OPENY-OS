import type { DocsCurrency } from '@/lib/docs-types';

export type DocsModuleKey =
  | 'invoice'
  | 'quotation'
  | 'client-contract'
  | 'hr-contract'
  | 'employees'
  | 'accounting';

export interface DocsClientProfile {
  id: string;
  client_id: string;
  client_name: string;
  client_slug: string;
  default_currency: DocsCurrency | string;
  invoice_type?: string | null;
  quotation_type?: string | null;
  contract_type?: string | null;
  default_template_style?: string | null;
  billing_address?: string | null;
  tax_info?: string | null;
  notes?: string | null;
  invoice_layout_mode: string;
  supports_branch_breakdown: boolean;
  default_platforms: string[];
  default_branch_names: string[];
  service_description_default?: string | null;
  default_fees_logic: Record<string, unknown>;
  default_totals_logic: Record<string, unknown>;
  invoice_template_config: Record<string, unknown>;
  quotation_template_config: Record<string, unknown>;
  contract_template_config: Record<string, unknown>;
  hr_contract_template_config: Record<string, unknown>;
  employees_template_config: Record<string, unknown>;
  accounting_template_config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export const VIRTUAL_PROFILE_PREFIX = 'virtual-';

export function isVirtualDocsProfileId(id: string | null | undefined) {
  return typeof id === 'string' && id.startsWith(VIRTUAL_PROFILE_PREFIX);
}

export function buildClientSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export async function fetchDocsClientProfiles(): Promise<DocsClientProfile[]> {
  const res = await fetch('/api/docs/client-profiles', { cache: 'no-store' });
  if (!res.ok) {
    let apiError = '';
    try {
      const json = (await res.json()) as { error?: string };
      apiError = json?.error ?? '';
    } catch {
      // ignore parse and fallback
    }
    throw new Error(apiError || 'Unable to load client document profiles.');
  }
  const json = (await res.json()) as { profiles?: DocsClientProfile[] };
  return json.profiles ?? [];
}

export function sanitizeDocCode(code: string, fallback: string) {
  const value = (code || '').trim();
  const normalized = (value || fallback)
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return normalized || fallback;
}
