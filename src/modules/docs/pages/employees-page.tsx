'use client';

import { useState, useCallback, useEffect } from 'react';
import { Plus, Trash2, Edit2, Search, Download, ChevronUp } from 'lucide-react';
import clsx from 'clsx';
import {
  type DocsEmployee,
  type DocsSalaryAdjustment,
  DOCS_EMPLOYMENT_TYPES,
} from '@/lib/docs-types';
import ClientProfileSelector from '@/components/docs/ClientProfileSelector';
import {
  type DocsClientProfile,
  fetchDocsClientProfiles,
  sanitizeDocCode,
} from '@/lib/docs-client-profiles';
import { DocsDateField } from '@/components/docs/DocsUi';
import AppModal from '@/components/ui/AppModal';
import SelectDropdown from '@/components/ui/SelectDropdown';
import ConfirmDialog from '@/components/ui/actions/ConfirmDialog';
import {
  DocsDocTypeTabs,
  DocsEditorCard,
  DocsToolbarLayout,
  DocsWorkspaceShell,
} from '@/components/docs/DocsWorkspace';
import { useLang } from '@/context/lang-context';

type DocsT = (key: string, vars?: Record<string, string | number>) => string;

function employmentTypeLabel(value: string, t: DocsT) {
  const m: Record<string, string> = {
    full_time: t('docEmpTypeFullTime'),
    part_time: t('docEmpTypePartTime'),
    contract: t('docEmpTypeContract'),
    freelance: t('docEmpTypeFreelance'),
  };
  return m[value] ?? value;
}

function employeeStatusLabel(s: string, t: DocsT) {
  const m: Record<string, string> = {
    active: t('active'),
    inactive: t('inactive'),
    terminated: t('docEmpTerminated'),
  };
  return m[s] ?? s;
}

function salaryChangeLabel(type: string, t: DocsT) {
  const k = type.toLowerCase();
  if (k === 'increase') return t('docEmpChangeIncrease');
  if (k === 'decrease') return t('docEmpChangeDecrease');
  return t('docEmpChangeAdjustment');
}

function today() {
  return new Date().toISOString().slice(0, 10);
}
function fmtMoney(n: number, lang: 'en' | 'ar') {
  return new Intl.NumberFormat(lang === 'ar' ? 'ar-SA' : 'en-US', {
    minimumFractionDigits: 2,
  }).format(n);
}
function nextEmpId(list: DocsEmployee[]) {
  const nums = list.map((e) => parseInt(e.employee_id.replace(/\D/g, '') || '0')).filter(Boolean);
  return `EMP-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(4, '0')}`;
}

type Tab = 'overview' | 'employees' | 'payroll';
type StatusF = 'all' | 'active' | 'inactive' | 'terminated';
type TypeF = 'all' | 'full_time' | 'part_time' | 'contract' | 'freelance';

// ── Employee form ─────────────────────────────────────────────────────────────

interface EmpForm {
  employee_id: string;
  full_name: string;
  date_of_birth: string;
  phone: string;
  address: string;
  job_title: string;
  employment_type: string;
  hire_date: string;
  status: string;
  daily_hours: number;
  contract_duration: string;
  salary: number;
}

function blankEmp(id: string): EmpForm {
  return {
    employee_id: id,
    full_name: '',
    date_of_birth: '',
    phone: '',
    address: '',
    job_title: '',
    employment_type: 'full_time',
    hire_date: today(),
    status: 'active',
    daily_hours: 8,
    contract_duration: '',
    salary: 0,
  };
}

// ── Salary Adjustment modal ───────────────────────────────────────────────────

