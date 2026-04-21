'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Plus, Trash2, Save, Download, Printer, AlertCircle, Check,
} from 'lucide-react';
import clsx from 'clsx';
import type {
  DocsInvoice,
  InvoiceBranchGroup,
  InvoiceCampaignRow,
  InvoicePlatformGroup,
} from '@/lib/docs-types';
import { DOCS_CURRENCIES } from '@/lib/docs-types';
import type { DocsClientProfile } from '@/lib/docs-client-profiles';
import { fetchDocsClientProfiles } from '@/lib/docs-client-profiles';
import ClientProfileSelector from '@/components/docs/ClientProfileSelector';
import InvoicePreview from '@/components/docs/invoice/InvoicePreview';
import { buildInvoiceDocumentModel } from '@/lib/docs-invoice-document-model';
import { exportPreviewPdf } from '@/lib/docs-print';

interface FormState {
  id?: string;
  client_profile_id: string | null;
  invoice_number: string;
  client_name: string;
  campaign_month: string;
  invoice_date: string;
  currency: string;
  status: 'paid' | 'unpaid';
  our_fees: number;
  notes: string;
  branch_groups: InvoiceBranchGroup[];
}

const uid = () => (crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2, 11));
const today = () => new Date().toISOString().slice(0, 10);
const monthNow = () => new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).replace(' ', '-');

function row(): InvoiceCampaignRow {
  return { id: uid(), ad_name: '', date: today(), results: '', cost: 0 };
}

function platform(name = 'Platform'): InvoicePlatformGroup {
  return { id: uid(), platform_name: name, campaign_rows: [row()] };
}

function branch(name = 'Branch'): InvoiceBranchGroup {
  return { id: uid(), branch_name: name, platform_groups: [platform()] };
}

function nextInvoiceNumber(invoices: DocsInvoice[]) {
  const maxNumber = invoices
    .map((invoice) => parseInt(invoice.invoice_number.replace(/\D/g, '') || '0', 10))
    .filter(Boolean)
    .reduce((max, value) => (value > max ? value : max), 0);
  return `INV-${String(maxNumber + 1).padStart(4, '0')}`;
}

function blank(invoices: DocsInvoice[]): FormState {
  return {
    client_profile_id: null,
    invoice_number: nextInvoiceNumber(invoices),
    client_name: '',
    campaign_month: monthNow(),
    invoice_date: today(),
    currency: 'SAR',
    status: 'unpaid',
    our_fees: 0,
    notes: '',
    branch_groups: [branch('Main Branch')],
  };
}

function toForm(invoice: DocsInvoice): FormState {
  return {
    id: invoice.id,
    client_profile_id: invoice.client_profile_id ?? null,
    invoice_number: invoice.invoice_number,
    client_name: invoice.client_name,
    campaign_month: invoice.campaign_month ?? monthNow(),
    invoice_date: invoice.invoice_date ?? today(),
    currency: invoice.currency,
    status: invoice.status,
    our_fees: Number(invoice.our_fees ?? 0),
    notes: invoice.notes ?? '',
    branch_groups: invoice.branch_groups?.length ? invoice.branch_groups : [branch('Main Branch')],
  };
}

