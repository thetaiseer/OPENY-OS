'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Plus, Trash2, Save, Copy, Edit2, RotateCcw, Search,
  Download, Printer, ChevronDown, Check, X, AlertCircle, Archive, ExternalLink,
} from 'lucide-react';
import clsx from 'clsx';
import type { DocsInvoice, InvoicePlatform, InvoiceDeliverable } from '@/lib/docs-types';
import { DEFAULT_INVOICE_PLATFORMS, DOCS_CURRENCIES } from '@/lib/docs-types';

// ── helpers ───────────────────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2, 10); }
function fmt(n: number, cur: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur, minimumFractionDigits: 2 }).format(n);
}
function today() { return new Date().toISOString().slice(0, 10); }
function nextInvoiceNum(list: DocsInvoice[]) {
  const nums = list.map(i => parseInt(i.invoice_number.replace(/\D/g, '') || '0')).filter(Boolean);
  const max = nums.length ? Math.max(...nums) : 0;
  return `INV-${String(max + 1).padStart(4, '0')}`;
}

function blankForm(num: string): FormState {
  return {
    invoice_number: num,
    client_name:    '',
    campaign_month: '',
    invoice_date:   today(),
    total_budget:   0,
    currency:       'SAR',
    status:         'unpaid',
    platforms:      DEFAULT_INVOICE_PLATFORMS.map(p => ({ ...p })),
    deliverables:   [],
    custom_client:  '',
    custom_project: '',
    notes:          '',
  };
}

interface FormState {
  invoice_number: string;
  client_name:    string;
  campaign_month: string;
  invoice_date:   string;
  total_budget:   number;
  currency:       string;
  status:         'paid' | 'unpaid';
  platforms:      InvoicePlatform[];
  deliverables:   InvoiceDeliverable[];
  custom_client:  string;
  custom_project: string;
  notes:          string;
}

// ── Deliverable row ───────────────────────────────────────────────────────────

function DeliverableRow({
  item, onChange, onRemove,
}: {
  item: InvoiceDeliverable;
  onChange: (updated: InvoiceDeliverable) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        className="flex-1 px-3 py-1.5 text-sm rounded-lg border outline-none focus:ring-2"
        style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)', '--tw-ring-color': 'var(--accent)' } as React.CSSProperties}
        placeholder="Description"
        value={item.description}
        onChange={e => onChange({ ...item, description: e.target.value })}
      />
      <input
        type="number" min={1}
        className="w-16 px-2 py-1.5 text-sm rounded-lg border outline-none text-center"
        style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }}
        placeholder="Qty"
        value={item.quantity}
        onChange={e => {
          const q = Math.max(1, Number(e.target.value));
          onChange({ ...item, quantity: q, total: q * item.unitPrice });
        }}
      />
      <input
        type="number" min={0}
        className="w-24 px-2 py-1.5 text-sm rounded-lg border outline-none text-right"
        style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }}
        placeholder="Unit price"
        value={item.unitPrice}
        onChange={e => {
          const p = Math.max(0, Number(e.target.value));
          onChange({ ...item, unitPrice: p, total: item.quantity * p });
        }}
      />
      <button onClick={onRemove} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition-colors shrink-0">
        <Trash2 size={14} />
      </button>
    </div>
  );
}

// ── Platform row ──────────────────────────────────────────────────────────────