function SalaryModal({
  employee,
  onClose,
  onDone,
}: {
  employee: DocsEmployee;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t, lang } = useLang();
  const [newSalary, setNewSalary] = useState(employee.salary);
  const [note, setNote] = useState('');
  const [effDate, setEffDate] = useState(today());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (newSalary < 0) {
      setError(t('docEmpSalaryNegative'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/docs/employees/${employee.id}/salary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_salary: newSalary, effective_date: effDate, notes: note }),
      });
      if (!res.ok) {
        setError((await res.json()).error ?? t('docEmpFailed'));
        return;
      }
      onDone();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppModal
      open
      onClose={onClose}
      title={t('docEmpSalaryModalTitle', { name: employee.full_name })}
      size="sm"
      bodyClassName="space-y-3"
      footer={
        <>
          <button onClick={onClose} className="openy-modal-btn-secondary flex-1">
            {t('cancel')}
          </button>
          <button onClick={submit} disabled={saving} className="openy-modal-btn-primary flex-1">
            {saving ? t('docCommonSaving') : t('docEmpUpdateSalary')}
          </button>
        </>
      }
    >
      {error && (
        <div
          className="mb-3 rounded-lg px-3 py-2 text-sm"
          style={{ background: 'rgba(239,68,68,0.08)', color: '#dc2626' }}
        >
          {error}
        </div>
      )}
      <div>
        <label
          className="mb-1 block text-xs font-medium"
          style={{ color: 'var(--text-secondary)' }}
        >
          {t('docEmpCurrentSalary')}
        </label>
        <div className="text-sm font-bold" style={{ color: 'var(--text)' }}>
          {t('docCurrencySar')} {fmtMoney(employee.salary, lang)}
        </div>
      </div>
      <div>
        <label
          className="mb-1 block text-xs font-medium"
          style={{ color: 'var(--text-secondary)' }}
        >
          {t('docEmpNewSalary')}
        </label>
        <input
          type="number"
          min={0}
          className="w-full rounded-lg border px-3 py-1.5 text-sm outline-none"
          style={{
            background: 'var(--surface-2)',
            borderColor: 'var(--border)',
            color: 'var(--text)',
          }}
          value={newSalary}
          onChange={(e) => setNewSalary(Number(e.target.value))}
        />
      </div>
      <div>
        <label
          className="mb-1 block text-xs font-medium"
          style={{ color: 'var(--text-secondary)' }}
        >
          {t('docEmpEffectiveDate')}
        </label>
        <input
          type="date"
          className="w-full rounded-lg border px-3 py-1.5 text-sm outline-none"
          style={{
            background: 'var(--surface-2)',
            borderColor: 'var(--border)',
            color: 'var(--text)',
          }}
          value={effDate}
          onChange={(e) => setEffDate(e.target.value)}
        />
      </div>
      <div>
        <label
          className="mb-1 block text-xs font-medium"
          style={{ color: 'var(--text-secondary)' }}
        >
          {t('notes')}
        </label>
        <textarea
          className="w-full rounded-lg border px-3 py-1.5 text-sm outline-none"
          rows={2}
          style={{
            background: 'var(--surface-2)',
            borderColor: 'var(--border)',
            color: 'var(--text)',
          }}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
    </AppModal>
  );
}

// ── Employee modal (add/edit) ─────────────────────────────────────────────────

