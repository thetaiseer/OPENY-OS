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
import InvoicePreview from '@/components/docs/invoice/InvoicePreview';
import { buildInvoiceDocumentModel } from '@/lib/docs-invoice-document-model';
import { exportPreviewPdf } from '@/lib/docs-print';
import {
  generateInvoiceFromTemplate,
  generateSmartInvoice,
  INVOICE_TEMPLATE_OPTIONS,
  INVOICE_TEMPLATES,
} from '@/lib/docs-invoice-autogen';
import type { InvoiceTemplateName } from '@/lib/docs-invoice-autogen';

interface FormState {
  id?: string;
  client_profile_id: string | null;
  invoice_template: InvoiceTemplateName;
  invoice_number: string;
  client_name: string;
  campaign_month: string;
  invoice_date: string;
  currency: string;
  status: 'paid' | 'unpaid';
  our_fees: number;
  notes: string;
}

interface PlatformConfig {
  key: 'instagram' | 'snapchat' | 'tiktok';
  name: 'Instagram' | 'Snapchat' | 'TikTok';
  enabled: boolean;
  campaignCount: number;
  allocationPct: number;
}

const today = () => new Date().toISOString().slice(0, 10);
const monthNow = () => {
  const currentDate = new Date();
  return `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
};

const DEFAULT_TOTAL_BUDGET = INVOICE_TEMPLATES['Pro icon KSA Template'].defaultFinalBudget;
const DEFAULT_FEES = INVOICE_TEMPLATES['Pro icon KSA Template'].defaultFees;

const DEFAULT_PLATFORM_CONFIGS: PlatformConfig[] = [
  { key: 'instagram', name: 'Instagram', enabled: true, campaignCount: 6, allocationPct: 50 },
  { key: 'snapchat', name: 'Snapchat', enabled: true, campaignCount: 4, allocationPct: 30 },
  { key: 'tiktok', name: 'TikTok', enabled: true, campaignCount: 2, allocationPct: 20 },
];

const uid = (): string =>
  (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 11));

function isTemplateName(value: string | null | undefined): value is InvoiceTemplateName {
  return !!value && INVOICE_TEMPLATE_OPTIONS.includes(value as InvoiceTemplateName);
}

function asTemplateName(value: string | null | undefined): InvoiceTemplateName {
  return isTemplateName(value) ? value : 'Manual';
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

function normalizePlatformConfigs(platforms: PlatformConfig[]) {
  const enabledIndexes = platforms.map((item, index) => ({ item, index })).filter((entry) => entry.item.enabled);
  if (enabledIndexes.length === 0) {
    return platforms.map((platform) => ({ ...platform, allocationPct: 0 }));
  }
  const normalized = distributePercentages(enabledIndexes.map(({ item }) => item.allocationPct));
  const next = platforms.map((platform) => ({ ...platform, allocationPct: platform.enabled ? platform.allocationPct : 0 }));
  enabledIndexes.forEach(({ index }, i) => {
    const platform = next[index];
    if (!platform) return;
    platform.allocationPct = normalized[i] ?? 0;
    platform.campaignCount = Math.max(1, Math.round(platform.campaignCount || 1));
  });
  return next;
}

function derivePlatformConfigs(branchGroups: InvoiceBranchGroup[] = [], finalBudget: number) {
  const base = DEFAULT_PLATFORM_CONFIGS.map((platform) => ({ ...platform, enabled: false, campaignCount: 1, allocationPct: 0 }));
  const byPlatform = new Map<string, { count: number; cost: number }>();

  branchGroups.forEach((branch) => {
    branch.platform_groups.forEach((platform) => {
      const key = platform.platform_name.trim().toLowerCase();
      const existing = byPlatform.get(key) ?? { count: 0, cost: 0 };
      existing.count += platform.campaign_rows.length;
      existing.cost += platform.campaign_rows.reduce((sum, row) => sum + (Number(row.cost) || 0), 0);
      byPlatform.set(key, existing);
    });
  });

  const next = base.map((platform) => {
    const stats = byPlatform.get(platform.name.toLowerCase());
    if (!stats || stats.count <= 0) return platform;
    return {
      ...platform,
      enabled: true,
      campaignCount: Math.max(1, stats.count),
      allocationPct: finalBudget > 0 ? Math.round((stats.cost / finalBudget) * 100) : 0,
    };
  });

  const hasEnabled = next.some((platform) => platform.enabled);
  return normalizePlatformConfigs(hasEnabled ? next : DEFAULT_PLATFORM_CONFIGS);
}

function blank(invoices: DocsInvoice[]): FormState {
  return {
    client_profile_id: null,
    invoice_template: 'Manual',
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
  const [platformConfigs, setPlatformConfigs] = useState<PlatformConfig[]>(DEFAULT_PLATFORM_CONFIGS);
  const [generationSeed, setGenerationSeed] = useState(0);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadFromInvoice = useCallback((invoice: DocsInvoice | null, availableInvoices: DocsInvoice[]) => {
    if (!invoice) {
      setForm(blank(availableInvoices));
      setBranchGroups(createManualDefaultBranchGroups());
      setTotalBudget(DEFAULT_TOTAL_BUDGET);
      setPlatformConfigs(DEFAULT_PLATFORM_CONFIGS);
      setGenerationSeed(0);
      return;
    }

    const nextForm = toForm(invoice);
    const normalizedGroups = normalizeBranchGroupsForEditor(
      invoice.branch_groups ?? [],
      nextForm.invoice_template === 'Manual',
    );
    const inferredBudget = Math.max(0, Math.round(Number(invoice.final_budget ?? sumBranchGroupsCost(normalizedGroups))));

    setForm(nextForm);
    setBranchGroups(normalizedGroups.length ? normalizedGroups : createManualDefaultBranchGroups());
    setTotalBudget(inferredBudget || DEFAULT_TOTAL_BUDGET);
    setPlatformConfigs(
      nextForm.invoice_template === 'Pro icon KSA Template'
        ? derivePlatformConfigs(normalizedGroups, inferredBudget || DEFAULT_TOTAL_BUDGET)
        : DEFAULT_PLATFORM_CONFIGS,
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

  function applyTemplate(templateName: InvoiceTemplateName) {
    if (templateName === 'Manual') {
      setForm((prev) => ({ ...prev, invoice_template: 'Manual' }));
      setBranchGroups(createManualDefaultBranchGroups());
      setPlatformConfigs(DEFAULT_PLATFORM_CONFIGS);
      setGenerationSeed(0);
      return;
    }

    const generated = generateInvoiceFromTemplate({
      templateName,
      campaignMonth: form.campaign_month,
      invoiceDate: form.invoice_date,
      finalBudget: totalBudget,
      fees: form.our_fees,
    });

    setForm((prev) => ({
      ...prev,
      invoice_template: templateName,
      client_name: generated.clientName || prev.client_name,
      our_fees: generated.fees,
    }));
    setBranchGroups(normalizeBranchGroupsForEditor(generated.branchGroups));
    setTotalBudget(generated.finalBudget || totalBudget);
    setPlatformConfigs(
      templateName === 'Pro icon KSA Template'
        ? derivePlatformConfigs(generated.branchGroups, generated.finalBudget || totalBudget)
        : DEFAULT_PLATFORM_CONFIGS,
    );
    setGenerationSeed(0);
  }

  function regenerateKsa(seedOffset = 1, reset = false) {
    const nextSeed = generationSeed + seedOffset;
    const nextPlatforms = reset ? DEFAULT_PLATFORM_CONFIGS : platformConfigs;
    const nextBudget = reset ? DEFAULT_TOTAL_BUDGET : totalBudget;

    const generated = generateSmartInvoice({
      campaignMonth: form.campaign_month,
      invoiceDate: form.invoice_date,
      finalBudget: nextBudget,
      fees: form.our_fees,
      clientName: form.client_name || INVOICE_TEMPLATES['Pro icon KSA Template'].clientName,
      platforms: nextPlatforms.map((platform) => ({
        name: platform.name,
        enabled: platform.enabled,
        campaignCount: platform.campaignCount,
        allocationPct: platform.allocationPct,
      })),
      seedSalt: String(nextSeed),
    });

    if (reset) {
      setTotalBudget(DEFAULT_TOTAL_BUDGET);
      setPlatformConfigs(DEFAULT_PLATFORM_CONFIGS);
    }

    setBranchGroups(normalizeBranchGroupsForEditor(generated.branchGroups));
    setForm((prev) => ({
      ...prev,
      invoice_template: 'Pro icon KSA Template',
      client_name: prev.client_name || generated.clientName,
    }));
    setGenerationSeed(nextSeed);
  }

  function togglePlatform(index: number, enabled: boolean) {
    setPlatformConfigs((prev) => {
      const next = prev.map((platform, i) => (
        i === index
          ? {
            ...platform,
            enabled,
            campaignCount: Math.max(1, platform.campaignCount || 1),
            allocationPct: enabled ? Math.max(1, platform.allocationPct || 1) : 0,
          }
          : platform
      ));
      return normalizePlatformConfigs(next);
    });
  }

  function updateCampaignCount(index: number, value: number) {
    setPlatformConfigs((prev) => prev.map((platform, i) => (
      i === index ? { ...platform, campaignCount: Math.max(1, Math.round(value || 1)) } : platform
    )));
  }

  function updateAllocation(index: number, value: number) {
    setPlatformConfigs((prev) => {
      if (!prev[index]?.enabled) return prev;
      const enabledIndexes = prev.map((item, idx) => ({ item, idx })).filter((entry) => entry.item.enabled);
      if (enabledIndexes.length <= 1) {
        return prev.map((platform, idx) => ({ ...platform, allocationPct: idx === index ? 100 : 0 }));
      }

      const clamped = Math.max(0, Math.min(100, Math.round(value)));
      const otherIndexes = enabledIndexes.map((entry) => entry.idx).filter((idx) => idx !== index);
      const currentOtherTotal = otherIndexes.reduce((sum, idx) => sum + (prev[idx]?.allocationPct ?? 0), 0);
      const remaining = Math.max(0, 100 - clamped);

      const otherAllocations = distributePercentages(
        otherIndexes.map((idx) => {
          const current = prev[idx]?.allocationPct ?? 0;
          if (currentOtherTotal <= 0) return 1;
          return (current / currentOtherTotal) * remaining;
        }),
      );

      const next = prev.map((platform) => ({ ...platform }));
      const selectedPlatform = next[index];
      if (!selectedPlatform) return prev;
      selectedPlatform.allocationPct = clamped;
      otherIndexes.forEach((idx, i) => {
        const otherPlatform = next[idx];
        if (!otherPlatform) return;
        otherPlatform.allocationPct = otherAllocations[i] ?? 0;
      });

      return normalizePlatformConfigs(next);
    });
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
      setBranchGroups(normalizedGroups.length ? normalizedGroups : createManualDefaultBranchGroups());
      setTotalBudget(persistedBudget || totalBudget);
      setPlatformConfigs(
        savedInvoice.invoice_template === 'Pro icon KSA Template'
          ? derivePlatformConfigs(normalizedGroups, persistedBudget || totalBudget)
          : DEFAULT_PLATFORM_CONFIGS,
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

  const totalAllocation = platformConfigs
    .filter((platform) => platform.enabled)
    .reduce((sum, platform) => sum + platform.allocationPct, 0);

  const inputClass = 'w-full px-3 py-2 text-sm rounded-lg border outline-none bg-[var(--surface-2)] border-[var(--border)] text-[var(--text)]';

  return (
    <div className="docs-app p-6 space-y-4">
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

      <div className="grid grid-cols-1 xl:grid-cols-[44%_56%] gap-4 min-h-[calc(100vh-170px)]">
        <section className="space-y-4 overflow-y-auto pr-1">
          <div className="rounded-2xl border p-4 space-y-3" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Document Setup</h2>
              <div className="flex items-center gap-2">
                <button type="button" onClick={createNew} className="px-2.5 py-1.5 rounded-lg border text-xs font-semibold" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                  <Plus size={12} className="inline mr-1" /> New
                </button>
                <button type="button" onClick={() => void saveInvoice()} disabled={saving || loading} className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ background: 'var(--accent)' }}>
                  <Save size={12} className="inline mr-1" /> {saving ? 'Saving…' : 'Save'}
                </button>
                {form.id ? (
                  <button type="button" onClick={() => void deleteInvoice()} className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ background: '#dc2626' }}>
                    <Trash2 size={12} className="inline mr-1" /> Delete
                  </button>
                ) : null}
              </div>
            </div>

            <div>
              <label htmlFor="invoice-template" className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Invoice Mode / Template</label>
              <select
                id="invoice-template"
                className={inputClass}
                value={form.invoice_template}
                onChange={(e) => applyTemplate(asTemplateName(e.target.value))}
              >
                {INVOICE_TEMPLATE_OPTIONS.map((templateName) => (
                  <option key={templateName} value={templateName}>{templateName === 'Manual' ? 'Standard Manual Invoice' : templateName}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Invoice Number</label>
                <input className={inputClass} value={form.invoice_number} onChange={(e) => setField('invoice_number', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Currency</label>
                <select className={inputClass} value={form.currency} onChange={(e) => setField('currency', e.target.value)}>
                  {DOCS_CURRENCIES.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Status</label>
                <select className={inputClass} value={form.status} onChange={(e) => setField('status', e.target.value as 'paid' | 'unpaid')}>
                  <option value="unpaid">Unpaid</option>
                  <option value="paid">Paid</option>
                </select>
              </div>
              <div>
                <label htmlFor="invoice-campaign-month" className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Campaign Month</label>
                <input id="invoice-campaign-month" type="month" className={inputClass} value={form.campaign_month} onChange={(e) => setField('campaign_month', e.target.value)} />
              </div>
              <div>
                <label htmlFor="invoice-date" className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Invoice Date</label>
                <input id="invoice-date" type="date" className={inputClass} value={form.invoice_date} onChange={(e) => setField('invoice_date', e.target.value)} />
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
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Client Name</label>
              <input className={inputClass} value={form.client_name} onChange={(e) => setField('client_name', e.target.value)} placeholder={selectedProfile?.client_name || 'Client name'} />
            </div>
          </div>

          {form.invoice_template === 'Pro icon KSA Template' ? (
            <div className="rounded-2xl border p-4 space-y-3" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Pro icon KSA Generator</h2>

              <div>
                <label htmlFor="invoice-total-budget" className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Total Budget</label>
                <input id="invoice-total-budget" type="number" min={0} className={inputClass} value={totalBudget} onChange={(e) => setTotalBudget(Math.max(0, Math.round(Number(e.target.value) || 0)))} />
              </div>

              <div className="rounded-xl border p-2 flex items-center justify-between text-xs" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Total Allocation</span>
                <span className={clsx('font-bold', totalAllocation === 100 ? 'text-emerald-600' : 'text-amber-600')}>
                  {totalAllocation}%
                </span>
              </div>

              {platformConfigs.map((platform, index) => {
                const platformBudget = Math.round((totalBudget * platform.allocationPct) / 100);
                return (
                  <div key={platform.key} className="rounded-xl border p-3 space-y-2" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
                    <div className="flex items-center justify-between gap-3">
                      <label className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--text)' }}>
                        <input
                          type="checkbox"
                          checked={platform.enabled}
                          onChange={(e) => togglePlatform(index, e.target.checked)}
                        />
                        {platform.name}
                      </label>
                      <span className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>
                        {platform.enabled ? `${platformBudget.toLocaleString()} ${form.currency}` : 'Disabled'}
                      </span>
                    </div>

                    <div className="grid grid-cols-[170px_1fr_80px] gap-3 items-center">
                      <div>
                        <label htmlFor={`campaign-count-${platform.key}`} className="block text-[11px] font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Campaign Count</label>
                        <input
                          id={`campaign-count-${platform.key}`}
                          type="number"
                          min={1}
                          disabled={!platform.enabled}
                          className={inputClass}
                          value={platform.campaignCount}
                          onChange={(e) => updateCampaignCount(index, Number(e.target.value))}
                        />
                      </div>

                      <div>
                        <label htmlFor={`allocation-range-${platform.key}`} className="block text-[11px] font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Budget Allocation %</label>
                        <input
                          id={`allocation-range-${platform.key}`}
                          type="range"
                          min={0}
                          max={100}
                          disabled={!platform.enabled}
                          className="w-full"
                          value={platform.allocationPct}
                          aria-label={`Budget allocation percentage for ${platform.name}`}
                          aria-valuetext={`${platform.allocationPct}%`}
                          onChange={(e) => updateAllocation(index, Number(e.target.value))}
                        />
                      </div>

                      <div>
                        <label htmlFor={`allocation-input-${platform.key}`} className="block text-[11px] font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Allocation %</label>
                        <input
                          id={`allocation-input-${platform.key}`}
                          type="number"
                          min={0}
                          max={100}
                          disabled={!platform.enabled}
                          className={inputClass}
                          value={platform.allocationPct}
                          aria-label={`Allocation percentage for ${platform.name}`}
                          onChange={(e) => updateAllocation(index, Number(e.target.value))}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => regenerateKsa(1, false)}
                  className="px-3 py-2 rounded-lg text-xs font-semibold text-white"
                  style={{ background: 'var(--accent)' }}
                >
                  <Wand2 size={13} className="inline mr-1" /> Generate Rows
                </button>
                <button
                  type="button"
                  onClick={() => regenerateKsa(1, true)}
                  className="px-3 py-2 rounded-lg text-xs font-semibold border"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                >
                  <RotateCcw size={13} className="inline mr-1" /> Reset Generator
                </button>
              </div>
            </div>
          ) : null}

          <div className="rounded-2xl border p-4 space-y-3" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Invoice Structure Editor</h2>
              <button
                type="button"
                onClick={addBranch}
                className="px-2.5 py-1.5 rounded-lg border text-xs font-semibold"
                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
              >
                <Plus size={12} className="inline mr-1" /> Add Branch
              </button>
            </div>

            {branchGroups.length === 0 ? (
              <div className="text-xs rounded-lg border px-3 py-2" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                No rows yet. Add a branch to start building your invoice.
              </div>
            ) : null}

            {branchGroups.map((branch, branchIndex) => (
              <div key={branch.id} className="rounded-xl border p-3 space-y-3" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
                <div className="flex items-center gap-2">
                  <input
                    className={inputClass}
                    value={branch.branch_name}
                    onChange={(e) => updateBranchName(branchIndex, e.target.value)}
                    placeholder="Branch name"
                  />
                  <button
                    type="button"
                    onClick={() => removeBranch(branchIndex)}
                    className="px-2 py-2 rounded-lg border text-xs font-semibold"
                    style={{ borderColor: 'rgba(239,68,68,0.3)', color: '#dc2626' }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>

                {branch.platform_groups.map((platform, platformIndex) => (
                  <div key={platform.id} className="rounded-lg border p-3 space-y-2" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                    <div className="flex items-center gap-2">
                      <input
                        className={inputClass}
                        value={platform.platform_name}
                        onChange={(e) => updatePlatformName(branchIndex, platformIndex, e.target.value)}
                        placeholder="Platform name"
                      />
                      <button
                        type="button"
                        onClick={() => addRow(branchIndex, platformIndex)}
                        className="px-2 py-2 rounded-lg border text-xs font-semibold"
                        style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                        title="Add row"
                      >
                        <Plus size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => removePlatform(branchIndex, platformIndex)}
                        className="px-2 py-2 rounded-lg border text-xs font-semibold"
                        style={{ borderColor: 'rgba(239,68,68,0.3)', color: '#dc2626' }}
                        title="Remove platform"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>

                    {platform.campaign_rows.length === 0 ? (
                      <div className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>No rows. Add one row.</div>
                    ) : null}

                    {platform.campaign_rows.map((row, rowIndex) => (
                      <div key={row.id} className="grid grid-cols-[1.2fr_120px_1fr_120px_32px] gap-2 items-center">
                        <input
                          className={inputClass}
                          value={row.ad_name}
                          onChange={(e) => updateRowField(branchIndex, platformIndex, rowIndex, 'ad_name', e.target.value)}
                          placeholder="Ad name"
                        />
                        <input
                          type="date"
                          className={inputClass}
                          value={row.date}
                          onChange={(e) => updateRowField(branchIndex, platformIndex, rowIndex, 'date', e.target.value)}
                        />
                        <input
                          className={inputClass}
                          value={row.results}
                          onChange={(e) => updateRowField(branchIndex, platformIndex, rowIndex, 'results', e.target.value)}
                          placeholder="Results"
                        />
                        <input
                          type="number"
                          min={0}
                          className={inputClass}
                          value={row.cost}
                          onChange={(e) => updateRowField(branchIndex, platformIndex, rowIndex, 'cost', e.target.value)}
                          placeholder="Cost"
                        />
                        <button
                          type="button"
                          onClick={() => removeRow(branchIndex, platformIndex, rowIndex)}
                          className="px-2 py-2 rounded-lg border text-xs font-semibold"
                          style={{ borderColor: 'rgba(239,68,68,0.3)', color: '#dc2626' }}
                          title="Remove row"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => addPlatform(branchIndex)}
                  className="px-2.5 py-1.5 rounded-lg border text-xs font-semibold"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                >
                  <Plus size={12} className="inline mr-1" /> Add Platform
                </button>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border p-4 space-y-2" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Budget Summary</h2>
            <div className="flex items-center justify-between text-xs py-1.5 border-b" style={{ borderColor: 'var(--border)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Final Budget</span>
              <span className="font-semibold" style={{ color: 'var(--text)' }}>{model.totals.finalBudget.toLocaleString()} {form.currency}</span>
            </div>
            <div className="flex items-center justify-between text-xs py-1.5 border-b" style={{ borderColor: 'var(--border)' }}>
              <label htmlFor="invoice-our-fees" style={{ color: 'var(--text-secondary)' }}>Our Fees</label>
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
          </div>

          <div className="rounded-2xl border p-4 space-y-3" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Controls</h2>

            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Saved Invoices</label>
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
              {loading ? <p className="text-[11px] mt-1" style={{ color: 'var(--text-secondary)' }}>Loading invoices…</p> : null}
            </div>

            <div>
              <label htmlFor="invoice-notes" className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Notes</label>
              <textarea id="invoice-notes" className={inputClass} rows={3} value={form.notes} onChange={(e) => setField('notes', e.target.value)} />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border p-3 overflow-auto xl:sticky xl:top-4 xl:h-[calc(100vh-170px)]" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <div className="flex items-center justify-end gap-2 pb-3">
            {form.id ? (
              <a
                href={`/api/docs/invoices/${form.id}/export`}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border"
                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
              >
                <Download size={12} className="inline mr-1" /> Excel
              </a>
            ) : null}
            <button
              type="button"
              onClick={() => { void exportPreviewPdf('invoice-preview', form.invoice_number || 'invoice', 'invoice'); }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
              style={{ background: 'var(--accent)' }}
            >
              <Printer size={12} className="inline mr-1" /> PDF
            </button>
          </div>

          <div className="overflow-x-auto">
            <div style={{ minWidth: '820px' }}>
              <InvoicePreview model={model} />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
