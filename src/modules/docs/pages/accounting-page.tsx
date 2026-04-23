'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { Plus, Trash2, Edit2, Download, Search, Archive } from 'lucide-react';
import clsx from 'clsx';
import { type DocsAccountingEntry, type DocsAccountingExpense, DOCS_CURRENCIES, ACCOUNTING_COLLECTORS, getAccountingCollectorByType } from '@/lib/docs-types';
import ClientProfileSelector from '@/components/docs/ClientProfileSelector';
import { type DocsClientProfile, fetchDocsClientProfiles, isVirtualDocsProfileId, sanitizeDocCode } from '@/lib/docs-client-profiles';
import { DocsDateField } from '@/components/docs/DocsUi';
import AppModal from '@/components/ui/AppModal';
import { DocsDocTypeTabs } from '@/components/docs/DocsWorkspace';

type Tab = 'ledger' | 'summary';

function today() { return new Date().toISOString().slice(0, 10); }
function thisMonth() { return new Date().toISOString().slice(0, 7); }
function monthKey(m: string) { return m.replace('-', ''); }
function collectorFromType(type: 'local' | 'overseas') {
  return getAccountingCollectorByType(type);
}

function fmt(n: number, cur = 'SAR') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur, minimumFractionDigits: 2 }).format(n);
}

// ── Entry modal ───────────────────────────────────────────────────────────────

interface EntryForm {
  client_name: string; service: string; amount: number; currency: string;
  collection_type: 'local' | 'overseas'; collector: string;
  entry_date: string; notes: string;
}