function PlatformRow({
  platform, budget, onChange,
}: {
  platform: InvoicePlatform;
  budget:   number;
  onChange: (updated: InvoicePlatform) => void;
}) {
  const computed = budget * (platform.budgetPct / 100);
  return (
    <div className={clsx('flex items-center gap-2 py-1.5 px-2 rounded-lg transition-colors', platform.enabled ? 'bg-[var(--accent-soft)]' : 'opacity-50')}>
      <input
        type="checkbox"
        checked={platform.enabled}
        onChange={e => onChange({ ...platform, enabled: e.target.checked })}
        className="accent-[var(--accent)]"
      />
      <span className="w-24 text-sm font-medium" style={{ color: 'var(--text)' }}>{platform.label}</span>
      <input
        type="number" min={1}
        className="w-14 px-2 py-1 text-sm rounded border text-center outline-none"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
        disabled={!platform.enabled}
        value={platform.count}
        onChange={e => onChange({ ...platform, count: Math.max(1, Number(e.target.value)) })}
      />
      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>camps</span>
      <input
        type="number" min={0} max={100}
        className="w-16 px-2 py-1 text-sm rounded border text-center outline-none"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
        disabled={!platform.enabled}
        value={platform.budgetPct}
        onChange={e => onChange({ ...platform, budgetPct: Math.min(100, Math.max(0, Number(e.target.value))), budget: computed })}
      />
      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>%</span>
      <span className="ml-auto text-sm font-semibold" style={{ color: 'var(--accent)' }}>
        {fmt(computed, 'SAR')}
      </span>
    </div>
  );
}

// ── Live A4 Preview ───────────────────────────────────────────────────────────

