'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2, Edit2, Download, Search, Archive, Printer } from 'lucide-react';
import clsx from 'clsx';
import {
  type DocsAccountingEntry,
  type DocsAccountingExpense,
  type DocsAccountingTransfer,
  DOCS_CURRENCIES,
  ACCOUNTING_COLLECTORS,
} from '@/lib/docs-types';
import ClientProfileSelector from '@/components/docs/ClientProfileSelector';
import {
  type DocsClientProfile,
  fetchDocsClientProfiles,
  isVirtualDocsProfileId,
  sanitizeDocCode,
} from '@/lib/docs-client-profiles';
import { DocsDateField } from '@/components/docs/DocsUi';
import AppModal from '@/components/ui/AppModal';
import SelectDropdown from '@/components/ui/SelectDropdown';
import ConfirmDialog from '@/components/ui/actions/ConfirmDialog';
import {
  DocsDocTypeTabs,
  DocsToolbarLayout,
  DocsWorkspaceShell,
} from '@/components/docs/DocsWorkspace';
import {
  computeAccountingSettlement,
  type AccountingSettlementResult,
} from '@/lib/accounting-settlement';
import { exportPreviewPdf } from '@/lib/docs-print';
import { OPENY_DOC_STYLE } from '@/lib/openy-brand';
import { useLang } from '@/context/lang-context';
import { useAppPeriod } from '@/context/app-period-context';
import { useToast } from '@/context/toast-context';

const [PARTNER_A, PARTNER_B] = ACCOUNTING_COLLECTORS;

function today() {
  return new Date().toISOString().slice(0, 10);
}
function monthKey(m: string) {
  return m.replace('-', '');
}

function fmtMoney(n: number, cur = 'SAR') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: cur,
    minimumFractionDigits: 2,
  }).format(n);
}

function monthHeading(month: string, lang: 'en' | 'ar') {
  const [y, mo] = month.split('-').map(Number);
  if (!y || !mo) return month;
  const loc = lang === 'ar' ? 'ar-SA' : 'en-US';
  return new Date(y, mo - 1, 1).toLocaleString(loc, { month: 'long', year: 'numeric' });
}

// ── Entry modal ───────────────────────────────────────────────────────────────

interface EntryForm {
  client_name: string;
  service: string;
  amount: number;
  currency: string;
  collector: string;
  collection_type: 'local' | 'overseas';
  entry_date: string;
  notes: string;
}