function EntryModal({ initial, monthKey: mk, onClose, onDone, selectedProfile }: {
  initial?: DocsAccountingEntry;
  monthKey: string;
  onClose: () => void;
  onDone: () => void;
  selectedProfile?: DocsClientProfile | null;
}) {
  const [form, setForm] = useState<EntryForm>(() => initial ? {
    client_name: initial.client_name, service: initial.service ?? '', amount: initial.amount,
    currency: initial.currency, collection_type: initial.collection_type, collector: initial.collector ?? '',
    entry_date: initial.entry_date, notes: initial.notes ?? '',
  } : {
    client_name: '', service: '', amount: 0, currency: 'SAR',
    collection_type: 'local', collector: ACCOUNTING_COLLECTORS[0],
    entry_date: today(), notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  function setF<K extends keyof EntryForm>(k: K, v: EntryForm[K]) { setForm(f => ({ ...f, [k]: v })); }
  useEffect(() => {
    if (initial) return;
    if (!selectedProfile) return;
    setForm(prev => ({
      ...prev,
      client_name: selectedProfile.client_name,
      currency: selectedProfile.default_currency,
      notes: prev.notes || selectedProfile.notes || '',
    }));
  }, [initial, selectedProfile]);

  async function submit() {
    if (!form.client_name.trim()) { setError('Client name is required'); return; }
    setSaving(true); setError('');
    try {
      const url = initial ? `/api/docs/accounting/entries/${initial.id}` : '/api/docs/accounting/entries';
      const res = await fetch(url, {
        method: initial ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          collector: collectorFromType(form.collection_type),
          month_key: mk,
          client_profile_id: selectedProfile && !isVirtualDocsProfileId(selectedProfile.id) ? selectedProfile.id : null,
        }),
      });
      if (!res.ok) { setError((await res.json()).error ?? 'Save failed'); return; }
      onDone(); onClose();
    } finally { setSaving(false); }
  }

  const inp = 'w-full px-3 py-1.5 text-sm rounded-lg border outline-none bg-[var(--surface-2)] border-[var(--border)] text-[var(--text)]';
  const lbl = (l: string) => <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{l}</label>;

  return (
    <AppModal
      open
      onClose={onClose}
      title={initial ? 'Edit Entry' : 'Add Revenue Entry'}
      size="sm"
      bodyClassName="space-y-3"
      footer={(
        <>
          <button onClick={onClose} className="openy-modal-btn-secondary flex-1">Cancel</button>
          <button onClick={submit} disabled={saving} className="openy-modal-btn-primary flex-1 disabled:opacity-60">{saving ? 'Saving…' : initial ? 'Update' : 'Add Entry'}</button>
        </>
      )}
    >
        {error && <div className="mb-3 px-3 py-2 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.08)', color: '#dc2626' }}>{error}</div>}
        <div className="space-y-3">
          <div>{lbl('Client Name *')}<input className={inp} value={form.client_name} onChange={e => setF('client_name', e.target.value)} /></div>
          <div>{lbl('Service')}<input className={inp} value={form.service} onChange={e => setF('service', e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>{lbl('Amount')}<input type="number" min={0} className={inp} value={form.amount} onChange={e => setF('amount', Number(e.target.value))} /></div>
            <div>{lbl('Currency')}<select className={inp} value={form.currency} onChange={e => setF('currency', e.target.value)}>{DOCS_CURRENCIES.map(c => <option key={c}>{c}</option>)}</select></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>{lbl('Payment Type')}<select className={inp} value={form.collection_type} onChange={e => {
              const type = e.target.value as 'local' | 'overseas';
              setForm(f => ({ ...f, collection_type: type, collector: collectorFromType(type) }));
            }}><option value="local">{ACCOUNTING_COLLECTORS[0]}</option><option value="overseas">{ACCOUNTING_COLLECTORS[1]}</option></select></div>
            <div>{lbl('Collector')}<input className={inp} value={collectorFromType(form.collection_type)} readOnly /></div>
          </div>
          <div>{lbl('Entry Date')}<input type="date" className={inp} value={form.entry_date} onChange={e => setF('entry_date', e.target.value)} /></div>
          <div>{lbl('Notes')}<textarea className={inp} rows={2} value={form.notes} onChange={e => setF('notes', e.target.value)} /></div>
        </div>
    </AppModal>
  );
}

// ── Expense modal ─────────────────────────────────────────────────────────────

interface ExpenseForm { description: string; amount: number; currency: string; expense_date: string; notes: string; }

function ExpenseModal({ initial, monthKey: mk, onClose, onDone }: {
  initial?: DocsAccountingExpense; monthKey: string; onClose: () => void; onDone: () => void;
}) {
  const [form, setForm] = useState<ExpenseForm>(() => initial ? {
    description: initial.description, amount: initial.amount, currency: initial.currency,
    expense_date: initial.expense_date, notes: initial.notes ?? '',
  } : { description: '', amount: 0, currency: 'SAR', expense_date: today(), notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  function setF<K extends keyof ExpenseForm>(k: K, v: ExpenseForm[K]) { setForm(f => ({ ...f, [k]: v })); }

  async function submit() {
    if (!form.description.trim()) { setError('Description is required'); return; }
    setSaving(true); setError('');
    try {
      const url = initial ? `/api/docs/accounting/expenses/${initial.id}` : '/api/docs/accounting/expenses';
      const res = await fetch(url, {
        method: initial ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, month_key: mk }),
      });
      if (!res.ok) { setError((await res.json()).error ?? 'Save failed'); return; }
      onDone(); onClose();
    } finally { setSaving(false); }
  }

  const inp = 'w-full px-3 py-1.5 text-sm rounded-lg border outline-none bg-[var(--surface-2)] border-[var(--border)] text-[var(--text)]';
  const lbl = (l: string) => <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{l}</label>;

  return (
    <AppModal
      open
      onClose={onClose}
      title={initial ? 'Edit Expense' : 'Add Expense'}
      size="sm"
      bodyClassName="space-y-3"
      footer={(
        <>
          <button onClick={onClose} className="openy-modal-btn-secondary flex-1">Cancel</button>
          <button onClick={submit} disabled={saving} className="openy-modal-btn-primary flex-1 disabled:opacity-60">{saving ? 'Saving…' : initial ? 'Update' : 'Add Expense'}</button>
        </>
      )}
    >
        {error && <div className="mb-3 px-3 py-2 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.08)', color: '#dc2626' }}>{error}</div>}
        <div className="space-y-3">
          <div>{lbl('Description *')}<input className={inp} value={form.description} onChange={e => setF('description', e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>{lbl('Amount')}<input type="number" min={0} className={inp} value={form.amount} onChange={e => setF('amount', Number(e.target.value))} /></div>
            <div>{lbl('Currency')}<select className={inp} value={form.currency} onChange={e => setF('currency', e.target.value)}>{DOCS_CURRENCIES.map(c => <option key={c}>{c}</option>)}</select></div>
          </div>
          <div>{lbl('Expense Date')}<input type="date" className={inp} value={form.expense_date} onChange={e => setF('expense_date', e.target.value)} /></div>
          <div>{lbl('Notes')}<textarea className={inp} rows={2} value={form.notes} onChange={e => setF('notes', e.target.value)} /></div>
        </div>
    </AppModal>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AccountingPage() {
  const [tab, setTab]               = useState<Tab>('ledger');
  const [month, setMonth]           = useState(thisMonth());
  const [entries, setEntries]       = useState<DocsAccountingEntry[]>([]);
  const [expenses, setExpenses]     = useState<DocsAccountingExpense[]>([]);
  const [loading, setLoading]       = useState(true);
  const [addEntry, setAddEntry]     = useState(false);
  const [editEntry, setEditEntry]   = useState<DocsAccountingEntry | null>(null);
  const [addExpense, setAddExpense] = useState(false);
  const [editExpense, setEditExpense] = useState<DocsAccountingExpense | null>(null);
  const [search, setSearch]         = useState('');
  const [collectorF, setCollectorF] = useState('all');
  const [profiles, setProfiles] = useState<DocsClientProfile[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');

  const mk = monthKey(month);
  const selectedProfile = profiles.find(p => p.client_id === selectedClientId) ?? null;

  const accountingDocumentCode = useMemo(() => {
    if (!selectedProfile) return '';
    const slug = sanitizeDocCode(selectedProfile.client_slug || selectedProfile.client_name || 'accounting', 'accounting');
    return `${slug.toUpperCase()}-${mk}`;
  }, [selectedProfile, mk]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [eRes, xRes] = await Promise.all([
        fetch(`/api/docs/accounting/entries?month_key=${mk}`),
        fetch(`/api/docs/accounting/expenses?month_key=${mk}`),
      ]);
      const [ej, xj] = await Promise.all([eRes.json(), xRes.json()]);
      setEntries(ej.entries ?? []);
      setExpenses(xj.expenses ?? []);
    } finally { setLoading(false); }
  }, [mk]);

  useEffect(() => { void loadData(); }, [loadData]);
  useEffect(() => { fetchDocsClientProfiles().then(setProfiles).catch(() => null); }, []);

  async function deleteEntry(id: string) {
    if (!confirm('Delete this entry?')) return;
    await fetch(`/api/docs/accounting/entries/${id}`, { method: 'DELETE' });
    await loadData();
  }

  async function deleteExpense(id: string) {
    if (!confirm('Delete this expense?')) return;
    await fetch(`/api/docs/accounting/expenses/${id}`, { method: 'DELETE' });
    await loadData();
  }

  // Filtering
  const visibleEntries = entries.filter(e => {
    if (collectorF !== 'all' && e.collector !== collectorF) return false;
    if (search && !e.client_name.toLowerCase().includes(search.toLowerCase()) &&
        !(e.service ?? '').toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Summaries
  const totalRevenue = entries.reduce((s, e) => s + e.amount, 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const netResult = totalRevenue - totalExpenses;
  const localTotal = entries.filter(e => e.collection_type === 'local').reduce((s, e) => s + e.amount, 0);
  const overseasTotal = entries.filter(e => e.collection_type === 'overseas').reduce((s, e) => s + e.amount, 0);

  // Per-collector summaries
  const byCollector: Record<string, { local: number; overseas: number }> = {};
  for (const e of entries) {
    const c = e.collector ?? 'Unknown';
    if (!byCollector[c]) byCollector[c] = { local: 0, overseas: 0 };
    if (e.collection_type === 'local') byCollector[c].local += e.amount;
    else byCollector[c].overseas += e.amount;
  }

  async function handleBackup() {
    const label = `Backup ${month} (accounting)`;
    await fetch('/api/docs/backups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ module: 'accounting', data: { entries, expenses }, label }),
    });
  }

  return (
    <div className="docs-app flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <div className="px-6 py-3 border-b shrink-0 space-y-2 sticky top-3 z-20 backdrop-blur-md" style={{ background: 'color-mix(in srgb, var(--surface-elevated) 88%, transparent)', borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <DocsDocTypeTabs active="accounting" />
          <div className="flex items-center gap-2">
            {([['ledger','Ledger'],['summary','Summary']] as [Tab, string][]).map(([t, l]) => (
              <button key={t} onClick={() => setTab(t)} className={clsx('py-1.5 px-3 text-sm font-medium rounded-lg transition-colors', tab === t ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'text-[var(--text-secondary)] hover:text-[var(--text)]')}>{l}</button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <DocsDateField value={month} onChange={setMonth} mode="month" placeholder="Accounting month" />
          <a
            href={`/api/docs/accounting/export?month_key=${encodeURIComponent(mk)}${accountingDocumentCode ? `&document_code=${encodeURIComponent(accountingDocumentCode)}` : ''}`}
            download
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg text-white"
            style={{ background: '#0f172a' }}
          >
            <Download size={14} /> Export
          </a>
          <button
            onClick={handleBackup}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg"
            style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
            title="Backup current month data"
          >
            <Archive size={14} /> Backup
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* ── Ledger ───────────────────────────────────────────────────────── */}
        {tab === 'ledger' && (
          <div className="p-6 space-y-6">
            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                ['Total Revenue', fmt(totalRevenue), '#059669'],
                ['Local Collections', fmt(localTotal), '#2563eb'],
                ['Overseas Collections', fmt(overseasTotal), '#7c3aed'],
                ['Net Result', fmt(netResult), netResult >= 0 ? '#059669' : '#dc2626'],
              ].map(([l,v,c]) => (
                <div key={l} className="rounded-2xl p-5 border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                  <div className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>{l}</div>
                  <div className="text-xl font-bold" style={{ color: c }}>{v}</div>
                </div>
              ))}
            </div>

            {/* Revenue entries */}
            <div>
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Revenue Entries</h2>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-secondary)' }} />
                    <input className="pl-8 pr-3 py-1.5 text-sm rounded-lg border outline-none" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)', width: 180 }} placeholder="Search entries…" value={search} onChange={e => setSearch(e.target.value)} />
                  </div>
                  <select className="px-2 py-1.5 text-sm rounded-lg border outline-none" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }} value={collectorF} onChange={e => setCollectorF(e.target.value)}>
                    <option value="all">All Collectors</option>
                    {ACCOUNTING_COLLECTORS.map(c => <option key={c}>{c}</option>)}
                  </select>
                  <button onClick={() => setAddEntry(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg text-white" style={{ background: 'var(--accent)' }}><Plus size={14} /> Add Entry</button>
                </div>
              </div>
              <div className="mb-3">
                <ClientProfileSelector
                  profiles={profiles}
                  selectedClientId={selectedClientId}
                  onSelectClientId={setSelectedClientId}
                  label="Client context"
                />
              </div>

              <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: 'var(--surface)', borderBottom: `1px solid var(--border)` }}>
                      {['Client', 'Service', 'Amount', 'Payment Type', 'Collector', 'Date', ''].map(h => (
                        <th key={h} className={clsx('px-4 py-3 text-xs font-semibold', h === 'Amount' ? 'text-right' : 'text-left')} style={{ color: 'var(--text-secondary)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loading && <tr><td colSpan={7} className="text-center py-6 text-sm" style={{ color: 'var(--text-secondary)' }}>Loading…</td></tr>}
                    {!loading && visibleEntries.length === 0 && <tr><td colSpan={7} className="text-center py-6 text-sm" style={{ color: 'var(--text-secondary)' }}>No entries for this month</td></tr>}
                    {visibleEntries.map(e => (
                      <tr key={e.id} className="hover:bg-[var(--surface-2)] border-t" style={{ borderColor: 'var(--border)' }}>
                        <td className="px-4 py-3 font-medium" style={{ color: 'var(--text)' }}>{e.client_name}</td>
                        <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{e.service ?? '—'}</td>
                        <td className="px-4 py-3 text-right font-semibold" style={{ color: '#059669' }}>{fmt(e.amount, e.currency)}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: e.collection_type === 'local' ? 'rgba(37,99,235,0.1)' : 'rgba(124,58,237,0.1)', color: e.collection_type === 'local' ? '#2563eb' : '#7c3aed' }}>
                            {collectorFromType(e.collection_type)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{e.collector ?? '—'}</td>
                        <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{e.entry_date}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 justify-end">
                            <button onClick={() => setEditEntry(e)} className="p-1 rounded hover:bg-[var(--accent-soft)]"><Edit2 size={13} style={{ color: 'var(--accent)' }} /></button>
                            <button onClick={() => deleteEntry(e.id)} className="p-1 rounded hover:bg-red-50"><Trash2 size={13} style={{ color: '#ef4444' }} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {visibleEntries.length > 0 && (
                    <tfoot>
                      <tr style={{ background: 'var(--surface)', borderTop: `2px solid var(--border)` }}>
                        <td colSpan={2} className="px-4 py-3 text-sm font-bold" style={{ color: 'var(--text)' }}>Total Revenue</td>
                        <td className="px-4 py-3 text-right font-bold" style={{ color: '#059669' }}>{fmt(visibleEntries.reduce((s, e) => s + e.amount, 0))}</td>
                        <td colSpan={4} />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>

            {/* Expenses */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Expenses</h2>
                <button onClick={() => setAddExpense(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg text-white" style={{ background: '#0f172a' }}><Plus size={14} /> Add Expense</button>
              </div>

              <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: 'var(--surface)', borderBottom: `1px solid var(--border)` }}>
                      {['Description', 'Amount', 'Date', 'Notes', ''].map(h => (
                        <th key={h} className={clsx('px-4 py-3 text-xs font-semibold', h === 'Amount' ? 'text-right' : 'text-left')} style={{ color: 'var(--text-secondary)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {!loading && expenses.length === 0 && <tr><td colSpan={5} className="text-center py-6 text-sm" style={{ color: 'var(--text-secondary)' }}>No expenses recorded</td></tr>}
                    {expenses.map(x => (
                      <tr key={x.id} className="hover:bg-[var(--surface-2)] border-t" style={{ borderColor: 'var(--border)' }}>
                        <td className="px-4 py-3 font-medium" style={{ color: 'var(--text)' }}>{x.description}</td>
                        <td className="px-4 py-3 text-right font-semibold" style={{ color: '#dc2626' }}>{fmt(x.amount, x.currency)}</td>
                        <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{x.expense_date}</td>
                        <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{x.notes ?? '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 justify-end">
                            <button onClick={() => setEditExpense(x)} className="p-1 rounded hover:bg-[var(--accent-soft)]"><Edit2 size={13} style={{ color: 'var(--accent)' }} /></button>
                            <button onClick={() => deleteExpense(x.id)} className="p-1 rounded hover:bg-red-50"><Trash2 size={13} style={{ color: '#ef4444' }} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {expenses.length > 0 && (
                    <tfoot>
                      <tr style={{ background: 'var(--surface)', borderTop: `2px solid var(--border)` }}>
                        <td className="px-4 py-3 text-sm font-bold" style={{ color: 'var(--text)' }}>Total Expenses</td>
                        <td className="px-4 py-3 text-right font-bold" style={{ color: '#dc2626' }}>{fmt(totalExpenses)}</td>
                        <td colSpan={3} />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── Summary ───────────────────────────────────────────────────────── */}
        {tab === 'summary' && (
          <div className="p-6 space-y-6">
            <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>Monthly Summary — {month}</h2>

            {/* Totals */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="rounded-2xl p-5 border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                <div className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Total Revenue</div>
                <div className="text-2xl font-bold" style={{ color: '#059669' }}>{fmt(totalRevenue)}</div>
                <div className="flex gap-4 mt-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  <span>Local: {fmt(localTotal)}</span>
                  <span>Overseas: {fmt(overseasTotal)}</span>
                </div>
              </div>
              <div className="rounded-2xl p-5 border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                <div className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Total Expenses</div>
                <div className="text-2xl font-bold" style={{ color: '#dc2626' }}>{fmt(totalExpenses)}</div>
              </div>
              <div className="rounded-2xl p-5 border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                <div className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Net Result</div>
                <div className="text-2xl font-bold" style={{ color: netResult >= 0 ? '#059669' : '#dc2626' }}>{fmt(netResult)}</div>
              </div>
            </div>

            {/* Partner settlement — local vs overseas */}
            <div>
              <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text)' }}>Partner Settlement Summary</h3>
              <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: 'var(--surface)', borderBottom: `1px solid var(--border)` }}>
                      {['Partner', 'Local Collections', 'Overseas Collections', 'Total'].map(h => (
                        <th key={h} className={clsx('px-4 py-3 text-xs font-semibold', h === 'Partner' ? 'text-left' : 'text-right')} style={{ color: 'var(--text-secondary)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(byCollector).map(([collector, data]) => (
                      <tr key={collector} className="hover:bg-[var(--surface-2)] border-t" style={{ borderColor: 'var(--border)' }}>
                        <td className="px-4 py-3 font-medium" style={{ color: 'var(--text)' }}>{collector}</td>
                        <td className="px-4 py-3 text-right" style={{ color: '#2563eb' }}>{fmt(data.local)}</td>
                        <td className="px-4 py-3 text-right" style={{ color: '#7c3aed' }}>{fmt(data.overseas)}</td>
                        <td className="px-4 py-3 text-right font-bold" style={{ color: 'var(--text)' }}>{fmt(data.local + data.overseas)}</td>
                      </tr>
                    ))}
                    {Object.keys(byCollector).length === 0 && (
                      <tr><td colSpan={4} className="text-center py-6 text-sm" style={{ color: 'var(--text-secondary)' }}>No data for this month</td></tr>
                    )}
                  </tbody>
                  {Object.keys(byCollector).length > 0 && (
                    <tfoot>
                      <tr style={{ background: 'var(--surface)', borderTop: `2px solid var(--border)` }}>
                        <td className="px-4 py-3 font-bold" style={{ color: 'var(--text)' }}>Total</td>
                        <td className="px-4 py-3 text-right font-bold" style={{ color: '#2563eb' }}>{fmt(localTotal)}</td>
                        <td className="px-4 py-3 text-right font-bold" style={{ color: '#7c3aed' }}>{fmt(overseasTotal)}</td>
                        <td className="px-4 py-3 text-right font-bold" style={{ color: 'var(--accent)' }}>{fmt(totalRevenue)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>

            {/* Settlement direction — who transfers to whom */}
            {totalRevenue > 0 && Object.keys(byCollector).length >= 2 && (() => {
              const [p1, p2] = ACCOUNTING_COLLECTORS;
              const p1Total = (byCollector[p1]?.local ?? 0) + (byCollector[p1]?.overseas ?? 0);
              const eachShare = netResult / 2;
              const diff = p1Total - eachShare;
              const absAmt = Math.abs(diff);
              if (absAmt < 0.005) return null;
              const fromName = diff > 0 ? p1 : p2;
              const toName   = diff > 0 ? p2 : p1;
              return (
                <div className="rounded-2xl p-4 border flex items-start gap-3" style={{
                  background: diff > 0
                    ? 'linear-gradient(135deg,rgba(37,99,235,0.06),rgba(124,58,237,0.06))'
                    : 'linear-gradient(135deg,rgba(5,150,105,0.06),rgba(15,118,110,0.06))',
                  borderColor: diff > 0 ? '#2563eb' : '#059669',
                  borderWidth: 1.5,
                }}>
                  <svg fill="none" stroke={diff > 0 ? '#2563eb' : '#059669'} viewBox="0 0 24 24" style={{ width: 28, height: 28, flexShrink: 0 }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={diff > 0 ? 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4' : 'M16 17H4m0 0l4-4m-4 4l4 4M8 7h12m0 0l-4-4m4 4l-4 4'} />
                  </svg>
                  <div>
                    <div className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Settlement Result — نتيجة التسوية</div>
                    <div className="text-sm font-bold" style={{ color: diff > 0 ? '#2563eb' : '#059669' }}>
                      {fromName} transfers&nbsp;
                      <span className="text-base" style={{ color: '#dc2626' }}>{fmt(absAmt)}</span>
                      &nbsp;→ to {toName}
                    </div>
                    <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                      Each partner&apos;s equal share: {fmt(eachShare)} &nbsp;·&nbsp;
                      {p1} collected: {fmt(p1Total)}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Expense breakdown */}
            {expenses.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text)' }}>Expense Breakdown</h3>
                <div className="space-y-2">
                  {expenses.map(x => (
                    <div key={x.id} className="flex items-center justify-between px-4 py-3 rounded-xl" style={{ background: 'var(--surface)', border: `1px solid var(--border)` }}>
                      <span style={{ color: 'var(--text)' }}>{x.description}</span>
                      <span className="font-semibold" style={{ color: '#dc2626' }}>{fmt(x.amount, x.currency)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {addEntry  && <EntryModal monthKey={mk} selectedProfile={selectedProfile} onClose={() => setAddEntry(false)} onDone={loadData} />}
      {editEntry && <EntryModal initial={editEntry} monthKey={mk} selectedProfile={selectedProfile} onClose={() => setEditEntry(null)} onDone={loadData} />}
      {addExpense   && <ExpenseModal monthKey={mk} onClose={() => setAddExpense(false)} onDone={loadData} />}
      {editExpense  && <ExpenseModal initial={editExpense} monthKey={mk} onClose={() => setEditExpense(null)} onDone={loadData} />}
    </div>
  );
}
