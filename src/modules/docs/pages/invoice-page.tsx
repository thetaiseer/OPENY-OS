'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  Download,
  Plus,
  Printer,
  RotateCcw,
  Save,
  Trash2,
  Wand2,
} from 'lucide-react';
import clsx from 'clsx';
import type { DocsInvoice, InvoiceBranchGroup, InvoiceCampaignRow, InvoicePlatformGroup } from '@/lib/docs-types';
import { DOCS_CURRENCIES } from '@/lib/docs-types';
import type { DocsClientProfile } from '@/lib/docs-client-profiles';
import { fetchDocsClientProfiles } from '@/lib/docs-client-profiles';
import ClientProfileSelector from '@/components/docs/ClientProfileSelector';
import { DocsDocTypeTabs, DocsEditorCard, DocsWorkspaceShell } from '@/components/docs/DocsWorkspace';
import InvoicePreview from '@/components/docs/invoice/InvoicePreview';
import { buildInvoiceDocumentModel } from '@/lib/docs-invoice-document-model';
import { exportPreviewPdf } from '@/lib/docs-print';
import {
  applyInvoiceTemplate,
  INVOICE_TEMPLATE_OPTIONS,
  normalizeInvoiceTemplateName,
  type InvoiceTemplateKey,
} from '@/lib/invoiceTemplates';
import {
  createDefaultProIconKsaBranchConfigs,
  deriveProIconKsaBranchConfigs,
  generateProIconKsaInvoice,
  getProIconKsaPlatformPreviewBudget,
  PRO_ICON_KSA_TEMPLATE_CONFIG,
  PRO_ICON_KSA_TEMPLATE_KEY,
  toPositiveInt,
  type ProIconKsaBranchConfig,
} from '@/lib/proIconKsaTemplate';

interface FormState {
  id?: string;
  client_profile_id: string | null;
  invoice_template: InvoiceTemplateKey;
  invoice_number: string;
  client_name: string;
  campaign_month: string;
  invoice_date: string;
  currency: string;
  status: 'paid' | 'unpaid';
  our_fees: number;
  notes: string;
}

