'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import {
  Plus, Trash2, Save, Copy, Edit2, RotateCcw, Search,
  Download, Printer, Check, X, AlertCircle, Archive, ExternalLink, ChevronDown, ChevronRight,
} from 'lucide-react';
import clsx from 'clsx';
import OpenyLogo from '@/components/branding/OpenyLogo';
import ClientProfileSelector from '@/components/docs/ClientProfileSelector';
import type {
  DocsInvoice,
  InvoiceBranchGroup,
  InvoiceCampaignRow,
  InvoicePlatformGroup,
} from '@/lib/docs-types';
import { DOCS_CURRENCIES } from '@/lib/docs-types';
import type { DocsClientProfile } from '@/lib/docs-client-profiles';
import { fetchDocsClientProfiles, isVirtualDocsProfileId } from '@/lib/docs-client-profiles';
import { printPreviewDocument } from '@/lib/docs-print';

const INVOICE_BLACK = '#000';
const INVOICE_ADDRESS = 'Villa 175, First District, Fifth Settlement, Cairo';
const INVOICE_EMAIL = 'info@openytalk.com';

function uid() { return Math.random().toString(36).slice(2, 10); }
function today() { return new Date().toISOString().slice(0, 10); }
function fmt(n: number, cur: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur, minimumFractionDigits: 2 }).format(n || 0);
}
function n(v: unknown) {
  const parsed = Number(v);
  return Number.isFinite(parsed) ? parsed : 0;
}
function round2(v: number) {
  return Math.round(v * 100) / 100;
}
function getInvoiceAmount(inv: Pick<DocsInvoice, 'grand_total' | 'final_budget' | 'total_budget'>) {
  return n(inv.grand_total ?? inv.final_budget ?? inv.total_budget);
}
function resolveFinalBudget(inv: DocsInvoice, branchGroups: InvoiceBranchGroup[]) {
  if (inv.final_budget !== null && inv.final_budget !== undefined) return n(inv.final_budget);
  if (branchGroups.length > 0) return calcFinalBudget(branchGroups);
  return n(inv.total_budget);
}
function nextInvoiceNum(list: DocsInvoice[]) {
  const nums = list.map(i => parseInt(i.invoice_number.replace(/\D/g, '') || '0')).filter(Boolean);
  const max = nums.length ? Math.max(...nums) : 0;
  return `INV-${String(max + 1).padStart(4, '0')}`;
}

function blankCampaignRow(): InvoiceCampaignRow {
  return { id: uid(), ad_name: '', date: today(), results: '', cost: 0 };
}
function blankPlatformGroup(): InvoicePlatformGroup {
  return { id: uid(), platform_name: 'Meta', campaign_rows: [blankCampaignRow()] };
}
function blankBranchGroup(): InvoiceBranchGroup {
  return { id: uid(), branch_name: 'Main Branch', platform_groups: [blankPlatformGroup()] };
}
function defaultBranchGroups(): InvoiceBranchGroup[] {
  return [
    { id: uid(), branch_name: 'Riyadh Branch', platform_groups: [blankPlatformGroup()] },
    { id: uid(), branch_name: 'Jeddah Branch', platform_groups: [blankPlatformGroup()] },
    { id: uid(), branch_name: 'Khobar Branch', platform_groups: [blankPlatformGroup()] },
  ];
}

function calcBranchSubtotal(branch: InvoiceBranchGroup) {
  return round2(branch.platform_groups.reduce((sum, platform) => (
    sum + platform.campaign_rows.reduce((sub, row) => sub + n(row.cost), 0)
  ), 0));
}
function calcFinalBudget(branchGroups: InvoiceBranchGroup[]) {
  return round2(branchGroups.reduce((sum, branch) => sum + calcBranchSubtotal(branch), 0));
}

function sanitizeBranchGroups(branchGroups: unknown): InvoiceBranchGroup[] {
  if (!Array.isArray(branchGroups) || branchGroups.length === 0) return defaultBranchGroups();

  const safe = branchGroups.map((branch) => {
    const b = branch as Partial<InvoiceBranchGroup>;
    const platformGroups = Array.isArray(b.platform_groups) && b.platform_groups.length > 0
      ? b.platform_groups.map((platform) => {
          const p = platform as Partial<InvoicePlatformGroup>;
          const campaignRows = Array.isArray(p.campaign_rows) && p.campaign_rows.length > 0
            ? p.campaign_rows.map((row) => {
                const r = row as Partial<InvoiceCampaignRow>;
                return {
                  id: r.id || uid(),
                  ad_name: r.ad_name || '',
                  date: r.date || today(),
                  results: r.results || '',
                  cost: n(r.cost),
                };
              })
            : [blankCampaignRow()];

          return {
            id: p.id || uid(),
            platform_name: p.platform_name || 'Platform',
            campaign_rows: campaignRows,
          };
        })
      : [blankPlatformGroup()];

    return {
      id: b.id || uid(),
      branch_name: b.branch_name || 'Branch',
      platform_groups: platformGroups,
    };
  });

  return safe.length ? safe : defaultBranchGroups();
}

function legacyToBranchGroups(inv: DocsInvoice): InvoiceBranchGroup[] {
  const platforms = (inv.platforms || []).filter(p => p.enabled);
  if (!platforms.length) return defaultBranchGroups();
  return [{
    id: uid(),
    branch_name: 'Main Branch',
    platform_groups: platforms.map((platform) => ({
      id: uid(),
      platform_name: platform.label,
      campaign_rows: [{
        id: uid(),
        ad_name: `${platform.label} Campaign`,
        date: inv.invoice_date || today(),
        results: '',
        cost: round2(n(inv.total_budget) * (n(platform.budgetPct) / 100)),
      }],
    })),
  }];
}