function EntryModal({
  initial,
  monthKey: mk,
  onClose,
  onDone,
  selectedProfile,
}: {
  initial?: DocsAccountingEntry;
  monthKey: string;
  onClose: () => void;
  onDone: () => void;
  selectedProfile?: DocsClientProfile | null;
}) {
  const { t } = useLang();
  const [form, setForm] = useState<EntryForm>(() =>
    initial
      ? {
          client_name: initial.client_name,
          service: initial.service ?? '',
          amount: initial.amount,
          currency: initial.currency,
          collector: initial.collector ?? PARTNER_A,
          collection_type: initial.collection_type,
          entry_date: initial.entry_date,
          notes: initial.notes ?? '',
        }
      : {
          client_name: '',
          service: '',
          amount: 0,
          currency: 'EGP',
          collector: PARTNER_A,
          collection_type: 'local',
          entry_date: today(),
          notes: '',
        },
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function setF<K extends keyof EntryForm>(k: K, v: EntryForm[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }
  useEffect(() => {
    if (initial) return;
    if (!selectedProfile) return;
    setForm((prev) => ({
      ...prev,
      client_name: selectedProfile.client_name,
      currency: selectedProfile.default_currency,
      notes: prev.notes || selectedProfile.notes || '',
    }));
  }, [initial, selectedProfile]);

  function setCollector(c: string) {
    setForm((f) => ({
      ...f,
      collector: c,
      collection_type: c === PARTNER_A ? 'local' : 'overseas',
    }));
  }

  async function submit() {
    if (!form.client_name.trim()) {
      setError(t('docAcctClientRequired'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      const url = initial
        ? `/api/docs/accounting/entries/${initial.id}`
        : '/api/docs/accounting/entries';
      const res = await fetch(url, {
        method: initial ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          collector: form.collector,
          month_key: mk,
          client_profile_id:
            selectedProfile && !isVirtualDocsProfileId(selectedProfile.id)
              ? selectedProfile.id
              : null,
        }),
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
      title={initial ? t('docAcctEditRevenue') : t('docAcctAddRevenue')}
      size="sm"
      bodyClassName="space-y-3"
      footer={
        <>
          <button type="button" onClick={onClose} className="openy-modal-btn-secondary flex-1">
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="openy-modal-btn-primary flex-1 disabled:opacity-60"
          >
            {saving ? t('docCommonSaving') : initial ? t('docQtUpdate') : t('docQtAddLine')}
          </button>
        </>
      }
    >
      {error ? (
        <div
          className="mb-3 rounded-lg px-3 py-2 text-sm"
          style={{ background: 'var(--surface-muted)', color: 'var(--text-primary)' }}
        >
          {error}
        </div>
      ) : null}
      <div className="space-y-3">
        <div>
          {lbl(t('docAcctClientStar'))}
          <input
            className={inp}
            value={form.client_name}
            onChange={(e) => setF('client_name', e.target.value)}
          />
        </div>
        <div>
          {lbl(t('docAcctService'))}
          <input
            className={inp}
            value={form.service}
            onChange={(e) => setF('service', e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            {lbl(t('docAcctAmount'))}
            <input
              type="number"
              min={0}
              step="0.01"
              className={inp}
              value={form.amount}
              onChange={(e) => setF('amount', Number(e.target.value))}
            />
          </div>
          <div>
            {lbl(t('docAcctCurrency'))}
            <SelectDropdown
              fullWidth
              className={inp}
              value={form.currency}
              onChange={(v) => setF('currency', v)}
              options={DOCS_CURRENCIES.map((c) => ({ value: c, label: c }))}
            />
          </div>
        </div>
        <div>
          {lbl(t('docAcctCollectedBy'))}
          <SelectDropdown
            fullWidth
            className={inp}
            value={form.collector}
            onChange={(v) => setCollector(v)}
            options={[
              {
                value: PARTNER_A,
                label: `${PARTNER_A} — ${t('docAcctRegionEgyptShort')}`,
              },
              {
                value: PARTNER_B,
                label: `${PARTNER_B} — ${t('docAcctRegionAbroadShort')}`,
              },
            ]}
          />
          <p className="mt-1.5 text-[11px] leading-snug text-[var(--text-secondary)]">
            {t('docAcctCollectorFieldHelp')}
          </p>
        </div>
        <div>
          {lbl(t('docAcctEntryDate'))}
          <input
            type="date"
            className={inp}
            value={form.entry_date}
            onChange={(e) => setF('entry_date', e.target.value)}
          />
        </div>
        <div>
          {lbl(t('docAcctNotes'))}
          <textarea
            className={inp}
            rows={2}
            value={form.notes}
            onChange={(e) => setF('notes', e.target.value)}
          />
        </div>
      </div>
    </AppModal>
  );
}

// ── Expense modal ─────────────────────────────────────────────────────────────

interface ExpenseForm {
  description: string;
  amount: number;
  currency: string;
  expense_date: string;
  paid_by_partner: string;
  notes: string;
}

function ExpenseModal({
  initial,
  monthKey: mk,
  onClose,
  onDone,
}: {
  initial?: DocsAccountingExpense;
  monthKey: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useLang();
  const [form, setForm] = useState<ExpenseForm>(() =>
    initial
      ? {
          description: initial.description,
          amount: initial.amount,
          currency: initial.currency,
          expense_date: initial.expense_date,
          paid_by_partner: initial.paid_by_partner ?? PARTNER_B,
          notes: initial.notes ?? '',
        }
      : {
          description: '',
          amount: 0,
          currency: 'EGP',
          expense_date: today(),
          paid_by_partner: PARTNER_B,
          notes: '',
        },
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function setF<K extends keyof ExpenseForm>(k: K, v: ExpenseForm[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit() {
    if (!form.description.trim()) {
      setError(t('docAcctDescriptionRequired'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      const url = initial
        ? `/api/docs/accounting/expenses/${initial.id}`
        : '/api/docs/accounting/expenses';
      const res = await fetch(url, {
        method: initial ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, month_key: mk }),
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
      title={initial ? t('docAcctEditExpense') : t('docAcctAddExpense')}
      size="sm"
      bodyClassName="space-y-3"
      footer={
        <>
          <button type="button" onClick={onClose} className="openy-modal-btn-secondary flex-1">
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="openy-modal-btn-primary flex-1 disabled:opacity-60"
          >
            {saving ? t('docCommonSaving') : initial ? t('docQtUpdate') : t('docQtAddLine')}
          </button>
        </>
      }
    >
      {error ? (
        <div
          className="mb-3 rounded-lg px-3 py-2 text-sm"
          style={{ background: 'var(--surface-muted)', color: 'var(--text-primary)' }}
        >
          {error}
        </div>
      ) : null}
      <div className="space-y-3">
        <div>
          {lbl(t('docAcctDescriptionStar'))}
          <input
            className={inp}
            value={form.description}
            onChange={(e) => setF('description', e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            {lbl(t('docAcctAmount'))}
            <input
              type="number"
              min={0}
              step="0.01"
              className={inp}
              value={form.amount}
              onChange={(e) => setF('amount', Number(e.target.value))}
            />
          </div>
          <div>
            {lbl(t('docAcctCurrency'))}
            <SelectDropdown
              fullWidth
              className={inp}
              value={form.currency}
              onChange={(v) => setF('currency', v)}
              options={DOCS_CURRENCIES.map((c) => ({ value: c, label: c }))}
            />
          </div>
        </div>
        <div>
          {lbl(t('docAcctPaidByPartner'))}
          <SelectDropdown
            fullWidth
            className={inp}
            value={form.paid_by_partner}
            onChange={(v) => setF('paid_by_partner', v)}
            options={[
              {
                value: PARTNER_A,
                label: `${PARTNER_A} — ${t('docAcctRegionEgyptShort')}`,
              },
              {
                value: PARTNER_B,
                label: `${PARTNER_B} — ${t('docAcctRegionAbroadShort')}`,
              },
            ]}
          />
          <p className="mt-1.5 text-[11px] leading-snug text-[var(--text-secondary)]">
            {t('docAcctExpensePaidByHelp')}
          </p>
        </div>
        <div>
          {lbl(t('docAcctExpenseDate'))}
          <input
            type="date"
            className={inp}
            value={form.expense_date}
            onChange={(e) => setF('expense_date', e.target.value)}
          />
        </div>
        <div>
          {lbl(t('docAcctNotes'))}
          <textarea
            className={inp}
            rows={2}
            value={form.notes}
            onChange={(e) => setF('notes', e.target.value)}
          />
        </div>
      </div>
    </AppModal>
  );
}

// ── Transfer modal ───────────────────────────────────────────────────────────

interface TransferForm {
  from_partner: string;
  to_partner: string;
  amount: number;
  currency: string;
  transfer_date: string;
  notes: string;
}

function TransferModal({
  initial,
  monthKey: mk,
  onClose,
  onDone,
}: {
  initial?: DocsAccountingTransfer;
  monthKey: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useLang();
  const [form, setForm] = useState<TransferForm>(() =>
    initial
      ? {
          from_partner: initial.from_partner,
          to_partner: initial.to_partner,
          amount: initial.amount,
          currency: initial.currency,
          transfer_date: initial.transfer_date,
          notes: initial.notes ?? '',
        }
      : {
          from_partner: PARTNER_A,
          to_partner: PARTNER_B,
          amount: 0,
          currency: 'EGP',
          transfer_date: today(),
          notes: '',
        },
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function setF<K extends keyof TransferForm>(k: K, v: TransferForm[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit() {
    if (form.from_partner === form.to_partner) {
      setError(t('docAcctFromToDiffer'));
      return;
    }
    if (!Number.isFinite(form.amount) || form.amount <= 0) {
      setError(t('docAcctAmountPositive'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      const url = initial
        ? `/api/docs/accounting/transfers/${initial.id}`
        : '/api/docs/accounting/transfers';
      const res = await fetch(url, {
        method: initial ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, month_key: mk }),
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
      title={initial ? t('docAcctEditTransfer') : t('docAcctLogTransfer')}
      size="sm"
      bodyClassName="space-y-3"
      footer={
        <>
          <button type="button" onClick={onClose} className="openy-modal-btn-secondary flex-1">
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="openy-modal-btn-primary flex-1 disabled:opacity-60"
          >
            {saving ? t('docCommonSaving') : initial ? t('docQtUpdate') : t('docQtAddLine')}
          </button>
        </>
      }
    >
      {error ? (
        <div
          className="mb-3 rounded-lg px-3 py-2 text-sm"
          style={{ background: 'var(--surface-muted)', color: 'var(--text-primary)' }}
        >
          {error}
        </div>
      ) : null}
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            {lbl(t('docAcctFrom'))}
            <SelectDropdown
              fullWidth
              className={inp}
              value={form.from_partner}
              onChange={(v) => setF('from_partner', v)}
              options={[
                { value: PARTNER_A, label: PARTNER_A },
                { value: PARTNER_B, label: PARTNER_B },
              ]}
            />
          </div>
          <div>
            {lbl(t('docAcctTo'))}
            <SelectDropdown
              fullWidth
              className={inp}
              value={form.to_partner}
              onChange={(v) => setF('to_partner', v)}
              options={[
                { value: PARTNER_A, label: PARTNER_A },
                { value: PARTNER_B, label: PARTNER_B },
              ]}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            {lbl(t('docAcctAmount'))}
            <input
              type="number"
              min={0}
              step="0.01"
              className={inp}
              value={form.amount}
              onChange={(e) => setF('amount', Number(e.target.value))}
            />
          </div>
          <div>
            {lbl(t('docAcctCurrency'))}
            <SelectDropdown
              fullWidth
              className={inp}
              value={form.currency}
              onChange={(v) => setF('currency', v)}
              options={DOCS_CURRENCIES.map((c) => ({ value: c, label: c }))}
            />
          </div>
        </div>
        <div>
          {lbl(t('docAcctTransferDate'))}
          <input
            type="date"
            className={inp}
            value={form.transfer_date}
            onChange={(e) => setF('transfer_date', e.target.value)}
          />
        </div>
        <div>
          {lbl(t('docAcctNotes'))}
          <textarea
            className={inp}
            rows={2}
            value={form.notes}
            onChange={(e) => setF('notes', e.target.value)}
          />
        </div>
      </div>
    </AppModal>
  );
}

// ── Live month-close dashboard ─────────────────────────────────────────────────

function AccountingSettlementDashboard({
  monthLabel,
  settlement,
  currency,
  entriesCount,
  expensesCount,
}: {
  monthLabel: string;
  settlement: AccountingSettlementResult;
  currency: string;
  entriesCount: number;
  expensesCount: number;
}) {
  const { t } = useLang();
  const [p0, p1] = settlement.partners;
  const hasData = entriesCount > 0 || expensesCount > 0;

  const stepClass =
    'rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide bg-[var(--accent-soft)] text-[var(--accent)]';

  const partnerBlock = (
    name: string,
    regionKey: 'docAcctRegionEgyptShort' | 'docAcctRegionAbroadShort',
  ) => (
    <div
      className="rounded-xl border p-3"
      style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}
    >
      <div className="text-sm font-bold text-[var(--text)]">{name}</div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--accent)]">
        {t(regionKey)}
      </div>
      <dl className="mt-2 space-y-1.5 text-xs">
        <div className="flex justify-between gap-2">
          <dt className="text-[var(--text-secondary)]">{t('docAcctCollectedShort')}</dt>
          <dd className="font-semibold text-emerald-700">
            {fmtMoney(settlement.collectedBy[name] ?? 0, currency)}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-[var(--text-secondary)]">{t('docAcctExpensesPaidShort')}</dt>
          <dd className="font-semibold text-red-600">
            {fmtMoney(settlement.expensesPaidBy[name] ?? 0, currency)}
          </dd>
        </div>
        <div className="flex justify-between gap-2 border-t border-[var(--border)] pt-1.5">
          <dt className="font-semibold text-[var(--text)]">{t('docAcctNetInHandShort')}</dt>
          <dd className="font-bold text-[var(--text)]">
            {fmtMoney(settlement.netInHand[name] ?? 0, currency)}
          </dd>
        </div>
      </dl>
    </div>
  );

  return (
    <section
      className="rounded-2xl border p-5 shadow-sm"
      style={{
        borderColor: 'color-mix(in srgb, var(--accent) 30%, var(--border))',
        background:
          'linear-gradient(165deg, color-mix(in srgb, var(--accent) 7%, var(--surface)) 0%, var(--surface) 55%)',
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-[var(--text)]">{t('docAcctDashboardTitle')}</h2>
          <p className="mt-0.5 text-sm text-[var(--text-secondary)]">{monthLabel}</p>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-[var(--text-secondary)]">
            {t('docAcctDashboardSubtitle')}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <span className={stepClass}>1 · {t('docAcctStepRevenues')}</span>
          <span className={stepClass}>2 · {t('docAcctStepExpenses')}</span>
          <span className={stepClass}>3 · {t('docAcctStepClose')}</span>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div
          className="rounded-xl border px-3 py-2.5"
          style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}
        >
          <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">
            {t('docAcctTotalRevenue')}
          </div>
          <div className="mt-1 text-lg font-black text-emerald-700">
            {fmtMoney(settlement.totalRevenue, currency)}
          </div>
        </div>
        <div
          className="rounded-xl border px-3 py-2.5"
          style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}
        >
          <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">
            {t('docAcctTotalExpenses')}
          </div>
          <div className="mt-1 text-lg font-black text-red-600">
            {fmtMoney(settlement.totalExpenses, currency)}
          </div>
        </div>
        <div
          className="rounded-xl border px-3 py-2.5"
          style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}
        >
          <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">
            {t('docAcctNetProfit')}
          </div>
          <div className="mt-1 text-lg font-black text-[var(--text)]">
            {fmtMoney(settlement.netProfit, currency)}
          </div>
        </div>
      </div>

      <div
        className="mt-3 rounded-xl border px-4 py-3"
        style={{
          borderColor: 'var(--border)',
          background: 'color-mix(in srgb, var(--accent) 9%, var(--surface))',
        }}
      >
        <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">
          {t('docAcctPartnerShare')}
        </div>
        <div className="mt-1 flex flex-wrap items-baseline gap-2">
          <span className="text-xl font-black text-[var(--accent)]">
            {fmtMoney(settlement.partnerShare, currency)}
          </span>
          <span className="text-xs text-[var(--text-secondary)]">({t('docAcctEachPartner')})</span>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-[var(--text-secondary)]">
          {t('docAcctSettlementExplainer')}
        </p>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {partnerBlock(p0, 'docAcctRegionEgyptShort')}
        {partnerBlock(p1, 'docAcctRegionAbroadShort')}
      </div>

      <div
        className={clsx(
          'mt-4 rounded-xl border-2 border-dashed px-4 py-3',
          settlement.debtor
            ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
            : 'border-[var(--border)]',
        )}
      >
        <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">
          {t('docAcctTransferVerdict')}
        </div>
        {settlement.debtor && settlement.creditor ? (
          <p className="mt-2 text-base font-bold text-[var(--text)]">
            {t('docAcctDebtorOwes', {
              debtor: settlement.debtor,
              creditor: settlement.creditor,
              amount: fmtMoney(settlement.settlementAmount, currency),
            })}
          </p>
        ) : (
          <p className="mt-2 text-sm font-semibold text-[var(--text)]">{t('docAcctBalanced')}</p>
        )}
      </div>

      {!hasData ? (
        <p className="mt-3 text-center text-xs text-[var(--text-secondary)]">
          {t('docAcctDashboardEmpty')}
        </p>
      ) : null}
    </section>
  );
}

// ── PDF / preview block ───────────────────────────────────────────────────────

function SettlementPdfBlock({
  monthLabelText,
  monthKeyStr,
  settlement,
  entries,
  expenses,
  transfers,
  monthNotes,
  reportCurrency,
}: {
  monthLabelText: string;
  monthKeyStr: string;
  settlement: ReturnType<typeof computeAccountingSettlement>;
  entries: DocsAccountingEntry[];
  expenses: DocsAccountingExpense[];
  transfers: DocsAccountingTransfer[];
  monthNotes: string;
  reportCurrency: string;
}) {
  const { t } = useLang();
  const s = OPENY_DOC_STYLE;
  const cur = reportCurrency;
  const summaryRows: [string, string][] = [
    [t('docAcctTotalRevenue'), fmtMoney(settlement.totalRevenue, cur)],
    [t('docAcctTotalExpenses'), fmtMoney(settlement.totalExpenses, cur)],
    [t('docAcctNetProfit'), fmtMoney(settlement.netProfit, cur)],
    [t('docAcctPartnerShare'), fmtMoney(settlement.partnerShare, cur)],
    [
      t('docAcctCollectedPrefix', { partner: PARTNER_A }),
      fmtMoney(settlement.collectedBy[PARTNER_A] ?? 0, cur),
    ],
    [
      t('docAcctCollectedPrefix', { partner: PARTNER_B }),
      fmtMoney(settlement.collectedBy[PARTNER_B] ?? 0, cur),
    ],
    [
      t('docAcctExpensesPaidPrefix', { partner: PARTNER_A }),
      fmtMoney(settlement.expensesPaidBy[PARTNER_A] ?? 0, cur),
    ],
    [
      t('docAcctExpensesPaidPrefix', { partner: PARTNER_B }),
      fmtMoney(settlement.expensesPaidBy[PARTNER_B] ?? 0, cur),
    ],
    [
      t('docAcctNetInHandPrefix', { partner: PARTNER_A }),
      fmtMoney(settlement.netInHand[PARTNER_A] ?? 0, cur),
    ],
    [
      t('docAcctNetInHandPrefix', { partner: PARTNER_B }),
      fmtMoney(settlement.netInHand[PARTNER_B] ?? 0, cur),
    ],
  ];
  return (
    <div
      id="accounting-settlement-pdf"
      style={{
        fontFamily: 'system-ui, sans-serif',
        color: s.text,
        background: s.background,
        padding: 24,
        maxWidth: 720,
      }}
    >
      <div
        style={{ borderBottom: `2px solid ${s.borderStrong}`, paddingBottom: 12, marginBottom: 16 }}
      >
        <div style={{ fontSize: 11, color: s.textMuted, letterSpacing: '0.08em' }}>
          {t('docAcctOpenyDocs')}
        </div>
        <h1 style={{ margin: '6px 0 0', fontSize: 22, color: s.title }}>
          {t('docAcctMonthlySettlement')}
        </h1>
        <div style={{ fontSize: 13, color: s.textMuted, marginTop: 4 }}>
          {monthLabelText} · <span style={{ fontFamily: 'monospace' }}>{monthKeyStr}</span>
        </div>
      </div>

      <section style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 13, margin: '0 0 10px', color: s.title }}>
          {t('docAcctSettlementSummary')}
        </h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <tbody>
            {summaryRows.map(([k, v]) => (
              <tr key={k} style={{ borderBottom: `1px solid ${s.border}` }}>
                <td style={{ padding: '6px 0', color: s.textMuted }}>{k}</td>
                <td style={{ padding: '6px 0', textAlign: 'end', fontWeight: 600 }}>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div
          style={{
            marginTop: 14,
            padding: 12,
            borderRadius: 8,
            background: s.surface,
            border: `1px solid ${s.border}`,
            fontSize: 13,
            fontWeight: 700,
            color: settlement.debtor ? s.alert : s.title,
          }}
        >
          {settlement.debtor && settlement.creditor
            ? t('docAcctDebtorOwes', {
                debtor: settlement.debtor,
                creditor: settlement.creditor,
                amount: fmtMoney(settlement.settlementAmount, cur),
              })
            : t('docAcctBalanced')}
        </div>
      </section>

      <section style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 13, margin: '0 0 8px', color: s.title }}>{t('docAcctRevenues')}</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr style={{ background: s.headerBg, color: s.headerText }}>
              <th style={{ textAlign: 'start', padding: 6 }}>{t('docAcctColClient')}</th>
              <th style={{ textAlign: 'end', padding: 6 }}>{t('docAcctAmount')}</th>
              <th style={{ textAlign: 'start', padding: 6 }}>{t('docAcctColCollector')}</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} style={{ borderBottom: `1px solid ${s.border}` }}>
                <td style={{ padding: 6 }}>{e.client_name}</td>
                <td style={{ padding: 6, textAlign: 'end' }}>{fmtMoney(e.amount, e.currency)}</td>
                <td style={{ padding: 6, color: s.textMuted }}>{e.collector ?? PARTNER_A}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 13, margin: '0 0 8px', color: s.title }}>{t('docAcctExpenses')}</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr style={{ background: s.headerBg, color: s.headerText }}>
              <th style={{ textAlign: 'start', padding: 6 }}>{t('docAcctColDescription')}</th>
              <th style={{ textAlign: 'end', padding: 6 }}>{t('docAcctAmount')}</th>
              <th style={{ textAlign: 'start', padding: 6 }}>{t('docAcctColPaidBy')}</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((e) => (
              <tr key={e.id} style={{ borderBottom: `1px solid ${s.border}` }}>
                <td style={{ padding: 6 }}>{e.description}</td>
                <td style={{ padding: 6, textAlign: 'end' }}>{fmtMoney(e.amount, e.currency)}</td>
                <td style={{ padding: 6, color: s.textMuted }}>{e.paid_by_partner ?? PARTNER_B}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 13, margin: '0 0 8px', color: s.title }}>
          {t('docAcctPartnerTransfers')}
        </h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr style={{ background: s.headerBg, color: s.headerText }}>
              <th style={{ textAlign: 'start', padding: 6 }}>{t('docAcctFrom')}</th>
              <th style={{ textAlign: 'start', padding: 6 }}>{t('docAcctTo')}</th>
              <th style={{ textAlign: 'end', padding: 6 }}>{t('docAcctAmount')}</th>
            </tr>
          </thead>
          <tbody>
            {transfers.length === 0 ? (
              <tr>
                <td colSpan={3} style={{ padding: 8, color: s.textMuted }}>
                  {t('docAcctNoTransfers')}
                </td>
              </tr>
            ) : (
              transfers.map((tr) => (
                <tr key={tr.id} style={{ borderBottom: `1px solid ${s.border}` }}>
                  <td style={{ padding: 6 }}>{tr.from_partner}</td>
                  <td style={{ padding: 6 }}>{tr.to_partner}</td>
                  <td style={{ padding: 6, textAlign: 'end' }}>
                    {fmtMoney(tr.amount, tr.currency)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section>
        <h2 style={{ fontSize: 13, margin: '0 0 8px', color: s.title }}>
          {t('docAcctMonthNotes')}
        </h2>
        <div
          style={{
            fontSize: 12,
            whiteSpace: 'pre-wrap',
            padding: 10,
            borderRadius: 8,
            border: `1px solid ${s.border}`,
            background: s.surface,
            color: monthNotes ? s.text : s.textMuted,
          }}
        >
          {monthNotes || t('commonEmptyDash')}
        </div>
      </section>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AccountingPage() {
  const { t, lang } = useLang();
  const { toast } = useToast();
  const { periodYm, setPeriodYm } = useAppPeriod();
  const month = periodYm;
  const setMonth = setPeriodYm;
  const mk = monthKey(month);
  const [entries, setEntries] = useState<DocsAccountingEntry[]>([]);
  const [expenses, setExpenses] = useState<DocsAccountingExpense[]>([]);
  const [transfers, setTransfers] = useState<DocsAccountingTransfer[]>([]);
  const [monthNotes, setMonthNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [addEntry, setAddEntry] = useState(false);
  const [editEntry, setEditEntry] = useState<DocsAccountingEntry | null>(null);
  const [addExpense, setAddExpense] = useState(false);
  const [editExpense, setEditExpense] = useState<DocsAccountingExpense | null>(null);
  const [addTransfer, setAddTransfer] = useState(false);
  const [editTransfer, setEditTransfer] = useState<DocsAccountingTransfer | null>(null);
  const [search, setSearch] = useState('');
  const [pdfBusy, setPdfBusy] = useState(false);
  const [deletingEntry, setDeletingEntry] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{
    id: string;
    type: 'revenue' | 'expense' | 'transfer';
  } | null>(null);
  const [profiles, setProfiles] = useState<DocsClientProfile[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const notesDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedProfile = useMemo(
    () => profiles.find((p) => p.client_id === selectedClientId) ?? null,
    [profiles, selectedClientId],
  );

  const accountingDocumentCode = useMemo(
    () =>
      sanitizeDocCode(
        selectedProfile?.client_slug || selectedProfile?.client_name || 'accounting',
        'accounting',
      ),
    [selectedProfile],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [entRes, expRes, trRes, metaRes] = await Promise.all([
        fetch(`/api/docs/accounting/entries?month_key=${encodeURIComponent(mk)}`),
        fetch(`/api/docs/accounting/expenses?month_key=${encodeURIComponent(mk)}`),
        fetch(`/api/docs/accounting/transfers?month_key=${encodeURIComponent(mk)}`).then(
          async (r) => {
            if (!r.ok) return { transfers: [] as DocsAccountingTransfer[] };
            const j = (await r.json()) as { transfers?: DocsAccountingTransfer[] };
            return { transfers: j.transfers ?? [] };
          },
        ),
        fetch(`/api/docs/accounting/month-meta?month_key=${encodeURIComponent(mk)}`).then(
          async (r) => {
            if (!r.ok) return { notes: '' };
            const j = (await r.json()) as { meta?: { notes?: string } };
            return { notes: j.meta?.notes ?? '' };
          },
        ),
      ]);
      const entJson = (await entRes.json()) as { entries?: DocsAccountingEntry[] };
      const expJson = (await expRes.json()) as { expenses?: DocsAccountingExpense[] };
      if (entRes.ok) setEntries(entJson.entries ?? []);
      if (expRes.ok) {
        setExpenses(
          (expJson.expenses ?? []).map((e) => ({
            ...e,
            paid_by_partner: e.paid_by_partner ?? null,
          })),
        );
      }
      setTransfers(trRes.transfers);
      setMonthNotes(metaRes.notes);
    } finally {
      setLoading(false);
    }
  }, [mk]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    fetchDocsClientProfiles()
      .then(setProfiles)
      .catch(() => null);
  }, []);

  function scheduleSaveNotes(next: string) {
    setMonthNotes(next);
    if (notesDebounce.current) clearTimeout(notesDebounce.current);
    notesDebounce.current = setTimeout(async () => {
      await fetch('/api/docs/accounting/month-meta', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month_key: mk, notes: next }),
      });
    }, 600);
  }

  const settlement = useMemo(
    () =>
      computeAccountingSettlement({
        entries: entries.map((e) => ({ amount: e.amount, collector: e.collector })),
        expenses: expenses.map((x) => ({
          amount: x.amount,
          paid_by_partner: x.paid_by_partner ?? null,
        })),
      }),
    [entries, expenses],
  );

  const monthCurrency = useMemo(() => {
    const fromEntry = entries.find((e) => e.currency)?.currency;
    const fromExpense = expenses.find((e) => e.currency)?.currency;
    return fromEntry || fromExpense || 'EGP';
  }, [entries, expenses]);

  const visibleEntries = entries.filter((e) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      e.client_name.toLowerCase().includes(q) ||
      (e.service ?? '').toLowerCase().includes(q) ||
      (e.notes ?? '').toLowerCase().includes(q)
    );
  });

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeletingEntry(true);
    const endpoint =
      pendingDelete.type === 'revenue'
        ? `/api/docs/accounting/entries/${pendingDelete.id}`
        : pendingDelete.type === 'expense'
          ? `/api/docs/accounting/expenses/${pendingDelete.id}`
          : `/api/docs/accounting/transfers/${pendingDelete.id}`;
    const label =
      pendingDelete.type === 'revenue'
        ? 'Delete revenue'
        : pendingDelete.type === 'expense'
          ? 'Delete expense'
          : 'Delete transfer';
    try {
      const res = await fetch(endpoint, { method: 'DELETE' });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        toast(`${label}: ${data.error ?? `HTTP ${res.status}`}`, 'error');
        return;
      }
      toast(`${label}: done`, 'success');
      setPendingDelete(null);
      await loadData();
    } catch (err) {
      toast(`${label}: ${err instanceof Error ? err.message : t('unknownError')}`, 'error');
    } finally {
      setDeletingEntry(false);
    }
  }

  async function handleBackup() {
    const label = t('docAcctBackupLabel', { month });
    await fetch('/api/docs/backups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        module: 'accounting',
        data: { entries, expenses, transfers, monthNotes },
        label,
      }),
    });
  }

  async function exportPdf() {
    setPdfBusy(true);
    try {
      const ok = await exportPreviewPdf(
        'accounting-settlement-pdf',
        `settlement-${mk}`,
        'accounting',
      );
      if (!ok) toast(t('docQtPdfExportError'), 'error');
    } catch {
      toast(t('docQtPdfExportError'), 'error');
    } finally {
      setPdfBusy(false);
    }
  }

  const inp =
    'w-full px-3 py-1.5 text-sm rounded-lg border outline-none bg-[var(--surface-2)] border-[var(--border)] text-[var(--text)]';

  return (
    <>
      <DocsWorkspaceShell
        shellClassName="min-h-0"
        toolbar={
          <DocsToolbarLayout
            navigation={<DocsDocTypeTabs active="accounting" />}
            actions={
              <>
                <DocsDateField
                  value={month}
                  onChange={setMonth}
                  mode="month"
                  placeholder={t('docAcctSettlementMonth')}
                />
                <button
                  type="button"
                  disabled={pdfBusy}
                  onClick={() => void exportPdf()}
                  className="rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                  style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
                >
                  <Printer size={12} className="me-1 inline" />{' '}
                  {pdfBusy ? t('docPdfGenerating') : t('docQtToolbarPdf')}
                </button>
                <a
                  href={`/api/docs/accounting/export?month_key=${encodeURIComponent(mk)}${accountingDocumentCode ? `&document_code=${encodeURIComponent(accountingDocumentCode)}` : ''}`}
                  download
                  className="inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-semibold no-underline"
                  style={{ background: 'var(--accent)', color: 'var(--accent-foreground)' }}
                >
                  <Download size={12} className="me-1 inline" /> {t('docQtToolbarExcel')}
                </a>
              </>
            }
          >
            <p className="docs-toolbar-blurb">
              {t('docAcctPartnersBlurb', { a: PARTNER_A, b: PARTNER_B })}
            </p>
          </DocsToolbarLayout>
        }
        editor={
          <div className="max-h-[calc(100vh-10rem)] space-y-6 overflow-y-auto pe-1 lg:max-h-none">
            {loading ? (
              <p className="text-sm text-[var(--text-secondary)]">{t('docAcctLoadingMonth')}</p>
            ) : null}

            {!loading ? (
              <AccountingSettlementDashboard
                monthLabel={monthHeading(month, lang)}
                settlement={settlement}
                currency={monthCurrency}
                entriesCount={entries.length}
                expensesCount={expenses.length}
              />
            ) : null}

            <section
              className="rounded-2xl border p-4"
              style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-[var(--text)]">
                    {t('docAcctRevenuesSection')}
                  </h2>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    {t('docAcctRevenuesIntro')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAddEntry(true)}
                  className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-[var(--accent-foreground)]"
                  style={{ background: 'var(--accent)' }}
                >
                  <Plus size={14} /> {t('docAcctAddRevenueBtn')}
                </button>
              </div>
              <div className="mb-3">
                <ClientProfileSelector
                  profiles={profiles}
                  selectedClientId={selectedClientId}
                  onSelectClientId={setSelectedClientId}
                  label={t('docAcctClientContextOptional')}
                />
              </div>
              <div className="relative mb-3 max-w-xs">
                <Search
                  size={13}
                  className="absolute start-2.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]"
                />
                <input
                  className={clsx(inp, 'ps-8')}
                  placeholder={t('docAcctSearchRevenues')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div
                className="overflow-x-auto rounded-xl border"
                style={{ borderColor: 'var(--border)' }}
              >
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr
                      className="border-b bg-[var(--surface-2)]"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      {(
                        [
                          [t('docAcctColClient'), 'start'],
                          [t('docAcctColService'), 'start'],
                          [t('docAcctAmount'), 'end'],
                          [t('docAcctColCollector'), 'start'],
                          [t('docAcctColDate'), 'start'],
                          [t('docEmpColActions'), 'end'],
                        ] as const
                      ).map(([label, align]) => (
                        <th
                          key={label}
                          className={clsx(
                            'px-3 py-2 text-xs font-semibold text-[var(--text-secondary)]',
                            align === 'end' ? 'text-end' : 'text-start',
                          )}
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleEntries.map((e) => (
                      <tr key={e.id} className="border-t" style={{ borderColor: 'var(--border)' }}>
                        <td className="px-3 py-2 font-medium text-[var(--text)]">
                          {e.client_name}
                        </td>
                        <td className="px-3 py-2 text-[var(--text-secondary)]">
                          {e.service ?? t('commonEmptyDash')}
                        </td>
                        <td className="px-3 py-2 text-end font-semibold text-emerald-700">
                          {fmtMoney(e.amount, e.currency)}
                        </td>
                        <td className="px-3 py-2 text-[var(--text-secondary)]">
                          {e.collector ?? PARTNER_A}
                        </td>
                        <td className="px-3 py-2 text-[var(--text-secondary)]">{e.entry_date}</td>
                        <td className="px-3 py-2 text-end">
                          <button
                            type="button"
                            className="rounded p-1 hover:bg-[var(--accent-soft)]"
                            onClick={() => setEditEntry(e)}
                          >
                            <Edit2 size={13} className="text-[var(--accent)]" />
                          </button>
                          <button
                            type="button"
                            className="rounded p-1 hover:bg-red-50"
                            onClick={() => setPendingDelete({ id: e.id, type: 'revenue' })}
                          >
                            <Trash2 size={13} className="text-red-500" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section
              className="rounded-2xl border p-4"
              style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-[var(--text)]">
                    {t('docAcctExpensesSection')}
                  </h2>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    {t('docAcctExpensesIntro')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAddExpense(true)}
                  className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold"
                  style={{ background: 'var(--accent)', color: 'var(--accent-foreground)' }}
                >
                  <Plus size={14} /> {t('docAcctAddExpenseBtn')}
                </button>
              </div>
              <div
                className="overflow-x-auto rounded-xl border"
                style={{ borderColor: 'var(--border)' }}
              >
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr
                      className="border-b bg-[var(--surface-2)]"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      {(
                        [
                          [t('docAcctColDescription'), 'start'],
                          [t('docAcctAmount'), 'end'],
                          [t('docAcctColPaidBy'), 'start'],
                          [t('docAcctColDate'), 'start'],
                          [t('docEmpColActions'), 'end'],
                        ] as const
                      ).map(([label, align]) => (
                        <th
                          key={label}
                          className={clsx(
                            'px-3 py-2 text-xs font-semibold text-[var(--text-secondary)]',
                            align === 'end' ? 'text-end' : 'text-start',
                          )}
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((e) => (
                      <tr key={e.id} className="border-t" style={{ borderColor: 'var(--border)' }}>
                        <td className="px-3 py-2 font-medium text-[var(--text)]">
                          {e.description}
                        </td>
                        <td className="px-3 py-2 text-end font-semibold text-red-600">
                          {fmtMoney(e.amount, e.currency)}
                        </td>
                        <td className="px-3 py-2 text-[var(--text-secondary)]">
                          {e.paid_by_partner ?? PARTNER_B}
                        </td>
                        <td className="px-3 py-2 text-[var(--text-secondary)]">{e.expense_date}</td>
                        <td className="px-3 py-2 text-end">
                          <button
                            type="button"
                            className="rounded p-1 hover:bg-[var(--accent-soft)]"
                            onClick={() => setEditExpense(e)}
                          >
                            <Edit2 size={13} className="text-[var(--accent)]" />
                          </button>
                          <button
                            type="button"
                            className="rounded p-1 hover:bg-red-50"
                            onClick={() => setPendingDelete({ id: e.id, type: 'expense' })}
                          >
                            <Trash2 size={13} className="text-red-500" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section
              className="rounded-2xl border p-4"
              style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-[var(--text)]">
                  {t('docAcctPartnerTransfersSection')}
                </h2>
                <button
                  type="button"
                  onClick={() => setAddTransfer(true)}
                  className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                >
                  <Plus size={14} /> {t('docAcctLogTransferBtn')}
                </button>
              </div>
              <p className="mb-3 text-xs text-[var(--text-secondary)]">
                {t('docAcctTransfersIntroShort')} {t('docAcctTransfersHelp')}
              </p>
              <div
                className="overflow-x-auto rounded-xl border"
                style={{ borderColor: 'var(--border)' }}
              >
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr
                      className="border-b bg-[var(--surface-2)]"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      {(
                        [
                          [t('docAcctFrom'), 'start'],
                          [t('docAcctTo'), 'start'],
                          [t('docAcctAmount'), 'end'],
                          [t('docAcctColDate'), 'start'],
                          [t('docEmpColActions'), 'end'],
                        ] as const
                      ).map(([label, align]) => (
                        <th
                          key={label}
                          className={clsx(
                            'px-3 py-2 text-xs font-semibold text-[var(--text-secondary)]',
                            align === 'end' ? 'text-end' : 'text-start',
                          )}
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {transfers.map((tr) => (
                      <tr key={tr.id} className="border-t" style={{ borderColor: 'var(--border)' }}>
                        <td className="px-3 py-2 text-[var(--text)]">{tr.from_partner}</td>
                        <td className="px-3 py-2 text-[var(--text)]">{tr.to_partner}</td>
                        <td className="px-3 py-2 text-end font-semibold">
                          {fmtMoney(tr.amount, tr.currency)}
                        </td>
                        <td className="px-3 py-2 text-[var(--text-secondary)]">
                          {tr.transfer_date}
                        </td>
                        <td className="px-3 py-2 text-end">
                          <button
                            type="button"
                            className="rounded p-1 hover:bg-[var(--accent-soft)]"
                            onClick={() => setEditTransfer(tr)}
                          >
                            <Edit2 size={13} className="text-[var(--accent)]" />
                          </button>
                          <button
                            type="button"
                            className="rounded p-1 hover:bg-red-50"
                            onClick={() => setPendingDelete({ id: tr.id, type: 'transfer' })}
                          >
                            <Trash2 size={13} className="text-red-500" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section
              className="rounded-2xl border p-4"
              style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
            >
              <h2 className="mb-3 text-sm font-semibold text-[var(--text)]">
                {t('docAcctMonthNotesTitle')}
              </h2>
              <textarea
                className={inp}
                rows={4}
                value={monthNotes}
                onChange={(e) => scheduleSaveNotes(e.target.value)}
                placeholder={t('docAcctMonthNotesPlaceholder')}
              />
            </section>
          </div>
        }
        preview={
          <div className="docs-preview-shell overflow-x-auto">
            <div
              className="mb-3 rounded-xl border p-3 text-xs text-[var(--text-secondary)]"
              style={{ borderColor: 'var(--border)' }}
            >
              <div className="font-semibold text-[var(--text)]">{t('docAcctLiveSettlement')}</div>
              <div className="mt-1">{monthHeading(month, lang)}</div>
            </div>
            <SettlementPdfBlock
              monthLabelText={monthHeading(month, lang)}
              monthKeyStr={mk}
              settlement={settlement}
              entries={entries}
              expenses={expenses}
              transfers={transfers}
              monthNotes={monthNotes}
              reportCurrency={monthCurrency}
            />
          </div>
        }
        history={
          <div className="space-y-3 text-sm">
            <p className="text-[var(--text-secondary)]">{t('docAcctHistoryBlurb')}</p>
            <button
              type="button"
              onClick={() => void handleBackup()}
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold"
              style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
            >
              <Archive size={14} /> {t('docAcctBackupMonth')}
            </button>
          </div>
        }
      />

      {addEntry ? (
        <EntryModal
          monthKey={mk}
          selectedProfile={selectedProfile}
          onClose={() => setAddEntry(false)}
          onDone={loadData}
        />
      ) : null}
      {editEntry ? (
        <EntryModal
          initial={editEntry}
          monthKey={mk}
          selectedProfile={selectedProfile}
          onClose={() => setEditEntry(null)}
          onDone={loadData}
        />
      ) : null}
      {addExpense ? (
        <ExpenseModal monthKey={mk} onClose={() => setAddExpense(false)} onDone={loadData} />
      ) : null}
      {editExpense ? (
        <ExpenseModal
          initial={editExpense}
          monthKey={mk}
          onClose={() => setEditExpense(null)}
          onDone={loadData}
        />
      ) : null}
      {addTransfer ? (
        <TransferModal monthKey={mk} onClose={() => setAddTransfer(false)} onDone={loadData} />
      ) : null}
      {editTransfer ? (
        <TransferModal
          initial={editTransfer}
          monthKey={mk}
          onClose={() => setEditTransfer(null)}
          onDone={loadData}
        />
      ) : null}
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={
          pendingDelete?.type === 'revenue'
            ? 'Delete revenue entry'
            : pendingDelete?.type === 'expense'
              ? 'Delete expense entry'
              : 'Delete transfer entry'
        }
        description="This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel={t('cancel')}
        destructive
        loading={deletingEntry}
        onCancel={() => {
          if (deletingEntry) return;
          setPendingDelete(null);
        }}
        onConfirm={confirmDelete}
      />
    </>
  );
}
