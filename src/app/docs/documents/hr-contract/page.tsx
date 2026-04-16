'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  Plus, Trash2, Save, Copy, Edit2, RotateCcw, Search,
  Download, Printer, Check, AlertCircle, Archive, ExternalLink, X,
} from 'lucide-react';
import clsx from 'clsx';
import type { DocsHrContract, ContractClause } from '@/lib/docs-types';
import { DOCS_CURRENCIES, DOCS_PAYMENT_METHODS, DOCS_EMPLOYMENT_TYPES, DOCS_MARITAL_STATUSES } from '@/lib/docs-types';
import { OpenyDocumentHeader, OpenyDocumentPage, OpenySectionTitle } from '@/components/docs/DocumentDesign';
import { OPENY_DOC_STYLE } from '@/lib/openy-brand';
import ClientProfileSelector from '@/components/docs/ClientProfileSelector';
import type { DocsClientProfile } from '@/lib/docs-client-profiles';
import { fetchDocsClientProfiles, isVirtualDocsProfileId } from '@/lib/docs-client-profiles';
import { printPreviewDocument } from '@/lib/docs-print';

function uid() { return Math.random().toString(36).slice(2, 10); }
function today() { return new Date().toISOString().slice(0, 10); }
function fmt(n: number, cur: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur, minimumFractionDigits: 2 }).format(n);
}
function nextNum(list: DocsHrContract[]) {
  const nums = list.map(c => parseInt(c.contract_number.replace(/\D/g, '') || '0')).filter(Boolean);
  return `HR-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(4, '0')}`;
}

type SF = {
  client_profile_id: string | null;
  contract_number: string; contract_date: string; duration: string;
  status: string; currency: string; language: 'ar' | 'en';
  company_name: string; company_representative: string; company_address: string;
  company_email: string; company_phone: string;
  employee_full_name: string; employee_national_id: string; employee_address: string;
  employee_phone: string; employee_email: string; employee_nationality: string;
  employee_marital_status: string;
  job_title: string; department: string; direct_manager: string; employment_type: string;
  start_date: string; contract_duration: string; probation_period: string; workplace: string;
  salary: number; payment_method: string; payment_date: string;
  benefits: string[];
  daily_hours: number; work_days: string; annual_leave: number;
  legal_clauses: ContractClause[];
  sig_company_rep: string; sig_employee_name: string; sig_date: string; sig_place: string;
};

function blank(num: string): SF {
  return {
    client_profile_id: null,
    contract_number: num, contract_date: today(), duration: '1 year',
    status: 'draft', currency: 'SAR', language: 'en',
    company_name: '', company_representative: '', company_address: '', company_email: '', company_phone: '',
    employee_full_name: '', employee_national_id: '', employee_address: '', employee_phone: '',
    employee_email: '', employee_nationality: '', employee_marital_status: 'Single',
    job_title: '', department: '', direct_manager: '', employment_type: 'full_time',
    start_date: today(), contract_duration: '1 year', probation_period: '3 months', workplace: '',
    salary: 0, payment_method: 'Bank Transfer', payment_date: 'End of month',
    benefits: [],
    daily_hours: 8, work_days: 'Sunday – Thursday', annual_leave: 21,
    legal_clauses: [],
    sig_company_rep: '', sig_employee_name: '', sig_date: today(), sig_place: '',
  };
}