interface FormState {
  client_profile_id: string | null;
  invoice_number: string;
  client_name: string;
  campaign_month: string;
  invoice_date: string;
  currency: string;
  status: 'paid' | 'unpaid';
  branch_groups: InvoiceBranchGroup[];
  final_budget: number;
  total_budget: number;
  our_fees: number;
  grand_total: number;
  platforms: DocsInvoice['platforms'];
  deliverables: DocsInvoice['deliverables'];
  custom_client: string;
  custom_project: string;
  notes: string;
}

function blankForm(num: string): FormState {
  return {
    client_profile_id: null,
    invoice_number: num,
    client_name: '',
    campaign_month: '',
    invoice_date: today(),
    currency: 'EGP',
    status: 'unpaid',
    branch_groups: defaultBranchGroups(),
    final_budget: 0,
    total_budget: 0,
    our_fees: 0,
    grand_total: 0,
    platforms: [],
    deliverables: [],
    custom_client: '',
    custom_project: '',
    notes: '',
  };
}
function getCsvRows(form: FormState) {
  const rows: string[][] = [
    ['Invoice No', 'Client', 'Date', 'Month', 'Currency', 'Final Budget', 'Our Fees', 'Grand Total', 'Status'],
    [
      form.invoice_number,
      form.client_name,
      form.invoice_date,
      form.campaign_month,
      form.currency,
      String(form.final_budget),
      String(form.our_fees),
      String(form.grand_total),
      form.status,
    ],
    [],
    ['Branch', 'Platform', 'Ad Name', 'Date', 'Results', 'Cost'],
  ];

  form.branch_groups.forEach((branch) => {
    branch.platform_groups.forEach((platform) => {
      platform.campaign_rows.forEach((row) => {
        rows.push([
          branch.branch_name,
          platform.platform_name,
          row.ad_name,
          row.date,
          row.results,
          String(n(row.cost)),
        ]);
      });
    });
    rows.push([`${branch.branch_name} Subtotal`, '', '', '', '', String(calcBranchSubtotal(branch))]);
  });

  if (form.notes.trim()) rows.push([], ['Notes'], [form.notes]);
  return rows;
}

async function getResponseErrorMessage(response: Response, fallback: string) {
  try {
    const json = await response.json() as { error?: string };
    if (json?.error && typeof json.error === 'string') return json.error;
  } catch {
    // ignore JSON parse errors
  }
  return fallback;
}

function InvoicePreview({ form }: { form: FormState }) {
  const tableRows = form.branch_groups.map((branch) => {
    const branchRows = branch.platform_groups.flatMap((platform) => {
      const rows = platform.campaign_rows.length ? platform.campaign_rows : [blankCampaignRow()];
      return rows.map((row, rowIndex) => ({
        branch: branch.branch_name,
        platform: platform.platform_name,
        ad_name: row.ad_name,
        date: row.date,
        results: row.results,
        cost: n(row.cost),
        showPlatform: rowIndex === 0,
        platformSpan: rows.length,
      }));
    });

    return {
      branch,
      subtotal: calcBranchSubtotal(branch),
      rows: branchRows,
      span: Math.max(1, branchRows.length),
    };
  });

  return (
    <div id="invoice-preview" style={{ background: '#fff', color: INVOICE_BLACK, width: '100%', minHeight: 1123, padding: '44px 48px', fontSize: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <OpenyLogo forceVariant="light" width={124} height={34} />
          <div style={{ marginTop: 8, fontSize: 11, lineHeight: 1.5 }}>
            {INVOICE_ADDRESS}<br />
            {INVOICE_EMAIL}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: 1 }}>INVOICE</div>
          <div style={{ fontSize: 11, marginTop: 8 }}>REF: <b>{form.invoice_number || '—'}</b></div>
          <div style={{ fontSize: 11, marginTop: 3 }}>DATE: <b>{form.invoice_date || '—'}</b></div>
        </div>
      </div>

      <div style={{ borderTop: `2px solid ${INVOICE_BLACK}`, marginBottom: 16 }} />

      <div style={{ marginBottom: 16 }}>
        <span style={{ background: INVOICE_BLACK, color: '#fff', padding: '4px 10px', fontSize: 11, fontWeight: 800, letterSpacing: 0.4 }}>
          BILLED TO
        </span>
        <div style={{ marginTop: 9, fontSize: 16, fontWeight: 700 }}>{form.client_name || '—'}</div>
        <div style={{ marginTop: 3, fontSize: 12 }}>Campaign Month: {form.campaign_month || '—'}</div>
      </div>

      {tableRows.map(({ branch, rows, span, subtotal }) => (
        <div key={branch.id} style={{ marginBottom: 16 }}>
          <div style={{ background: INVOICE_BLACK, color: '#fff', fontWeight: 700, fontSize: 12, padding: '6px 10px' }}>
            {branch.branch_name || 'Branch'}
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: INVOICE_BLACK, color: '#fff' }}>
                <th style={previewHeaderCell}>BRANCH</th>
                <th style={previewHeaderCell}>PLATFORM</th>
                <th style={previewHeaderCell}>AD NAME</th>
                <th style={previewHeaderCell}>DATE</th>
                <th style={previewHeaderCell}>RESULTS</th>
                <th style={{ ...previewHeaderCell, textAlign: 'right' }}>COST ({form.currency})</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td style={previewCell}>{branch.branch_name}</td>
                  <td style={previewCell}>—</td>
                  <td style={previewCell}>—</td>
                  <td style={previewCell}>—</td>
                  <td style={previewCell}>—</td>
                  <td style={{ ...previewCell, textAlign: 'right' }}>{fmt(0, form.currency)}</td>
                </tr>
              ) : rows.map((row, index) => (
                <tr key={`${branch.id}-${index}`}>
                  {index === 0 && (
                    <td rowSpan={span} style={{ ...previewCell, fontWeight: 600 }}>{row.branch || '—'}</td>
                  )}
                  {row.showPlatform && (
                    <td rowSpan={row.platformSpan} style={previewCell}>{row.platform || '—'}</td>
                  )}
                  <td style={previewCell}>{row.ad_name || '—'}</td>
                  <td style={previewCell}>{row.date || '—'}</td>
                  <td style={previewCell}>{row.results || '—'}</td>
                  <td style={{ ...previewCell, textAlign: 'right', fontWeight: 600 }}>{fmt(row.cost, form.currency)}</td>
                </tr>
              ))}
              <tr>
                <td colSpan={5} style={{ ...previewCell, background: '#f1f1f1', textAlign: 'right', fontWeight: 700 }}>
                  Subtotal ({branch.branch_name || 'Branch'})
                </td>
                <td style={{ ...previewCell, background: '#f1f1f1', textAlign: 'right', fontWeight: 700 }}>
                  {fmt(subtotal, form.currency)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ))}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
        <table style={{ minWidth: 310, borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
               <td style={totalsLabel}>Final Budget (Ad Spend)</td>
              <td style={totalsValue}>{fmt(form.final_budget, form.currency)}</td>
            </tr>
            <tr>
              <td style={totalsLabel}>Our Fees</td>
              <td style={totalsValue}>{fmt(form.our_fees, form.currency)}</td>
            </tr>
            <tr>
              <td style={{ ...totalsLabel, fontWeight: 900, background: INVOICE_BLACK, color: '#fff' }}>GRAND TOTAL</td>
              <td style={{ ...totalsValue, fontWeight: 900, background: INVOICE_BLACK, color: '#fff' }}>{fmt(form.grand_total, form.currency)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {form.notes.trim() && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 4 }}>NOTES</div>
          <div style={{ fontSize: 11 }}>{form.notes}</div>
        </div>
      )}
    </div>
  );
}