const today = () => new Date().toISOString().slice(0, 10);
const monthNow = () => {
  const currentDate = new Date();
  return `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
};

const DEFAULT_TOTAL_BUDGET = PRO_ICON_KSA_TEMPLATE_CONFIG.defaultTotalBudget;
const DEFAULT_FEES = PRO_ICON_KSA_TEMPLATE_CONFIG.defaultFees;

const uid = (): string =>
  (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 11));

function asTemplateName(value: string | null | undefined): InvoiceTemplateKey {
  return normalizeInvoiceTemplateName(value);
}

function createEmptyRow(): InvoiceCampaignRow {
  return { id: uid(), ad_name: '', date: '', results: '', cost: 0 };
}

function createEmptyPlatform(name = 'Instagram'): InvoicePlatformGroup {
  return {
    id: uid(),
    platform_name: name,
    campaign_rows: [createEmptyRow()],
  };
}

function createEmptyBranch(name = 'Main Branch'): InvoiceBranchGroup {
  return {
    id: uid(),
    branch_name: name,
    platform_groups: [createEmptyPlatform()],
  };
}

function createManualDefaultBranchGroups(): InvoiceBranchGroup[] {
  return [createEmptyBranch()];
}

function sumBranchGroupsCost(branchGroups: InvoiceBranchGroup[] = []) {
  return Math.round(branchGroups.reduce((branchSum, branch) => (
    branchSum + branch.platform_groups.reduce((platformSum, platform) => (
      platformSum + platform.campaign_rows.reduce((rowSum, row) => rowSum + (Number(row.cost) || 0), 0)
    ), 0)
  ), 0));
}

function normalizeBranchGroupsForEditor(branchGroups: InvoiceBranchGroup[] = [], ensureAtLeastOne = false) {
  const normalized = branchGroups.map((branch, branchIndex) => ({
    id: branch.id || `branch-${branchIndex + 1}-${uid()}`,
    branch_name: branch.branch_name || `Branch ${branchIndex + 1}`,
    platform_groups: (branch.platform_groups ?? []).map((platform, platformIndex) => ({
      id: platform.id || `platform-${branchIndex + 1}-${platformIndex + 1}-${uid()}`,
      platform_name: platform.platform_name || 'Platform',
      campaign_rows: (platform.campaign_rows ?? []).map((row, rowIndex) => ({
        id: row.id || `row-${branchIndex + 1}-${platformIndex + 1}-${rowIndex + 1}-${uid()}`,
        ad_name: row.ad_name || '',
        date: row.date || '',
        results: row.results || '',
        cost: Math.max(0, Number(row.cost) || 0),
      })),
    })),
  }));

  if (!ensureAtLeastOne) return normalized;
  if (normalized.length === 0) return createManualDefaultBranchGroups();

  return normalized.map((branch) => {
    if (branch.platform_groups.length === 0) {
      return { ...branch, platform_groups: [createEmptyPlatform()] };
    }
    return {
      ...branch,
      platform_groups: branch.platform_groups.map((platform) => (
        platform.campaign_rows.length === 0
          ? { ...platform, campaign_rows: [createEmptyRow()] }
          : platform
      )),
    };
  });
}

function nextInvoiceNumber(invoices: DocsInvoice[]) {
  const maxNumber = invoices
    .map((invoice) => parseInt(invoice.invoice_number.replace(/\D/g, '') || '0', 10))
    .filter((value) => Number.isFinite(value))
    .reduce((max, value) => (value > max ? value : max), 0);
  return `INV-${String(maxNumber + 1).padStart(4, '0')}`;
}

function distributePercentages(rawValues: number[]) {
  if (rawValues.length === 0) return [];
  const safe = rawValues.map((value) => (Number.isFinite(value) && value > 0 ? value : 0));
  const sum = safe.reduce((s, v) => s + v, 0);
  if (sum <= 0) {
    const even = Math.floor(100 / rawValues.length);
    const values = Array.from({ length: rawValues.length }, () => even);
    let rem = 100 - (even * rawValues.length);
    let index = 0;
    while (rem > 0) {
      values[index % values.length] += 1;
      rem -= 1;
      index += 1;
    }
    return values;
  }
  const scaled = safe.map((value) => (value / sum) * 100);
  const floored = scaled.map((value) => Math.floor(value));
  let remainder = 100 - floored.reduce((s, value) => s + value, 0);
  const order = scaled
    .map((value, index) => ({ index, frac: value - Math.floor(value) }))
    .sort((a, b) => b.frac - a.frac);
  let cursor = 0;
  while (remainder > 0 && order.length > 0) {
    const entry = order[cursor % order.length];
    if (!entry) break;
    floored[entry.index] += 1;
    remainder -= 1;
    cursor += 1;
  }
  return floored;
}

function normalizeKsaBranchConfigs(configs: ProIconKsaBranchConfig[]) {
  const next = configs.map((branch) => ({
    ...branch,
    allocationPct: branch.enabled ? Math.max(0, Math.round(branch.allocationPct || 0)) : 0,
    platforms: branch.platforms.map((platform) => ({
      ...platform,
      campaignCount: toPositiveInt(platform.campaignCount),
      allocationPct: platform.enabled ? Math.max(0, Math.round(platform.allocationPct || 0)) : 0,
    })),
  }));
  const enabledBranches = next.filter((branch) => branch.enabled);
  const normalizedBranchPct = distributePercentages(
    enabledBranches.map((branch) => branch.allocationPct),
  );
  let enabledBranchCursor = 0;
  enabledBranches.forEach((branch) => {
    branch.allocationPct = normalizedBranchPct[enabledBranchCursor] ?? 0;
    enabledBranchCursor += 1;
    const enabledPlatforms = branch.platforms.filter((platform) => platform.enabled);
    if (enabledPlatforms.length === 0) return;
    const normalizedPlatformPct = distributePercentages(
      enabledPlatforms.map((platform) => platform.allocationPct),
    );
    enabledPlatforms.forEach((platform, index) => {
      platform.allocationPct = normalizedPlatformPct[index] ?? 0;
    });
  });
  return next;
}

function blank(invoices: DocsInvoice[]): FormState {
  return {
    client_profile_id: null,
    invoice_template: 'manual',
    invoice_number: nextInvoiceNumber(invoices),
    client_name: '',
    campaign_month: monthNow(),
    invoice_date: today(),
    currency: 'SAR',
    status: 'unpaid',
    our_fees: DEFAULT_FEES,
    notes: '',
  };
}

function toForm(invoice: DocsInvoice): FormState {
  return {
    id: invoice.id,
    client_profile_id: invoice.client_profile_id ?? null,
    invoice_template: asTemplateName(invoice.invoice_template ?? null),
    invoice_number: invoice.invoice_number,
    client_name: invoice.client_name,
    campaign_month: invoice.campaign_month ?? monthNow(),
    invoice_date: invoice.invoice_date ?? today(),
    currency: invoice.currency,
    status: invoice.status,
    our_fees: Math.max(0, Number(invoice.our_fees ?? 0)),
    notes: invoice.notes ?? '',
  };
}

export default function InvoicePage() {
  const [invoices, setInvoices] = useState<DocsInvoice[]>([]);
  const [profiles, setProfiles] = useState<DocsClientProfile[]>([]);
  const [form, setForm] = useState<FormState>(() => blank([]));
  const [branchGroups, setBranchGroups] = useState<InvoiceBranchGroup[]>(createManualDefaultBranchGroups);
  const [totalBudget, setTotalBudget] = useState<number>(DEFAULT_TOTAL_BUDGET);
  const [ksaBranchConfigs, setKsaBranchConfigs] = useState<ProIconKsaBranchConfig[]>(createDefaultProIconKsaBranchConfigs);
  const [generationSeed, setGenerationSeed] = useState(0);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editorPanel, setEditorPanel] = useState<'setup' | 'generator' | 'data' | 'totals'>('setup');
  const [expandedBranchRows, setExpandedBranchRows] = useState<Record<string, boolean>>({});

  const loadFromInvoice = useCallback((invoice: DocsInvoice | null, availableInvoices: DocsInvoice[]) => {
    if (!invoice) {
      setForm(blank(availableInvoices));
      setBranchGroups(createManualDefaultBranchGroups());
      setTotalBudget(DEFAULT_TOTAL_BUDGET);
      setKsaBranchConfigs(createDefaultProIconKsaBranchConfigs());
      setGenerationSeed(0);
      return;
    }

    const nextForm = toForm(invoice);
    const normalizedGroups = normalizeBranchGroupsForEditor(
      invoice.branch_groups ?? [],
      nextForm.invoice_template === 'manual',
    );
    const inferredBudget = Math.max(0, Math.round(Number(invoice.final_budget ?? sumBranchGroupsCost(normalizedGroups))));

    setForm(nextForm);
    setBranchGroups(
      normalizedGroups.length
        ? normalizedGroups
        : (nextForm.invoice_template === 'manual' ? createManualDefaultBranchGroups() : []),
    );
    setTotalBudget(inferredBudget || DEFAULT_TOTAL_BUDGET);
    setKsaBranchConfigs(
      nextForm.invoice_template === PRO_ICON_KSA_TEMPLATE_KEY
        ? deriveProIconKsaBranchConfigs(normalizedGroups, inferredBudget || DEFAULT_TOTAL_BUDGET)
        : createDefaultProIconKsaBranchConfigs(),
    );
    setGenerationSeed(0);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [invRes, docsProfiles] = await Promise.all([
        fetch('/api/docs/invoices', { cache: 'no-store' }),
        fetchDocsClientProfiles(),
      ]);
      const invJson = await invRes.json() as { invoices?: DocsInvoice[]; error?: string };
      if (!invRes.ok) throw new Error(invJson.error ?? 'Unable to load invoices.');

      const loadedInvoices = invJson.invoices ?? [];
      setInvoices(loadedInvoices);
      setProfiles(docsProfiles);
      loadFromInvoice(loadedInvoices[0] ?? null, loadedInvoices);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load invoices.');
    } finally {
      setLoading(false);
    }
  }, [loadFromInvoice]);

  useEffect(() => { void load(); }, [load]);

  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.client_id === form.client_profile_id),
    [profiles, form.client_profile_id],
  );

  const model = useMemo(() => buildInvoiceDocumentModel({
    ...form,
    branch_groups: branchGroups,
  }), [form, branchGroups]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function createNew() {
    setError('');
    setSuccess('');
    loadFromInvoice(null, invoices);
  }

  function applyTemplate(templateName: InvoiceTemplateKey) {
    if (templateName === 'manual') {
      setForm((prev) => ({ ...prev, invoice_template: 'manual' }));
      setBranchGroups(createManualDefaultBranchGroups());
      setKsaBranchConfigs(createDefaultProIconKsaBranchConfigs());
      setGenerationSeed(0);
      return;
    }

    const generated = applyInvoiceTemplate({
      templateKey: templateName,
      campaignMonth: form.campaign_month,
      invoiceDate: form.invoice_date,
      totalBudget,
      fees: form.our_fees,
    });

    setForm((prev) => ({
      ...prev,
      invoice_template: templateName,
      client_name: generated.clientName || prev.client_name,
      our_fees: generated.fees,
      currency: PRO_ICON_KSA_TEMPLATE_CONFIG.defaultCurrency,
    }));
    setBranchGroups(normalizeBranchGroupsForEditor(generated.branchGroups));
    setTotalBudget(generated.totalBudget || totalBudget);
    setKsaBranchConfigs(
      generated.defaultBranchConfigs
        ? normalizeKsaBranchConfigs(generated.defaultBranchConfigs)
        : createDefaultProIconKsaBranchConfigs(),
    );
    setGenerationSeed(0);
  }

  function regenerateKsa(seedOffset = 1, reset = false) {
    const nextSeed = generationSeed + seedOffset;
    const nextBranches = reset ? createDefaultProIconKsaBranchConfigs() : ksaBranchConfigs;
    const nextBudget = reset ? DEFAULT_TOTAL_BUDGET : totalBudget;

    const generated = generateProIconKsaInvoice({
      campaignMonth: form.campaign_month,
      invoiceDate: form.invoice_date,
      totalBudget: nextBudget,
      fees: form.our_fees,
      clientName: form.client_name || PRO_ICON_KSA_TEMPLATE_CONFIG.clientName,
      branchConfigs: normalizeKsaBranchConfigs(nextBranches),
      seedSalt: String(nextSeed),
    });

    if (reset) {
      setTotalBudget(DEFAULT_TOTAL_BUDGET);
      setKsaBranchConfigs(createDefaultProIconKsaBranchConfigs());
    }

    setBranchGroups(normalizeBranchGroupsForEditor(generated.branchGroups));
    setForm((prev) => ({
      ...prev,
      invoice_template: PRO_ICON_KSA_TEMPLATE_KEY,
      client_name: prev.client_name || generated.clientName,
    }));
    setGenerationSeed(nextSeed);
  }

  function toggleKsaBranch(branchIndex: number, enabled: boolean) {
    setKsaBranchConfigs((prev) => normalizeKsaBranchConfigs(prev.map((branch, idx) => (
      idx === branchIndex ? { ...branch, enabled, allocationPct: enabled ? Math.max(1, branch.allocationPct || 1) : 0 } : branch
    ))));
  }

  function updateKsaBranchAllocation(branchIndex: number, value: number) {
    setKsaBranchConfigs((prev) => normalizeKsaBranchConfigs(prev.map((branch, idx) => (
      idx === branchIndex ? { ...branch, allocationPct: Math.max(0, Math.min(100, Math.round(value || 0))) } : branch
    ))));
  }

  function updateKsaPlatformName(branchIndex: number, platformIndex: number, value: string) {
    setKsaBranchConfigs((prev) => prev.map((branch, idx) => {
      if (idx !== branchIndex) return branch;
      return {
        ...branch,
        platforms: branch.platforms.map((platform, pIdx) => (
          pIdx === platformIndex ? { ...platform, name: value } : platform
        )),
      };
    }));
  }

  function addKsaPlatform(branchIndex: number) {
    setKsaBranchConfigs((prev) => prev.map((branch, idx) => (
      idx === branchIndex
        ? {
          ...branch,
          platforms: [
            ...branch.platforms,
            { id: uid(), name: `Platform ${branch.platforms.length + 1}`, enabled: true, campaignCount: 1, allocationPct: 0 },
          ],
        }
        : branch
    )));
  }

  function removeKsaPlatform(branchIndex: number, platformIndex: number) {
    setKsaBranchConfigs((prev) => normalizeKsaBranchConfigs(prev.map((branch, idx) => (
      idx === branchIndex
        ? { ...branch, platforms: branch.platforms.filter((_, pIdx) => pIdx !== platformIndex) }
        : branch
    ))));
  }

  function toggleKsaPlatform(branchIndex: number, platformIndex: number, enabled: boolean) {
    setKsaBranchConfigs((prev) => normalizeKsaBranchConfigs(prev.map((branch, idx) => {
      if (idx !== branchIndex) return branch;
      return {
        ...branch,
        platforms: branch.platforms.map((platform, pIdx) => (
          pIdx === platformIndex
            ? { ...platform, enabled, allocationPct: enabled ? Math.max(1, platform.allocationPct || 1) : 0 }
            : platform
        )),
      };
    })));
  }

  function updateKsaCampaignCount(branchIndex: number, platformIndex: number, value: number) {
    setKsaBranchConfigs((prev) => prev.map((branch, idx) => {
      if (idx !== branchIndex) return branch;
      return {
        ...branch,
        platforms: branch.platforms.map((platform, pIdx) => (
          pIdx === platformIndex ? { ...platform, campaignCount: toPositiveInt(value) } : platform
        )),
      };
    }));
  }

  function updateKsaPlatformAllocation(branchIndex: number, platformIndex: number, value: number) {
    setKsaBranchConfigs((prev) => normalizeKsaBranchConfigs(prev.map((branch, idx) => {
      if (idx !== branchIndex) return branch;
      return {
        ...branch,
        platforms: branch.platforms.map((platform, pIdx) => (
          pIdx === platformIndex ? { ...platform, allocationPct: Math.max(0, Math.min(100, Math.round(value || 0))) } : platform
        )),
      };
    })));
  }

  function updateBranchName(branchIndex: number, value: string) {
    setBranchGroups((prev) => prev.map((branch, i) => (
      i === branchIndex ? { ...branch, branch_name: value } : branch
    )));
  }

  function addBranch() {
    setBranchGroups((prev) => [...prev, createEmptyBranch(`Branch ${prev.length + 1}`)]);
  }

  function removeBranch(branchIndex: number) {
    setBranchGroups((prev) => prev.filter((_, i) => i !== branchIndex));
  }

  function updatePlatformName(branchIndex: number, platformIndex: number, value: string) {
    setBranchGroups((prev) => prev.map((branch, bIdx) => {
      if (bIdx !== branchIndex) return branch;
      return {
        ...branch,
        platform_groups: branch.platform_groups.map((platform, pIdx) => (
          pIdx === platformIndex ? { ...platform, platform_name: value } : platform
        )),
      };
    }));
  }

  function addPlatform(branchIndex: number) {
    setBranchGroups((prev) => prev.map((branch, bIdx) => (
      bIdx === branchIndex
        ? { ...branch, platform_groups: [...branch.platform_groups, createEmptyPlatform()] }
        : branch
    )));
  }

  function removePlatform(branchIndex: number, platformIndex: number) {
    setBranchGroups((prev) => prev.map((branch, bIdx) => (
      bIdx === branchIndex
        ? { ...branch, platform_groups: branch.platform_groups.filter((_, pIdx) => pIdx !== platformIndex) }
        : branch
    )));
  }

  function updateRowField(
    branchIndex: number,
    platformIndex: number,
    rowIndex: number,
    field: keyof InvoiceCampaignRow,
    value: string | number,
  ) {
    setBranchGroups((prev) => prev.map((branch, bIdx) => {
      if (bIdx !== branchIndex) return branch;
      return {
        ...branch,
        platform_groups: branch.platform_groups.map((platform, pIdx) => {
          if (pIdx !== platformIndex) return platform;
          return {
            ...platform,
            campaign_rows: platform.campaign_rows.map((row, rIdx) => {
              if (rIdx !== rowIndex) return row;
              if (field === 'cost') {
                return { ...row, cost: Math.max(0, Number(value) || 0) };
              }
              return { ...row, [field]: String(value) };
            }),
          };
        }),
      };
    }));
  }

  function addRow(branchIndex: number, platformIndex: number) {
    setBranchGroups((prev) => prev.map((branch, bIdx) => {
      if (bIdx !== branchIndex) return branch;
      return {
        ...branch,
        platform_groups: branch.platform_groups.map((platform, pIdx) => (
          pIdx === platformIndex
            ? { ...platform, campaign_rows: [...platform.campaign_rows, createEmptyRow()] }
            : platform
        )),
      };
    }));
  }

  function removeRow(branchIndex: number, platformIndex: number, rowIndex: number) {
    setBranchGroups((prev) => prev.map((branch, bIdx) => {
      if (bIdx !== branchIndex) return branch;
      return {
        ...branch,
        platform_groups: branch.platform_groups.map((platform, pIdx) => (
          pIdx === platformIndex
            ? { ...platform, campaign_rows: platform.campaign_rows.filter((_, rIdx) => rIdx !== rowIndex) }
            : platform
        )),
      };
    }));
  }

  async function saveInvoice() {
    if (!form.invoice_number.trim()) { setError('Invoice number is required.'); return; }
    if (!form.client_name.trim()) { setError('Client name is required.'); return; }

    setSaving(true);
    setError('');

    try {
      const payload = {
        client_profile_id: form.client_profile_id,
        invoice_template: form.invoice_template,
        invoice_number: form.invoice_number,
        client_name: form.client_name,
        campaign_month: form.campaign_month,
        invoice_date: form.invoice_date,
        currency: form.currency,
        status: form.status,
        our_fees: Math.max(0, Number(form.our_fees || 0)),
        notes: form.notes,
        branch_groups: normalizeBranchGroupsForEditor(branchGroups),
      };

      const url = form.id ? `/api/docs/invoices/${form.id}` : '/api/docs/invoices';
      const method = form.id ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json() as { invoice?: DocsInvoice; error?: string };
      if (!res.ok || !json.invoice) throw new Error(json.error ?? 'Unable to save invoice.');

      const savedInvoice = json.invoice;
      setForm(toForm(savedInvoice));

      setInvoices((prev) => {
        const exists = prev.some((invoice) => invoice.id === savedInvoice.id);
        const next = exists
          ? prev.map((invoice) => (invoice.id === savedInvoice.id ? savedInvoice : invoice))
          : [savedInvoice, ...prev];
        return next.sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at));
      });

      const normalizedGroups = normalizeBranchGroupsForEditor(savedInvoice.branch_groups ?? []);
      const persistedBudget = Math.max(0, Math.round(Number(savedInvoice.final_budget ?? sumBranchGroupsCost(normalizedGroups))));
      setBranchGroups(
        normalizedGroups.length
          ? normalizedGroups
          : (asTemplateName(savedInvoice.invoice_template ?? null) === 'manual' ? createManualDefaultBranchGroups() : []),
      );
      setTotalBudget(persistedBudget || totalBudget);
      setKsaBranchConfigs(
        asTemplateName(savedInvoice.invoice_template ?? null) === PRO_ICON_KSA_TEMPLATE_KEY
          ? deriveProIconKsaBranchConfigs(normalizedGroups, persistedBudget || totalBudget)
          : createDefaultProIconKsaBranchConfigs(),
      );

      setSuccess('Invoice saved successfully.');
      setTimeout(() => setSuccess(''), 2200);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save invoice.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteInvoice() {
    if (!form.id) return;
    const res = await fetch(`/api/docs/invoices/${form.id}`, { method: 'DELETE' });
    if (!res.ok) {
      setError('Unable to delete invoice.');
      return;
    }

    const nextInvoices = invoices.filter((invoice) => invoice.id !== form.id);
    setInvoices(nextInvoices);
    loadFromInvoice(nextInvoices[0] ?? null, nextInvoices);
    setSuccess('Invoice deleted.');
    setTimeout(() => setSuccess(''), 1800);
  }

  const totalAllocation = ksaBranchConfigs
    .filter((branch) => branch.enabled)
    .reduce((sum, branch) => sum + branch.allocationPct, 0);

  function toggleBranchDetails(branchId: string) {
    setExpandedBranchRows((prev) => ({ ...prev, [branchId]: !prev[branchId] }));
  }

  const inputClass = 'w-full px-3 py-2 text-sm rounded-lg border outline-none bg-[var(--surface-2)] border-[var(--border)] text-[var(--text)]';

  return (
    <DocsWorkspaceShell
      toolbar={(
        <div className="docs-workspace-quickbar">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <DocsDocTypeTabs active="invoice" />
            <div className="flex items-center gap-2">
              <button type="button" onClick={createNew} className="px-3 py-1.5 rounded-lg border text-xs font-semibold" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                <Plus size={12} className="inline mr-1" /> New
              </button>
              <button type="button" onClick={() => void saveInvoice()} disabled={saving || loading} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ background: 'var(--accent)' }}>
                <Save size={12} className="inline mr-1" /> {saving ? 'Saving…' : 'Save'}
              </button>
              {form.id ? (
                <a href={`/api/docs/invoices/${form.id}/export`} className="px-3 py-1.5 rounded-lg border text-xs font-semibold" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                  <Download size={12} className="inline mr-1" /> Excel
                </a>
              ) : null}
              <button type="button" onClick={() => { void exportPreviewPdf('invoice-preview', form.invoice_number || 'invoice', 'invoice'); }} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ background: '#0f172a' }}>
                <Printer size={12} className="inline mr-1" /> PDF
              </button>
              {form.id ? (
                <button type="button" onClick={() => void deleteInvoice()} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ background: '#dc2626' }}>
                  <Trash2 size={12} className="inline mr-1" /> Delete
                </button>
              ) : null}
            </div>
          </div>
          <div className="docs-workspace-quickbar-grid">
            <div>
              <label htmlFor="invoice-template">Mode / Template</label>
              <select id="invoice-template" className={inputClass} value={form.invoice_template} onChange={(e) => applyTemplate(asTemplateName(e.target.value))}>
                {INVOICE_TEMPLATE_OPTIONS.map((template) => (
                  <option key={template.key} value={template.key}>{template.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label>Client</label>
              <select
                className={inputClass}
                value={form.client_profile_id ?? ''}
                onChange={(e) => {
                  const value = e.target.value;
                  setField('client_profile_id', value || null);
                  const profile = profiles.find((p) => p.client_id === value);
                  if (profile) setField('client_name', profile.client_name);
                }}
              >
                <option value="">Select client</option>
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.client_id}>{profile.client_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="invoice-campaign-month">Campaign Month</label>
              <input id="invoice-campaign-month" type="month" className={inputClass} value={form.campaign_month} onChange={(e) => setField('campaign_month', e.target.value)} />
            </div>
            <div>
              <label htmlFor="invoice-date">Invoice Date</label>
              <input id="invoice-date" type="date" className={inputClass} value={form.invoice_date} onChange={(e) => setField('invoice_date', e.target.value)} />
            </div>
            <div>
              <label>History</label>
              <select
                className={inputClass}
                value={form.id ?? ''}
                onChange={(e) => {
                  const selectedId = e.target.value;
                  const selected = invoices.find((invoice) => invoice.id === selectedId) ?? null;
                  loadFromInvoice(selected, invoices);
                }}
              >
                <option value="">New unsaved invoice</option>
                {invoices.map((invoice) => (
                  <option key={invoice.id} value={invoice.id}>
                    {invoice.invoice_number} · {invoice.client_name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}
      editor={(
        <div className="space-y-3 overflow-y-auto pr-1">
          {error ? (
            <div className="rounded-xl border px-3 py-2 text-sm flex items-center gap-2" style={{ borderColor: 'rgba(239,68,68,0.35)', color: '#dc2626', background: 'rgba(239,68,68,0.08)' }}>
              <AlertCircle size={15} /> {error}
            </div>
          ) : null}
          {success ? (
            <div className="rounded-xl border px-3 py-2 text-sm flex items-center gap-2" style={{ borderColor: 'rgba(16,185,129,0.35)', color: '#047857', background: 'rgba(16,185,129,0.08)' }}>
              <Check size={15} /> {success}
            </div>
          ) : null}

          <div className="docs-tabs">
            {([
              ['setup', 'Setup'],
              ['generator', 'Generator'],
              ['data', 'Campaign Data'],
              ['totals', 'Totals'],
            ] as const).map(([key, label]) => (
              <button key={key} type="button" onClick={() => setEditorPanel(key)} className={clsx('docs-tab', editorPanel === key && 'docs-tab-active')}>
                {label}
              </button>
            ))}
          </div>

          {editorPanel === 'setup' ? (
            <DocsEditorCard title="Document Setup">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label>Invoice Number</label>
                  <input className={inputClass} value={form.invoice_number} onChange={(e) => setField('invoice_number', e.target.value)} />
                </div>
                <div>
                  <label>Currency</label>
                  <select className={inputClass} value={form.currency} onChange={(e) => setField('currency', e.target.value)}>
                    {DOCS_CURRENCIES.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
                  </select>
                </div>
                <div>
                  <label>Status</label>
                  <select className={inputClass} value={form.status} onChange={(e) => setField('status', e.target.value as 'paid' | 'unpaid')}>
                    <option value="unpaid">Unpaid</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>
                <div>
                  <label>Client Name</label>
                  <input className={inputClass} value={form.client_name} onChange={(e) => setField('client_name', e.target.value)} placeholder={selectedProfile?.client_name || 'Client name'} />
                </div>
              </div>
              <ClientProfileSelector
                profiles={profiles}
                selectedClientId={form.client_profile_id ?? ''}
                onSelectClientId={(value) => {
                  setField('client_profile_id', value || null);
                  if (!value) return;
                  const profile = profiles.find((p) => p.client_id === value);
                  if (profile) setField('client_name', profile.client_name);
                }}
              />
              <div>
                <label htmlFor="invoice-notes">Notes</label>
                <textarea id="invoice-notes" className={inputClass} rows={3} value={form.notes} onChange={(e) => setField('notes', e.target.value)} />
              </div>
            </DocsEditorCard>
          ) : null}

          {editorPanel === 'generator' ? (
            <DocsEditorCard title="Template Generator" actions={(
              <div className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>Allocation total: {totalAllocation}%</div>
            )}>
              {form.invoice_template === PRO_ICON_KSA_TEMPLATE_KEY ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-[1fr_180px] gap-2">
                    <div>
                      <label htmlFor="invoice-total-budget">Total Budget</label>
                      <input id="invoice-total-budget" type="number" min={0} className={inputClass} value={totalBudget} onChange={(e) => setTotalBudget(Math.max(0, Math.round(Number(e.target.value) || 0)))} />
                    </div>
                    <div className="rounded-xl border p-2 text-xs space-y-1" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
                      <div className="flex items-center justify-between">
                        <span style={{ color: 'var(--text-secondary)' }}>Deduction</span>
                        <span className="font-semibold" style={{ color: 'var(--text)' }}>
                          {PRO_ICON_KSA_TEMPLATE_CONFIG.deduction.type === 'fixed'
                            ? `${PRO_ICON_KSA_TEMPLATE_CONFIG.deduction.fixedAmount.toLocaleString()} ${form.currency}`
                            : `0 ${form.currency}`}
                        </span>
                      </div>
                    </div>
                  </div>

                  {ksaBranchConfigs.map((branch, branchIndex) => {
                    const branchBudget = Math.round((totalBudget * branch.allocationPct) / 100);
                    const localAllocationTotal = branch.platforms.filter((item) => item.enabled).reduce((sum, item) => sum + item.allocationPct, 0);
                    return (
                      <div key={branch.id} className="rounded-xl border p-3 space-y-3" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
                        <div className="flex items-center justify-between gap-2">
                          <label className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--text)' }}>
                            <input type="checkbox" checked={branch.enabled} onChange={(e) => toggleKsaBranch(branchIndex, e.target.checked)} />
                            {branch.name}
                          </label>
                          <span className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>
                            {branch.enabled ? `${branchBudget.toLocaleString()} ${form.currency}` : 'Disabled'}
                          </span>
                        </div>
                        <div className="grid grid-cols-[1fr_120px] gap-2 items-end">
                          <div>
                            <label htmlFor={`branch-allocation-range-${branch.id}`}>Branch Allocation %</label>
                            <input
                              id={`branch-allocation-range-${branch.id}`}
                              type="range"
                              min={0}
                              max={100}
                              disabled={!branch.enabled}
                              className="w-full"
                              value={branch.allocationPct}
                              onChange={(e) => updateKsaBranchAllocation(branchIndex, Number(e.target.value))}
                            />
                          </div>
                          <input
                            id={`branch-allocation-input-${branch.id}`}
                            type="number"
                            min={0}
                            max={100}
                            disabled={!branch.enabled}
                            className={inputClass}
                            value={branch.allocationPct}
                            onChange={(e) => updateKsaBranchAllocation(branchIndex, Number(e.target.value))}
                          />
                        </div>

                        {branch.platforms.map((platform, platformIndex) => {
                          const platformBudget = getProIconKsaPlatformPreviewBudget(totalBudget, branch, platform);
                          return (
                            <div key={platform.id} className="rounded-lg border p-2 space-y-2" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                              <div className="grid grid-cols-[1fr_90px_28px] gap-2 items-center">
                                <label className="flex items-center gap-2 text-xs font-semibold" style={{ color: 'var(--text)' }}>
                                  <input type="checkbox" checked={platform.enabled} onChange={(e) => toggleKsaPlatform(branchIndex, platformIndex, e.target.checked)} />
                                  <input className={inputClass} value={platform.name} onChange={(e) => updateKsaPlatformName(branchIndex, platformIndex, e.target.value)} disabled={!platform.enabled} placeholder="Platform name" />
                                </label>
                                <span className="text-[11px] font-semibold text-right" style={{ color: 'var(--accent)' }}>
                                  {platform.enabled ? `${platformBudget.toLocaleString()} ${form.currency}` : 'Disabled'}
                                </span>
                                <button type="button" onClick={() => removeKsaPlatform(branchIndex, platformIndex)} className="rounded border text-[10px] h-7" style={{ borderColor: 'rgba(239,68,68,0.3)', color: '#dc2626' }} title="Remove platform">
                                  <Trash2 size={11} className="mx-auto" />
                                </button>
                              </div>
                              <div className="grid grid-cols-[120px_1fr_90px] gap-2 items-end">
                                <div>
                                  <label>Campaign Count</label>
                                  <input type="number" min={1} disabled={!platform.enabled} className={inputClass} value={platform.campaignCount} onChange={(e) => updateKsaCampaignCount(branchIndex, platformIndex, Number(e.target.value))} />
                                </div>
                                <div>
                                  <label>Platform Allocation %</label>
                                  <input type="range" min={0} max={100} disabled={!platform.enabled} className="w-full" value={platform.allocationPct} onChange={(e) => updateKsaPlatformAllocation(branchIndex, platformIndex, Number(e.target.value))} />
                                </div>
                                <input type="number" min={0} max={100} disabled={!platform.enabled} className={inputClass} value={platform.allocationPct} onChange={(e) => updateKsaPlatformAllocation(branchIndex, platformIndex, Number(e.target.value))} />
                              </div>
                            </div>
                          );
                        })}

                        <div className="text-[11px]" style={{ color: localAllocationTotal === 100 ? '#047857' : '#b45309' }}>
                          Platform allocation total: {localAllocationTotal}%
                        </div>
                        <button type="button" onClick={() => addKsaPlatform(branchIndex)} className="px-2.5 py-1.5 rounded-lg border text-xs font-semibold" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                          <Plus size={12} className="inline mr-1" /> Add Platform
                        </button>
                      </div>
                    );
                  })}

                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => regenerateKsa(1, false)} className="px-3 py-2 rounded-lg text-xs font-semibold text-white" style={{ background: 'var(--accent)' }}>
                      <Wand2 size={13} className="inline mr-1" /> Generate Invoice Data
                    </button>
                    <button type="button" onClick={() => regenerateKsa(1, true)} className="px-3 py-2 rounded-lg text-xs font-semibold border" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                      <RotateCcw size={13} className="inline mr-1" /> Reset Generator
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border px-3 py-2 text-xs" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                  Manual mode does not require template generation. Use Campaign Data tab to manage branch/platform rows.
                </div>
              )}
            </DocsEditorCard>
          ) : null}

          {editorPanel === 'data' ? (
            <DocsEditorCard
              title="Generated Campaign Data"
              actions={form.invoice_template === 'manual' ? (
                <button type="button" onClick={addBranch} className="px-2.5 py-1.5 rounded-lg border text-xs font-semibold" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                  <Plus size={12} className="inline mr-1" /> Add Branch
                </button>
              ) : null}
            >
              {branchGroups.length === 0 ? (
                <div className="text-xs rounded-lg border px-3 py-2" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                  No rows yet. Add a branch to start building your invoice.
                </div>
              ) : null}

              <div className="space-y-3">
                {branchGroups.map((branch, branchIndex) => {
                  const branchTotal = branch.platform_groups.reduce((sum, platform) => (
                    sum + platform.campaign_rows.reduce((rowSum, row) => rowSum + (Number(row.cost) || 0), 0)
                  ), 0);
                  const expanded = expandedBranchRows[branch.id] ?? true;
                  return (
                    <div key={branch.id} className="rounded-xl border p-3 space-y-2" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
                      <div className="grid grid-cols-[1fr_auto_auto] gap-2 items-center">
                        <input className={inputClass} value={branch.branch_name} onChange={(e) => updateBranchName(branchIndex, e.target.value)} placeholder="Branch name" />
                        <div className="px-2 py-1 rounded-lg text-xs font-semibold" style={{ background: 'var(--surface)', color: 'var(--accent)' }}>
                          {branchTotal.toLocaleString()} {form.currency}
                        </div>
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => toggleBranchDetails(branch.id)} className="px-2 py-2 rounded-lg border text-xs font-semibold" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                            {expanded ? 'Collapse' : 'Expand'}
                          </button>
                          {form.invoice_template === 'manual' ? (
                            <button type="button" onClick={() => removeBranch(branchIndex)} className="px-2 py-2 rounded-lg border text-xs font-semibold" style={{ borderColor: 'rgba(239,68,68,0.3)', color: '#dc2626' }}>
                              <Trash2 size={12} />
                            </button>
                          ) : null}
                        </div>
                      </div>

                      {expanded ? (
                        <div className="space-y-2">
                          {branch.platform_groups.map((platform, platformIndex) => {
                            const platformTotal = platform.campaign_rows.reduce((sum, row) => sum + (Number(row.cost) || 0), 0);
                            return (
                              <div key={platform.id} className="rounded-lg border p-3 space-y-2" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                                <div className="grid grid-cols-[1fr_auto_auto] gap-2 items-center">
                                  <input className={inputClass} value={platform.platform_name} onChange={(e) => updatePlatformName(branchIndex, platformIndex, e.target.value)} placeholder="Platform name" />
                                  <div className="px-2 py-1 rounded-lg text-xs font-semibold" style={{ background: 'var(--surface-2)', color: 'var(--text)' }}>
                                    {platformTotal.toLocaleString()} {form.currency}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <button type="button" onClick={() => addRow(branchIndex, platformIndex)} className="px-2 py-2 rounded-lg border text-xs font-semibold" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }} title="Add row">
                                      <Plus size={12} />
                                    </button>
                                    {form.invoice_template === 'manual' ? (
                                      <button type="button" onClick={() => removePlatform(branchIndex, platformIndex)} className="px-2 py-2 rounded-lg border text-xs font-semibold" style={{ borderColor: 'rgba(239,68,68,0.3)', color: '#dc2626' }} title="Remove platform">
                                        <Trash2 size={12} />
                                      </button>
                                    ) : null}
                                  </div>
                                </div>

                                {platform.campaign_rows.length === 0 ? (
                                  <div className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>No rows. Add one row.</div>
                                ) : null}

                                {platform.campaign_rows.map((row, rowIndex) => (
                                  <div key={row.id} className="grid grid-cols-[1.2fr_115px_1fr_110px_30px] gap-2 items-center">
                                    <input className={inputClass} value={row.ad_name} onChange={(e) => updateRowField(branchIndex, platformIndex, rowIndex, 'ad_name', e.target.value)} placeholder="Ad name" />
                                    <input type="date" className={inputClass} value={row.date} onChange={(e) => updateRowField(branchIndex, platformIndex, rowIndex, 'date', e.target.value)} />
                                    <input className={inputClass} value={row.results} onChange={(e) => updateRowField(branchIndex, platformIndex, rowIndex, 'results', e.target.value)} placeholder="Results" />
                                    <input type="number" min={0} className={inputClass} value={row.cost} onChange={(e) => updateRowField(branchIndex, platformIndex, rowIndex, 'cost', e.target.value)} placeholder="Cost" />
                                    <button type="button" onClick={() => removeRow(branchIndex, platformIndex, rowIndex)} className="px-2 py-2 rounded-lg border text-xs font-semibold" style={{ borderColor: 'rgba(239,68,68,0.3)', color: '#dc2626' }} title="Remove row">
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            );
                          })}

                          {form.invoice_template === 'manual' ? (
                            <button type="button" onClick={() => addPlatform(branchIndex)} className="px-2.5 py-1.5 rounded-lg border text-xs font-semibold" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                              <Plus size={12} className="inline mr-1" /> Add Platform
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </DocsEditorCard>
          ) : null}

          {editorPanel === 'totals' ? (
            <DocsEditorCard title="Totals & Controls">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs py-1.5 border-b" style={{ borderColor: 'var(--border)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Final Budget</span>
                  <span className="font-semibold" style={{ color: 'var(--text)' }}>{model.totals.finalBudget.toLocaleString()} {form.currency}</span>
                </div>
                <div className="flex items-center justify-between text-xs py-1.5 border-b" style={{ borderColor: 'var(--border)' }}>
                  <label htmlFor="invoice-our-fees">Our Fees</label>
                  <input
                    id="invoice-our-fees"
                    type="number"
                    min={0}
                    className="w-36 px-2 py-1 text-xs rounded-md border outline-none bg-[var(--surface-2)] border-[var(--border)] text-[var(--text)] text-right"
                    value={form.our_fees}
                    onChange={(e) => setField('our_fees', Math.max(0, Number(e.target.value) || 0))}
                  />
                </div>
                <div className="flex items-center justify-between text-sm py-2 rounded-lg px-2" style={{ background: 'var(--text)', color: 'var(--surface)' }}>
                  <span className="font-bold">GRAND TOTAL</span>
                  <span className="font-black">{model.totals.grandTotal.toLocaleString()} {form.currency}</span>
                </div>
                {loading ? <p className="text-[11px] mt-1" style={{ color: 'var(--text-secondary)' }}>Loading invoices…</p> : null}
              </div>
            </DocsEditorCard>
          ) : null}
        </div>
      )}
      preview={(
        <section className="docs-preview-shell">
          <div className="overflow-x-auto">
            <div className="docs-preview-canvas" style={{ width: 820 }}>
              <InvoicePreview model={model} />
            </div>
          </div>
        </section>
      )}
    />
  );
}