function HrContractPreview({ form }: { form: SF }) {
  const isAr = form.language === 'ar';

  return (
    <OpenyDocumentPage
      id="hr-contract-preview"
      dir={isAr ? 'rtl' : 'ltr'}
      fontFamily={isAr ? "'Cairo',Arial,sans-serif" : 'Arial,sans-serif'}
      fontSize={12}
    >
      <OpenyDocumentHeader
        title={isAr ? 'عقد عمل' : 'EMPLOYMENT CONTRACT'}
        number={form.contract_number}
        centerTitle
      />
      <div style={{ padding: '24px 36px' }}>
        <table style={{ width: '100%', marginBottom: 20, fontSize: 12 }}>
          <tbody>
            <tr><td style={{ color: OPENY_DOC_STYLE.textMuted, width: 160 }}>Date:</td><td style={{ fontWeight: 600 }}>{form.contract_date}</td><td style={{ color: OPENY_DOC_STYLE.textMuted, width: 160 }}>Duration:</td><td style={{ fontWeight: 600 }}>{form.duration}</td></tr>
            <tr><td style={{ color: OPENY_DOC_STYLE.textMuted }}>Status:</td><td style={{ fontWeight: 600 }}>{form.status}</td><td style={{ color: OPENY_DOC_STYLE.textMuted }}>Language:</td><td style={{ fontWeight: 600 }}>{isAr ? 'Arabic' : 'English'}</td></tr>
          </tbody>
        </table>

        <div style={{ display: 'flex', gap: 20, marginBottom: 20 }}>
          <div style={{ flex: 1, border: `1px solid ${OPENY_DOC_STYLE.border}`, borderRadius: 8, padding: 14, background: OPENY_DOC_STYLE.surface }}>
            <OpenySectionTitle>Employer</OpenySectionTitle>
            {[['Company', form.company_name],['Representative', form.company_representative],['Address', form.company_address],['Email', form.company_email],['Phone', form.company_phone]].map(([l,v]) => v ? <div key={l} style={{ fontSize: 11, marginBottom: 2 }}><span style={{ color: OPENY_DOC_STYLE.textMuted }}>{l}: </span>{v}</div> : null)}
          </div>
          <div style={{ flex: 1, border: `1px solid ${OPENY_DOC_STYLE.border}`, borderRadius: 8, padding: 14, background: OPENY_DOC_STYLE.surface }}>
            <OpenySectionTitle>Employee</OpenySectionTitle>
            {[['Name', form.employee_full_name],['ID / Passport', form.employee_national_id],['Address', form.employee_address],['Phone', form.employee_phone],['Email', form.employee_email],['Nationality', form.employee_nationality],['Marital Status', form.employee_marital_status]].map(([l,v]) => v ? <div key={l} style={{ fontSize: 11, marginBottom: 2 }}><span style={{ color: OPENY_DOC_STYLE.textMuted }}>{l}: </span>{v}</div> : null)}
          </div>
        </div>

        <div style={{ border: `1px solid ${OPENY_DOC_STYLE.border}`, borderRadius: 8, padding: 14, marginBottom: 16, background: OPENY_DOC_STYLE.surface }}>
          <OpenySectionTitle>Job Details</OpenySectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 24px', fontSize: 12 }}>
            {[['Title', form.job_title],['Department', form.department],['Manager', form.direct_manager],['Type', form.employment_type]].map(([l,v]) => v ? <div key={l}><span style={{ color: OPENY_DOC_STYLE.textMuted }}>{l}: </span><span style={{ fontWeight: 600 }}>{v}</span></div> : null)}
          </div>
        </div>

        <div style={{ border: `1px solid ${OPENY_DOC_STYLE.border}`, borderRadius: 8, padding: 14, marginBottom: 16, background: OPENY_DOC_STYLE.surface }}>
          <OpenySectionTitle>Employment Terms</OpenySectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 24px', fontSize: 12 }}>
            {[['Start Date', form.start_date],['Duration', form.contract_duration],['Probation', form.probation_period],['Workplace', form.workplace]].map(([l,v]) => v ? <div key={l}><span style={{ color: OPENY_DOC_STYLE.textMuted }}>{l}: </span><span style={{ fontWeight: 600 }}>{v}</span></div> : null)}
          </div>
        </div>

        <div style={{ border: `1px solid ${OPENY_DOC_STYLE.border}`, borderRadius: 8, padding: 14, marginBottom: 16, background: OPENY_DOC_STYLE.surface }}>
          <OpenySectionTitle>Salary & Benefits</OpenySectionTitle>
          <div style={{ fontSize: 15, fontWeight: 800, color: OPENY_DOC_STYLE.title, marginBottom: 8 }}>{fmt(form.salary, form.currency)} / month</div>
          <div style={{ fontSize: 12, marginBottom: 4 }}><span style={{ color: OPENY_DOC_STYLE.textMuted }}>Payment: </span>{form.payment_method} · {form.payment_date}</div>
          {form.benefits.length > 0 && <div style={{ fontSize: 12 }}><span style={{ color: OPENY_DOC_STYLE.textMuted }}>Benefits: </span>{form.benefits.join(', ')}</div>}
        </div>

        <div style={{ border: `1px solid ${OPENY_DOC_STYLE.border}`, borderRadius: 8, padding: 14, marginBottom: 16, background: OPENY_DOC_STYLE.surface }}>
          <OpenySectionTitle>Working Hours</OpenySectionTitle>
          <div style={{ display: 'flex', gap: 24, fontSize: 12 }}>
            <div><span style={{ color: OPENY_DOC_STYLE.textMuted }}>Daily: </span><span style={{ fontWeight: 600 }}>{form.daily_hours}h</span></div>
            <div><span style={{ color: OPENY_DOC_STYLE.textMuted }}>Days: </span><span style={{ fontWeight: 600 }}>{form.work_days}</span></div>
            <div><span style={{ color: OPENY_DOC_STYLE.textMuted }}>Annual Leave: </span><span style={{ fontWeight: 600 }}>{form.annual_leave} days</span></div>
          </div>
        </div>

        {form.legal_clauses.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <OpenySectionTitle>Legal Clauses</OpenySectionTitle>
            {form.legal_clauses.map((cl, i) => (
              <div key={cl.id} style={{ marginBottom: 10 }}>
                <div style={{ fontWeight: 600, fontSize: 12 }}>{i + 1}. {cl.title}</div>
                <div style={{ fontSize: 11, color: OPENY_DOC_STYLE.textMuted, paddingLeft: 14, marginTop: 2 }}>{cl.content}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 40, marginTop: 32 }}>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ minHeight: 40, borderBottom: `1px solid ${OPENY_DOC_STYLE.borderStrong}`, marginBottom: 8 }}>{form.sig_company_rep}</div>
            <div style={{ fontSize: 11, color: OPENY_DOC_STYLE.textMuted }}>Company Representative</div>
          </div>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ minHeight: 40, borderBottom: `1px solid ${OPENY_DOC_STYLE.borderStrong}`, marginBottom: 8 }}>{form.sig_employee_name}</div>
            <div style={{ fontSize: 11, color: OPENY_DOC_STYLE.textMuted }}>Employee Signature</div>
          </div>
        </div>
        <div style={{ textAlign: 'center', marginTop: 12, fontSize: 11, color: OPENY_DOC_STYLE.textMuted }}>
          {form.sig_place && `${form.sig_place} · `}{form.sig_date}
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

