'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  Plus, Trash2, Save, Copy, Edit2, RotateCcw, Search,
  Download, Printer, Check, AlertCircle,
} from 'lucide-react';
import clsx from 'clsx';
import type { DocsQuotation, QuotationDeliverable } from '@/lib/docs-types';
import { DOCS_CURRENCIES, DOCS_PAYMENT_METHODS } from '@/lib/docs-types';

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
    <div id="quotation-preview" className="bg-white text-gray-900 w-full" style={{ fontFamily: 'Arial, sans-serif', fontSize: 13, minHeight: 1123 }}>
      <div style={{ background: '#7c3aed', color: '#fff', padding: '28px 36px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>QUOTATION</div>
            <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>{form.quote_number}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 700, fontSize: 18 }}>OPENY</div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>Digital Marketing Agency</div>
          </div>
        </div>
      </div>
      <div style={{ padding: '24px 36px' }}>
        <div style={{ display: 'flex', gap: 24, marginBottom: 24 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', color: '#6b7280', marginBottom: 4 }}>Prepared For</div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{form.client_name || '—'}</div>
            {form.company_brand && <div style={{ fontSize: 12, color: '#6b7280' }}>{form.company_brand}</div>}
            {form.project_title && <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>{form.project_title}</div>}
            {form.project_description && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{form.project_description}</div>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <table style={{ fontSize: 12 }}>
              <tbody>
                <tr><td style={{ color: '#6b7280', paddingRight: 12 }}>Date:</td><td style={{ fontWeight: 600 }}>{form.quote_date || '—'}</td></tr>
                <tr><td style={{ color: '#6b7280' }}>Currency:</td><td style={{ fontWeight: 600 }}>{form.currency}</td></tr>
                <tr><td style={{ color: '#6b7280' }}>Due in:</td><td style={{ fontWeight: 600 }}>{form.payment_due_days} days</td></tr>
                <tr>
                  <td style={{ color: '#6b7280' }}>Status:</td>
                  <td>
                    <span style={{ padding: '1px 8px', borderRadius: 10, background: form.status === 'paid' ? '#dcfce7' : '#fef9c3', color: form.status === 'paid' ? '#166534' : '#854d0e', fontWeight: 700, fontSize: 11 }}>
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
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: '#7c3aed' }}>Scope of Work</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f5f3ff' }}>
                  <th style={{ textAlign: 'left', padding: '6px 10px', borderBottom: '1px solid #e5e7eb' }}>Description</th>
                  <th style={{ textAlign: 'center', padding: '6px 10px', borderBottom: '1px solid #e5e7eb', width: 60 }}>Qty</th>
                  <th style={{ textAlign: 'right', padding: '6px 10px', borderBottom: '1px solid #e5e7eb', width: 110 }}>Unit Price</th>
                  <th style={{ textAlign: 'right', padding: '6px 10px', borderBottom: '1px solid #e5e7eb', width: 110 }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {form.deliverables.map(d => (
                  <tr key={d.id}>
                    <td style={{ padding: '5px 10px', borderBottom: '1px solid #f5f3ff' }}>{d.description}</td>
                    <td style={{ textAlign: 'center', padding: '5px 10px', borderBottom: '1px solid #f5f3ff' }}>{d.quantity}</td>
                    <td style={{ textAlign: 'right', padding: '5px 10px', borderBottom: '1px solid #f5f3ff' }}>{fmt(d.unitPrice, form.currency)}</td>
                    <td style={{ textAlign: 'right', padding: '5px 10px', borderBottom: '1px solid #f5f3ff', fontWeight: 600 }}>{fmt(d.total, form.currency)}</td>
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
                  <td style={{ padding: '4px 16px', color: '#6b7280' }}>Subtotal</td>
                  <td style={{ textAlign: 'right', padding: '4px 0', fontWeight: 600 }}>{fmt(delivTotal, form.currency)}</td>
                </tr>
              )}
              <tr>
                <td style={{ padding: '8px 16px', fontWeight: 700, fontSize: 15 }}>Total Quote Value</td>
                <td style={{ textAlign: 'right', padding: '8px 0', fontWeight: 800, fontSize: 15, color: '#7c3aed', borderTop: '2px solid #7c3aed' }}>
                  {fmt(total, form.currency)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, color: '#7c3aed' }}>Payment Terms</div>
          <div style={{ fontSize: 12, marginBottom: 4 }}><span style={{ color: '#6b7280' }}>Method: </span>{form.payment_method === 'Custom' ? form.custom_payment_method : form.payment_method}</div>
          <div style={{ fontSize: 12 }}><span style={{ color: '#6b7280' }}>Due in: </span>{form.payment_due_days} days from invoice date</div>
        </div>

        {form.additional_notes && (
          <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 12, color: '#6b7280', marginBottom: 4 }}>NOTES</div>
            <div style={{ fontSize: 12 }}>{form.additional_notes}</div>
          </div>
        )}

        <div style={{ marginTop: 40, display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ textAlign: 'center', width: 200 }}>
            <div style={{ borderTop: '1px solid #d1d5db', paddingTop: 8, fontSize: 11, color: '#6b7280' }}>Prepared by / Signature</div>
          </div>
          <div style={{ textAlign: 'center', width: 200 }}>
            <div style={{ borderTop: '1px solid #d1d5db', paddingTop: 8, fontSize: 11, color: '#6b7280' }}>Client Acceptance / Date</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HistoryPanel({ quotations, loading, onEdit, onDuplicate, onDelete, onReload }: {
  quotations: DocsQuotation[]; loading: boolean;
  onEdit: (q: DocsQuotation) => void; onDuplicate: (q: DocsQuotation) => void;
  onDelete: (id: string) => void; onReload: () => void;
}) {
  const [search, setSearch]   = useState('');
  const [statusF, setStatusF] = useState<'all' | 'paid' | 'unpaid'>('all');

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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/docs/quotations');
      const json = await res.json();
      setQuotations(json.quotations ?? []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

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
    setForm({ ...q, quote_number: nextQNum(quotations), quote_date: today(), status: 'unpaid', deliverables: q.deliverables.map(d => ({ ...d, id: uid() })), company_brand: q.company_brand ?? '', project_title: q.project_title ?? '', project_description: q.project_description ?? '', payment_method: q.payment_method ?? 'Bank Transfer', custom_payment_method: q.custom_payment_method ?? '', additional_notes: q.additional_notes ?? '' });
    setActiveTab('editor');
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
              <button onClick={save} disabled={saving} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60" style={{ background: '#7c3aed' }}>
                {saved ? <><Check size={16} /> Saved!</> : saving ? 'Saving…' : <><Save size={16} /> {editingId ? 'Update Quotation' : 'Save Quotation'}</>}
              </button>
            </div>
          </div>
        ) : (
          <HistoryPanel quotations={quotations} loading={loading} onEdit={loadIntoForm} onDuplicate={duplicateQuotation} onDelete={deleteQ} onReload={load} />
        )}
      </div>

      <div className="hidden lg:flex flex-1 items-start justify-center p-6 overflow-auto" style={{ background: 'var(--surface-2)' }}>
        <div className="fixed right-6 bottom-6 flex flex-col gap-2 z-50">
          <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-lg" style={{ background: '#dc2626' }}><Printer size={15} /> PDF</button>
          <button onClick={() => { const rows = [['Quote No','Client','Date','Currency','Value','Status'],[form.quote_number,form.client_name,form.quote_date,form.currency,String(form.total_value),form.status]]; const csv = rows.map(r=>r.map(c=>`"${c}"`).join(',')).join('\n'); const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'})); a.download=`${form.quote_number}.csv`; a.click(); }} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-lg" style={{ background: '#16a34a' }}><Download size={15} /> Excel / CSV</button>
        </div>
        <div className="bg-white shadow-2xl rounded-sm" style={{ width: 794, minHeight: 1123 }}>
          <QuotationPreview form={form} />
        </div>
      </div>

      <style>{`@media print { body > * { display: none !important; } #quotation-preview { display: block !important; } }`}</style>
    </div>
  );
}
