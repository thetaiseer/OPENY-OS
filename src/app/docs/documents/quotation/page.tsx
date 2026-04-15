'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  Plus, Trash2, Save, Copy, Edit2, RotateCcw, Search,
  Download, Printer, Check, AlertCircle, Archive, ExternalLink, X,
} from 'lucide-react';
import clsx from 'clsx';
import type { DocsQuotation, QuotationDeliverable } from '@/lib/docs-types';
import { DOCS_CURRENCIES, DOCS_PAYMENT_METHODS } from '@/lib/docs-types';
import ClientProfileSelector from '@/components/docs/ClientProfileSelector';
import type { DocsClientProfile } from '@/lib/docs-client-profiles';
import { fetchDocsClientProfiles, isVirtualDocsProfileId } from '@/lib/docs-client-profiles';
import { printPreviewDocument } from '@/lib/docs-print';
import {
  OpenyDocumentHeader,
  OpenyDocumentPage,
  OpenySectionTitle,
  openyMetaKeyStyle,
  openyStatusPillStyle,
  openyTableHeaderStyle,
  openyTdStyle,
  openyThStyle,
} from '@/components/docs/DocumentDesign';
import { OPENY_DOC_STYLE } from '@/lib/openy-brand';

function uid() { return Math.random().toString(36).slice(2, 10); }
function fmt(n: number, cur: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur, minimumFractionDigits: 2 }).format(n);
}
function today() { return new Date().toISOString().slice(0, 10); }
function nextQNum(list: DocsQuotation[]) {
  const nums = list.map(q => parseInt(q.quote_number.replace(/\D/g, '') || '0')).filter(Boolean);
  const max = nums.length ? Math.max(...nums) : 0;
  return `QUO-${String(max + 1).padStart(4, '0')}`;
}

interface FormState {
  client_profile_id:      string | null;
  quote_number:          string;
  quote_date:            string;
  currency:              string;
  client_name:           string;
  company_brand:         string;
  project_title:         string;
  project_description:   string;
  deliverables:          QuotationDeliverable[];
  total_value:           number;
  payment_due_days:      number;
  payment_method:        string;
  custom_payment_method: string;
  additional_notes:      string;
  status:                'paid' | 'unpaid';
}

function blank(num: string): FormState {
  return {
    client_profile_id: null,
    quote_number: num, quote_date: today(), currency: 'SAR',
    client_name: '', company_brand: '', project_title: '', project_description: '',
    deliverables: [], total_value: 0, payment_due_days: 30,
    payment_method: 'Bank Transfer', custom_payment_method: '',
    additional_notes: '', status: 'unpaid',
  };
}