function InvoicePreview({ form }: { form: FormState }) {
  const enabledPlatforms = form.platforms.filter(p => p.enabled);
  const totalPct = enabledPlatforms.reduce((s, p) => s + p.budgetPct, 0);
  const delivTotal = form.deliverables.reduce((s, d) => s + d.total, 0);

  return (
    <div
      id="invoice-preview"
      className="bg-white text-gray-900 w-full"
      style={{ fontFamily: 'Arial, sans-serif', fontSize: 13, minHeight: 1123 }}
    >
      {/* Header */}
      <div style={{ background: '#1e40af', color: '#fff', padding: '28px 36px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: 1 }}>INVOICE</div>
            <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>{form.invoice_number}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 700, fontSize: 18 }}>OPENY</div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>Digital Marketing Agency</div>
          </div>
        </div>
      </div>

      <div style={{ padding: '24px 36px' }}>
        {/* Meta row */}
        <div style={{ display: 'flex', gap: 24, marginBottom: 24, flexWrap: 'wrap' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', color: '#6b7280', marginBottom: 4 }}>Bill To</div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{form.client_name || '—'}</div>
            {form.custom_client && <div style={{ fontSize: 12, color: '#6b7280' }}>{form.custom_client}</div>}
            {form.custom_project && <div style={{ fontSize: 12 }}>{form.custom_project}</div>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <table style={{ fontSize: 12 }}>
              <tbody>
                <tr><td style={{ color: '#6b7280', paddingRight: 12 }}>Date:</td><td style={{ fontWeight: 600 }}>{form.invoice_date || '—'}</td></tr>
                <tr><td style={{ color: '#6b7280' }}>Period:</td><td style={{ fontWeight: 600 }}>{form.campaign_month || '—'}</td></tr>
                <tr><td style={{ color: '#6b7280' }}>Currency:</td><td style={{ fontWeight: 600 }}>{form.currency}</td></tr>
                <tr>
                  <td style={{ color: '#6b7280' }}>Status:</td>
                  <td>
                    <span style={{
                      display: 'inline-block', padding: '1px 8px', borderRadius: 10,
                      background: form.status === 'paid' ? '#dcfce7' : '#fef9c3',
                      color: form.status === 'paid' ? '#166534' : '#854d0e',
                      fontWeight: 700, fontSize: 11,
                    }}>
                      {form.status.toUpperCase()}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Deliverables */}
        {form.deliverables.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: '#1e40af' }}>Services & Deliverables</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f3f4f6' }}>
                  <th style={{ textAlign: 'left', padding: '6px 10px', borderBottom: '1px solid #e5e7eb' }}>Description</th>
                  <th style={{ textAlign: 'center', padding: '6px 10px', borderBottom: '1px solid #e5e7eb', width: 60 }}>Qty</th>
                  <th style={{ textAlign: 'right', padding: '6px 10px', borderBottom: '1px solid #e5e7eb', width: 100 }}>Unit Price</th>
                  <th style={{ textAlign: 'right', padding: '6px 10px', borderBottom: '1px solid #e5e7eb', width: 100 }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {form.deliverables.map((d) => (
                  <tr key={d.id}>
                    <td style={{ padding: '5px 10px', borderBottom: '1px solid #f3f4f6' }}>{d.description}</td>
                    <td style={{ textAlign: 'center', padding: '5px 10px', borderBottom: '1px solid #f3f4f6' }}>{d.quantity}</td>
                    <td style={{ textAlign: 'right', padding: '5px 10px', borderBottom: '1px solid #f3f4f6' }}>{fmt(d.unitPrice, form.currency)}</td>
                    <td style={{ textAlign: 'right', padding: '5px 10px', borderBottom: '1px solid #f3f4f6' }}>{fmt(d.total, form.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Platform allocation */}
        {enabledPlatforms.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: '#1e40af' }}>Campaign Budget Allocation</div>
            {totalPct !== 100 && (
              <div style={{ color: '#dc2626', fontSize: 11, marginBottom: 8 }}>
                ⚠ Allocation is {totalPct}% — must equal 100%
              </div>
            )}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f3f4f6' }}>
                  <th style={{ textAlign: 'left', padding: '6px 10px', borderBottom: '1px solid #e5e7eb' }}>Platform</th>
                  <th style={{ textAlign: 'center', padding: '6px 10px', borderBottom: '1px solid #e5e7eb' }}>Campaigns</th>
                  <th style={{ textAlign: 'center', padding: '6px 10px', borderBottom: '1px solid #e5e7eb' }}>Allocation</th>
                  <th style={{ textAlign: 'right', padding: '6px 10px', borderBottom: '1px solid #e5e7eb' }}>Budget</th>
                </tr>
              </thead>
              <tbody>
                {enabledPlatforms.map(p => (
                  <tr key={p.key}>
                    <td style={{ padding: '5px 10px', borderBottom: '1px solid #f3f4f6', fontWeight: 600 }}>{p.label}</td>
                    <td style={{ textAlign: 'center', padding: '5px 10px', borderBottom: '1px solid #f3f4f6' }}>{p.count}</td>
                    <td style={{ textAlign: 'center', padding: '5px 10px', borderBottom: '1px solid #f3f4f6' }}>{p.budgetPct}%</td>
                    <td style={{ textAlign: 'right', padding: '5px 10px', borderBottom: '1px solid #f3f4f6', fontWeight: 700 }}>
                      {fmt(form.total_budget * (p.budgetPct / 100), form.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Totals */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24 }}>
          <table style={{ fontSize: 13, minWidth: 260 }}>
            <tbody>
              {delivTotal > 0 && (
                <tr>
                  <td style={{ padding: '4px 16px', color: '#6b7280' }}>Deliverables subtotal</td>
                  <td style={{ textAlign: 'right', padding: '4px 0', fontWeight: 600 }}>{fmt(delivTotal, form.currency)}</td>
                </tr>
              )}
              {form.total_budget > 0 && (
                <tr>
                  <td style={{ padding: '4px 16px', color: '#6b7280' }}>Campaign budget</td>
                  <td style={{ textAlign: 'right', padding: '4px 0', fontWeight: 600 }}>{fmt(form.total_budget, form.currency)}</td>
                </tr>
              )}
              <tr>
                <td style={{ padding: '8px 16px', fontWeight: 700, fontSize: 15 }}>Total</td>
                <td style={{ textAlign: 'right', padding: '8px 0', fontWeight: 800, fontSize: 15, color: '#1e40af', borderTop: '2px solid #1e40af' }}>
                  {fmt(delivTotal + form.total_budget, form.currency)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Notes */}
        {form.notes && (
          <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 4, color: '#6b7280' }}>NOTES</div>
            <div style={{ fontSize: 12 }}>{form.notes}</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Backup Modal ──────────────────────────────────────────────────────────────

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

// ── History Panel ─────────────────────────────────────────────────────────────

function HistoryPanel({
  invoices, loading, onEdit, onDuplicate, onDelete, onReload, onBackup, onClearAll, onRestoreData,
}: {
  invoices:      DocsInvoice[];
  loading:       boolean;
  onEdit:        (inv: DocsInvoice) => void;
  onDuplicate:   (inv: DocsInvoice) => void;
  onDelete:      (id: string) => void;
  onReload:      () => void;
  onBackup:      () => Promise<void>;
  onClearAll:    () => Promise<void>;
  onRestoreData: (data: unknown) => void;
}) {
  const [search, setSearch]       = useState('');
  const [statusF, setStatusF]     = useState<'all' | 'paid' | 'unpaid'>('all');
  const [clientF, setClientF]     = useState('');
  const [sortF, setSortF]         = useState('created_at');
  const [sortDir, setSortDir]     = useState<'asc' | 'desc'>('desc');
  const [showRestore, setShowRestore] = useState(false);
  const [backing, setBacking]         = useState(false);
  const [clearing, setClearing]       = useState(false);

  const visible = invoices.filter(inv => {
    if (statusF !== 'all' && inv.status !== statusF) return false;
    if (clientF && !inv.client_name.toLowerCase().includes(clientF.toLowerCase())) return false;
    if (search && !inv.invoice_number.toLowerCase().includes(search.toLowerCase()) &&
        !inv.client_name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }).sort((a, b) => {
    const av = (a as unknown as Record<string, string>)[sortF] ?? '';
    const bv = (b as unknown as Record<string, string>)[sortF] ?? '';
    return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
  });

  return (
    <div className="flex flex-col h-full">
      {/* Filters */}
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
          <button
            onClick={onReload}
            className="p-1.5 rounded-lg hover:bg-[var(--surface-2)] transition-colors"
            title="Refresh"
          >
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
          <button
            onClick={() => setShowRestore(true)}
            className="p-1.5 rounded-lg hover:bg-[var(--surface-2)] transition-colors"
            title="Restore from backup"
          >
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
          <select
            className="px-2 py-1 text-xs rounded-lg border outline-none"
            style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }}
            value={`${sortF}:${sortDir}`}
            onChange={e => {
              const [f, d] = e.target.value.split(':');
              setSortF(f);
              setSortDir(d as 'asc' | 'desc');
            }}
          >
            <option value="created_at:desc">Newest first</option>
            <option value="created_at:asc">Oldest first</option>
            <option value="client_name:asc">Client A–Z</option>
            <option value="invoice_date:desc">Date ↓</option>
          </select>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto divide-y" style={{ borderColor: 'var(--border)' }}>
        {loading && (
          <div className="p-6 text-sm text-center" style={{ color: 'var(--text-secondary)' }}>Loading…</div>
        )}
        {!loading && visible.length === 0 && (
          <div className="p-6 text-sm text-center" style={{ color: 'var(--text-secondary)' }}>No invoices found</div>
        )}
        {visible.map(inv => (
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
                  {fmt(inv.total_budget, inv.currency)}
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
                <button
                  onClick={() => onEdit(inv)}
                  className="p-1.5 rounded-lg hover:bg-[var(--accent-soft)] transition-colors"
                  title="Edit"
                >
                  <Edit2 size={13} style={{ color: 'var(--accent)' }} />
                </button>
                <button
                  onClick={() => onDuplicate(inv)}
                  className="p-1.5 rounded-lg hover:bg-[var(--surface-2)] transition-colors"
                  title="Duplicate as new"
                >
                  <Copy size={13} style={{ color: 'var(--text-secondary)' }} />
                </button>
                <button
                  onClick={() => onDelete(inv.id)}
                  className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                  title="Delete"
                >
                  <Trash2 size={13} style={{ color: '#ef4444' }} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {showRestore && (
        <BackupModal module="invoices" onClose={() => setShowRestore(false)} onRestore={onRestoreData} />
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function InvoicePage() {
  const [invoices, setInvoices]   = useState<DocsInvoice[]>([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [activeTab, setActiveTab] = useState<'editor' | 'history'>('editor');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError]         = useState('');
  const [saved, setSaved]         = useState(false);
  const [form, setForm]           = useState<FormState>(() => blankForm('INV-0001'));
  const previewRef                = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/docs/invoices');
      const json = await res.json();
      setInvoices(json.invoices ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const enabledPlatforms = form.platforms.filter(p => p.enabled);
  const totalPct = enabledPlatforms.reduce((s, p) => s + p.budgetPct, 0);
  const allocationValid = enabledPlatforms.length === 0 || totalPct === 100;

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(f => ({ ...f, [key]: value }));
  }

  function updatePlatform(idx: number, updated: InvoicePlatform) {
    setForm(f => {
      const platforms = [...f.platforms];
      platforms[idx] = updated;
      return { ...f, platforms };
    });
  }

  function addDeliverable() {
    setForm(f => ({
      ...f,
      deliverables: [...f.deliverables, { id: uid(), description: '', quantity: 1, unitPrice: 0, total: 0 }],
    }));
  }

  function updateDeliverable(idx: number, d: InvoiceDeliverable) {
    setForm(f => {
      const deliverables = [...f.deliverables];
      deliverables[idx] = d;
      return { ...f, deliverables };
    });
  }

  function removeDeliverable(idx: number) {
    setForm(f => ({ ...f, deliverables: f.deliverables.filter((_, i) => i !== idx) }));
  }

  function resetForm() {
    setEditingId(null);
    setForm(blankForm(nextInvoiceNum(invoices)));
    setError('');
    setActiveTab('editor');
  }

  function loadInvoiceIntoForm(inv: DocsInvoice) {
    setEditingId(inv.id);
    setForm({
      invoice_number: inv.invoice_number,
      client_name:    inv.client_name,
      campaign_month: inv.campaign_month ?? '',
      invoice_date:   inv.invoice_date ?? today(),
      total_budget:   inv.total_budget,
      currency:       inv.currency,
      status:         inv.status,
      platforms:      inv.platforms.length ? inv.platforms : DEFAULT_INVOICE_PLATFORMS.map(p => ({ ...p })),
      deliverables:   inv.deliverables,
      custom_client:  inv.custom_client ?? '',
      custom_project: inv.custom_project ?? '',
      notes:          inv.notes ?? '',
    });
    setActiveTab('editor');
  }

  function duplicateInvoice(inv: DocsInvoice) {
    const newNum = nextInvoiceNum(invoices);
    setEditingId(null);
    setForm({
      invoice_number: newNum,
      client_name:    inv.client_name,
      campaign_month: inv.campaign_month ?? '',
      invoice_date:   today(),
      total_budget:   inv.total_budget,
      currency:       inv.currency,
      status:         'unpaid',
      platforms:      inv.platforms.length ? inv.platforms.map(p => ({ ...p })) : DEFAULT_INVOICE_PLATFORMS.map(p => ({ ...p })),
      deliverables:   inv.deliverables.map(d => ({ ...d, id: uid() })),
      custom_client:  inv.custom_client ?? '',
      custom_project: inv.custom_project ?? '',
      notes:          inv.notes ?? '',
    });
    setActiveTab('editor');
  }

  async function saveInvoice() {
    if (!form.client_name.trim()) { setError('Client name is required'); return; }
    if (!form.invoice_number.trim()) { setError('Invoice number is required'); return; }
    if (!allocationValid) { setError('Platform allocation must sum to 100%'); return; }

    setSaving(true);
    setError('');
    try {
      const payload = { ...form };
      const url  = editingId ? `/api/docs/invoices/${editingId}` : '/api/docs/invoices';
      const method = editingId ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        setError(err.error ?? 'Save failed');
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      await load();
      if (!editingId) resetForm();
    } finally {
      setSaving(false);
    }
  }

  async function deleteInvoice(id: string) {
    if (!confirm('Delete this invoice?')) return;
    await fetch(`/api/docs/invoices/${id}`, { method: 'DELETE' });
    await load();
    if (editingId === id) resetForm();
  }

  async function handleBackup() {
    const label = `Backup ${new Date().toLocaleDateString()} (${invoices.length} invoices)`;
    await fetch('/api/docs/backups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ module: 'invoices', data: invoices, label }),
    });
  }

  async function handleClearAll() {
    await Promise.all(invoices.map(inv => fetch(`/api/docs/invoices/${inv.id}`, { method: 'DELETE' })));
    await load();
    resetForm();
  }

  async function handleRestoreData(data: unknown) {
    if (!Array.isArray(data) || data.length === 0) { alert('Invalid or empty backup data.'); return; }
    if (!confirm(`Restore ${data.length} invoice(s) from backup? They will be created as new records.`)) return;
    let count = 0;
    for (const item of data as DocsInvoice[]) {
      const { id: _id, created_at: _ca, updated_at: _ua, created_by: _cb,
              export_pdf_url: _ep, export_excel_url: _ee, is_duplicate: _dup, original_id: _oid,
              ...rest } = item;
      const res = await fetch('/api/docs/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rest),
      });
      if (res.ok) count++;
    }
    await load();
    alert(`Restored ${count} of ${data.length} invoice(s).`);
  }

  function exportPDF() {
    window.print();
  }

  function exportCSV() {
    const rows = [
      ['Invoice No', 'Client', 'Date', 'Month', 'Currency', 'Budget', 'Status'],
      [form.invoice_number, form.client_name, form.invoice_date, form.campaign_month, form.currency, String(form.total_budget), form.status],
      [],
      ['Deliverables', '', '', '', '', '', ''],
      ['Description', 'Qty', 'Unit Price', 'Total', '', '', ''],
      ...form.deliverables.map(d => [d.description, String(d.quantity), String(d.unitPrice), String(d.total), '', '', '']),
      [],
      ['Platform Allocation', '', '', '', '', '', ''],
      ['Platform', 'Campaigns', 'Allocation %', 'Budget', '', '', ''],
      ...form.platforms.filter(p => p.enabled).map(p => [p.label, String(p.count), String(p.budgetPct) + '%', String(form.total_budget * p.budgetPct / 100), '', '', '']),
    ];
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${form.invoice_number}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left panel ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col w-full lg:w-[480px] shrink-0 border-r overflow-hidden" style={{ borderColor: 'var(--border)' }}>
        {/* Tabs */}
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
          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {/* Edit mode banner */}
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

            {/* Document setup */}
            <section>
              <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-secondary)' }}>Document Setup</h3>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Invoice Number">
                    <input className={inputCls} value={form.invoice_number} onChange={e => setField('invoice_number', e.target.value)} />
                  </Field>
                  <Field label="Invoice Date">
                    <input type="date" className={inputCls} value={form.invoice_date} onChange={e => setField('invoice_date', e.target.value)} />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Total Budget">
                    <input type="number" min={0} className={inputCls} value={form.total_budget} onChange={e => setField('total_budget', Number(e.target.value))} />
                  </Field>
                  <Field label="Currency">
                    <select className={inputCls} value={form.currency} onChange={e => setField('currency', e.target.value)}>
                      {DOCS_CURRENCIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </Field>
                </div>
              </div>
            </section>

            {/* Client info */}
            <section>
              <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-secondary)' }}>Client</h3>
              <div className="space-y-3">
                <Field label="Client Name *">
                  <input className={inputCls} value={form.client_name} onChange={e => setField('client_name', e.target.value)} placeholder="e.g. Acme Corp" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Campaign Month">
                    <input className={inputCls} value={form.campaign_month} onChange={e => setField('campaign_month', e.target.value)} placeholder="e.g. January 2026" />
                  </Field>
                  <Field label="Status">
                    <select className={inputCls} value={form.status} onChange={e => setField('status', e.target.value as 'paid' | 'unpaid')}>
                      <option value="unpaid">Unpaid</option>
                      <option value="paid">Paid</option>
                    </select>
                  </Field>
                </div>
                <Field label="Custom Client (optional)">
                  <input className={inputCls} value={form.custom_client} onChange={e => setField('custom_client', e.target.value)} placeholder="Additional client info" />
                </Field>
                <Field label="Custom Project (optional)">
                  <input className={inputCls} value={form.custom_project} onChange={e => setField('custom_project', e.target.value)} placeholder="Project description" />
                </Field>
              </div>
            </section>

            {/* Deliverables */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Deliverables / Services</h3>
                <button
                  onClick={addDeliverable}
                  className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg font-medium transition-colors"
                  style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
                >
                  <Plus size={12} /> Add
                </button>
              </div>
              <div className="space-y-2">
                {form.deliverables.map((d, i) => (
                  <DeliverableRow
                    key={d.id}
                    item={d}
                    onChange={u => updateDeliverable(i, u)}
                    onRemove={() => removeDeliverable(i)}
                  />
                ))}
                {form.deliverables.length === 0 && (
                  <p className="text-xs text-center py-3" style={{ color: 'var(--text-secondary)' }}>No deliverables added</p>
                )}
              </div>
            </section>

            {/* Platform allocation */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                  Campaign Budget Allocation
                </h3>
                {enabledPlatforms.length > 0 && (
                  <span className={clsx('text-xs font-bold', allocationValid ? 'text-green-600' : 'text-red-500')}>
                    {totalPct}% {allocationValid ? <Check size={12} className="inline" /> : '≠ 100%'}
                  </span>
                )}
              </div>
              <div className="space-y-1">
                {form.platforms.map((p, i) => (
                  <PlatformRow
                    key={p.key}
                    platform={p}
                    budget={form.total_budget}
                    onChange={u => updatePlatform(i, u)}
                  />
                ))}
              </div>
            </section>

            {/* Notes */}
            <section>
              <Field label="Notes">
                <textarea
                  className={inputCls}
                  rows={3}
                  value={form.notes}
                  onChange={e => setField('notes', e.target.value)}
                  placeholder="Additional notes…"
                />
              </Field>
            </section>

            {/* Save */}
            <div className="pb-4">
              <button
                onClick={saveInvoice}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-60"
                style={{ background: 'var(--accent)' }}
              >
                {saved ? <><Check size={16} /> Saved!</> : saving ? 'Saving…' : <><Save size={16} /> {editingId ? 'Update Invoice' : 'Save Invoice'}</>}
              </button>
            </div>
          </div>
        ) : (
          <HistoryPanel
            invoices={invoices}
            loading={loading}
            onEdit={loadInvoiceIntoForm}
            onDuplicate={duplicateInvoice}
            onDelete={deleteInvoice}
            onReload={load}
            onBackup={handleBackup}
            onClearAll={handleClearAll}
            onRestoreData={handleRestoreData}
          />
        )}
      </div>

      {/* ── Right panel: A4 Preview ─────────────────────────────────────────── */}
      <div
        className="hidden lg:flex flex-1 items-start justify-center p-6 overflow-auto"
        style={{ background: 'var(--surface-2)' }}
      >
        {/* Floating export dock */}
        <div className="fixed right-6 bottom-6 flex flex-col gap-2 z-50 no-print">
          <button
            onClick={exportPDF}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-lg transition-opacity hover:opacity-90"
            style={{ background: '#dc2626' }}
          >
            <Printer size={15} /> PDF
          </button>
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-lg transition-opacity hover:opacity-90"
            style={{ background: '#16a34a' }}
          >
            <Download size={15} /> Excel / CSV
          </button>
        </div>

        {/* A4 paper */}
        <div
          ref={previewRef}
          className="bg-white shadow-2xl rounded-sm"
          style={{ width: 794, minHeight: 1123, transformOrigin: 'top center' }}
        >
          <InvoicePreview form={form} />
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body > * { display: none !important; }
          #invoice-preview { display: block !important; }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{label}</label>
      {children}
    </div>
  );
}

const inputCls = [
  'w-full px-3 py-1.5 text-sm rounded-lg border outline-none',
  'focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent',
  'transition-colors',
].join(' ') + ' bg-[var(--surface-2)] border-[var(--border)] text-[var(--text)]';