function HistoryPanel({ contracts, loading, onEdit, onDuplicate, onDelete, onReload, onBackup, onClearAll, onRestoreData }: {
  contracts: DocsHrContract[]; loading: boolean;
  onEdit: (c: DocsHrContract) => void; onDuplicate: (c: DocsHrContract) => void;
  onDelete: (id: string) => void; onReload: () => void;
  onBackup: () => Promise<void>; onClearAll: () => Promise<void>; onRestoreData: (data: unknown) => void;
}) {
  const [search, setSearch]   = useState('');
  const [statusF, setStatusF] = useState('all');
  const [showRestore, setShowRestore] = useState(false);
  const [backing, setBacking]         = useState(false);
  const [clearing, setClearing]       = useState(false);

  const visible = contracts.filter(c => {
    if (statusF !== 'all' && c.status !== statusF) return false;
    if (search && !c.contract_number.toLowerCase().includes(search.toLowerCase()) &&
        !c.employee_full_name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b space-y-2" style={{ borderColor: 'var(--border)' }}>
        <div className="flex gap-2">
          <div className="relative flex-1"><Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-secondary)' }} /><input className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border outline-none" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }} placeholder="Search HR contracts…" value={search} onChange={e => setSearch(e.target.value)} /></div>
          <button onClick={onReload} className="p-1.5 rounded-lg hover:bg-[var(--surface-2)]"><RotateCcw size={14} style={{ color: 'var(--text-secondary)' }} /></button>
          <button onClick={async () => { setBacking(true); try { await onBackup(); } finally { setBacking(false); } }} disabled={backing} className="p-1.5 rounded-lg hover:bg-[var(--accent-soft)]" title="Backup all HR contracts">
            <Archive size={14} style={{ color: backing ? 'var(--text-secondary)' : 'var(--accent)' }} />
          </button>
          <button onClick={() => setShowRestore(true)} className="p-1.5 rounded-lg hover:bg-[var(--surface-2)]" title="Restore from backup">
            <RotateCcw size={14} style={{ color: '#f59e0b' }} />
          </button>
          <button onClick={async () => { if (!confirm('Clear ALL HR contracts? This cannot be undone.')) return; setClearing(true); try { await onClearAll(); } finally { setClearing(false); } }} disabled={clearing} className="p-1.5 rounded-lg hover:bg-red-50" title="Clear all HR contracts">
            <Trash2 size={14} style={{ color: '#ef4444' }} />
          </button>
        </div>
        <div className="flex gap-2 flex-wrap">
          {['all','draft','active','signed','expired','terminated'].map(s => (
            <button key={s} onClick={() => setStatusF(s)} className={clsx('px-2.5 py-1 text-xs rounded-full font-medium', statusF === s ? 'bg-[var(--accent)] text-white' : 'bg-[var(--surface-2)] text-[var(--text-secondary)]')}>{s.charAt(0).toUpperCase() + s.slice(1)}</button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto divide-y" style={{ borderColor: 'var(--border)' }}>
        {loading && <div className="p-6 text-sm text-center" style={{ color: 'var(--text-secondary)' }}>Loading…</div>}
        {!loading && visible.length === 0 && <div className="p-6 text-sm text-center" style={{ color: 'var(--text-secondary)' }}>No HR contracts found</div>}
        {visible.map(c => (
          <div key={c.id} className="p-3 hover:bg-[var(--surface-2)]">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5"><span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{c.contract_number}</span><span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[var(--surface-2)]" style={{ color: 'var(--text-secondary)' }}>{c.status}</span></div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{c.employee_full_name} · {c.job_title ?? '—'}</div>
                <div className="text-xs font-semibold mt-0.5" style={{ color: '#059669' }}>{fmt(c.salary, c.currency)} / month</div>
                <a href={`/api/docs/hr-contracts/${c.id}/export`} download onClick={e => e.stopPropagation()} className="flex items-center gap-1 text-[10px] font-medium mt-1 hover:underline" style={{ color: 'var(--text-secondary)' }}>
                  <ExternalLink size={9} /> HTML Doc
                </a>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => onEdit(c)} className="p-1.5 rounded-lg hover:bg-[var(--accent-soft)]"><Edit2 size={13} style={{ color: 'var(--accent)' }} /></button>
                <button onClick={() => onDuplicate(c)} className="p-1.5 rounded-lg hover:bg-[var(--surface-2)]"><Copy size={13} style={{ color: 'var(--text-secondary)' }} /></button>
                <button onClick={() => onDelete(c.id)} className="p-1.5 rounded-lg hover:bg-red-50"><Trash2 size={13} style={{ color: '#ef4444' }} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {showRestore && <BackupModal module="hr-contracts" onClose={() => setShowRestore(false)} onRestore={onRestoreData} />}
    </div>
  );
}

export default function HrContractPage() {
  const [contracts, setContracts] = useState<DocsHrContract[]>([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [activeTab, setActiveTab] = useState<'editor' | 'history'>('editor');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError]         = useState('');
  const [saved, setSaved]         = useState(false);
  const [form, setForm]           = useState<SF>(() => blank('HR-0001'));
  const [profiles, setProfiles]   = useState<DocsClientProfile[]>([]);
  const [newBenefit, setNewBenefit] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await fetch('/api/docs/hr-contracts'); const j = await r.json(); setContracts(j.contracts ?? []); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { fetchDocsClientProfiles().then(setProfiles).catch(() => null); }, []);

  function setField<K extends keyof SF>(k: K, v: SF[K]) { setForm(f => ({ ...f, [k]: v })); }

  function resetForm() { setEditingId(null); setForm(blank(nextNum(contracts))); setError(''); setActiveTab('editor'); }

  function loadIntoForm(c: DocsHrContract) {
    setEditingId(c.id);
    setForm({
      client_profile_id: c.client_profile_id ?? null,
      contract_number: c.contract_number, contract_date: c.contract_date ?? today(), duration: c.duration ?? '1 year',
      status: c.status, currency: c.currency, language: c.language,
      company_name: c.company_name ?? '', company_representative: c.company_representative ?? '',
      company_address: c.company_address ?? '', company_email: c.company_email ?? '', company_phone: c.company_phone ?? '',
      employee_full_name: c.employee_full_name, employee_national_id: c.employee_national_id ?? '',
      employee_address: c.employee_address ?? '', employee_phone: c.employee_phone ?? '',
      employee_email: c.employee_email ?? '', employee_nationality: c.employee_nationality ?? '',
      employee_marital_status: c.employee_marital_status ?? 'Single',
      job_title: c.job_title ?? '', department: c.department ?? '', direct_manager: c.direct_manager ?? '',
      employment_type: c.employment_type ?? 'full_time', start_date: c.start_date ?? today(),
      contract_duration: c.contract_duration ?? '1 year', probation_period: c.probation_period ?? '3 months',
      workplace: c.workplace ?? '', salary: c.salary, payment_method: c.payment_method ?? 'Bank Transfer',
      payment_date: c.payment_date ?? 'End of month', benefits: c.benefits,
      daily_hours: c.daily_hours, work_days: c.work_days ?? 'Sunday – Thursday', annual_leave: c.annual_leave,
      legal_clauses: c.legal_clauses,
      sig_company_rep: c.sig_company_rep ?? '', sig_employee_name: c.sig_employee_name ?? '',
      sig_date: c.sig_date ?? today(), sig_place: c.sig_place ?? '',
    });
    setActiveTab('editor');
  }

  async function save() {
    if (!form.employee_full_name.trim()) { setError('Employee full name is required'); return; }
    if (!form.contract_number.trim()) { setError('Contract number is required'); return; }
    setSaving(true); setError('');
    try {
      const url = editingId ? `/api/docs/hr-contracts/${editingId}` : '/api/docs/hr-contracts';
      const res = await fetch(url, { method: editingId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (!res.ok) { setError((await res.json()).error ?? 'Save failed'); return; }
      setSaved(true); setTimeout(() => setSaved(false), 2000);
      await load();
      if (!editingId) resetForm();
    } finally { setSaving(false); }
  }

  function applyClientProfile(clientId: string) {
    if (!clientId) {
      setField('client_profile_id', null);
      return;
    }
    const profile = profiles.find(p => p.client_id === clientId);
    if (!profile) return;
    const hasManualEdits = !!(form.company_name.trim() || form.employee_full_name.trim() || form.legal_clauses.length > 0);
    if (hasManualEdits && !confirm('Replace current HR contract defaults with selected client template?')) return;
    const cfg = profile.hr_contract_template_config ?? {};
    setForm(prev => ({
      ...prev,
      client_profile_id: isVirtualDocsProfileId(profile.id) ? null : profile.id,
      company_name: profile.client_name,
      currency: profile.default_currency,
      company_address: prev.company_address || profile.billing_address || '',
      payment_method: (cfg.payment_method as string | undefined) ?? prev.payment_method,
    }));
  }

  async function deleteC(id: string) {
    if (!confirm('Delete this contract?')) return;
    await fetch(`/api/docs/hr-contracts/${id}`, { method: 'DELETE' });
    await load();
    if (editingId === id) resetForm();
  }

  async function handleBackup() {
    const label = `Backup ${new Date().toLocaleDateString()} (${contracts.length} HR contracts)`;
    await fetch('/api/docs/backups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ module: 'hr_contracts', data: contracts, label }) });
  }

  async function handleClearAll() {
    await Promise.all(contracts.map(c => fetch(`/api/docs/hr-contracts/${c.id}`, { method: 'DELETE' })));
    await load();
    resetForm();
  }

  async function handleRestoreData(data: unknown) {
    if (!Array.isArray(data) || data.length === 0) { alert('Invalid or empty backup data.'); return; }
    if (!confirm(`Restore ${data.length} HR contract(s) from backup? They will be created as new records.`)) return;
    let count = 0;
    for (const item of data as DocsHrContract[]) {
      const { id: _id, created_at: _ca, updated_at: _ua, created_by: _cb,
              export_pdf_url: _ep, export_doc_url: _ed, is_duplicate: _dup, original_id: _oid,
              ...rest } = item;
      const res = await fetch('/api/docs/hr-contracts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rest) });
      if (res.ok) count++;
    }
    await load();
    alert(`Restored ${count} of ${data.length} HR contract(s).`);
  }

  const inp = 'w-full px-3 py-1.5 text-sm rounded-lg border outline-none bg-[var(--surface-2)] border-[var(--border)] text-[var(--text)]';
  const lbl = (l: string) => <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{l}</label>;
  const Sec = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section><h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-secondary)' }}>{title}</h3><div className="space-y-3">{children}</div></section>
  );

  return (
    <div className="docs-app flex h-full overflow-hidden">
      <div className="flex flex-col w-full lg:w-[480px] shrink-0 border-r overflow-hidden" style={{ borderColor: 'var(--border)' }}>
        <div className="flex border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
          {(['editor', 'history'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={clsx('flex-1 py-3 text-sm font-medium capitalize border-b-2', activeTab === tab ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-[var(--text-secondary)]')}>{tab}</button>
          ))}
        </div>

        {activeTab === 'editor' ? (
          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {editingId && <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm" style={{ background: 'rgba(234,179,8,0.1)', color: '#92400e' }}><Edit2 size={14} /> Editing · <button onClick={resetForm} className="underline">Cancel</button></div>}
            {error && <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.08)', color: '#dc2626' }}><AlertCircle size={14} /> {error}</div>}

            <Sec title="Contract Info">
              <div className="grid grid-cols-2 gap-3">
                <div>{lbl('Contract Number')}<input className={inp} value={form.contract_number} onChange={e => setField('contract_number', e.target.value)} /></div>
                <div>{lbl('Date')}<input type="date" className={inp} value={form.contract_date} onChange={e => setField('contract_date', e.target.value)} /></div>
                <div>{lbl('Duration')}<input className={inp} value={form.duration} onChange={e => setField('duration', e.target.value)} /></div>
                <div>{lbl('Status')}<select className={inp} value={form.status} onChange={e => setField('status', e.target.value)}>{['draft','active','signed','expired','terminated'].map(s => <option key={s}>{s}</option>)}</select></div>
                <div>{lbl('Currency')}<select className={inp} value={form.currency} onChange={e => setField('currency', e.target.value)}>{DOCS_CURRENCIES.map(c => <option key={c}>{c}</option>)}</select></div>
                <div>{lbl('Language')}<select className={inp} value={form.language} onChange={e => setField('language', e.target.value as 'ar' | 'en')}><option value="en">English</option><option value="ar">Arabic</option></select></div>
              </div>
            </Sec>

            <Sec title="Company Info">
              <ClientProfileSelector
                profiles={profiles}
                selectedClientId={profiles.find(p => p.id === form.client_profile_id)?.client_id ?? ''}
                onSelectClientId={applyClientProfile}
                label="Client"
              />
              {[['Company Name','company_name'],['Representative','company_representative'],['Address','company_address'],['Email','company_email'],['Phone','company_phone']].map(([l,f2]) => (
                <div key={f2}>{lbl(l)}<input className={inp} value={(form as unknown as Record<string,string>)[f2]} onChange={e => setField(f2 as keyof SF, e.target.value as never)} /></div>
              ))}
            </Sec>

            <Sec title="Employee Info">
              <div>{lbl('Full Name *')}<input className={inp} value={form.employee_full_name} onChange={e => setField('employee_full_name', e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>{lbl('National ID / Passport')}<input className={inp} value={form.employee_national_id} onChange={e => setField('employee_national_id', e.target.value)} /></div>
                <div>{lbl('Nationality')}<input className={inp} value={form.employee_nationality} onChange={e => setField('employee_nationality', e.target.value)} /></div>
                <div>{lbl('Phone')}<input className={inp} value={form.employee_phone} onChange={e => setField('employee_phone', e.target.value)} /></div>
                <div>{lbl('Email')}<input className={inp} value={form.employee_email} onChange={e => setField('employee_email', e.target.value)} /></div>
                <div>{lbl('Marital Status')}<select className={inp} value={form.employee_marital_status} onChange={e => setField('employee_marital_status', e.target.value)}>{DOCS_MARITAL_STATUSES.map(s => <option key={s}>{s}</option>)}</select></div>
              </div>
              <div>{lbl('Address')}<input className={inp} value={form.employee_address} onChange={e => setField('employee_address', e.target.value)} /></div>
            </Sec>

            <Sec title="Job Details">
              <div className="grid grid-cols-2 gap-3">
                <div>{lbl('Job Title')}<input className={inp} value={form.job_title} onChange={e => setField('job_title', e.target.value)} /></div>
                <div>{lbl('Department')}<input className={inp} value={form.department} onChange={e => setField('department', e.target.value)} /></div>
                <div>{lbl('Direct Manager')}<input className={inp} value={form.direct_manager} onChange={e => setField('direct_manager', e.target.value)} /></div>
                <div>{lbl('Employment Type')}<select className={inp} value={form.employment_type} onChange={e => setField('employment_type', e.target.value)}>{DOCS_EMPLOYMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
              </div>
            </Sec>

            <Sec title="Employment Terms">
              <div className="grid grid-cols-2 gap-3">
                <div>{lbl('Start Date')}<input type="date" className={inp} value={form.start_date} onChange={e => setField('start_date', e.target.value)} /></div>
                <div>{lbl('Contract Duration')}<input className={inp} value={form.contract_duration} onChange={e => setField('contract_duration', e.target.value)} /></div>
                <div>{lbl('Probation Period')}<input className={inp} value={form.probation_period} onChange={e => setField('probation_period', e.target.value)} /></div>
                <div>{lbl('Workplace')}<input className={inp} value={form.workplace} onChange={e => setField('workplace', e.target.value)} /></div>
              </div>
            </Sec>

            <Sec title="Salary & Benefits">
              <div className="grid grid-cols-2 gap-3">
                <div>{lbl('Salary')}<input type="number" min={0} className={inp} value={form.salary} onChange={e => setField('salary', Number(e.target.value))} /></div>
                <div>{lbl('Payment Method')}<select className={inp} value={form.payment_method} onChange={e => setField('payment_method', e.target.value)}>{DOCS_PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}</select></div>
                <div>{lbl('Payment Date')}<input className={inp} value={form.payment_date} onChange={e => setField('payment_date', e.target.value)} /></div>
              </div>
              <div>
                {lbl('Benefits')}
                <div className="flex gap-2 mb-2">
                  <input className={inp} placeholder="Add benefit…" value={newBenefit} onChange={e => setNewBenefit(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && newBenefit.trim()) { setField('benefits', [...form.benefits, newBenefit.trim()]); setNewBenefit(''); }}} />
                  <button onClick={() => { if (newBenefit.trim()) { setField('benefits', [...form.benefits, newBenefit.trim()]); setNewBenefit(''); }}} className="px-3 py-1.5 text-sm rounded-lg" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}><Plus size={14} /></button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {form.benefits.map((b, i) => (
                    <span key={i} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs" style={{ background: 'var(--surface-2)', color: 'var(--text)' }}>
                      {b}<button onClick={() => setField('benefits', form.benefits.filter((_,ii) => ii !== i))}><Trash2 size={10} style={{ color: '#ef4444' }} /></button>
                    </span>
                  ))}
                </div>
              </div>
            </Sec>

            <Sec title="Working Hours">
              <div className="grid grid-cols-3 gap-3">
                <div>{lbl('Daily Hours')}<input type="number" min={1} max={24} className={inp} value={form.daily_hours} onChange={e => setField('daily_hours', Number(e.target.value))} /></div>
                <div>{lbl('Annual Leave (days)')}<input type="number" min={0} className={inp} value={form.annual_leave} onChange={e => setField('annual_leave', Number(e.target.value))} /></div>
                <div className="col-span-1">{lbl('Work Days')}<input className={inp} value={form.work_days} onChange={e => setField('work_days', e.target.value)} /></div>
              </div>
            </Sec>

            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Legal Clauses</h3>
                <button onClick={() => setField('legal_clauses', [...form.legal_clauses, { id: uid(), title: '', content: '' }])} className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}><Plus size={12} /> Add</button>
              </div>
              {form.legal_clauses.map((cl, i) => (
                <div key={cl.id} className="border rounded-lg p-3 mb-3" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <input className="flex-1 px-2 py-1 text-sm font-semibold rounded border outline-none" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }} placeholder="Clause title" value={cl.title} onChange={e => { const cls = [...form.legal_clauses]; cls[i] = { ...cl, title: e.target.value }; setField('legal_clauses', cls); }} />
                    <button onClick={() => setField('legal_clauses', form.legal_clauses.filter((_,ii) => ii !== i))}><Trash2 size={13} style={{ color: '#ef4444' }} /></button>
                  </div>
                  <textarea className="w-full px-2 py-1 text-sm rounded border outline-none" rows={3} style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }} placeholder="Clause content…" value={cl.content} onChange={e => { const cls = [...form.legal_clauses]; cls[i] = { ...cl, content: e.target.value }; setField('legal_clauses', cls); }} />
                </div>
              ))}
            </section>

            <Sec title="Signatures">
              <div className="grid grid-cols-2 gap-3">
                <div>{lbl('Company Representative')}<input className={inp} value={form.sig_company_rep} onChange={e => setField('sig_company_rep', e.target.value)} /></div>
                <div>{lbl('Employee Name')}<input className={inp} value={form.sig_employee_name} onChange={e => setField('sig_employee_name', e.target.value)} /></div>
                <div>{lbl('Signature Date')}<input type="date" className={inp} value={form.sig_date} onChange={e => setField('sig_date', e.target.value)} /></div>
                <div>{lbl('Place')}<input className={inp} value={form.sig_place} onChange={e => setField('sig_place', e.target.value)} /></div>
              </div>
            </Sec>

            <div className="pb-4">
              <button onClick={save} disabled={saving} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60" style={{ background: 'var(--accent)' }}>
                {saved ? <><Check size={16} /> Saved!</> : saving ? 'Saving…' : <><Save size={16} /> {editingId ? 'Update Contract' : 'Save Contract'}</>}
              </button>
            </div>
          </div>
        ) : (
          <HistoryPanel contracts={contracts} loading={loading} onEdit={loadIntoForm} onDuplicate={c => { loadIntoForm(c); setEditingId(null); setField('contract_number', nextNum(contracts)); setField('status', 'draft'); }} onDelete={deleteC} onReload={load} onBackup={handleBackup} onClearAll={handleClearAll} onRestoreData={handleRestoreData} />
        )}
      </div>

      <div className="hidden lg:flex flex-1 items-start justify-center p-6 overflow-auto" style={{ background: 'var(--surface-2)' }}>
        <div className="fixed right-6 bottom-6 flex flex-col gap-2 z-50">
          <button onClick={() => printPreviewDocument('hr-contract-preview', form.contract_number, 'hr-contract')} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-lg" style={{ background: '#0f172a' }}><Printer size={15} /> PDF</button>
          <button onClick={() => { const html = document.getElementById('hr-contract-preview')?.outerHTML ?? ''; const blob = new Blob([`<html><body>${html}</body></html>`], { type: 'application/msword' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${form.contract_number}.doc`; a.click(); }} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-lg" style={{ background: '#475569' }}><Download size={15} /> Word / DOC</button>
        </div>
        <div className="bg-white shadow-2xl rounded-sm" style={{ width: 794, minHeight: 1123 }}>
          <HrContractPreview form={form} />
        </div>
      </div>

    </div>
  );
}