export default function InvoicePage() {
  const [invoices, setInvoices] = useState<DocsInvoice[]>([]);
  const [profiles, setProfiles] = useState<DocsClientProfile[]>([]);
  const [form, setForm] = useState<FormState>(() => blank([]));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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
      setForm((current) => {
        if (current.id) return current;
        if (loadedInvoices[0]) return toForm(loadedInvoices[0]);
        return blank(loadedInvoices);
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load invoices.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.client_id === form.client_profile_id),
    [profiles, form.client_profile_id],
  );

  const model = useMemo(() => buildInvoiceDocumentModel(form), [form]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function patchBranchGroups(updater: (groups: InvoiceBranchGroup[]) => InvoiceBranchGroup[]) {
    setForm((prev) => ({ ...prev, branch_groups: updater(prev.branch_groups) }));
  }

  function createNew() {
    setError('');
    setSuccess('');
    setForm(blank(invoices));
  }

  async function saveInvoice() {
    if (!form.invoice_number.trim()) { setError('Invoice number is required.'); return; }
    if (!form.client_name.trim()) { setError('Client name is required.'); return; }

    setSaving(true);
    setError('');
    try {
      const payload = {
        client_profile_id: form.client_profile_id,
        invoice_number: form.invoice_number,
        client_name: form.client_name,
        campaign_month: form.campaign_month,
        invoice_date: form.invoice_date,
        currency: form.currency,
        status: form.status,
        our_fees: Number(form.our_fees || 0),
        notes: form.notes,
        branch_groups: form.branch_groups,
        platforms: [],
        deliverables: [],
        custom_client: null,
        custom_project: null,
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
    setForm(nextInvoices[0] ? toForm(nextInvoices[0]) : blank(nextInvoices));
    setSuccess('Invoice deleted.');
    setTimeout(() => setSuccess(''), 1800);
  }

  const inputClass = 'w-full px-3 py-1.5 text-sm rounded-lg border outline-none bg-[var(--surface-2)] border-[var(--border)] text-[var(--text)]';

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

      <div className="grid grid-cols-1 xl:grid-cols-[44%_56%] gap-4 min-h-[calc(100vh-190px)]">
        <section className="space-y-4 overflow-y-auto pr-1">
          <div className="rounded-2xl border p-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Invoice Workspace</h2>
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

            <div className="space-y-2 max-h-36 overflow-auto pr-1">
              {loading ? <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Loading invoices…</p> : null}
              {!loading && invoices.length === 0 ? <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>No saved invoices yet.</p> : null}
              {invoices.map((invoice) => (
                <button
                  key={invoice.id}
                  type="button"
                  onClick={() => setForm(toForm(invoice))}
                  className={clsx('w-full text-left rounded-lg border px-2.5 py-2 transition-colors', form.id === invoice.id ? 'bg-[var(--accent-soft)] border-[var(--accent)]' : 'hover:bg-[var(--surface-2)] border-[var(--border)]')}
                >
                  <p className="text-xs font-semibold" style={{ color: 'var(--text)' }}>{invoice.invoice_number} · {invoice.client_name}</p>
                  <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{invoice.campaign_month || '—'} · {new Date(invoice.updated_at).toLocaleString()}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border p-4 space-y-3" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Invoice Number</label>
                <input className={inputClass} value={form.invoice_number} onChange={(e) => setField('invoice_number', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Invoice Date</label>
                <input type="date" className={inputClass} value={form.invoice_date} onChange={(e) => setField('invoice_date', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Campaign Month</label>
                <input className={inputClass} value={form.campaign_month} onChange={(e) => setField('campaign_month', e.target.value)} />
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
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Our Fees</label>
                <input type="number" className={inputClass} value={form.our_fees} onChange={(e) => setField('our_fees', Number(e.target.value))} />
              </div>
            </div>

            <ClientProfileSelector
              profiles={profiles}
              selectedClientId={form.client_profile_id ?? ''}
              onSelectClientId={(value) => {
                setField('client_profile_id', value || null);
                if (!value) return;
                const profile = profiles.find((p) => p.client_id === value);
                if (profile) {
                  setField('client_name', profile.client_name);
                }
              }}
            />

            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Client Name</label>
              <input className={inputClass} value={form.client_name} onChange={(e) => setField('client_name', e.target.value)} placeholder={selectedProfile?.client_name || 'Client name'} />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Notes</label>
              <textarea className={inputClass} rows={3} value={form.notes} onChange={(e) => setField('notes', e.target.value)} />
            </div>
          </div>

          <div className="rounded-2xl border p-4 space-y-3" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Branch & Platform Groups</h3>
              <button type="button" onClick={() => patchBranchGroups((groups) => [...groups, branch(`Branch ${groups.length + 1}`)])} className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>
                <Plus size={12} className="inline mr-1" /> Add Branch
              </button>
            </div>

            {form.branch_groups.map((bg, bi) => (
              <div key={bg.id} className="rounded-xl border p-3 space-y-2" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
                <div className="flex items-center gap-2">
                  <input className={inputClass} value={bg.branch_name} onChange={(e) => patchBranchGroups((groups) => groups.map((item, i) => (i === bi ? { ...item, branch_name: e.target.value } : item)))} />
                  <button type="button" onClick={() => patchBranchGroups((groups) => groups.filter((_, i) => i !== bi))} className="px-2 py-1 rounded-md text-xs text-white" style={{ background: '#dc2626' }}>
                    <Trash2 size={12} />
                  </button>
                </div>

                {bg.platform_groups.map((pg, pi) => (
                  <div key={pg.id} className="rounded-lg border p-2" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                    <div className="flex items-center gap-2 mb-2">
                      <input className={inputClass} value={pg.platform_name} onChange={(e) => patchBranchGroups((groups) => groups.map((group, gi) => (gi === bi ? { ...group, platform_groups: group.platform_groups.map((item, i) => (i === pi ? { ...item, platform_name: e.target.value } : item)) } : group)))} />
                      <button type="button" onClick={() => patchBranchGroups((groups) => groups.map((group, gi) => (gi === bi ? { ...group, platform_groups: group.platform_groups.filter((_, i) => i !== pi) } : group)))} className="px-2 py-1 rounded-md text-xs text-white" style={{ background: '#dc2626' }}>
                        <Trash2 size={12} />
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      {pg.campaign_rows.map((cr, ri) => (
                        <div key={cr.id} className="grid grid-cols-[1fr_130px_1fr_120px_auto] gap-1.5">
                          <input className={inputClass} placeholder="Ad name" value={cr.ad_name} onChange={(e) => patchBranchGroups((groups) => groups.map((group, gi) => (gi === bi ? { ...group, platform_groups: group.platform_groups.map((platformItem, pj) => (pj === pi ? { ...platformItem, campaign_rows: platformItem.campaign_rows.map((rowItem, rk) => (rk === ri ? { ...rowItem, ad_name: e.target.value } : rowItem)) } : platformItem)) } : group)))} />
                          <input className={inputClass} placeholder="Date" value={cr.date} onChange={(e) => patchBranchGroups((groups) => groups.map((group, gi) => (gi === bi ? { ...group, platform_groups: group.platform_groups.map((platformItem, pj) => (pj === pi ? { ...platformItem, campaign_rows: platformItem.campaign_rows.map((rowItem, rk) => (rk === ri ? { ...rowItem, date: e.target.value } : rowItem)) } : platformItem)) } : group)))} />
                          <input className={inputClass} placeholder="Results" value={cr.results} onChange={(e) => patchBranchGroups((groups) => groups.map((group, gi) => (gi === bi ? { ...group, platform_groups: group.platform_groups.map((platformItem, pj) => (pj === pi ? { ...platformItem, campaign_rows: platformItem.campaign_rows.map((rowItem, rk) => (rk === ri ? { ...rowItem, results: e.target.value } : rowItem)) } : platformItem)) } : group)))} />
                          <input type="number" className={inputClass} placeholder="Cost" value={cr.cost} onChange={(e) => patchBranchGroups((groups) => groups.map((group, gi) => (gi === bi ? { ...group, platform_groups: group.platform_groups.map((platformItem, pj) => (pj === pi ? { ...platformItem, campaign_rows: platformItem.campaign_rows.map((rowItem, rk) => (rk === ri ? { ...rowItem, cost: Number(e.target.value) } : rowItem)) } : platformItem)) } : group)))} />
                          <button type="button" onClick={() => patchBranchGroups((groups) => groups.map((group, gi) => (gi === bi ? { ...group, platform_groups: group.platform_groups.map((platformItem, pj) => (pj === pi ? { ...platformItem, campaign_rows: platformItem.campaign_rows.filter((_, rk) => rk !== ri) } : platformItem)) } : group)))} className="px-2 py-1 rounded-md text-xs text-white" style={{ background: '#dc2626' }}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                      <button type="button" onClick={() => patchBranchGroups((groups) => groups.map((group, gi) => (gi === bi ? { ...group, platform_groups: group.platform_groups.map((platformItem, pj) => (pj === pi ? { ...platformItem, campaign_rows: [...platformItem.campaign_rows, row()] } : platformItem)) } : group)))} className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>
                        <Plus size={12} className="inline mr-1" /> Add Row
                      </button>
                    </div>
                  </div>
                ))}

                <button type="button" onClick={() => patchBranchGroups((groups) => groups.map((group, gi) => (gi === bi ? { ...group, platform_groups: [...group.platform_groups, platform(`Platform ${group.platform_groups.length + 1}`)] } : group)))} className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>
                  <Plus size={12} className="inline mr-1" /> Add Platform
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border p-3 overflow-auto" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
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