function BackupModal({ module, onClose, onRestore }: {
  module: string; onClose: () => void; onRestore: (data: unknown) => void;
}) {
  const [backups, setBackups] = useState<Array<{ id: string; label: string | null; created_at: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/docs/backups?module=${module}`)
      .then(r => r.json())
      .then(j => setBackups(j.backups ?? []))
      .finally(() => setLoading(false));
  }, [module]);

  async function restore(id: string) {
    const r = await fetch(`/api/docs/backups/${id}`);
    const j = await r.json();
    if (j.backup?.data) { onRestore(j.backup.data); onClose(); }
  }

  async function deleteBackup(id: string) {
    await fetch(`/api/docs/backups/${id}`, { method: 'DELETE' });
    setBackups(b => b.filter(x => x.id !== id));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="rounded-2xl shadow-xl p-6 w-full max-w-md" style={{ background: 'var(--surface)' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>Restore Backup</h2>
          <button onClick={onClose}><X size={18} style={{ color: 'var(--text-secondary)' }} /></button>
        </div>
        {loading && <p className="text-sm text-center py-4" style={{ color: 'var(--text-secondary)' }}>Loading backups…</p>}
        {!loading && backups.length === 0 && <p className="text-sm text-center py-4" style={{ color: 'var(--text-secondary)' }}>No backups found</p>}
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {backups.map(b => (
            <div key={b.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl border" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
              <div>
                <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>{b.label ?? 'Backup'}</div>
                <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{new Date(b.created_at).toLocaleString()}</div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => restore(b.id)} className="px-2.5 py-1 text-xs rounded-lg font-medium text-white" style={{ background: 'var(--accent)' }}>Restore</button>
                <button onClick={() => deleteBackup(b.id)} className="p-1.5 rounded-lg hover:bg-red-50"><Trash2 size={12} style={{ color: '#ef4444' }} /></button>
              </div>
            </div>
          ))}
        </div>
        <button onClick={onClose} className="mt-4 w-full py-2 text-sm rounded-xl border" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>Close</button>
      </div>
    </div>
  );
}

function HistoryPanel({
  invoices, loading, onEdit, onDuplicate, onDelete, onReload, onBackup, onClearAll, onRestoreData,
}: {
  invoices: DocsInvoice[];
  loading: boolean;
  onEdit: (inv: DocsInvoice) => void;
  onDuplicate: (inv: DocsInvoice) => void;
  onDelete: (id: string) => void;
  onReload: () => void;
  onBackup: () => Promise<void>;
  onClearAll: () => Promise<void>;
  onRestoreData: (data: unknown) => void;
}) {
  const [search, setSearch] = useState('');
  const [statusF, setStatusF] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [clientF, setClientF] = useState('');
  const [showRestore, setShowRestore] = useState(false);
  const [backing, setBacking] = useState(false);
  const [clearing, setClearing] = useState(false);

  const visible = invoices.filter(inv => {
    if (statusF !== 'all' && inv.status !== statusF) return false;
    if (clientF && !inv.client_name.toLowerCase().includes(clientF.toLowerCase())) return false;
    if (search && !inv.invoice_number.toLowerCase().includes(search.toLowerCase()) &&
      !inv.client_name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="history-panel flex flex-col h-full">
      <div className="p-4 border-b space-y-2" style={{ borderColor: 'var(--border)' }}>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-secondary)' }} />
            <input
              className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border outline-none"
              style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }}
              placeholder="Search invoices…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button onClick={onReload} className="p-1.5 rounded-lg hover:bg-[var(--surface-2)] transition-colors" title="Refresh">
            <RotateCcw size={14} style={{ color: 'var(--text-secondary)' }} />
          </button>
          <button
            onClick={async () => { setBacking(true); try { await onBackup(); } finally { setBacking(false); } }}
            disabled={backing}
            className="p-1.5 rounded-lg hover:bg-[var(--accent-soft)] transition-colors"
            title="Backup all invoices"
          >
            <Archive size={14} style={{ color: backing ? 'var(--text-secondary)' : 'var(--accent)' }} />
          </button>
          <button onClick={() => setShowRestore(true)} className="p-1.5 rounded-lg hover:bg-[var(--surface-2)] transition-colors" title="Restore from backup">
            <RotateCcw size={14} style={{ color: '#f59e0b' }} />
          </button>
          <button
            onClick={async () => {
              if (!confirm('Clear ALL invoices? This cannot be undone.')) return;
              setClearing(true);
              try { await onClearAll(); } finally { setClearing(false); }
            }}
            disabled={clearing}
            className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
            title="Clear all invoices"
          >
            <Trash2 size={14} style={{ color: '#ef4444' }} />
          </button>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['all', 'paid', 'unpaid'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusF(s)}
              className={clsx('px-2.5 py-1 text-xs rounded-full font-medium transition-colors', statusF === s ? 'bg-[var(--accent)] text-white' : 'bg-[var(--surface-2)] text-[var(--text-secondary)]')}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
          <input
            className="flex-1 min-w-0 px-2 py-1 text-xs rounded-lg border outline-none"
            style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }}
            placeholder="Filter by client…"
            value={clientF}
            onChange={e => setClientF(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto divide-y" style={{ borderColor: 'var(--border)' }}>
        {loading && <div className="p-6 text-sm text-center" style={{ color: 'var(--text-secondary)' }}>Loading…</div>}
        {!loading && visible.length === 0 && <div className="p-6 text-sm text-center" style={{ color: 'var(--text-secondary)' }}>No invoices found</div>}
        {visible.map(inv => {
          const amount = getInvoiceAmount(inv);
          return (
            <div key={inv.id} className="p-3 hover:bg-[var(--surface-2)] transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{inv.invoice_number}</span>
                    <span
                      className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                      style={{
                        background: inv.status === 'paid' ? 'rgba(22,163,74,0.1)' : 'rgba(234,179,8,0.1)',
                        color: inv.status === 'paid' ? '#16a34a' : '#ca8a04',
                      }}
                    >
                      {inv.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    {inv.client_name} · {inv.invoice_date ?? '—'}
                  </div>
                  <div className="text-xs font-semibold mt-0.5" style={{ color: 'var(--accent)' }}>
                    {fmt(amount, inv.currency)}
                  </div>
                  <a
                    href={`/api/docs/invoices/${inv.id}/export`}
                    download
                    onClick={e => e.stopPropagation()}
                    className="flex items-center gap-1 text-[10px] font-medium mt-1 hover:underline"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <ExternalLink size={9} /> CSV
                  </a>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => onEdit(inv)} className="p-1.5 rounded-lg hover:bg-[var(--accent-soft)] transition-colors" title="Edit">
                    <Edit2 size={13} style={{ color: 'var(--accent)' }} />
                  </button>
                  <button onClick={() => onDuplicate(inv)} className="p-1.5 rounded-lg hover:bg-[var(--surface-2)] transition-colors" title="Duplicate as new">
                    <Copy size={13} style={{ color: 'var(--text-secondary)' }} />
                  </button>
                  <button onClick={() => onDelete(inv.id)} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors" title="Delete">
                    <Trash2 size={13} style={{ color: '#ef4444' }} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {showRestore && (
        <BackupModal module="invoices" onClose={() => setShowRestore(false)} onRestore={onRestoreData} />
      )}
    </div>
  );
}

export default function InvoicePage() {
  const [invoices, setInvoices] = useState<DocsInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'editor' | 'history'>('editor');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState<FormState>(() => blankForm('INV-0001'));
  const [collapsedBranches, setCollapsedBranches] = useState<Set<string>>(new Set());
  const [profiles, setProfiles] = useState<DocsClientProfile[]>([]);

  const computedFinalBudget = useMemo(() => calcFinalBudget(form.branch_groups ?? []), [form.branch_groups]);
  const computedGrandTotal = useMemo(() => round2(computedFinalBudget + n(form.our_fees)), [computedFinalBudget, form.our_fees]);
  const branchSubtotals = useMemo(
    () => new Map(form.branch_groups.map(branch => [branch.id, calcBranchSubtotal(branch)])),
    [form.branch_groups],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/docs/invoices');
      if (!res.ok) {
        setError(await getResponseErrorMessage(res, 'Unable to load invoices right now.'));
        return;
      }
      const json = await res.json() as { invoices?: DocsInvoice[] };
      setInvoices(json.invoices ?? []);
    } catch {
      setError('Unable to load invoices right now. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    fetchDocsClientProfiles().then(setProfiles).catch(() => null);
  }, []);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(f => ({ ...f, [key]: value }));
  }

  function setBranchGroups(updater: (prev: InvoiceBranchGroup[]) => InvoiceBranchGroup[]) {
    setForm(prev => ({ ...prev, branch_groups: updater(prev.branch_groups) }));
  }

  function toggleBranchCollapse(branchId: string) {
    setCollapsedBranches(prev => {
      const next = new Set(prev);
      if (next.has(branchId)) next.delete(branchId);
      else next.add(branchId);
      return next;
    });
  }

  function setAllBranchesCollapsed(collapsed: boolean) {
    if (!collapsed) {
      setCollapsedBranches(new Set());
      return;
    }
    setCollapsedBranches(new Set(form.branch_groups.map(branch => branch.id)));
  }

  function addBranch() {
    setBranchGroups(prev => [...prev, { ...blankBranchGroup(), branch_name: 'New Branch' }]);
  }

  function removeBranch(branchIndex: number) {
    const removedId = form.branch_groups[branchIndex]?.id;
    setBranchGroups(prev => {
      const next = prev.filter((_, i) => i !== branchIndex);
      return next.length ? next : defaultBranchGroups();
    });
    if (removedId) {
      setCollapsedBranches(prev => {
        const next = new Set(prev);
        next.delete(removedId);
        return next;
      });
    }
  }

  function updateBranchName(branchIndex: number, name: string) {
    setBranchGroups(prev => prev.map((b, i) => i === branchIndex ? { ...b, branch_name: name } : b));
  }

  function addPlatform(branchIndex: number) {
    setBranchGroups(prev => prev.map((branch, i) => {
      if (i !== branchIndex) return branch;
      return {
        ...branch,
        platform_groups: [...branch.platform_groups, { ...blankPlatformGroup(), platform_name: 'New Platform' }],
      };
    }));
  }

  function removePlatform(branchIndex: number, platformIndex: number) {
    setBranchGroups(prev => prev.map((branch, i) => {
      if (i !== branchIndex) return branch;
      const nextPlatforms = branch.platform_groups.filter((_, idx) => idx !== platformIndex);
      return { ...branch, platform_groups: nextPlatforms.length ? nextPlatforms : [blankPlatformGroup()] };
    }));
  }

  function updatePlatformName(branchIndex: number, platformIndex: number, name: string) {
    setBranchGroups(prev => prev.map((branch, i) => {
      if (i !== branchIndex) return branch;
      return {
        ...branch,
        platform_groups: branch.platform_groups.map((platform, idx) => idx === platformIndex ? { ...platform, platform_name: name } : platform),
      };
    }));
  }

  function addCampaignRow(branchIndex: number, platformIndex: number) {
    setBranchGroups(prev => prev.map((branch, i) => {
      if (i !== branchIndex) return branch;
      return {
        ...branch,
        platform_groups: branch.platform_groups.map((platform, idx) => {
          if (idx !== platformIndex) return platform;
          return { ...platform, campaign_rows: [...platform.campaign_rows, blankCampaignRow()] };
        }),
      };
    }));
  }

  function updateCampaignRow(
    branchIndex: number,
    platformIndex: number,
    rowIndex: number,
    patch: Partial<InvoiceCampaignRow>,
  ) {
    setBranchGroups(prev => prev.map((branch, i) => {
      if (i !== branchIndex) return branch;
      return {
        ...branch,
        platform_groups: branch.platform_groups.map((platform, pIdx) => {
          if (pIdx !== platformIndex) return platform;
          return {
            ...platform,
            campaign_rows: platform.campaign_rows.map((row, rIdx) => (
              rIdx === rowIndex
                ? { ...row, ...patch, cost: n(patch.cost ?? row.cost) }
                : row
            )),
          };
        }),
      };
    }));
  }
  function removeCampaignRow(branchIndex: number, platformIndex: number, rowIndex: number) {
    setBranchGroups(prev => prev.map((branch, i) => {
      if (i !== branchIndex) return branch;
      return {
        ...branch,
        platform_groups: branch.platform_groups.map((platform, pIdx) => {
          if (pIdx !== platformIndex) return platform;
          const rows = platform.campaign_rows.filter((_, rIdx) => rIdx !== rowIndex);
          return { ...platform, campaign_rows: rows.length ? rows : [blankCampaignRow()] };
        }),
      };
    }));
  }

  function resetForm() {
    setEditingId(null);
    setForm(blankForm(nextInvoiceNum(invoices)));
    setCollapsedBranches(new Set());
    setError('');
    setActiveTab('editor');
  }

  function loadInvoiceIntoForm(inv: DocsInvoice) {
    const branchGroups = sanitizeBranchGroups(inv.branch_groups?.length ? inv.branch_groups : legacyToBranchGroups(inv));
    const finalBudget = resolveFinalBudget(inv, branchGroups);
    const ourFees = n(inv.our_fees);

    setEditingId(inv.id);
    setForm({
      client_profile_id: inv.client_profile_id ?? null,
      invoice_number: inv.invoice_number,
      client_name: inv.client_name,
      campaign_month: inv.campaign_month ?? '',
      invoice_date: inv.invoice_date ?? today(),
      currency: inv.currency,
      status: inv.status,
      branch_groups: branchGroups,
      final_budget: finalBudget,
      total_budget: finalBudget,
      our_fees: ourFees,
      grand_total: n(inv.grand_total ?? finalBudget + ourFees),
      platforms: Array.isArray(inv.platforms) ? inv.platforms : [],
      deliverables: Array.isArray(inv.deliverables) ? inv.deliverables : [],
      custom_client: inv.custom_client ?? '',
      custom_project: inv.custom_project ?? '',
      notes: inv.notes ?? '',
    });
    setCollapsedBranches(new Set());
    setActiveTab('editor');
  }

  function duplicateInvoice(inv: DocsInvoice) {
    const branchGroups = sanitizeBranchGroups(inv.branch_groups?.length ? inv.branch_groups : legacyToBranchGroups(inv));
    const finalBudget = resolveFinalBudget(inv, branchGroups);
    const ourFees = n(inv.our_fees);

    setEditingId(null);
    setForm({
      client_profile_id: inv.client_profile_id ?? null,
      invoice_number: nextInvoiceNum(invoices),
      client_name: inv.client_name,
      campaign_month: inv.campaign_month ?? '',
      invoice_date: today(),
      currency: inv.currency,
      status: 'unpaid',
      branch_groups: branchGroups,
      final_budget: finalBudget,
      total_budget: finalBudget,
      our_fees: ourFees,
      grand_total: n(inv.grand_total ?? finalBudget + ourFees),
      platforms: Array.isArray(inv.platforms) ? inv.platforms.map(p => ({ ...p })) : [],
      deliverables: Array.isArray(inv.deliverables) ? inv.deliverables.map(d => ({ ...d, id: uid() })) : [],
      custom_client: inv.custom_client ?? '',
      custom_project: inv.custom_project ?? '',
      notes: inv.notes ?? '',
    });
    setCollapsedBranches(new Set());
    setActiveTab('editor');
  }

  async function saveInvoice() {
    if (!form.client_name.trim()) { setError('Client name is required'); return; }
    if (!form.invoice_number.trim()) { setError('Invoice number is required'); return; }

    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        branch_groups: sanitizeBranchGroups(form.branch_groups),
        final_budget: computedFinalBudget,
        total_budget: computedFinalBudget,
        grand_total: computedGrandTotal,
      };

      const url = editingId ? `/api/docs/invoices/${editingId}` : '/api/docs/invoices';
      const method = editingId ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        setError(await getResponseErrorMessage(res, 'Could not save invoice. Please try again.'));
        return;
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      await load();
      if (!editingId) resetForm();
    } catch {
      setError('Could not save invoice. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteInvoice(id: string) {
    if (!confirm('Delete this invoice?')) return;
    try {
      const res = await fetch(`/api/docs/invoices/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        setError(await getResponseErrorMessage(res, 'Could not delete invoice. Please try again.'));
        return;
      }
      await load();
      if (editingId === id) resetForm();
    } catch {
      setError('Could not delete invoice. Please try again.');
    }
  }

  async function handleBackup() {
    const label = `Backup ${new Date().toLocaleDateString()} (${invoices.length} invoices)`;
    try {
      const res = await fetch('/api/docs/backups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module: 'invoices', data: invoices, label }),
      });
      if (!res.ok) setError(await getResponseErrorMessage(res, 'Could not create backup right now.'));
    } catch {
      setError('Could not create backup right now.');
    }
  }

  async function handleClearAll() {
    try {
      await Promise.all(invoices.map(inv => fetch(`/api/docs/invoices/${inv.id}`, { method: 'DELETE' })));
      await load();
      resetForm();
    } catch {
      setError('Could not clear invoices right now.');
    }
  }

  async function handleRestoreData(data: unknown) {
    if (!Array.isArray(data) || data.length === 0) {
      setError('Invalid or empty backup data.');
      return;
    }
    if (!confirm(`Restore ${data.length} invoice(s) from backup? They will be created as new records.`)) return;

    let count = 0;
    for (const item of data as DocsInvoice[]) {
      const {
        id: _id,
        created_at: _ca,
        updated_at: _ua,
        created_by: _cb,
        export_pdf_url: _ep,
        export_excel_url: _ee,
        is_duplicate: _dup,
        original_id: _oid,
        ...rest
      } = item;

      const res = await fetch('/api/docs/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rest),
      });
      if (res.ok) count++;
    }

    await load();
    if (count !== data.length) {
      setError(`Restored ${count} of ${data.length} invoices. Some invoices could not be restored.`);
      return;
    }
    setError('');
  }

  function exportPDF() {
    printPreviewDocument('invoice-preview', form.invoice_number, 'invoice');
  }

  function applyClientProfile(clientId: string) {
    if (!clientId) {
      setField('client_profile_id', null);
      return;
    }
    const profile = profiles.find(p => p.client_id === clientId);
    if (!profile) return;
    const hasManualEdits = !!(
      form.client_name.trim()
      || form.notes.trim()
      || form.branch_groups.some((branch) => (
        branch.platform_groups.some((platform) => (
          platform.campaign_rows.some((row) => n(row.cost) > 0 || row.ad_name.trim() || row.results.trim())
        ))
      ))
    );
    if (hasManualEdits && !confirm('Replace current invoice defaults with the selected client template?')) return;

    const branchNames = profile.default_branch_names.length
      ? profile.default_branch_names
      : ['Main Branch'];
    const platformNames = profile.default_platforms.length
      ? profile.default_platforms
      : ['Meta'];
    const nextBranchGroups = branchNames.map((branchName) => ({
      id: uid(),
      branch_name: branchName,
      platform_groups: platformNames.map((platformName) => ({
        id: uid(),
        platform_name: platformName,
        campaign_rows: [{
          id: uid(),
          ad_name: profile.service_description_default || `${platformName} Campaign`,
          date: form.invoice_date || today(),
          results: '',
          cost: 0,
        }],
      })),
    }));

    setForm(prev => ({
      ...prev,
      client_profile_id: isVirtualDocsProfileId(profile.id) ? null : profile.id,
      client_name: profile.client_name,
      currency: profile.default_currency,
      branch_groups: nextBranchGroups,
      notes: prev.notes || profile.notes || '',
    }));
  }

  function exportCSV() {
    const nextForm = {
      ...form,
      final_budget: computedFinalBudget,
      total_budget: computedFinalBudget,
      grand_total: computedGrandTotal,
    };

    const csv = getCsvRows(nextForm)
      .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\r\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${form.invoice_number}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="invoice-workspace flex h-full overflow-hidden">
      <div className="editor-panel flex flex-col w-full lg:w-[520px] shrink-0 border-r overflow-hidden" style={{ borderColor: 'var(--border)' }}>
        <div className="flex border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
          {(['editor', 'history'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={clsx(
                'flex-1 py-3 text-sm font-medium transition-colors capitalize border-b-2',
                activeTab === tab
                  ? 'border-[var(--accent)] text-[var(--accent)]'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text)]',
              )}
            >
              {tab}
            </button>
          ))}
        </div>
        {activeTab === 'editor' ? (
          <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-6">
            {editingId && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium" style={{ background: 'rgba(234,179,8,0.1)', color: '#92400e' }}>
                <Edit2 size={14} />
                Editing existing invoice · <button onClick={resetForm} className="underline hover:no-underline">Cancel</button>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.08)', color: '#dc2626' }}>
                <AlertCircle size={14} />
                {error}
              </div>
            )}

            <section>
              <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-secondary)' }}>Document Setup</h3>
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Invoice Number">
                    <input className={inputCls} value={form.invoice_number} onChange={e => setField('invoice_number', e.target.value)} />
                  </Field>
                  <Field label="Invoice Date">
                    <input type="date" className={inputCls} value={form.invoice_date} onChange={e => setField('invoice_date', e.target.value)} />
                  </Field>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Currency">
                    <select className={inputCls} value={form.currency} onChange={e => setField('currency', e.target.value)}>
                      {DOCS_CURRENCIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </Field>
                  <Field label="Status">
                    <select className={inputCls} value={form.status} onChange={e => setField('status', e.target.value as 'paid' | 'unpaid')}>
                      <option value="unpaid">Unpaid</option>
                      <option value="paid">Paid</option>
                    </select>
                  </Field>
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-secondary)' }}>Client Information</h3>
              <div className="space-y-3">
                <ClientProfileSelector
                  profiles={profiles}
                  selectedClientId={profiles.find(p => p.id === form.client_profile_id)?.client_id ?? ''}
                  onSelectClientId={applyClientProfile}
                  label="Client"
                />
                <Field label="Client Name *">
                  <input className={inputCls} value={form.client_name} onChange={e => setField('client_name', e.target.value)} placeholder="e.g. Acme Corp" />
                </Field>
                <Field label="Campaign Month">
                  <input className={inputCls} value={form.campaign_month} onChange={e => setField('campaign_month', e.target.value)} placeholder="e.g. January 2026" />
                </Field>
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Branches</h3>
                <div className="flex items-center gap-2">
                  <button onClick={() => setAllBranchesCollapsed(false)} className="px-2 py-1 text-xs rounded-lg font-medium border" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                    Expand all
                  </button>
                  <button onClick={() => setAllBranchesCollapsed(true)} className="px-2 py-1 text-xs rounded-lg font-medium border" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                    Collapse all
                  </button>
                  <button onClick={addBranch} className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg font-medium transition-colors" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                    <Plus size={12} /> Add Branch
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {form.branch_groups.map((branch, branchIndex) => {
                  const branchSubtotal = branchSubtotals.get(branch.id) ?? 0;
                  return (
                  <div key={branch.id} className="border rounded-lg p-3 space-y-3" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleBranchCollapse(branch.id)}
                        className="p-2 rounded-lg hover:bg-[var(--surface-2)]"
                        title={collapsedBranches.has(branch.id) ? 'Expand branch' : 'Collapse branch'}
                      >
                        {collapsedBranches.has(branch.id)
                          ? <ChevronRight size={14} style={{ color: 'var(--text-secondary)' }} />
                          : <ChevronDown size={14} style={{ color: 'var(--text-secondary)' }} />}
                      </button>
                      <input className={inputCls} value={branch.branch_name} onChange={e => updateBranchName(branchIndex, e.target.value)} placeholder="Branch name" />
                      <div className="text-xs font-bold px-2 py-1 rounded-lg whitespace-nowrap" style={{ color: 'var(--text)', background: 'var(--surface-2)' }}>
                        {fmt(branchSubtotal, form.currency)}
                      </div>
                      <button onClick={() => removeBranch(branchIndex)} className="p-2 rounded-lg hover:bg-red-50" title="Remove branch">
                        <Trash2 size={14} style={{ color: '#ef4444' }} />
                      </button>
                    </div>

                    {!collapsedBranches.has(branch.id) && (
                      <div className="space-y-3">
                        {branch.platform_groups.map((platform, platformIndex) => (
                          <div key={platform.id} className="border rounded-md p-3 space-y-2" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
                          <div className="flex items-center gap-2">
                            <input className={inputCls} value={platform.platform_name} onChange={e => updatePlatformName(branchIndex, platformIndex, e.target.value)} placeholder="Platform name" />
                            <button onClick={() => removePlatform(branchIndex, platformIndex)} className="p-2 rounded-lg hover:bg-red-50" title="Remove platform">
                              <Trash2 size={14} style={{ color: '#ef4444' }} />
                            </button>
                          </div>

                          <div className="overflow-x-auto">
                            <table className="w-full text-xs border-collapse" style={{ minWidth: 560 }}>
                              <thead>
                                <tr style={{ background: INVOICE_BLACK, color: '#fff' }}>
                                  <th className="px-2 py-1.5 text-left">Ad Name</th>
                                  <th className="px-2 py-1.5 text-left">Date</th>
                                  <th className="px-2 py-1.5 text-left">Results</th>
                                  <th className="px-2 py-1.5 text-right">Cost</th>
                                  <th className="px-2 py-1.5 text-center">Action</th>
                                </tr>
                              </thead>
                              <tbody>
                                {platform.campaign_rows.map((row, rowIndex) => (
                                  <tr key={row.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                    <td className="p-1.5"><input className={inputCls} value={row.ad_name} onChange={e => updateCampaignRow(branchIndex, platformIndex, rowIndex, { ad_name: e.target.value })} /></td>
                                    <td className="p-1.5"><input type="date" className={inputCls} value={row.date} onChange={e => updateCampaignRow(branchIndex, platformIndex, rowIndex, { date: e.target.value })} /></td>
                                    <td className="p-1.5"><input className={inputCls} value={row.results} onChange={e => updateCampaignRow(branchIndex, platformIndex, rowIndex, { results: e.target.value })} /></td>
                                    <td className="p-1.5"><input type="number" min={0} className={inputCls} value={row.cost} onChange={e => updateCampaignRow(branchIndex, platformIndex, rowIndex, { cost: n(e.target.value) })} /></td>
                                    <td className="p-1.5 text-center">
                                      <button onClick={() => removeCampaignRow(branchIndex, platformIndex, rowIndex)} className="p-1.5 rounded hover:bg-red-50">
                                        <Trash2 size={12} style={{ color: '#ef4444' }} />
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          <div className="flex items-center justify-between">
                            <button onClick={() => addCampaignRow(branchIndex, platformIndex)} className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg font-medium transition-colors" style={{ background: INVOICE_BLACK, color: '#fff' }}>
                              <Plus size={12} /> Add Row
                            </button>
                            <div className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                              Platform Subtotal: {fmt(platform.campaign_rows.reduce((sum, row) => sum + n(row.cost), 0), form.currency)}
                            </div>
                          </div>
                          </div>
                        ))}

                        <div className="flex items-center justify-between">
                          <button onClick={() => addPlatform(branchIndex)} className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg font-medium transition-colors" style={{ background: INVOICE_BLACK, color: '#fff' }}>
                            <Plus size={12} /> Add Platform
                          </button>
                          <div className="text-xs font-bold" style={{ color: 'var(--text)' }}>
                            Branch Subtotal: {fmt(branchSubtotal, form.currency)}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            </section>
            <section>
              <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-secondary)' }}>Totals Summary</h3>
              <div className="space-y-3">
                <Field label="Final Budget (computed)">
                  <input className={inputCls} value={computedFinalBudget} readOnly aria-readonly="true" />
                </Field>
                <Field label="Our Fees">
                  <input type="number" min={0} className={inputCls} value={form.our_fees} onChange={e => setField('our_fees', n(e.target.value))} />
                </Field>
                <Field label="Grand Total (computed)">
                  <input className={inputCls} value={computedGrandTotal} readOnly aria-readonly="true" />
                </Field>
              </div>
            </section>

            <section>
              <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-secondary)' }}>Notes (optional)</h3>
              <textarea className={inputCls} rows={3} value={form.notes} onChange={e => setField('notes', e.target.value)} placeholder="Additional notes…" />
            </section>

            <div className="pb-4">
              <button onClick={saveInvoice} disabled={saving} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-60" style={{ background: 'var(--accent)' }}>
                {saved ? <><Check size={16} /> Saved!</> : saving ? 'Saving…' : <><Save size={16} /> {editingId ? 'Update Invoice' : 'Save Invoice'}</>}
              </button>
            </div>
          </div>
        ) : (
          <HistoryPanel invoices={invoices} loading={loading} onEdit={loadInvoiceIntoForm} onDuplicate={duplicateInvoice} onDelete={deleteInvoice} onReload={load} onBackup={handleBackup} onClearAll={handleClearAll} onRestoreData={handleRestoreData} />
        )}
      </div>

      <div className="preview-panel hidden lg:flex flex-1 items-start justify-center p-6 overflow-auto" style={{ background: 'var(--surface-2)' }}>
        <div className="fixed right-6 bottom-6 flex flex-col gap-2 z-50 no-print">
          <button onClick={exportPDF} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-lg transition-opacity hover:opacity-90" style={{ background: INVOICE_BLACK }}>
            <Printer size={15} /> PDF
          </button>
          <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-lg transition-opacity hover:opacity-90" style={{ background: '#303030' }}>
            <Download size={15} /> CSV
          </button>
        </div>

        <div className="preview-shell bg-white shadow-2xl rounded-sm" style={{ width: 794, minHeight: 1123 }}>
          <InvoicePreview form={{ ...form, final_budget: computedFinalBudget, total_budget: computedFinalBudget, grand_total: computedGrandTotal }} />
        </div>
      </div>

    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{label}</label>
      {children}
    </div>
  );
}

const previewHeaderCell: CSSProperties = {
  border: `1px solid ${INVOICE_BLACK}`,
  padding: '7px 8px',
  textAlign: 'left',
  fontSize: 11,
  letterSpacing: 0.2,
};

const previewCell: CSSProperties = {
  border: `1px solid ${INVOICE_BLACK}`,
  padding: '6px 8px',
  verticalAlign: 'top',
};

const totalsLabel: CSSProperties = {
  border: `1px solid ${INVOICE_BLACK}`,
  padding: '8px 10px',
  fontWeight: 700,
  textAlign: 'right',
};

const totalsValue: CSSProperties = {
  border: `1px solid ${INVOICE_BLACK}`,
  padding: '8px 10px',
  fontWeight: 700,
  textAlign: 'right',
};

const inputCls = [
  'w-full px-3 py-1.5 text-sm rounded-lg border outline-none',
  'focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent',
  'transition-colors',
].join(' ') + ' bg-[var(--surface-2)] border-[var(--border)] text-[var(--text)]';
