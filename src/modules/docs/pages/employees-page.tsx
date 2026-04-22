'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  Plus, Trash2, Save, Edit2, Search, Download, X, Check, ChevronUp, ChevronDown,
} from 'lucide-react';
import clsx from 'clsx';
import type { DocsEmployee, DocsSalaryAdjustment } from '@/lib/docs-types';
import { DOCS_EMPLOYMENT_TYPES, DOCS_MARITAL_STATUSES } from '@/lib/docs-types';
import ClientProfileSelector from '@/components/docs/ClientProfileSelector';
import type { DocsClientProfile } from '@/lib/docs-client-profiles';
import { fetchDocsClientProfiles, sanitizeDocCode } from '@/lib/docs-client-profiles';
import { DocsDateField } from '@/components/docs/DocsUi';

function today() { return new Date().toISOString().slice(0, 10); }
function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(n);
}
function uid() { return Math.random().toString(36).slice(2, 10); }
function nextEmpId(list: DocsEmployee[]) {
  const nums = list.map(e => parseInt(e.employee_id.replace(/\D/g, '') || '0')).filter(Boolean);
  return `EMP-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(4, '0')}`;
}

type Tab = 'overview' | 'employees' | 'payroll';
type StatusF = 'all' | 'active' | 'inactive' | 'terminated';
type TypeF   = 'all' | 'full_time' | 'part_time' | 'contract' | 'freelance';

// ── Employee form ─────────────────────────────────────────────────────────────

interface EmpForm {
  employee_id: string; full_name: string; date_of_birth: string;
  phone: string; address: string; job_title: string;
  employment_type: string; hire_date: string; status: string;
  daily_hours: number; contract_duration: string; salary: number;
}

function blankEmp(id: string): EmpForm {
  return {
    employee_id: id, full_name: '', date_of_birth: '', phone: '', address: '',
    job_title: '', employment_type: 'full_time', hire_date: today(),
    status: 'active', daily_hours: 8, contract_duration: '', salary: 0,
  };
}

// ── Salary Adjustment modal ───────────────────────────────────────────────────

