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
import { DocsDocTypeTabs, DocsWorkspaceShell } from '@/components/docs/DocsWorkspace';
import { computeAccountingSettlement } from '@/lib/accounting-settlement';
import { exportPreviewPdf } from '@/lib/docs-print';
import { OPENY_DOC_STYLE } from '@/lib/openy-brand';

const [PARTNER_A, PARTNER_B] = ACCOUNTING_COLLECTORS;

function today() {
  return new Date().toISOString().slice(0, 10);
}
function thisMonth() {
  return new Date().toISOString().slice(0, 7);
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

function monthHeading(month: string) {
  const [y, mo] = month.split('-').map(Number);
  if (!y || !mo) return month;
  return new Date(y, mo - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
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
          currency: 'SAR',
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
      setError('Client name is required');
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
        setError((await res.json()).error ?? 'Save failed');
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
      title={initial ? 'Edit revenue' : 'Add revenue'}
      size="sm"
      bodyClassName="space-y-3"
      footer={
        <>
          <button type="button" onClick={onClose} className="openy-modal-btn-secondary flex-1">
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="openy-modal-btn-primary flex-1 disabled:opacity-60"
          >
            {saving ? 'Saving…' : initial ? 'Update' : 'Add'}
          </button>
        </>
      }
    >
      {error ? (
        <div
          className="mb-3 rounded-lg px-3 py-2 text-sm"
          style={{ background: 'rgba(239,68,68,0.08)', color: '#dc2626' }}
        >
          {error}
        </div>
      ) : null}
      <div className="space-y-3">
        <div>
          {lbl('Client *')}
          <input
            className={inp}
            value={form.client_name}
            onChange={(e) => setF('client_name', e.target.value)}
          />
        </div>
        <div>
          {lbl('Service')}
          <input
            className={inp}
            value={form.service}
            onChange={(e) => setF('service', e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            {lbl('Amount')}
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
            {lbl('Currency')}
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
          {lbl('Collected by')}
          <SelectDropdown
            fullWidth
            className={inp}
            value={form.collector}
            onChange={(v) => setCollector(v)}
            options={[
              { value: PARTNER_A, label: PARTNER_A },
              { value: PARTNER_B, label: PARTNER_B },
            ]}
          />
        </div>
        <div>
          {lbl('Entry date')}
          <input
            type="date"
            className={inp}
            value={form.entry_date}
            onChange={(e) => setF('entry_date', e.target.value)}
          />
        </div>
        <div>
          {lbl('Notes')}
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
          currency: 'SAR',
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
      setError('Description is required');
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
        setError((await res.json()).error ?? 'Save failed');
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
      title={initial ? 'Edit expense' : 'Add expense'}
      size="sm"
      bodyClassName="space-y-3"
      footer={
        <>
          <button type="button" onClick={onClose} className="openy-modal-btn-secondary flex-1">
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="openy-modal-btn-primary flex-1 disabled:opacity-60"
          >
            {saving ? 'Saving…' : initial ? 'Update' : 'Add'}
          </button>
        </>
      }
    >
      {error ? (
        <div
          className="mb-3 rounded-lg px-3 py-2 text-sm"
          style={{ background: 'rgba(239,68,68,0.08)', color: '#dc2626' }}
        >
          {error}
        </div>
      ) : null}
      <div className="space-y-3">
        <div>
          {lbl('Description *')}
          <input
            className={inp}
            value={form.description}
            onChange={(e) => setF('description', e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            {lbl('Amount')}
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
            {lbl('Currency')}
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
          {lbl('Paid by partner')}
          <SelectDropdown
            fullWidth
            className={inp}
            value={form.paid_by_partner}
            onChange={(v) => setF('paid_by_partner', v)}
            options={[
              { value: PARTNER_A, label: PARTNER_A },
              { value: PARTNER_B, label: PARTNER_B },
            ]}
          />
        </div>
        <div>
          {lbl('Expense date')}
          <input
            type="date"
            className={inp}
            value={form.expense_date}
            onChange={(e) => setF('expense_date', e.target.value)}
          />
        </div>
        <div>
          {lbl('Notes')}
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
          currency: 'SAR',
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
      setError('From and to must differ');
      return;
    }
    if (!Number.isFinite(form.amount) || form.amount <= 0) {
      setError('Amount must be greater than zero');
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
        setError((await res.json()).error ?? 'Save failed');
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
      title={initial ? 'Edit transfer' : 'Log partner transfer'}
      size="sm"
      bodyClassName="space-y-3"
      footer={
        <>
          <button type="button" onClick={onClose} className="openy-modal-btn-secondary flex-1">
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="openy-modal-btn-primary flex-1 disabled:opacity-60"
          >
            {saving ? 'Saving…' : initial ? 'Update' : 'Add'}
          </button>
        </>
      }
    >
      {error ? (
        <div
          className="mb-3 rounded-lg px-3 py-2 text-sm"
          style={{ background: 'rgba(239,68,68,0.08)', color: '#dc2626' }}
        >
          {error}
        </div>
      ) : null}
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            {lbl('From')}
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
            {lbl('To')}
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
            {lbl('Amount')}
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
            {lbl('Currency')}
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
          {lbl('Transfer date')}
          <input
            type="date"
            className={inp}
            value={form.transfer_date}
            onChange={(e) => setF('transfer_date', e.target.value)}
          />
        </div>
        <div>
          {lbl('Notes')}
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

// ── PDF / preview block ───────────────────────────────────────────────────────

function SettlementPdfBlock({
  monthLabelText,
  monthKeyStr,
  settlement,
  entries,
  expenses,
  transfers,
  monthNotes,
}: {
  monthLabelText: string;
  monthKeyStr: string;
  settlement: ReturnType<typeof computeAccountingSettlement>;
  entries: DocsAccountingEntry[];
  expenses: DocsAccountingExpense[];
  transfers: DocsAccountingTransfer[];
  monthNotes: string;
}) {
  const s = OPENY_DOC_STYLE;
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
        <div style={{ fontSize: 11, color: s.textMuted, letterSpacing: '0.08em' }}>OPENY DOCS</div>
        <h1 style={{ margin: '6px 0 0', fontSize: 22, color: s.title }}>
          Monthly partner settlement
        </h1>
        <div style={{ fontSize: 13, color: s.textMuted, marginTop: 4 }}>
          {monthLabelText} · <span style={{ fontFamily: 'monospace' }}>{monthKeyStr}</span>
        </div>
      </div>

      <section style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 13, margin: '0 0 10px', color: s.title }}>Settlement summary</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <tbody>
            {[
              ['Total revenue', fmtMoney(settlement.totalRevenue)],
              ['Total expenses', fmtMoney(settlement.totalExpenses)],
              ['Net profit', fmtMoney(settlement.netProfit)],
              ['Partner share (net ÷ 2)', fmtMoney(settlement.partnerShare)],
              [`Collected — ${PARTNER_A}`, fmtMoney(settlement.collectedBy[PARTNER_A] ?? 0)],
              [`Collected — ${PARTNER_B}`, fmtMoney(settlement.collectedBy[PARTNER_B] ?? 0)],
              [`Expenses paid — ${PARTNER_A}`, fmtMoney(settlement.expensesPaidBy[PARTNER_A] ?? 0)],
              [`Expenses paid — ${PARTNER_B}`, fmtMoney(settlement.expensesPaidBy[PARTNER_B] ?? 0)],
              [`Net in hand — ${PARTNER_A}`, fmtMoney(settlement.netInHand[PARTNER_A] ?? 0)],
              [`Net in hand — ${PARTNER_B}`, fmtMoney(settlement.netInHand[PARTNER_B] ?? 0)],
            ].map(([k, v]) => (
              <tr key={k} style={{ borderBottom: `1px solid ${s.border}` }}>
                <td style={{ padding: '6px 0', color: s.textMuted }}>{k}</td>
                <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 600 }}>{v}</td>
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
          {settlement.debtor
            ? `${settlement.debtor} owes ${settlement.creditor}: ${fmtMoney(settlement.settlementAmount)}`
            : 'Partners are balanced for this month.'}
        </div>
      </section>

      <section style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 13, margin: '0 0 8px', color: s.title }}>Revenues</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr style={{ background: s.headerBg, color: s.headerText }}>
              <th style={{ textAlign: 'left', padding: 6 }}>Client</th>
              <th style={{ textAlign: 'right', padding: 6 }}>Amount</th>
              <th style={{ textAlign: 'left', padding: 6 }}>Collector</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} style={{ borderBottom: `1px solid ${s.border}` }}>
                <td style={{ padding: 6 }}>{e.client_name}</td>
                <td style={{ padding: 6, textAlign: 'right' }}>{fmtMoney(e.amount, e.currency)}</td>
                <td style={{ padding: 6, color: s.textMuted }}>{e.collector ?? PARTNER_A}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 13, margin: '0 0 8px', color: s.title }}>Expenses</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr style={{ background: s.headerBg, color: s.headerText }}>
              <th style={{ textAlign: 'left', padding: 6 }}>Description</th>
              <th style={{ textAlign: 'right', padding: 6 }}>Amount</th>
              <th style={{ textAlign: 'left', padding: 6 }}>Paid by</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((e) => (
              <tr key={e.id} style={{ borderBottom: `1px solid ${s.border}` }}>
                <td style={{ padding: 6 }}>{e.description}</td>
                <td style={{ padding: 6, textAlign: 'right' }}>{fmtMoney(e.amount, e.currency)}</td>
                <td style={{ padding: 6, color: s.textMuted }}>{e.paid_by_partner ?? PARTNER_B}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 13, margin: '0 0 8px', color: s.title }}>
          Partner transfers (record)
        </h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr style={{ background: s.headerBg, color: s.headerText }}>
              <th style={{ textAlign: 'left', padding: 6 }}>From</th>
              <th style={{ textAlign: 'left', padding: 6 }}>To</th>
              <th style={{ textAlign: 'right', padding: 6 }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {transfers.length === 0 ? (
              <tr>
                <td colSpan={3} style={{ padding: 8, color: s.textMuted }}>
                  No transfers logged.
                </td>
              </tr>
            ) : (
              transfers.map((t) => (
                <tr key={t.id} style={{ borderBottom: `1px solid ${s.border}` }}>
                  <td style={{ padding: 6 }}>{t.from_partner}</td>
                  <td style={{ padding: 6 }}>{t.to_partner}</td>
                  <td style={{ padding: 6, textAlign: 'right' }}>
                    {fmtMoney(t.amount, t.currency)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section>
        <h2 style={{ fontSize: 13, margin: '0 0 8px', color: s.title }}>Month notes</h2>
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
          {monthNotes || '—'}
        </div>
      </section>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AccountingPage() {
  const [month, setMonth] = useState(thisMonth());
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

  const visibleEntries = entries.filter((e) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      e.client_name.toLowerCase().includes(q) ||
      (e.service ?? '').toLowerCase().includes(q) ||
      (e.notes ?? '').toLowerCase().includes(q)
    );
  });

  async function deleteEntry(id: string) {
    if (!confirm('Delete this revenue line?')) return;
    await fetch(`/api/docs/accounting/entries/${id}`, { method: 'DELETE' });
    await loadData();
  }

  async function deleteExpense(id: string) {
    if (!confirm('Delete this expense?')) return;
    await fetch(`/api/docs/accounting/expenses/${id}`, { method: 'DELETE' });
    await loadData();
  }

  async function deleteTransfer(id: string) {
    if (!confirm('Delete this transfer record?')) return;
    await fetch(`/api/docs/accounting/transfers/${id}`, { method: 'DELETE' });
    await loadData();
  }

  async function handleBackup() {
    const label = `Backup ${month} (accounting)`;
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
    await exportPreviewPdf('accounting-settlement-pdf', `settlement-${mk}`, 'accounting');
  }

  const inp =
    'w-full px-3 py-1.5 text-sm rounded-lg border outline-none bg-[var(--surface-2)] border-[var(--border)] text-[var(--text)]';

  return (
    <>
      <DocsWorkspaceShell
        shellClassName="min-h-0"
        toolbar={
          <div className="docs-workspace-quickbar">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <DocsDocTypeTabs active="accounting" />
              <div className="flex flex-wrap items-center gap-2">
                <DocsDateField
                  value={month}
                  onChange={setMonth}
                  mode="month"
                  placeholder="Settlement month"
                />
                <button
                  type="button"
                  onClick={() => void exportPdf()}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
                  style={{ background: '#0f172a' }}
                >
                  <Printer size={12} className="mr-1 inline" /> PDF
                </button>
                <a
                  href={`/api/docs/accounting/export?month_key=${encodeURIComponent(mk)}${accountingDocumentCode ? `&document_code=${encodeURIComponent(accountingDocumentCode)}` : ''}`}
                  download
                  className="inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-semibold text-white no-underline"
                  style={{ background: '#059669' }}
                >
                  <Download size={12} className="mr-1 inline" /> Excel
                </a>
              </div>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">
              Partners: <strong className="text-[var(--text)]">{PARTNER_A}</strong> &{' '}
              <strong className="text-[var(--text)]">{PARTNER_B}</strong>. Net profit is split
              equally. Each partner&apos;s net in hand = collected revenue − expenses they paid.
              Settlement closes the gap to an equal share of net profit.
            </p>
          </div>
        }
        editor={
          <div className="max-h-[calc(100vh-10rem)] space-y-6 overflow-y-auto pr-1 lg:max-h-none">
            {loading ? (
              <p className="text-sm text-[var(--text-secondary)]">Loading month…</p>
            ) : null}

            <section
              className="rounded-2xl border p-4"
              style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
            >
              <h2 className="mb-3 text-sm font-semibold text-[var(--text)]">Month notes</h2>
              <textarea
                className={inp}
                rows={4}
                value={monthNotes}
                onChange={(e) => scheduleSaveNotes(e.target.value)}
                placeholder="Internal notes for this month (saved automatically)…"
              />
            </section>

            <section
              className="rounded-2xl border p-4"
              style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-[var(--text)]">Revenues</h2>
                <button
                  type="button"
                  onClick={() => setAddEntry(true)}
                  className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
                  style={{ background: 'var(--accent)' }}
                >
                  <Plus size={14} /> Add revenue
                </button>
              </div>
              <div className="mb-3">
                <ClientProfileSelector
                  profiles={profiles}
                  selectedClientId={selectedClientId}
                  onSelectClientId={setSelectedClientId}
                  label="Client context (optional)"
                />
              </div>
              <div className="relative mb-3 max-w-xs">
                <Search
                  size={13}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]"
                />
                <input
                  className={clsx(inp, 'pl-8')}
                  placeholder="Search revenues…"
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
                      {['Client', 'Service', 'Amount', 'Collector', 'Date', ''].map((h) => (
                        <th
                          key={h}
                          className={clsx(
                            'px-3 py-2 text-left text-xs font-semibold text-[var(--text-secondary)]',
                            h === 'Amount' && 'text-right',
                          )}
                        >
                          {h}
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
                          {e.service ?? '—'}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-emerald-700">
                          {fmtMoney(e.amount, e.currency)}
                        </td>
                        <td className="px-3 py-2 text-[var(--text-secondary)]">
                          {e.collector ?? PARTNER_A}
                        </td>
                        <td className="px-3 py-2 text-[var(--text-secondary)]">{e.entry_date}</td>
                        <td className="px-3 py-2 text-right">
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
                            onClick={() => void deleteEntry(e.id)}
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
                <h2 className="text-sm font-semibold text-[var(--text)]">Expenses</h2>
                <button
                  type="button"
                  onClick={() => setAddExpense(true)}
                  className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
                  style={{ background: '#0f172a' }}
                >
                  <Plus size={14} /> Add expense
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
                      {['Description', 'Amount', 'Paid by', 'Date', ''].map((h) => (
                        <th
                          key={h}
                          className={clsx(
                            'px-3 py-2 text-left text-xs font-semibold text-[var(--text-secondary)]',
                            h === 'Amount' && 'text-right',
                          )}
                        >
                          {h}
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
                        <td className="px-3 py-2 text-right font-semibold text-red-600">
                          {fmtMoney(e.amount, e.currency)}
                        </td>
                        <td className="px-3 py-2 text-[var(--text-secondary)]">
                          {e.paid_by_partner ?? PARTNER_B}
                        </td>
                        <td className="px-3 py-2 text-[var(--text-secondary)]">{e.expense_date}</td>
                        <td className="px-3 py-2 text-right">
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
                            onClick={() => void deleteExpense(e.id)}
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
                <h2 className="text-sm font-semibold text-[var(--text)]">Partner transfers</h2>
                <button
                  type="button"
                  onClick={() => setAddTransfer(true)}
                  className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                >
                  <Plus size={14} /> Log transfer
                </button>
              </div>
              <p className="mb-3 text-xs text-[var(--text-secondary)]">
                Record cash or bank movements between partners. Totals below still follow revenue
                and expenses; this section is your audit trail.
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
                      {['From', 'To', 'Amount', 'Date', ''].map((h) => (
                        <th
                          key={h}
                          className={clsx(
                            'px-3 py-2 text-left text-xs font-semibold text-[var(--text-secondary)]',
                            h === 'Amount' && 'text-right',
                          )}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {transfers.map((t) => (
                      <tr key={t.id} className="border-t" style={{ borderColor: 'var(--border)' }}>
                        <td className="px-3 py-2 text-[var(--text)]">{t.from_partner}</td>
                        <td className="px-3 py-2 text-[var(--text)]">{t.to_partner}</td>
                        <td className="px-3 py-2 text-right font-semibold">
                          {fmtMoney(t.amount, t.currency)}
                        </td>
                        <td className="px-3 py-2 text-[var(--text-secondary)]">
                          {t.transfer_date}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            className="rounded p-1 hover:bg-[var(--accent-soft)]"
                            onClick={() => setEditTransfer(t)}
                          >
                            <Edit2 size={13} className="text-[var(--accent)]" />
                          </button>
                          <button
                            type="button"
                            className="rounded p-1 hover:bg-red-50"
                            onClick={() => void deleteTransfer(t.id)}
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
          </div>
        }
        preview={
          <div className="docs-preview-shell overflow-x-auto">
            <div
              className="mb-3 rounded-xl border p-3 text-xs text-[var(--text-secondary)]"
              style={{ borderColor: 'var(--border)' }}
            >
              <div className="font-semibold text-[var(--text)]">Live settlement</div>
              <div className="mt-1">{monthHeading(month)}</div>
            </div>
            <SettlementPdfBlock
              monthLabelText={monthHeading(month)}
              monthKeyStr={mk}
              settlement={settlement}
              entries={entries}
              expenses={expenses}
              transfers={transfers}
              monthNotes={monthNotes}
            />
          </div>
        }
        history={
          <div className="space-y-3 text-sm">
            <p className="text-[var(--text-secondary)]">
              Export PDF or Excel from the toolbar. Use backup to snapshot this month&apos;s lines
              in OPENY backups.
            </p>
            <button
              type="button"
              onClick={() => void handleBackup()}
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold"
              style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
            >
              <Archive size={14} /> Backup month data
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
    </>
  );
}