function EmployeeModal({
  initial,
  onClose,
  onDone,
  employees,
}: {
  initial?: DocsEmployee;
  onClose: () => void;
  onDone: () => void;
  employees: DocsEmployee[];
}) {
  const { t } = useLang();
  const [form, setForm] = useState<EmpForm>(() =>
    initial
      ? {
          employee_id: initial.employee_id,
          full_name: initial.full_name,
          date_of_birth: initial.date_of_birth ?? '',
          phone: initial.phone ?? '',
          address: initial.address ?? '',
          job_title: initial.job_title ?? '',
          employment_type: initial.employment_type,
          hire_date: initial.hire_date ?? today(),
          status: initial.status,
          daily_hours: initial.daily_hours,
          contract_duration: initial.contract_duration ?? '',
          salary: initial.salary,
        }
      : blankEmp(nextEmpId(employees)),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function setF<K extends keyof EmpForm>(k: K, v: EmpForm[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit() {
    if (!form.full_name.trim()) {
      setError(t('docEmpFullNameRequired'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      const url = initial ? `/api/docs/employees/${initial.id}` : '/api/docs/employees';
      const res = await fetch(url, {
        method: initial ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        setError((await res.json()).error ?? t('docQtSaveFailed'));
        return;
      }
      onDone();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const inp =
    'w-full px-3 py-1.5 text-sm rounded-lg border outline-none bg-[var(--surface-2)] border-[var(--border)] text-[var(--text)]';
  const lbl = (l: string) => (
    <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
      {l}
    </label>
  );

  return (
    <AppModal
      open
      onClose={onClose}
      title={initial ? t('docEmpEditEmployee') : t('docEmpAddEmployee')}
      size="lg"
      bodyClassName="space-y-4"
      footer={
        <>
          <button onClick={onClose} className="openy-modal-btn-secondary flex-1">
            {t('cancel')}
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="openy-modal-btn-primary flex-1 disabled:opacity-60"
          >
            {saving ? t('docCommonSaving') : initial ? t('docQtUpdate') : t('docEmpAddEmployeeBtn')}
          </button>
        </>
      }
    >
      {error && (
        <div
          className="mb-3 rounded-lg px-3 py-2 text-sm"
          style={{ background: 'rgba(239,68,68,0.08)', color: '#dc2626' }}
        >
          {error}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          {lbl(t('docEmpEmployeeId'))}
          <input
            className={inp}
            value={form.employee_id}
            onChange={(e) => setF('employee_id', e.target.value)}
          />
        </div>
        <div>
          {lbl(t('docEmpFullNameReq'))}
          <input
            className={inp}
            value={form.full_name}
            onChange={(e) => setF('full_name', e.target.value)}
          />
        </div>
        <div>
          {lbl(t('docEmpColJobTitle'))}
          <input
            className={inp}
            value={form.job_title}
            onChange={(e) => setF('job_title', e.target.value)}
          />
        </div>
        <div>
          {lbl(t('docEmpEmploymentType'))}
          <SelectDropdown
            fullWidth
            className={inp}
            value={form.employment_type}
            onChange={(v) => setF('employment_type', v)}
            options={DOCS_EMPLOYMENT_TYPES.map((et) => ({
              value: et.value,
              label: employmentTypeLabel(et.value, t),
            }))}
          />
        </div>
        <div>
          {lbl(t('docEmpHireDate'))}
          <input
            type="date"
            className={inp}
            value={form.hire_date}
            onChange={(e) => setF('hire_date', e.target.value)}
          />
        </div>
        <div>
          {lbl(t('status'))}
          <SelectDropdown
            fullWidth
            className={inp}
            value={form.status}
            onChange={(v) => setF('status', v)}
            options={[
              { value: 'active', label: t('active') },
              { value: 'inactive', label: t('inactive') },
              { value: 'terminated', label: t('docEmpTerminated') },
            ]}
          />
        </div>
        <div>
          {lbl(t('phone'))}
          <input
            className={inp}
            value={form.phone}
            onChange={(e) => setF('phone', e.target.value)}
          />
        </div>
        <div>
          {lbl(t('docEmpDob'))}
          <input
            type="date"
            className={inp}
            value={form.date_of_birth}
            onChange={(e) => setF('date_of_birth', e.target.value)}
          />
        </div>
        <div>
          {lbl(t('docEmpSalarySarMonth'))}
          <input
            type="number"
            min={0}
            className={inp}
            value={form.salary}
            onChange={(e) => setF('salary', Number(e.target.value))}
          />
        </div>
        <div>
          {lbl(t('docHrLblDailyHours'))}
          <input
            type="number"
            min={1}
            max={24}
            className={inp}
            value={form.daily_hours}
            onChange={(e) => setF('daily_hours', Number(e.target.value))}
          />
        </div>
        <div>
          {lbl(t('docHrLblContractDuration'))}
          <input
            className={inp}
            value={form.contract_duration}
            onChange={(e) => setF('contract_duration', e.target.value)}
          />
        </div>
        <div className="col-span-2">
          {lbl(t('docCcLblAddress'))}
          <input
            className={inp}
            value={form.address}
            onChange={(e) => setF('address', e.target.value)}
          />
        </div>
      </div>
    </AppModal>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function EmployeesPage() {
  const { t, lang } = useLang();
  const [employees, setEmployees] = useState<DocsEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('overview');
  const [search, setSearch] = useState('');
  const [statusF, setStatusF] = useState<StatusF>('all');
  const [typeF, setTypeF] = useState<TypeF>('all');
  const [addModal, setAddModal] = useState(false);
  const [editModal, setEditModal] = useState<DocsEmployee | null>(null);
  const [salaryModal, setSalaryModal] = useState<DocsEmployee | null>(null);
  const [payrollMonth, setPayrollMonth] = useState(new Date().toISOString().slice(0, 7));
  const [profiles, setProfiles] = useState<DocsClientProfile[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [pendingDeleteEmployee, setPendingDeleteEmployee] = useState<DocsEmployee | null>(null);
  const [deletingEmployee, setDeletingEmployee] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusF !== 'all') params.set('status', statusF);
      if (typeF !== 'all') params.set('employment_type', typeF);
      if (search) params.set('search', search);
      const r = await fetch(`/api/docs/employees?${params}`);
      const j = await r.json();
      setEmployees(j.employees ?? []);
    } finally {
      setLoading(false);
    }
  }, [search, statusF, typeF]);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    fetchDocsClientProfiles()
      .then(setProfiles)
      .catch(() => null);
  }, []);
  const selectedProfile = profiles.find((p) => p.client_id === selectedClientId) ?? null;

  async function deleteEmp() {
    if (!pendingDeleteEmployee) return;
    setDeletingEmployee(true);
    try {
      await fetch(`/api/docs/employees/${pendingDeleteEmployee.id}`, { method: 'DELETE' });
      setPendingDeleteEmployee(null);
      await load();
    } finally {
      setDeletingEmployee(false);
    }
  }

  function exportPayrollCSV() {
    const payrollCodeBase =
      selectedProfile?.client_slug || selectedProfile?.client_name || 'payroll';
    const documentCode = sanitizeDocCode(payrollCodeBase, 'payroll');
    window.open(
      `/api/docs/employees/payroll-export?month=${encodeURIComponent(payrollMonth)}&document_code=${encodeURIComponent(documentCode)}`,
      '_blank',
      'noopener,noreferrer',
    );
  }

  const visible = employees.filter((e) => {
    if (statusF !== 'all' && e.status !== statusF) return false;
    if (typeF !== 'all' && e.employment_type !== typeF) return false;
    if (
      search &&
      !e.full_name.toLowerCase().includes(search.toLowerCase()) &&
      !e.employee_id.toLowerCase().includes(search.toLowerCase()) &&
      !(e.job_title ?? '').toLowerCase().includes(search.toLowerCase())
    )
      return false;
    return true;
  });

  const activeCount = employees.filter((e) => e.status === 'active').length;
  const totalPayroll = employees
    .filter((e) => e.status === 'active')
    .reduce((s, e) => s + e.salary, 0);
  const fullTimeCount = employees.filter((e) => e.employment_type === 'full_time').length;
  const contractCount = employees.filter(
    (e) => e.employment_type === 'contract' || e.employment_type === 'freelance',
  ).length;

  const statusColor = (s: string) =>
    s === 'active'
      ? { bg: 'rgba(22,163,74,0.1)', color: '#16a34a' }
      : s === 'inactive'
        ? { bg: 'rgba(234,179,8,0.1)', color: '#ca8a04' }
        : { bg: 'rgba(239,68,68,0.08)', color: '#ef4444' };

  return (
    <>
      <DocsWorkspaceShell
        toolbar={
          <DocsToolbarLayout
            navigation={<DocsDocTypeTabs active="employees" />}
            actions={
              <>
                <DocsDateField
                  value={payrollMonth}
                  onChange={setPayrollMonth}
                  mode="month"
                  placeholder={t('docEmpPayrollMonth')}
                />
                <button
                  onClick={exportPayrollCSV}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
                  style={{ background: '#0f172a' }}
                >
                  <Download size={13} /> {t('docEmpExportCsv')}
                </button>
              </>
            }
          >
            <div className="docs-workspace-quickbar-grid">
              <div>
                <label>{t('docEmpSearchLabel')}</label>
                <input
                  className="docs-input"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('docEmpSearchPh')}
                />
              </div>
              <div>
                <label>{t('status')}</label>
                <SelectDropdown
                  fullWidth
                  className="docs-input"
                  value={statusF}
                  onChange={(v) => setStatusF(v as StatusF)}
                  options={[
                    { value: 'all', label: t('docEmpAllStatuses') },
                    { value: 'active', label: t('active') },
                    { value: 'inactive', label: t('inactive') },
                    { value: 'terminated', label: t('docEmpTerminated') },
                  ]}
                />
              </div>
              <div>
                <label>{t('docEmpEmploymentType')}</label>
                <SelectDropdown
                  fullWidth
                  className="docs-input"
                  value={typeF}
                  onChange={(v) => setTypeF(v as TypeF)}
                  options={[
                    { value: 'all', label: t('docEmpAllTypes') },
                    ...DOCS_EMPLOYMENT_TYPES.map((et) => ({
                      value: et.value,
                      label: employmentTypeLabel(et.value, t),
                    })),
                  ]}
                />
              </div>
              <div>
                <label>{t('docEmpClientContext')}</label>
                <ClientProfileSelector
                  profiles={profiles}
                  selectedClientId={selectedClientId}
                  onSelectClientId={setSelectedClientId}
                />
              </div>
              <div>
                <label>{t('docEmpWorkspace')}</label>
                <div className="flex gap-1.5">
                  {(
                    [
                      ['overview', t('docEmpTabOverview')],
                      ['employees', t('docEmpTabEmployees')],
                      ['payroll', t('docEmpTabPayroll')],
                    ] as [Tab, string][]
                  ).map(([tabId, tabLabel]) => (
                    <button
                      key={tabId}
                      type="button"
                      onClick={() => setTab(tabId)}
                      className={clsx('docs-tab', tab === tabId && 'docs-tab-active')}
                    >
                      {tabLabel}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </DocsToolbarLayout>
        }
        editor={
          <div className="overflow-y-auto pe-1">
            <div className="space-y-5">
              {/* ── Overview ─────────────────────────────────────────────────────── */}
              {tab === 'overview' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                    {[
                      [t('docEmpTotalEmployees'), String(employees.length), '#d97706'],
                      [t('docEmpPreviewActive'), String(activeCount), '#059669'],
                      [t('docEmpFullTime'), String(fullTimeCount), '#2563eb'],
                      [
                        t('docEmpMonthlyPayroll'),
                        `${t('docCurrencySar')} ${fmtMoney(totalPayroll, lang)}`,
                        '#7c3aed',
                      ],
                    ].map(([l, v, c]) => (
                      <div
                        key={l}
                        className="rounded-2xl border p-4"
                        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                      >
                        <div
                          className="mb-2 text-xs font-medium"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          {l}
                        </div>
                        <div className="text-xl font-bold" style={{ color: c }}>
                          {v}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div
                      className="rounded-2xl border p-5"
                      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                    >
                      <h3 className="mb-3 text-sm font-semibold" style={{ color: 'var(--text)' }}>
                        {t('docEmpByType')}
                      </h3>
                      {DOCS_EMPLOYMENT_TYPES.map((et) => {
                        const cnt = employees.filter((e) => e.employment_type === et.value).length;
                        const pct = employees.length
                          ? Math.round((cnt / employees.length) * 100)
                          : 0;
                        return (
                          <div key={et.value} className="mb-2 flex items-center gap-3">
                            <span className="w-24 text-sm" style={{ color: 'var(--text)' }}>
                              {employmentTypeLabel(et.value, t)}
                            </span>
                            <div
                              className="h-2 flex-1 rounded-full"
                              style={{ background: 'var(--surface-2)' }}
                            >
                              <div
                                className="h-2 rounded-full"
                                style={{ width: `${pct}%`, background: 'var(--accent)' }}
                              />
                            </div>
                            <span
                              className="w-8 text-end text-sm font-semibold"
                              style={{ color: 'var(--text-secondary)' }}
                            >
                              {cnt}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <div
                      className="rounded-2xl border p-5"
                      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                    >
                      <h3 className="mb-3 text-sm font-semibold" style={{ color: 'var(--text)' }}>
                        {t('docEmpRecentHires')}
                      </h3>
                      {employees
                        .sort((a, b) => (b.hire_date ?? '').localeCompare(a.hire_date ?? ''))
                        .slice(0, 5)
                        .map((e) => (
                          <div key={e.id} className="flex items-center justify-between py-1.5">
                            <div>
                              <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                                {e.full_name}
                              </div>
                              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                {e.job_title ?? t('commonEmptyDash')} ·{' '}
                                {e.hire_date ?? t('commonEmptyDash')}
                              </div>
                            </div>
                            <span
                              className="rounded-full px-2 py-0.5 text-xs font-bold"
                              style={{ ...statusColor(e.status) }}
                            >
                              {employeeStatusLabel(e.status, t)}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Employees list ────────────────────────────────────────────────── */}
              {tab === 'employees' && (
                <DocsEditorCard title={t('docEmpRegistry')}>
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="relative">
                        <Search
                          size={14}
                          className="absolute start-2.5 top-1/2 -translate-y-1/2"
                          style={{ color: 'var(--text-secondary)' }}
                        />
                        <input
                          className="rounded-lg border py-1.5 pe-3 ps-8 text-sm outline-none"
                          style={{
                            background: 'var(--surface-2)',
                            borderColor: 'var(--border)',
                            color: 'var(--text)',
                            width: 220,
                          }}
                          placeholder={t('docEmpSearchPh')}
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                        />
                      </div>
                      <SelectDropdown
                        className="rounded-lg border px-2 py-1.5 text-sm outline-none"
                        style={{
                          background: 'var(--surface-2)',
                          borderColor: 'var(--border)',
                          color: 'var(--text)',
                        }}
                        value={statusF}
                        onChange={(v) => setStatusF(v as StatusF)}
                        options={[
                          { value: 'all', label: t('docEmpAllStatuses') },
                          { value: 'active', label: t('active') },
                          { value: 'inactive', label: t('inactive') },
                          { value: 'terminated', label: t('docEmpTerminated') },
                        ]}
                      />
                      <SelectDropdown
                        className="rounded-lg border px-2 py-1.5 text-sm outline-none"
                        style={{
                          background: 'var(--surface-2)',
                          borderColor: 'var(--border)',
                          color: 'var(--text)',
                        }}
                        value={typeF}
                        onChange={(v) => setTypeF(v as TypeF)}
                        options={[
                          { value: 'all', label: t('docEmpAllTypes') },
                          ...DOCS_EMPLOYMENT_TYPES.map((et) => ({
                            value: et.value,
                            label: employmentTypeLabel(et.value, t),
                          })),
                        ]}
                      />
                    </div>
                    <button
                      onClick={() => setAddModal(true)}
                      className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white"
                      style={{ background: 'var(--accent)' }}
                    >
                      <Plus size={16} /> {t('docEmpAddEmployeeBtn')}
                    </button>
                  </div>

                  <div
                    className="overflow-hidden rounded-2xl border"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <table className="w-full text-sm">
                      <thead>
                        <tr
                          style={{
                            background: 'var(--surface)',
                            borderBottom: `1px solid var(--border)`,
                          }}
                        >
                          <th
                            className="px-4 py-3 text-start text-xs font-semibold"
                            style={{ color: 'var(--text-secondary)' }}
                          >
                            {t('docEmpColEmployee')}
                          </th>
                          <th
                            className="px-4 py-3 text-start text-xs font-semibold"
                            style={{ color: 'var(--text-secondary)' }}
                          >
                            {t('docEmpColJobTitle')}
                          </th>
                          <th
                            className="px-4 py-3 text-start text-xs font-semibold"
                            style={{ color: 'var(--text-secondary)' }}
                          >
                            {t('docEmpColType')}
                          </th>
                          <th
                            className="px-4 py-3 text-start text-xs font-semibold"
                            style={{ color: 'var(--text-secondary)' }}
                          >
                            {t('docEmpColStatus')}
                          </th>
                          <th
                            className="px-4 py-3 text-end text-xs font-semibold"
                            style={{ color: 'var(--text-secondary)' }}
                          >
                            {t('docEmpColSalary')}
                          </th>
                          <th
                            className="px-4 py-3 text-end text-xs font-semibold"
                            style={{ color: 'var(--text-secondary)' }}
                          >
                            {t('docEmpColActions')}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {loading && (
                          <tr>
                            <td
                              colSpan={6}
                              className="py-8 text-center text-sm"
                              style={{ color: 'var(--text-secondary)' }}
                            >
                              {t('docLoading')}
                            </td>
                          </tr>
                        )}
                        {!loading && visible.length === 0 && (
                          <tr>
                            <td
                              colSpan={6}
                              className="py-8 text-center text-sm"
                              style={{ color: 'var(--text-secondary)' }}
                            >
                              {t('docEmpNoEmployees')}
                            </td>
                          </tr>
                        )}
                        {visible.map((e) => (
                          <tr
                            key={e.id}
                            className="border-t transition-colors hover:bg-[var(--surface-2)]"
                            style={{ borderColor: 'var(--border)' }}
                          >
                            <td className="px-4 py-3">
                              <div className="font-medium" style={{ color: 'var(--text)' }}>
                                {e.full_name}
                              </div>
                              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                {e.employee_id} · {e.phone ?? t('commonEmptyDash')}
                              </div>
                            </td>
                            <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>
                              {e.job_title ?? t('commonEmptyDash')}
                            </td>
                            <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>
                              {employmentTypeLabel(e.employment_type, t)}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className="rounded-full px-2 py-0.5 text-xs font-bold"
                                style={{ ...statusColor(e.status) }}
                              >
                                {employeeStatusLabel(e.status, t)}
                              </span>
                            </td>
                            <td
                              className="px-4 py-3 text-end font-semibold"
                              style={{ color: 'var(--text)' }}
                            >
                              {t('docCurrencySar')} {fmtMoney(e.salary, lang)}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => setSalaryModal(e)}
                                  className="rounded-lg p-1.5 hover:bg-[var(--accent-soft)]"
                                  title={t('docEmpUpdateSalary')}
                                >
                                  <ChevronUp size={14} style={{ color: 'var(--accent)' }} />
                                </button>
                                <button
                                  onClick={() => setEditModal(e)}
                                  className="rounded-lg p-1.5 hover:bg-[var(--accent-soft)]"
                                >
                                  <Edit2 size={13} style={{ color: 'var(--accent)' }} />
                                </button>
                                <button
                                  onClick={() => setPendingDeleteEmployee(e)}
                                  className="rounded-lg p-1.5 hover:bg-red-50"
                                >
                                  <Trash2 size={13} style={{ color: '#ef4444' }} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </DocsEditorCard>
              )}

              {/* ── Payroll ───────────────────────────────────────────────────────── */}
              {tab === 'payroll' && (
                <DocsEditorCard title={t('docEmpPayrollSheet')}>
                  <div className="space-y-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>
                          {t('docEmpPayrollSheet')}
                        </h2>
                        <DocsDateField
                          value={payrollMonth}
                          onChange={setPayrollMonth}
                          mode="month"
                          placeholder={t('docEmpPayrollMonth')}
                        />
                      </div>
                      <button
                        onClick={exportPayrollCSV}
                        className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white"
                        style={{ background: '#0f172a' }}
                      >
                        <Download size={15} /> {t('docEmpExportCsv')}
                      </button>
                    </div>
                    <ClientProfileSelector
                      profiles={profiles}
                      selectedClientId={selectedClientId}
                      onSelectClientId={setSelectedClientId}
                      label={t('docEmpClientContextPayroll')}
                    />

                    <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
                      {[
                        [t('docEmpActiveEmployees'), String(activeCount), '#059669'],
                        [
                          t('docEmpTotalPayroll'),
                          `${t('docCurrencySar')} ${fmtMoney(totalPayroll, lang)}`,
                          '#7c3aed',
                        ],
                        [
                          t('docEmpAvgSalary'),
                          `${t('docCurrencySar')} ${fmtMoney(activeCount > 0 ? totalPayroll / activeCount : 0, lang)}`,
                          '#d97706',
                        ],
                      ].map(([l, v, c]) => (
                        <div
                          key={l}
                          className="rounded-2xl border p-5"
                          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                        >
                          <div
                            className="mb-2 text-xs font-medium"
                            style={{ color: 'var(--text-secondary)' }}
                          >
                            {l}
                          </div>
                          <div className="text-xl font-bold" style={{ color: c }}>
                            {v}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div
                      className="overflow-hidden rounded-2xl border"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      <table className="w-full text-sm">
                        <thead>
                          <tr
                            style={{
                              background: 'var(--surface)',
                              borderBottom: `1px solid var(--border)`,
                            }}
                          >
                            <th
                              className="px-4 py-3 text-start text-xs font-semibold"
                              style={{ color: 'var(--text-secondary)' }}
                            >
                              {t('docEmpColEmployee')}
                            </th>
                            <th
                              className="px-4 py-3 text-start text-xs font-semibold"
                              style={{ color: 'var(--text-secondary)' }}
                            >
                              {t('docEmpColJobTitle')}
                            </th>
                            <th
                              className="px-4 py-3 text-end text-xs font-semibold"
                              style={{ color: 'var(--text-secondary)' }}
                            >
                              {t('docEmpColDailyHours')}
                            </th>
                            <th
                              className="px-4 py-3 text-end text-xs font-semibold"
                              style={{ color: 'var(--text-secondary)' }}
                            >
                              {t('docEmpColMonthlySalary')}
                            </th>
                            <th
                              className="px-4 py-3 text-start text-xs font-semibold"
                              style={{ color: 'var(--text-secondary)' }}
                            >
                              {t('docEmpColSalaryHistory')}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {employees
                            .filter((e) => e.status === 'active')
                            .map((e) => {
                              const adjustments = (e.salary_adjustments ??
                                []) as DocsSalaryAdjustment[];
                              const latest = adjustments[0];
                              return (
                                <tr
                                  key={e.id}
                                  className="border-t hover:bg-[var(--surface-2)]"
                                  style={{ borderColor: 'var(--border)' }}
                                >
                                  <td className="px-4 py-3">
                                    <div className="font-medium" style={{ color: 'var(--text)' }}>
                                      {e.full_name}
                                    </div>
                                    <div
                                      className="text-xs"
                                      style={{ color: 'var(--text-secondary)' }}
                                    >
                                      {e.employee_id}
                                    </div>
                                  </td>
                                  <td
                                    className="px-4 py-3"
                                    style={{ color: 'var(--text-secondary)' }}
                                  >
                                    {e.job_title ?? t('commonEmptyDash')}
                                  </td>
                                  <td
                                    className="px-4 py-3 text-end"
                                    style={{ color: 'var(--text)' }}
                                  >
                                    {t('docEmpHoursSuffix', { n: String(e.daily_hours) })}
                                  </td>
                                  <td
                                    className="px-4 py-3 text-end font-bold"
                                    style={{ color: '#7c3aed' }}
                                  >
                                    {t('docCurrencySar')} {fmtMoney(e.salary, lang)}
                                  </td>
                                  <td className="px-4 py-3">
                                    {latest && (
                                      <div className="text-xs">
                                        <span
                                          className={clsx(
                                            'font-semibold',
                                            latest.change_type === 'increase'
                                              ? 'text-green-600'
                                              : latest.change_type === 'decrease'
                                                ? 'text-red-500'
                                                : 'text-[color:var(--text-secondary)]',
                                          )}
                                        >
                                          {latest.change_type === 'increase'
                                            ? '↑'
                                            : latest.change_type === 'decrease'
                                              ? '↓'
                                              : '●'}{' '}
                                          {salaryChangeLabel(latest.change_type, t)}
                                        </span>
                                        <span
                                          className="ms-1"
                                          style={{ color: 'var(--text-secondary)' }}
                                        >
                                          {latest.effective_date ?? t('commonEmptyDash')}
                                        </span>
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                        <tfoot>
                          <tr
                            style={{
                              background: 'var(--surface)',
                              borderTop: `2px solid var(--border)`,
                            }}
                          >
                            <td
                              colSpan={3}
                              className="px-4 py-3 text-sm font-bold"
                              style={{ color: 'var(--text)' }}
                            >
                              {t('docEmpTotalPayrollFooter')}
                            </td>
                            <td
                              className="px-4 py-3 text-end text-sm font-bold"
                              style={{ color: '#7c3aed' }}
                            >
                              {t('docCurrencySar')} {fmtMoney(totalPayroll, lang)}
                            </td>
                            <td />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </DocsEditorCard>
              )}
            </div>
          </div>
        }
        preview={
          <aside className="docs-preview-shell">
            <div className="docs-preview-canvas space-y-6 p-7">
              <div
                className="flex items-center justify-between border-b pb-3"
                style={{ borderColor: '#e5e7eb' }}
              >
                <div>
                  <p className="text-xs font-semibold tracking-[0.16em] text-[color:var(--text-secondary)]">
                    {t('docEmpLivePreview')}
                  </p>
                  <h2 className="text-xl font-bold text-[color:var(--text-primary)]">
                    {t('docEmpStudioSnapshot')}
                  </h2>
                </div>
                <span className="rounded-full bg-[color:var(--surface-elevated)] px-3 py-1 text-xs font-semibold text-[color:var(--text-secondary)]">
                  {payrollMonth}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border p-3" style={{ borderColor: '#e5e7eb' }}>
                  <p className="text-[11px] uppercase tracking-[0.12em] text-[color:var(--text-secondary)]">
                    {t('docEmpPreviewTotal')}
                  </p>
                  <p className="text-lg font-bold text-[color:var(--text-primary)]">
                    {employees.length}
                  </p>
                </div>
                <div className="rounded-xl border p-3" style={{ borderColor: '#e5e7eb' }}>
                  <p className="text-[11px] uppercase tracking-[0.12em] text-[color:var(--text-secondary)]">
                    {t('docEmpPreviewActive')}
                  </p>
                  <p className="text-lg font-bold text-emerald-600">{activeCount}</p>
                </div>
                <div className="rounded-xl border p-3" style={{ borderColor: '#e5e7eb' }}>
                  <p className="text-[11px] uppercase tracking-[0.12em] text-[color:var(--text-secondary)]">
                    {t('docEmpPreviewMonthlyPayroll')}
                  </p>
                  <p className="text-lg font-bold text-violet-700">
                    {t('docCurrencySar')} {fmtMoney(totalPayroll, lang)}
                  </p>
                </div>
                <div className="rounded-xl border p-3" style={{ borderColor: '#e5e7eb' }}>
                  <p className="text-[11px] uppercase tracking-[0.12em] text-[color:var(--text-secondary)]">
                    {t('docEmpPreviewContracts')}
                  </p>
                  <p className="text-lg font-bold text-amber-600">{contractCount}</p>
                </div>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold text-[color:var(--text-secondary)]">
                  {t('docEmpTopPayroll')}
                </h3>
                <div className="space-y-2">
                  {employees
                    .filter((e) => e.status === 'active')
                    .sort((a, b) => b.salary - a.salary)
                    .slice(0, 7)
                    .map((employee) => (
                      <div
                        key={employee.id}
                        className="flex items-center justify-between rounded-lg border px-3 py-2"
                        style={{ borderColor: '#e5e7eb' }}
                      >
                        <div>
                          <p className="text-sm font-semibold text-[color:var(--text-primary)]">
                            {employee.full_name}
                          </p>
                          <p className="text-xs text-[color:var(--text-secondary)]">
                            {employee.job_title || t('commonEmptyDash')} · {employee.employee_id}
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-[color:var(--text-primary)]">
                          {t('docCurrencySar')} {fmtMoney(employee.salary, lang)}
                        </p>
                      </div>
                    ))}
                  {employees.length === 0 ? (
                    <p className="text-sm text-[color:var(--text-secondary)]">
                      {t('docEmpNoEmployeesYet')}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </aside>
        }
      />

      {addModal && (
        <EmployeeModal employees={employees} onClose={() => setAddModal(false)} onDone={load} />
      )}
      {editModal && (
        <EmployeeModal
          employees={employees}
          initial={editModal}
          onClose={() => setEditModal(null)}
          onDone={load}
        />
      )}
      {salaryModal && (
        <SalaryModal employee={salaryModal} onClose={() => setSalaryModal(null)} onDone={load} />
      )}
      <ConfirmDialog
        open={Boolean(pendingDeleteEmployee)}
        title="Delete employee"
        description={`Delete "${pendingDeleteEmployee?.full_name ?? ''}"? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel={t('cancel')}
        destructive
        loading={deletingEmployee}
        onCancel={() => {
          if (deletingEmployee) return;
          setPendingDeleteEmployee(null);
        }}
        onConfirm={deleteEmp}
      />
    </>
  );
}