function SalaryModal({ employee, onClose, onDone }: {
  employee: DocsEmployee; onClose: () => void; onDone: () => void;
}) {
  const [newSalary, setNewSalary] = useState(employee.salary);
  const [note, setNote]           = useState('');
  const [effDate, setEffDate]     = useState(today());
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');

  async function submit() {
    if (newSalary < 0) { setError('Salary cannot be negative'); return; }
    setSaving(true); setError('');
    try {
      const res = await fetch(`/api/docs/employees/${employee.id}/salary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_salary: newSalary, effective_date: effDate, notes: note }),
      });
      if (!res.ok) { setError((await res.json()).error ?? 'Failed'); return; }
      onDone();
      onClose();
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="rounded-2xl shadow-xl p-6 w-full max-w-md" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>Update Salary — {employee.full_name}</h2>
          <button onClick={onClose}><X size={18} style={{ color: 'var(--text-secondary)' }} /></button>
        </div>
        {error && <div className="mb-3 px-3 py-2 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.08)', color: '#dc2626' }}>{error}</div>}
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Current Salary</label>
            <div className="text-sm font-bold" style={{ color: 'var(--text)' }}>SAR {fmt(employee.salary)}</div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>New Salary</label>
            <input type="number" min={0} className="w-full px-3 py-1.5 text-sm rounded-lg border outline-none" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }} value={newSalary} onChange={e => setNewSalary(Number(e.target.value))} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Effective Date</label>
            <input type="date" className="w-full px-3 py-1.5 text-sm rounded-lg border outline-none" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }} value={effDate} onChange={e => setEffDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Notes</label>
            <textarea className="w-full px-3 py-1.5 text-sm rounded-lg border outline-none" rows={2} style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }} value={note} onChange={e => setNote(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-3 mt-4">
          <button onClick={onClose} className="flex-1 py-2 text-sm rounded-xl border" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>Cancel</button>
          <button onClick={submit} disabled={saving} className="flex-1 py-2 text-sm rounded-xl font-semibold text-white" style={{ background: 'var(--accent)' }}>
            {saving ? 'Saving…' : 'Update Salary'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Employee modal (add/edit) ─────────────────────────────────────────────────

function EmployeeModal({ initial, onClose, onDone, employees }: {
  initial?: DocsEmployee; onClose: () => void; onDone: () => void;
  employees: DocsEmployee[];
}) {
  const [form, setForm]   = useState<EmpForm>(() =>
    initial ? {
      employee_id: initial.employee_id, full_name: initial.full_name,
      date_of_birth: initial.date_of_birth ?? '', phone: initial.phone ?? '',
      address: initial.address ?? '', job_title: initial.job_title ?? '',
      employment_type: initial.employment_type, hire_date: initial.hire_date ?? today(),
      status: initial.status, daily_hours: initial.daily_hours,
      contract_duration: initial.contract_duration ?? '', salary: initial.salary,
    } : blankEmp(nextEmpId(employees))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  function setF<K extends keyof EmpForm>(k: K, v: EmpForm[K]) { setForm(f => ({ ...f, [k]: v })); }

  async function submit() {
    if (!form.full_name.trim()) { setError('Full name is required'); return; }
    setSaving(true); setError('');
    try {
      const url = initial ? `/api/docs/employees/${initial.id}` : '/api/docs/employees';
      const res = await fetch(url, {
        method: initial ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) { setError((await res.json()).error ?? 'Save failed'); return; }
      onDone(); onClose();
    } finally { setSaving(false); }
  }

  const inp = 'w-full px-3 py-1.5 text-sm rounded-lg border outline-none bg-[var(--surface-2)] border-[var(--border)] text-[var(--text)]';
  const lbl = (l: string) => <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{l}</label>;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 overflow-auto py-6">
      <div className="rounded-2xl shadow-xl p-6 w-full max-w-2xl m-auto" style={{ background: 'var(--surface)' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>{initial ? 'Edit Employee' : 'Add Employee'}</h2>
          <button onClick={onClose}><X size={18} style={{ color: 'var(--text-secondary)' }} /></button>
        </div>
        {error && <div className="mb-3 px-3 py-2 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.08)', color: '#dc2626' }}>{error}</div>}
        <div className="grid grid-cols-2 gap-3">
          <div>{lbl('Employee ID')}<input className={inp} value={form.employee_id} onChange={e => setF('employee_id', e.target.value)} /></div>
          <div>{lbl('Full Name *')}<input className={inp} value={form.full_name} onChange={e => setF('full_name', e.target.value)} /></div>
          <div>{lbl('Job Title')}<input className={inp} value={form.job_title} onChange={e => setF('job_title', e.target.value)} /></div>
          <div>{lbl('Employment Type')}<select className={inp} value={form.employment_type} onChange={e => setF('employment_type', e.target.value)}>{DOCS_EMPLOYMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
          <div>{lbl('Hire Date')}<input type="date" className={inp} value={form.hire_date} onChange={e => setF('hire_date', e.target.value)} /></div>
          <div>{lbl('Status')}<select className={inp} value={form.status} onChange={e => setF('status', e.target.value)}><option value="active">Active</option><option value="inactive">Inactive</option><option value="terminated">Terminated</option></select></div>
          <div>{lbl('Phone')}<input className={inp} value={form.phone} onChange={e => setF('phone', e.target.value)} /></div>
          <div>{lbl('Date of Birth')}<input type="date" className={inp} value={form.date_of_birth} onChange={e => setF('date_of_birth', e.target.value)} /></div>
          <div>{lbl('Salary (SAR/month)')}<input type="number" min={0} className={inp} value={form.salary} onChange={e => setF('salary', Number(e.target.value))} /></div>
          <div>{lbl('Daily Hours')}<input type="number" min={1} max={24} className={inp} value={form.daily_hours} onChange={e => setF('daily_hours', Number(e.target.value))} /></div>
          <div>{lbl('Contract Duration')}<input className={inp} value={form.contract_duration} onChange={e => setF('contract_duration', e.target.value)} /></div>
          <div className="col-span-2">{lbl('Address')}<input className={inp} value={form.address} onChange={e => setF('address', e.target.value)} /></div>
        </div>
        <div className="flex gap-3 mt-4">
          <button onClick={onClose} className="flex-1 py-2 text-sm rounded-xl border" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>Cancel</button>
          <button onClick={submit} disabled={saving} className="flex-1 py-2 text-sm rounded-xl font-semibold text-white disabled:opacity-60" style={{ background: 'var(--accent)' }}>
            {saving ? 'Saving…' : initial ? 'Update' : 'Add Employee'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function EmployeesPage() {
  const [employees, setEmployees]   = useState<DocsEmployee[]>([]);
  const [loading, setLoading]       = useState(true);
  const [tab, setTab]               = useState<Tab>('overview');
  const [search, setSearch]         = useState('');
  const [statusF, setStatusF]       = useState<StatusF>('all');
  const [typeF, setTypeF]           = useState<TypeF>('all');
  const [addModal, setAddModal]     = useState(false);
  const [editModal, setEditModal]   = useState<DocsEmployee | null>(null);
  const [salaryModal, setSalaryModal] = useState<DocsEmployee | null>(null);
  const [payrollMonth, setPayrollMonth] = useState(new Date().toISOString().slice(0, 7));
  const [profiles, setProfiles] = useState<DocsClientProfile[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusF !== 'all') params.set('status', statusF);
      if (typeF !== 'all')   params.set('employment_type', typeF);
      if (search)            params.set('search', search);
      const r = await fetch(`/api/docs/employees?${params}`);
      const j = await r.json();
      setEmployees(j.employees ?? []);
    } finally { setLoading(false); }
  }, [search, statusF, typeF]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { fetchDocsClientProfiles().then(setProfiles).catch(() => null); }, []);
  const selectedProfile = profiles.find(p => p.client_id === selectedClientId) ?? null;

  async function deleteEmp(id: string) {
    if (!confirm('Delete this employee? All salary history will also be deleted.')) return;
    await fetch(`/api/docs/employees/${id}`, { method: 'DELETE' });
    await load();
  }

  function exportPayrollCSV() {
    const payrollCodeBase = selectedProfile?.client_slug || selectedProfile?.client_name || 'payroll';
    const documentCode = sanitizeDocCode(payrollCodeBase, 'payroll');
    window.open(
      `/api/docs/employees/payroll-export?month=${encodeURIComponent(payrollMonth)}&document_code=${encodeURIComponent(documentCode)}`,
      '_blank',
      'noopener,noreferrer',
    );
  }

  const visible = employees.filter(e => {
    if (statusF !== 'all' && e.status !== statusF) return false;
    if (typeF !== 'all' && e.employment_type !== typeF) return false;
    if (search && !e.full_name.toLowerCase().includes(search.toLowerCase()) &&
        !e.employee_id.toLowerCase().includes(search.toLowerCase()) &&
        !(e.job_title ?? '').toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const activeCount = employees.filter(e => e.status === 'active').length;
  const totalPayroll = employees.filter(e => e.status === 'active').reduce((s, e) => s + e.salary, 0);
  const fullTimeCount = employees.filter(e => e.employment_type === 'full_time').length;
  const contractCount = employees.filter(e => e.employment_type === 'contract' || e.employment_type === 'freelance').length;

  const statusColor = (s: string) => s === 'active' ? { bg: 'rgba(22,163,74,0.1)', color: '#16a34a' } : s === 'inactive' ? { bg: 'rgba(234,179,8,0.1)', color: '#ca8a04' } : { bg: 'rgba(239,68,68,0.08)', color: '#ef4444' };

  return (
    <div className="docs-app flex flex-col h-full overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b shrink-0 px-6" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        {([['overview','Overview'],['employees','Employees'],['payroll','Payroll']] as [Tab, string][]).map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)} className={clsx('py-3 px-4 text-sm font-medium border-b-2 transition-colors', tab === t ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text)]')}>{l}</button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* ── Overview ─────────────────────────────────────────────────────── */}
        {tab === 'overview' && (
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                ['Total Employees', String(employees.length), '#d97706'],
                ['Active', String(activeCount), '#059669'],
                ['Full-Time', String(fullTimeCount), '#2563eb'],
                ['Monthly Payroll', `SAR ${fmt(totalPayroll)}`, '#7c3aed'],
              ].map(([l,v,c]) => (
                <div key={l} className="rounded-2xl p-5 border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                  <div className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>{l}</div>
                  <div className="text-xl font-bold" style={{ color: c }}>{v}</div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-2xl p-5 border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text)' }}>By Employment Type</h3>
                {DOCS_EMPLOYMENT_TYPES.map(t => {
                  const cnt = employees.filter(e => e.employment_type === t.value).length;
                  const pct = employees.length ? Math.round(cnt / employees.length * 100) : 0;
                  return (
                    <div key={t.value} className="flex items-center gap-3 mb-2">
                      <span className="text-sm w-24" style={{ color: 'var(--text)' }}>{t.label}</span>
                      <div className="flex-1 h-2 rounded-full" style={{ background: 'var(--surface-2)' }}>
                        <div className="h-2 rounded-full" style={{ width: `${pct}%`, background: 'var(--accent)' }} />
                      </div>
                      <span className="text-sm w-8 text-right font-semibold" style={{ color: 'var(--text-secondary)' }}>{cnt}</span>
                    </div>
                  );
                })}
              </div>
              <div className="rounded-2xl p-5 border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text)' }}>Recent Hires</h3>
                {employees.sort((a, b) => (b.hire_date ?? '').localeCompare(a.hire_date ?? '')).slice(0, 5).map(e => (
                  <div key={e.id} className="flex items-center justify-between py-1.5">
                    <div>
                      <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>{e.full_name}</div>
                      <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{e.job_title ?? '—'} · {e.hire_date ?? '—'}</div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ ...statusColor(e.status) }}>{e.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Employees list ────────────────────────────────────────────────── */}
        {tab === 'employees' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-secondary)' }} />
                  <input className="pl-8 pr-3 py-1.5 text-sm rounded-lg border outline-none" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)', width: 220 }} placeholder="Search employees…" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <select className="px-2 py-1.5 text-sm rounded-lg border outline-none" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }} value={statusF} onChange={e => setStatusF(e.target.value as StatusF)}>
                  <option value="all">All Statuses</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="terminated">Terminated</option>
                </select>
                <select className="px-2 py-1.5 text-sm rounded-lg border outline-none" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }} value={typeF} onChange={e => setTypeF(e.target.value as TypeF)}>
                  <option value="all">All Types</option>{DOCS_EMPLOYMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <button onClick={() => setAddModal(true)} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl text-white" style={{ background: 'var(--accent)' }}><Plus size={16} /> Add Employee</button>
            </div>

            <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'var(--surface)', borderBottom: `1px solid var(--border)` }}>
                    <th className="text-left px-4 py-3 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Employee</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Job Title</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Type</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Status</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Salary</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && <tr><td colSpan={6} className="text-center py-8 text-sm" style={{ color: 'var(--text-secondary)' }}>Loading…</td></tr>}
                  {!loading && visible.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-sm" style={{ color: 'var(--text-secondary)' }}>No employees found</td></tr>}
                  {visible.map(e => (
                    <tr key={e.id} className="hover:bg-[var(--surface-2)] transition-colors border-t" style={{ borderColor: 'var(--border)' }}>
                      <td className="px-4 py-3">
                        <div className="font-medium" style={{ color: 'var(--text)' }}>{e.full_name}</div>
                        <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{e.employee_id} · {e.phone ?? '—'}</div>
                      </td>
                      <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{e.job_title ?? '—'}</td>
                      <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{DOCS_EMPLOYMENT_TYPES.find(t => t.value === e.employment_type)?.label ?? e.employment_type}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ ...statusColor(e.status) }}>{e.status}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold" style={{ color: 'var(--text)' }}>SAR {fmt(e.salary)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => setSalaryModal(e)} className="p-1.5 rounded-lg hover:bg-[var(--accent-soft)]" title="Update salary"><ChevronUp size={14} style={{ color: 'var(--accent)' }} /></button>
                          <button onClick={() => setEditModal(e)} className="p-1.5 rounded-lg hover:bg-[var(--accent-soft)]"><Edit2 size={13} style={{ color: 'var(--accent)' }} /></button>
                          <button onClick={() => deleteEmp(e.id)} className="p-1.5 rounded-lg hover:bg-red-50"><Trash2 size={13} style={{ color: '#ef4444' }} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Payroll ───────────────────────────────────────────────────────── */}
        {tab === 'payroll' && (
          <div className="p-6 space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>Payroll Sheet</h2>
                <DocsDateField value={payrollMonth} onChange={setPayrollMonth} mode="month" placeholder="Payroll month" />
              </div>
              <button onClick={exportPayrollCSV} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl text-white" style={{ background: '#0f172a' }}><Download size={15} /> Export CSV</button>
            </div>
            <ClientProfileSelector
              profiles={profiles}
              selectedClientId={selectedClientId}
              onSelectClientId={setSelectedClientId}
              label="Client context"
            />

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                ['Active Employees', String(activeCount), '#059669'],
                ['Total Payroll', `SAR ${fmt(totalPayroll)}`, '#7c3aed'],
                ['Avg. Salary', `SAR ${fmt(activeCount > 0 ? totalPayroll / activeCount : 0)}`, '#d97706'],
              ].map(([l,v,c]) => (
                <div key={l} className="rounded-2xl p-5 border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                  <div className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>{l}</div>
                  <div className="text-xl font-bold" style={{ color: c }}>{v}</div>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'var(--surface)', borderBottom: `1px solid var(--border)` }}>
                    <th className="text-left px-4 py-3 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Employee</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Job Title</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Daily Hours</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Monthly Salary</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Salary History</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.filter(e => e.status === 'active').map(e => {
                    const adjustments = (e.salary_adjustments ?? []) as DocsSalaryAdjustment[];
                    const latest = adjustments[0];
                    return (
                      <tr key={e.id} className="hover:bg-[var(--surface-2)] border-t" style={{ borderColor: 'var(--border)' }}>
                        <td className="px-4 py-3">
                          <div className="font-medium" style={{ color: 'var(--text)' }}>{e.full_name}</div>
                          <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{e.employee_id}</div>
                        </td>
                        <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{e.job_title ?? '—'}</td>
                        <td className="px-4 py-3 text-right" style={{ color: 'var(--text)' }}>{e.daily_hours}h</td>
                        <td className="px-4 py-3 text-right font-bold" style={{ color: '#7c3aed' }}>SAR {fmt(e.salary)}</td>
                        <td className="px-4 py-3">
                          {latest && (
                            <div className="text-xs">
                              <span className={clsx('font-semibold', latest.change_type === 'increase' ? 'text-green-600' : latest.change_type === 'decrease' ? 'text-red-500' : 'text-gray-500')}>
                                {latest.change_type === 'increase' ? '↑' : latest.change_type === 'decrease' ? '↓' : '●'} {latest.change_type}
                              </span>
                              <span className="ml-1" style={{ color: 'var(--text-secondary)' }}>{latest.effective_date ?? '—'}</span>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: 'var(--surface)', borderTop: `2px solid var(--border)` }}>
                    <td colSpan={3} className="px-4 py-3 text-sm font-bold" style={{ color: 'var(--text)' }}>Total Payroll</td>
                    <td className="px-4 py-3 text-right text-sm font-bold" style={{ color: '#7c3aed' }}>SAR {fmt(totalPayroll)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>

      {addModal && <EmployeeModal employees={employees} onClose={() => setAddModal(false)} onDone={load} />}
      {editModal && <EmployeeModal employees={employees} initial={editModal} onClose={() => setEditModal(null)} onDone={load} />}
      {salaryModal && <SalaryModal employee={salaryModal} onClose={() => setSalaryModal(null)} onDone={load} />}
    </div>
  );
}