function QuotationPreview({ form }: { form: FormState }) {
  const delivTotal = form.deliverables.reduce((s, d) => s + d.total, 0);
  const total = form.total_value || delivTotal;

  return (
    <OpenyDocumentPage id="quotation-preview" fontSize={13}>
      <OpenyDocumentHeader
        title="QUOTATION"
        number={form.quote_number}
        subtitle="Digital Marketing Agency"
      />
      <div style={{ padding: '24px 36px' }}>
        <div style={{ display: 'flex', gap: 24, marginBottom: 24 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', color: OPENY_DOC_STYLE.textMuted, marginBottom: 4 }}>Prepared For</div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{form.client_name || '—'}</div>
            {form.company_brand && <div style={{ fontSize: 12, color: OPENY_DOC_STYLE.textMuted }}>{form.company_brand}</div>}
            {form.project_title && <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>{form.project_title}</div>}
            {form.project_description && <div style={{ fontSize: 12, color: OPENY_DOC_STYLE.textMuted, marginTop: 2 }}>{form.project_description}</div>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <table style={{ fontSize: 12 }}>
              <tbody>
                <tr><td style={openyMetaKeyStyle()}>Date:</td><td style={{ fontWeight: 600 }}>{form.quote_date || '—'}</td></tr>
                <tr><td style={openyMetaKeyStyle()}>Currency:</td><td style={{ fontWeight: 600 }}>{form.currency}</td></tr>
                <tr><td style={openyMetaKeyStyle()}>Due in:</td><td style={{ fontWeight: 600 }}>{form.payment_due_days} days</td></tr>
                <tr>
                  <td style={openyMetaKeyStyle()}>Status:</td>
                  <td>
                    <span style={openyStatusPillStyle(form.status)}>
                      {form.status.toUpperCase()}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {form.deliverables.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <OpenySectionTitle>Scope of Work</OpenySectionTitle>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={openyTableHeaderStyle()}>
                  <th style={openyThStyle('left')}>Description</th>
                  <th style={openyThStyle('center', { width: 60 })}>Qty</th>
                  <th style={openyThStyle('right', { width: 110 })}>Unit Price</th>
                  <th style={openyThStyle('right', { width: 110 })}>Total</th>
                </tr>
              </thead>
              <tbody>
                {form.deliverables.map(d => (
                  <tr key={d.id}>
                    <td style={openyTdStyle('left')}>{d.description}</td>
                    <td style={openyTdStyle('center')}>{d.quantity}</td>
                    <td style={openyTdStyle('right')}>{fmt(d.unitPrice, form.currency)}</td>
                    <td style={openyTdStyle('right', true)}>{fmt(d.total, form.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24 }}>
          <table style={{ fontSize: 13, minWidth: 260 }}>
            <tbody>
              {delivTotal > 0 && form.total_value > 0 && delivTotal !== form.total_value && (
                <tr>
                  <td style={{ padding: '4px 16px', color: OPENY_DOC_STYLE.textMuted }}>Subtotal</td>
                  <td style={{ textAlign: 'right', padding: '4px 0', fontWeight: 600 }}>{fmt(delivTotal, form.currency)}</td>
                </tr>
              )}
              <tr>
                <td style={{ padding: '8px 16px', fontWeight: 700, fontSize: 15 }}>Total Quote Value</td>
                <td style={{ textAlign: 'right', padding: '8px 0', fontWeight: 800, fontSize: 15, color: OPENY_DOC_STYLE.title, borderTop: `2px solid ${OPENY_DOC_STYLE.title}` }}>
                  {fmt(total, form.currency)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style={{ marginBottom: 20 }}>
          <OpenySectionTitle>Payment Terms</OpenySectionTitle>
          <div style={{ fontSize: 12, marginBottom: 4 }}><span style={{ color: OPENY_DOC_STYLE.textMuted }}>Method: </span>{form.payment_method === 'Custom' ? form.custom_payment_method : form.payment_method}</div>
          <div style={{ fontSize: 12 }}><span style={{ color: OPENY_DOC_STYLE.textMuted }}>Due in: </span>{form.payment_due_days} days from invoice date</div>
        </div>

        {form.additional_notes && (
          <div style={{ borderTop: `1px solid ${OPENY_DOC_STYLE.border}`, paddingTop: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 12, color: OPENY_DOC_STYLE.textMuted, marginBottom: 4 }}>NOTES</div>
            <div style={{ fontSize: 12 }}>{form.additional_notes}</div>
          </div>
        )}

        <div style={{ marginTop: 40, display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ textAlign: 'center', width: 200 }}>
            <div style={{ borderTop: `1px solid ${OPENY_DOC_STYLE.borderStrong}`, paddingTop: 8, fontSize: 11, color: OPENY_DOC_STYLE.textMuted }}>Prepared by / Signature</div>
          </div>
          <div style={{ textAlign: 'center', width: 200 }}>
            <div style={{ borderTop: `1px solid ${OPENY_DOC_STYLE.borderStrong}`, paddingTop: 8, fontSize: 11, color: OPENY_DOC_STYLE.textMuted }}>Client Acceptance / Date</div>
          </div>
        </div>
      </div>
    </OpenyDocumentPage>
  );
}

function BackupModal({ module, onClose, onRestore }: {
  module: string; onClose: () => void; onRestore: (data: unknown) => void;
}) {
  const [backups, setBackups] = useState<Array<{ id: string; label: string | null; created_at: string }>>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch(`/api/docs/backups?module=${module}`)
      .then(r => r.json()).then(j => setBackups(j.backups ?? [])).finally(() => setLoading(false));
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

function HistoryPanel({ quotations, loading, onEdit, onDuplicate, onDelete, onReload, onBackup, onClearAll, onRestoreData }: {
  quotations: DocsQuotation[]; loading: boolean;
  onEdit: (q: DocsQuotation) => void; onDuplicate: (q: DocsQuotation) => void;
  onDelete: (id: string) => void; onReload: () => void;
  onBackup: () => Promise<void>; onClearAll: () => Promise<void>; onRestoreData: (data: unknown) => void;
}) {
  const [search, setSearch]   = useState('');
  const [statusF, setStatusF] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [showRestore, setShowRestore] = useState(false);
  const [backing, setBacking]         = useState(false);
  const [clearing, setClearing]       = useState(false);

  const visible = quotations.filter(q => {
    if (statusF !== 'all' && q.status !== statusF) return false;
    if (search && !q.quote_number.toLowerCase().includes(search.toLowerCase()) &&
        !q.client_name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b space-y-2" style={{ borderColor: 'var(--border)' }}>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-secondary)' }} />
            <input className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border outline-none" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }} placeholder="Search quotations…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button onClick={onReload} className="p-1.5 rounded-lg hover:bg-[var(--surface-2)]"><RotateCcw size={14} style={{ color: 'var(--text-secondary)' }} /></button>
          <button onClick={async () => { setBacking(true); try { await onBackup(); } finally { setBacking(false); } }} disabled={backing} className="p-1.5 rounded-lg hover:bg-[var(--accent-soft)]" title="Backup all quotations">
            <Archive size={14} style={{ color: backing ? 'var(--text-secondary)' : 'var(--accent)' }} />
          </button>
          <button onClick={() => setShowRestore(true)} className="p-1.5 rounded-lg hover:bg-[var(--surface-2)]" title="Restore from backup">
            <RotateCcw size={14} style={{ color: '#f59e0b' }} />
          </button>
          <button onClick={async () => { if (!confirm('Clear ALL quotations? This cannot be undone.')) return; setClearing(true); try { await onClearAll(); } finally { setClearing(false); } }} disabled={clearing} className="p-1.5 rounded-lg hover:bg-red-50" title="Clear all quotations">
            <Trash2 size={14} style={{ color: '#ef4444' }} />
          </button>
        </div>
        <div className="flex gap-2">
          {(['all', 'paid', 'unpaid'] as const).map(s => (
            <button key={s} onClick={() => setStatusF(s)} className={clsx('px-2.5 py-1 text-xs rounded-full font-medium', statusF === s ? 'bg-[var(--accent)] text-white' : 'bg-[var(--surface-2)] text-[var(--text-secondary)]')}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto divide-y" style={{ borderColor: 'var(--border)' }}>
        {loading && <div className="p-6 text-sm text-center" style={{ color: 'var(--text-secondary)' }}>Loading…</div>}
        {!loading && visible.length === 0 && <div className="p-6 text-sm text-center" style={{ color: 'var(--text-secondary)' }}>No quotations found</div>}
        {visible.map(q => (
          <div key={q.id} className="p-3 hover:bg-[var(--surface-2)]">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{q.quote_number}</span>
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold" style={{ background: q.status === 'paid' ? 'rgba(22,163,74,0.1)' : 'rgba(234,179,8,0.1)', color: q.status === 'paid' ? '#16a34a' : '#ca8a04' }}>{q.status.toUpperCase()}</span>
                </div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{q.client_name} · {q.quote_date ?? '—'}</div>
                <div className="text-xs font-semibold mt-0.5" style={{ color: '#7c3aed' }}>{fmt(q.total_value, q.currency)}</div>
                <a href={`/api/docs/quotations/${q.id}/export`} download onClick={e => e.stopPropagation()} className="flex items-center gap-1 text-[10px] font-medium mt-1 hover:underline" style={{ color: 'var(--text-secondary)' }}>
                  <ExternalLink size={9} /> CSV
                </a>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => onEdit(q)} className="p-1.5 rounded-lg hover:bg-[var(--accent-soft)]"><Edit2 size={13} style={{ color: 'var(--accent)' }} /></button>
                <button onClick={() => onDuplicate(q)} className="p-1.5 rounded-lg hover:bg-[var(--surface-2)]"><Copy size={13} style={{ color: 'var(--text-secondary)' }} /></button>
                <button onClick={() => onDelete(q.id)} className="p-1.5 rounded-lg hover:bg-red-50"><Trash2 size={13} style={{ color: '#ef4444' }} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {showRestore && <BackupModal module="quotations" onClose={() => setShowRestore(false)} onRestore={onRestoreData} />}
    </div>
  );
}

export default function QuotationPage() {
  const [quotations, setQuotations] = useState<DocsQuotation[]>([]);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [activeTab, setActiveTab]   = useState<'editor' | 'history'>('editor');
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [error, setError]           = useState('');
  const [saved, setSaved]           = useState(false);
  const [form, setForm]             = useState<FormState>(() => blank('QUO-0001'));
  const [profiles, setProfiles]     = useState<DocsClientProfile[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/docs/quotations');
      const json = await res.json();
      setQuotations(json.quotations ?? []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { fetchDocsClientProfiles().then(setProfiles).catch(() => null); }, []);

  function setField<K extends keyof FormState>(k: K, v: FormState[K]) { setForm(f => ({ ...f, [k]: v })); }

  function addDeliverable() {
    setForm(f => ({ ...f, deliverables: [...f.deliverables, { id: uid(), description: '', quantity: 1, unitPrice: 0, total: 0 }] }));
  }

  function resetForm() {
    setEditingId(null);
    setForm(blank(nextQNum(quotations)));
    setError('');
    setActiveTab('editor');
  }

  function loadIntoForm(q: DocsQuotation) {
    setEditingId(q.id);
    setForm({
      client_profile_id: q.client_profile_id ?? null,
      quote_number: q.quote_number, quote_date: q.quote_date ?? today(), currency: q.currency,
      client_name: q.client_name, company_brand: q.company_brand ?? '', project_title: q.project_title ?? '',
      project_description: q.project_description ?? '', deliverables: q.deliverables,
      total_value: q.total_value, payment_due_days: q.payment_due_days,
      payment_method: q.payment_method ?? 'Bank Transfer', custom_payment_method: q.custom_payment_method ?? '',
      additional_notes: q.additional_notes ?? '', status: q.status,
    });
    setActiveTab('editor');
  }

  function duplicateQuotation(q: DocsQuotation) {
    setEditingId(null);
    setForm({ ...q, client_profile_id: q.client_profile_id ?? null, quote_number: nextQNum(quotations), quote_date: today(), status: 'unpaid', deliverables: q.deliverables.map(d => ({ ...d, id: uid() })), company_brand: q.company_brand ?? '', project_title: q.project_title ?? '', project_description: q.project_description ?? '', payment_method: q.payment_method ?? 'Bank Transfer', custom_payment_method: q.custom_payment_method ?? '', additional_notes: q.additional_notes ?? '' });
    setActiveTab('editor');
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
      || form.company_brand.trim()
      || form.project_title.trim()
      || form.project_description.trim()
      || form.deliverables.length > 0
      || form.additional_notes.trim()
    );
    if (hasManualEdits && !confirm('Replace current quotation defaults with selected client template?')) return;
    const quotationConfig = profile.quotation_template_config ?? {};
    setForm(prev => ({
      ...prev,
      client_profile_id: isVirtualDocsProfileId(profile.id) ? null : profile.id,
      client_name: profile.client_name,
      currency: profile.default_currency,
      company_brand: (quotationConfig.company_brand as string | undefined) ?? prev.company_brand,
      payment_due_days: Number(quotationConfig.payment_due_days ?? prev.payment_due_days),
      payment_method: (quotationConfig.payment_method as string | undefined) ?? prev.payment_method,
      additional_notes: prev.additional_notes || profile.notes || '',
    }));
  }

  async function save() {
    if (!form.client_name.trim()) { setError('Client name is required'); return; }
    setSaving(true); setError('');
    try {
      const url = editingId ? `/api/docs/quotations/${editingId}` : '/api/docs/quotations';
      const res = await fetch(url, { method: editingId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (!res.ok) { setError((await res.json()).error ?? 'Save failed'); return; }
      setSaved(true); setTimeout(() => setSaved(false), 2000);
      await load();
      if (!editingId) resetForm();
    } finally { setSaving(false); }
  }

  async function deleteQ(id: string) {
    if (!confirm('Delete this quotation?')) return;
    await fetch(`/api/docs/quotations/${id}`, { method: 'DELETE' });
    await load();
    if (editingId === id) resetForm();
  }

  async function handleBackup() {
    const label = `Backup ${new Date().toLocaleDateString()} (${quotations.length} quotations)`;
    await fetch('/api/docs/backups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ module: 'quotations', data: quotations, label }) });
  }

  async function handleClearAll() {
    await Promise.all(quotations.map(q => fetch(`/api/docs/quotations/${q.id}`, { method: 'DELETE' })));
    await load();
    resetForm();
  }

  async function handleRestoreData(data: unknown) {
    if (!Array.isArray(data) || data.length === 0) { alert('Invalid or empty backup data.'); return; }
    if (!confirm(`Restore ${data.length} quotation(s) from backup? They will be created as new records.`)) return;
    let count = 0;
    for (const item of data as DocsQuotation[]) {
      const { id: _id, created_at: _ca, updated_at: _ua, created_by: _cb,
              export_pdf_url: _ep, export_excel_url: _ee, is_duplicate: _dup, original_id: _oid,
              ...rest } = item;
      const res = await fetch('/api/docs/quotations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rest) });
      if (res.ok) count++;
    }
    await load();
    alert(`Restored ${count} of ${data.length} quotation(s).`);
  }

  const inputCls = 'w-full px-3 py-1.5 text-sm rounded-lg border outline-none bg-[var(--surface-2)] border-[var(--border)] text-[var(--text)]';

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex flex-col w-full lg:w-[480px] shrink-0 border-r overflow-hidden" style={{ borderColor: 'var(--border)' }}>
        <div className="flex border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
          {(['editor', 'history'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={clsx('flex-1 py-3 text-sm font-medium transition-colors capitalize border-b-2', activeTab === tab ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text)]')}>
              {tab}
            </button>
          ))}
        </div>

        {activeTab === 'editor' ? (
          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {editingId && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm" style={{ background: 'rgba(234,179,8,0.1)', color: '#92400e' }}>
                <Edit2 size={14} /> Editing · <button onClick={resetForm} className="underline">Cancel</button>
              </div>
            )}
            {error && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.08)', color: '#dc2626' }}>
                <AlertCircle size={14} /> {error}
              </div>
            )}

            <section>
              <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-secondary)' }}>Document Setup</h3>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Quote Number</label><input className={inputCls} value={form.quote_number} onChange={e => setField('quote_number', e.target.value)} /></div>
                <div><label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Date</label><input type="date" className={inputCls} value={form.quote_date} onChange={e => setField('quote_date', e.target.value)} /></div>
                <div><label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Currency</label><select className={inputCls} value={form.currency} onChange={e => setField('currency', e.target.value)}>{DOCS_CURRENCIES.map(c => <option key={c}>{c}</option>)}</select></div>
                <div><label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Status</label><select className={inputCls} value={form.status} onChange={e => setField('status', e.target.value as 'paid' | 'unpaid')}><option value="unpaid">Unpaid</option><option value="paid">Paid</option></select></div>
              </div>
            </section>

            <section>
              <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-secondary)' }}>Client Identity</h3>
              <div className="space-y-3">
                <ClientProfileSelector
                  profiles={profiles}
                  selectedClientId={profiles.find(p => p.id === form.client_profile_id)?.client_id ?? ''}
                  onSelectClientId={applyClientProfile}
                  label="Client"
                />
                <div><label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Client Name *</label><input className={inputCls} value={form.client_name} onChange={e => setField('client_name', e.target.value)} /></div>
                <div><label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Company / Brand</label><input className={inputCls} value={form.company_brand} onChange={e => setField('company_brand', e.target.value)} /></div>
                <div><label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Project Title</label><input className={inputCls} value={form.project_title} onChange={e => setField('project_title', e.target.value)} /></div>
                <div><label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Project Description</label><textarea className={inputCls} rows={2} value={form.project_description} onChange={e => setField('project_description', e.target.value)} /></div>
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Deliverables</h3>
                <button onClick={addDeliverable} className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg font-medium" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}><Plus size={12} /> Add</button>
              </div>
              <div className="space-y-2">
                {form.deliverables.map((d, i) => (
                  <div key={d.id} className="flex items-center gap-2">
                    <input className="flex-1 px-3 py-1.5 text-sm rounded-lg border outline-none" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }} placeholder="Description" value={d.description} onChange={e => { const nd = [...form.deliverables]; nd[i] = { ...d, description: e.target.value }; setField('deliverables', nd); }} />
                    <input type="number" min={1} className="w-14 px-2 py-1.5 text-sm rounded-lg border outline-none text-center" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }} value={d.quantity} onChange={e => { const q2 = Math.max(1, Number(e.target.value)); const nd = [...form.deliverables]; nd[i] = { ...d, quantity: q2, total: q2 * d.unitPrice }; setField('deliverables', nd); }} />
                    <input type="number" min={0} className="w-24 px-2 py-1.5 text-sm rounded-lg border outline-none text-right" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }} value={d.unitPrice} onChange={e => { const p = Math.max(0, Number(e.target.value)); const nd = [...form.deliverables]; nd[i] = { ...d, unitPrice: p, total: d.quantity * p }; setField('deliverables', nd); }} />
                    <button onClick={() => setField('deliverables', form.deliverables.filter((_, ii) => ii !== i))} className="p-1.5 rounded-lg hover:bg-red-50"><Trash2 size={14} style={{ color: '#ef4444' }} /></button>
                  </div>
                ))}
                {form.deliverables.length === 0 && <p className="text-xs text-center py-3" style={{ color: 'var(--text-secondary)' }}>No deliverables</p>}
              </div>
            </section>

            <section>
              <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-secondary)' }}>Pricing & Terms</h3>
              <div className="space-y-3">
                <div><label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Total Quote Value</label><input type="number" min={0} className={inputCls} value={form.total_value} onChange={e => setField('total_value', Number(e.target.value))} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Payment Due (days)</label><input type="number" min={1} className={inputCls} value={form.payment_due_days} onChange={e => setField('payment_due_days', Number(e.target.value))} /></div>
                  <div><label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Payment Method</label><select className={inputCls} value={form.payment_method} onChange={e => setField('payment_method', e.target.value)}>{DOCS_PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}</select></div>
                </div>
                {form.payment_method === 'Custom' && <div><label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Custom Method</label><input className={inputCls} value={form.custom_payment_method} onChange={e => setField('custom_payment_method', e.target.value)} /></div>}
                <div><label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Additional Notes</label><textarea className={inputCls} rows={3} value={form.additional_notes} onChange={e => setField('additional_notes', e.target.value)} /></div>
              </div>
            </section>

            <div className="pb-4">
              <button onClick={save} disabled={saving} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60" style={{ background: 'var(--accent)' }}>
                {saved ? <><Check size={16} /> Saved!</> : saving ? 'Saving…' : <><Save size={16} /> {editingId ? 'Update Quotation' : 'Save Quotation'}</>}
              </button>
            </div>
          </div>
        ) : (
          <HistoryPanel quotations={quotations} loading={loading} onEdit={loadIntoForm} onDuplicate={duplicateQuotation} onDelete={deleteQ} onReload={load} onBackup={handleBackup} onClearAll={handleClearAll} onRestoreData={handleRestoreData} />
        )}
      </div>

      <div className="hidden lg:flex flex-1 items-start justify-center p-6 overflow-auto" style={{ background: 'var(--surface-2)' }}>
        <div className="fixed right-6 bottom-6 flex flex-col gap-2 z-50">
          <button onClick={() => printPreviewDocument('quotation-preview', form.quote_number, 'quotation')} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-lg" style={{ background: '#0f172a' }}><Printer size={15} /> PDF</button>
          <button onClick={() => { const rows = [['Quote No','Client','Date','Currency','Value','Status'],[form.quote_number,form.client_name,form.quote_date,form.currency,String(form.total_value),form.status]]; const csv = rows.map(r=>r.map(c=>`"${c}"`).join(',')).join('\n'); const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'})); a.download=`${form.quote_number}.csv`; a.click(); }} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-lg" style={{ background: '#475569' }}><Download size={15} /> Excel / CSV</button>
        </div>
        <div className="bg-white shadow-2xl rounded-sm" style={{ width: 794, minHeight: 1123 }}>
          <QuotationPreview form={form} />
        </div>
      </div>

    </div>
  );
}
