'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Save,
  Copy,
  Edit2,
  RotateCcw,
  Search,
  Download,
  Printer,
  Check,
  AlertCircle,
  Archive,
  ExternalLink,
} from 'lucide-react';
import clsx from 'clsx';
import {
  type DocsQuotation,
  type QuotationDeliverable,
  DOCS_CURRENCIES,
  DOCS_PAYMENT_METHODS,
} from '@/lib/docs-types';
import ClientProfileSelector from '@/components/docs/ClientProfileSelector';
import {
  type DocsClientProfile,
  fetchDocsClientProfiles,
  isVirtualDocsProfileId,
} from '@/lib/docs-client-profiles';
import { exportPreviewPdf } from '@/lib/docs-print';
import ScaledDocumentPreview from '@/components/docs/ScaledDocumentPreview';
import AppModal from '@/components/ui/AppModal';
import SelectDropdown from '@/components/ui/SelectDropdown';
import ConfirmDialog from '@/components/ui/actions/ConfirmDialog';
import {
  DocsDocTypeTabs,
  DocsToolbarLayout,
  DocsWorkspaceShell,
} from '@/components/docs/DocsWorkspace';
import {
  OpenyClientBlock,
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
import { nextPrefixedSequential } from '@/lib/docs-doc-numbers';
import { useLang } from '@/context/lang-context';

type DocsT = (key: string, vars?: Record<string, string | number>) => string;

function docsPaymentMethodLabel(method: string, t: DocsT) {
  const map: Record<string, string> = {
    'Bank Transfer': t('docPayBankTransfer'),
    Cash: t('docPayCash'),
    Cheque: t('docPayCheque'),
    'Online Payment': t('docPayOnline'),
    'Credit Card': t('docPayCreditCard'),
    Custom: t('docPayCustom'),
  };
  return map[method] ?? method;
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}
function fmt(n: number, cur: string, lang: 'en' | 'ar') {
  return new Intl.NumberFormat(lang === 'ar' ? 'ar-SA' : 'en-US', {
    style: 'currency',
    currency: cur,
    minimumFractionDigits: 2,
  }).format(n);
}
function today() {
  return new Date().toISOString().slice(0, 10);
}
function nextQNum(list: DocsQuotation[]) {
  return nextPrefixedSequential(
    list.map((q) => q.quote_number),
    'QUO',
  );
}

interface FormState {
  client_profile_id: string | null;
  quote_number: string;
  quote_date: string;
  currency: string;
  client_name: string;
  company_brand: string;
  project_title: string;
  project_description: string;
  deliverables: QuotationDeliverable[];
  total_value: number;
  payment_due_days: number;
  payment_method: string;
  custom_payment_method: string;
  additional_notes: string;
  status: 'paid' | 'unpaid';
}

function blank(num: string): FormState {
  return {
    client_profile_id: null,
    quote_number: num,
    quote_date: today(),
    currency: 'SAR',
    client_name: '',
    company_brand: '',
    project_title: '',
    project_description: '',
    deliverables: [],
    total_value: 0,
    payment_due_days: 30,
    payment_method: 'Bank Transfer',
    custom_payment_method: '',
    additional_notes: '',
    status: 'unpaid',
  };
}

function QuotationPreview({ form }: { form: FormState }) {
  const { t, lang } = useLang();
  const delivTotal = form.deliverables.reduce((s, d) => s + d.total, 0);
  const total = form.total_value || delivTotal;
  const finalBudget = delivTotal > 0 ? delivTotal : total;
  const ourFees = Math.max(0, total - finalBudget);

  return (
    <OpenyDocumentPage id="quotation-preview" fontSize={13}>
      <OpenyDocumentHeader
        title={t('docQtStamp')}
        number={form.quote_number}
        date={form.quote_date}
      />
      <OpenyClientBlock
        label={t('docQtPreparedFor')}
        name={form.client_name || t('commonEmptyDash')}
        subtext={form.project_title || form.company_brand || form.project_description || undefined}
      />
      <div>
        <div style={{ display: 'flex', gap: 24, marginBottom: 24 }}>
          <div style={{ flex: 1 }}>
            {form.company_brand && (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {form.company_brand}
              </div>
            )}
            {form.project_title && (
              <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>
                {form.project_title}
              </div>
            )}
            {form.project_description && (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                {form.project_description}
              </div>
            )}
          </div>
          <div style={{ textAlign: 'end' }}>
            <table style={{ fontSize: 12 }}>
              <tbody>
                <tr>
                  <td style={openyMetaKeyStyle()}>{t('docQtLabelDate')}</td>
                  <td style={{ fontWeight: 600 }}>{form.quote_date || t('commonEmptyDash')}</td>
                </tr>
                <tr>
                  <td style={openyMetaKeyStyle()}>{t('docQtLabelCurrency')}</td>
                  <td style={{ fontWeight: 600 }}>{form.currency}</td>
                </tr>
                <tr>
                  <td style={openyMetaKeyStyle()}>{t('docQtLabelDueInShort')}</td>
                  <td style={{ fontWeight: 600 }}>
                    {t('docQtDaysCount', { n: form.payment_due_days })}
                  </td>
                </tr>
                <tr>
                  <td style={openyMetaKeyStyle()}>{t('docQtLabelStatusShort')}</td>
                  <td>
                    <span style={openyStatusPillStyle(form.status)}>
                      {form.status === 'paid' ? t('docStatusPaid') : t('docStatusUnpaid')}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {form.deliverables.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <OpenySectionTitle>{t('docQtScopeOfWork')}</OpenySectionTitle>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={openyTableHeaderStyle()}>
                  <th style={openyThStyle('left')}>{t('docQtColDescription')}</th>
                  <th style={openyThStyle('center', { width: 60 })}>{t('docQtColQty')}</th>
                  <th style={openyThStyle('right', { width: 110 })}>{t('docQtColUnitPrice')}</th>
                  <th style={openyThStyle('right', { width: 110 })}>{t('docQtColTotal')}</th>
                </tr>
              </thead>
              <tbody>
                {form.deliverables.map((d) => (
                  <tr key={d.id}>
                    <td style={openyTdStyle('left')}>{d.description}</td>
                    <td style={openyTdStyle('center', false, { whiteSpace: 'nowrap' })}>
                      {d.quantity}
                    </td>
                    <td style={openyTdStyle('right', false, { whiteSpace: 'nowrap' })}>
                      {fmt(d.unitPrice, form.currency, lang)}
                    </td>
                    <td style={openyTdStyle('right', true, { whiteSpace: 'nowrap' })}>
                      {fmt(d.total, form.currency, lang)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div
          className="avoid-break"
          style={{
            pageBreakInside: 'avoid',
            display: 'flex',
            justifyContent: 'flex-end',
            marginTop: 16,
            marginBottom: 24,
          }}
        >
          <table style={{ width: 300, borderCollapse: 'collapse', fontSize: 12 }}>
            <tbody>
              {delivTotal > 0 && form.total_value > 0 && delivTotal !== form.total_value && (
                <tr>
                  <td
                    style={{
                      border: '1px solid #111',
                      padding: '8px 10px',
                      color: '#111',
                      fontWeight: 700,
                    }}
                  >
                    {t('docQtSubtotal')}
                  </td>
                  <td
                    style={{
                      border: '1px solid #111',
                      textAlign: 'right',
                      padding: '8px 10px',
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {fmt(finalBudget, form.currency, lang)}
                  </td>
                </tr>
              )}
              <tr>
                <td style={{ border: '1px solid #111', padding: '8px 10px', fontWeight: 700 }}>
                  {t('docQtFinalBudgetLabel')}
                </td>
                <td
                  style={{
                    border: '1px solid #111',
                    textAlign: 'right',
                    padding: '8px 10px',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {fmt(finalBudget, form.currency, lang)}
                </td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #111', padding: '8px 10px', fontWeight: 700 }}>
                  {t('docOurFees')}
                </td>
                <td
                  style={{
                    border: '1px solid #111',
                    textAlign: 'right',
                    padding: '8px 10px',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {fmt(ourFees, form.currency, lang)}
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    border: '1px solid #111',
                    background: '#111',
                    color: 'var(--accent-foreground)',
                    padding: '8px 10px',
                    fontWeight: 700,
                    fontSize: 12,
                    textAlign: 'center',
                  }}
                >
                  {t('docGrandTotal')}
                </td>
                <td
                  style={{
                    border: '1px solid #111',
                    background: '#111',
                    color: 'var(--accent-foreground)',
                    textAlign: 'center',
                    padding: '8px 10px',
                    fontWeight: 700,
                    fontSize: 12,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {fmt(total, form.currency, lang)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style={{ marginBottom: 20 }}>
          <OpenySectionTitle>{t('docQtPaymentTerms')}</OpenySectionTitle>
          <div style={{ fontSize: 12, marginBottom: 4 }}>
            <span style={{ color: OPENY_DOC_STYLE.textMuted }}>{t('docQtMethodPrefix')} </span>
            {form.payment_method === 'Custom'
              ? form.custom_payment_method
              : docsPaymentMethodLabel(form.payment_method, t)}
          </div>
          <div style={{ fontSize: 12 }}>
            <span style={{ color: OPENY_DOC_STYLE.textMuted }}>{t('docQtDuePrefix')} </span>
            {t('docQtDueFromInvoice', { n: form.payment_due_days })}
          </div>
        </div>

        {form.additional_notes && (
          <div style={{ borderTop: `1px solid ${OPENY_DOC_STYLE.border}`, paddingTop: 16 }}>
            <div
              style={{
                fontWeight: 700,
                fontSize: 12,
                color: OPENY_DOC_STYLE.textMuted,
                marginBottom: 4,
              }}
            >
              {t('docQtNotesHeading')}
            </div>
            <div style={{ fontSize: 12 }}>{form.additional_notes}</div>
          </div>
        )}

        <div style={{ marginTop: 40, display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ textAlign: 'center', width: 200 }}>
            <div
              style={{
                borderTop: `1px solid ${OPENY_DOC_STYLE.borderStrong}`,
                paddingTop: 8,
                fontSize: 11,
                color: OPENY_DOC_STYLE.textMuted,
              }}
            >
              {t('docQtSigPreparer')}
            </div>
          </div>
          <div style={{ textAlign: 'center', width: 200 }}>
            <div
              style={{
                borderTop: `1px solid ${OPENY_DOC_STYLE.borderStrong}`,
                paddingTop: 8,
                fontSize: 11,
                color: OPENY_DOC_STYLE.textMuted,
              }}
            >
              {t('docQtSigClient')}
            </div>
          </div>
        </div>
      </div>
    </OpenyDocumentPage>
  );
}

function BackupModal({
  module,
  onClose,
  onRestore,
}: {
  module: string;
  onClose: () => void;
  onRestore: (data: unknown) => void;
}) {
  const { t, lang } = useLang();
  const [backups, setBackups] = useState<
    Array<{ id: string; label: string | null; created_at: string }>
  >([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch(`/api/docs/backups?module=${module}`)
      .then((r) => r.json())
      .then((j) => setBackups(j.backups ?? []))
      .finally(() => setLoading(false));
  }, [module]);
  async function restore(id: string) {
    const r = await fetch(`/api/docs/backups/${id}`);
    const j = await r.json();
    if (j.backup?.data) {
      onRestore(j.backup.data);
      onClose();
    }
  }
  async function deleteBackup(id: string) {
    await fetch(`/api/docs/backups/${id}`, { method: 'DELETE' });
    setBackups((b) => b.filter((x) => x.id !== id));
  }
  return (
    <AppModal
      open
      onClose={onClose}
      title={t('docBackupRestoreTitle')}
      size="sm"
      bodyClassName="space-y-2"
      footer={
        <button onClick={onClose} className="openy-modal-btn-secondary w-full">
          {t('docBackupClose')}
        </button>
      }
    >
      {loading && (
        <p className="py-4 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
          {t('docBackupLoadingList')}
        </p>
      )}
      {!loading && backups.length === 0 && (
        <p className="py-4 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
          {t('docBackupNone')}
        </p>
      )}
      <div className="max-h-80 space-y-2 overflow-y-auto">
        {backups.map((b) => (
          <div
            key={b.id}
            className="flex items-center justify-between rounded-xl border px-3 py-2.5"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
          >
            <div>
              <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                {b.label ?? t('docBackupDefaultName')}
              </div>
              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {new Date(b.created_at).toLocaleString(lang === 'ar' ? 'ar-SA' : 'en-US', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => restore(b.id)}
                className="rounded-lg px-2.5 py-1 text-xs font-medium text-[var(--accent-foreground)]"
                style={{ background: 'var(--accent)' }}
              >
                {t('docBackupRestoreBtn')}
              </button>
              <button
                onClick={() => deleteBackup(b.id)}
                className="rounded-lg p-1.5 hover:bg-red-50"
              >
                <Trash2 size={12} style={{ color: 'var(--text-primary)' }} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </AppModal>
  );
}

function HistoryPanel({
  quotations,
  loading,
  onEdit,
  onDuplicate,
  onDelete,
  onReload,
  onBackup,
  onClearAll,
  onRestoreData,
}: {
  quotations: DocsQuotation[];
  loading: boolean;
  onEdit: (q: DocsQuotation) => void;
  onDuplicate: (q: DocsQuotation) => void;
  onDelete: (id: string) => void;
  onReload: () => void;
  onBackup: () => Promise<void>;
  onClearAll: () => Promise<void>;
  onRestoreData: (data: unknown) => void;
}) {
  const { t, lang } = useLang();
  const [search, setSearch] = useState('');
  const [statusF, setStatusF] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [showRestore, setShowRestore] = useState(false);
  const [backing, setBacking] = useState(false);
  const [clearing, setClearing] = useState(false);

  const visible = quotations.filter((q) => {
    if (statusF !== 'all' && q.status !== statusF) return false;
    if (
      search &&
      !q.quote_number.toLowerCase().includes(search.toLowerCase()) &&
      !q.client_name.toLowerCase().includes(search.toLowerCase())
    )
      return false;
    return true;
  });

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-2 border-b p-4" style={{ borderColor: 'var(--border)' }}>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search
              size={14}
              className="absolute start-2.5 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--text-secondary)' }}
            />
            <input
              className="w-full rounded-lg border py-1.5 pe-3 ps-8 text-sm outline-none"
              style={{
                background: 'var(--surface-2)',
                borderColor: 'var(--border)',
                color: 'var(--text)',
              }}
              placeholder={t('docQtSearchQuotes')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button onClick={onReload} className="rounded-lg p-1.5 hover:bg-[var(--surface-2)]">
            <RotateCcw size={14} style={{ color: 'var(--text-secondary)' }} />
          </button>
          <button
            onClick={async () => {
              setBacking(true);
              try {
                await onBackup();
              } finally {
                setBacking(false);
              }
            }}
            disabled={backing}
            className="rounded-lg p-1.5 hover:bg-[var(--accent-soft)]"
            title={t('docBackupTooltipAll')}
          >
            <Archive
              size={14}
              style={{ color: backing ? 'var(--text-secondary)' : 'var(--accent)' }}
            />
          </button>
          <button
            onClick={() => setShowRestore(true)}
            className="rounded-lg p-1.5 hover:bg-[var(--surface-2)]"
            title={t('docBackupTooltipRestore')}
          >
            <RotateCcw size={14} style={{ color: 'var(--text-secondary)' }} />
          </button>
          <button
            onClick={async () => {
              if (!confirm(t('docQtConfirmClearAllQuotes'))) return;
              setClearing(true);
              try {
                await onClearAll();
              } finally {
                setClearing(false);
              }
            }}
            disabled={clearing}
            className="rounded-lg p-1.5 hover:bg-red-50"
            title={t('docBackupTooltipClearAll')}
          >
            <Trash2 size={14} style={{ color: 'var(--text-primary)' }} />
          </button>
        </div>
        <div className="flex gap-2">
          {(
            [
              ['all', 'all'] as const,
              ['paid', 'docStatusPaid'] as const,
              ['unpaid', 'docStatusUnpaid'] as const,
            ] as const
          ).map(([s, labelKey]) => (
            <button
              key={s}
              onClick={() => setStatusF(s)}
              className={clsx(
                'rounded-full px-2.5 py-1 text-xs font-medium',
                statusF === s
                  ? 'bg-[var(--accent)] text-[var(--accent-foreground)]'
                  : 'bg-[var(--surface-2)] text-[var(--text-secondary)]',
              )}
            >
              {labelKey === 'all' ? t('all') : t(labelKey)}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 divide-y overflow-y-auto" style={{ borderColor: 'var(--border)' }}>
        {loading && (
          <div className="p-6 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
            {t('docLoading')}
          </div>
        )}
        {!loading && visible.length === 0 && (
          <div className="p-6 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
            {t('docQtEmptyQuotes')}
          </div>
        )}
        {visible.map((q) => (
          <div key={q.id} className="p-3 hover:bg-[var(--surface-2)]">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                    {q.quote_number}
                  </span>
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                    style={{
                      background: q.status === 'paid' ? 'rgba(22,163,74,0.1)' : 'var(--surface-2)',
                      color: q.status === 'paid' ? 'var(--text-primary)' : 'var(--text-secondary)',
                    }}
                  >
                    {q.status === 'paid' ? t('docStatusPaid') : t('docStatusUnpaid')}
                  </span>
                </div>
                <div className="mt-0.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {q.client_name} · {q.quote_date ?? t('commonEmptyDash')}
                </div>
                <div
                  className="mt-0.5 text-xs font-semibold"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {fmt(q.total_value, q.currency, lang)}
                </div>
                <a
                  href={`/api/docs/quotations/${q.id}/export`}
                  download
                  onClick={(e) => e.stopPropagation()}
                  className="mt-1 flex items-center gap-1 text-[10px] font-medium hover:underline"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <ExternalLink size={9} /> {t('docQtExportCsv')}
                </a>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => onEdit(q)}
                  className="rounded-lg p-1.5 hover:bg-[var(--accent-soft)]"
                >
                  <Edit2 size={13} style={{ color: 'var(--accent)' }} />
                </button>
                <button
                  onClick={() => onDuplicate(q)}
                  className="rounded-lg p-1.5 hover:bg-[var(--surface-2)]"
                >
                  <Copy size={13} style={{ color: 'var(--text-secondary)' }} />
                </button>
                <button onClick={() => onDelete(q.id)} className="rounded-lg p-1.5 hover:bg-red-50">
                  <Trash2 size={13} style={{ color: 'var(--text-primary)' }} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {showRestore && (
        <BackupModal
          module="quotations"
          onClose={() => setShowRestore(false)}
          onRestore={onRestoreData}
        />
      )}
    </div>
  );
}

export default function QuotationPage() {
  const { t } = useLang();
  const [quotations, setQuotations] = useState<DocsQuotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'editor' | 'history'>('editor');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState<FormState>(() => blank('QUO-0001'));
  const [profiles, setProfiles] = useState<DocsClientProfile[]>([]);
  const [pendingDeleteQuotation, setPendingDeleteQuotation] = useState<string | null>(null);
  const [deletingQuotation, setDeletingQuotation] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/docs/quotations');
      const json = await res.json();
      setQuotations(json.quotations ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    fetchDocsClientProfiles()
      .then(setProfiles)
      .catch(() => null);
  }, []);

  function setField<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function addDeliverable() {
    setForm((f) => ({
      ...f,
      deliverables: [
        ...f.deliverables,
        { id: uid(), description: '', quantity: 1, unitPrice: 0, total: 0 },
      ],
    }));
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
      quote_number: q.quote_number,
      quote_date: q.quote_date ?? today(),
      currency: q.currency,
      client_name: q.client_name,
      company_brand: q.company_brand ?? '',
      project_title: q.project_title ?? '',
      project_description: q.project_description ?? '',
      deliverables: q.deliverables,
      total_value: q.total_value,
      payment_due_days: q.payment_due_days,
      payment_method: q.payment_method ?? 'Bank Transfer',
      custom_payment_method: q.custom_payment_method ?? '',
      additional_notes: q.additional_notes ?? '',
      status: q.status,
    });
    setActiveTab('editor');
  }

  function duplicateQuotation(q: DocsQuotation) {
    setEditingId(null);
    setForm({
      ...q,
      client_profile_id: q.client_profile_id ?? null,
      quote_number: nextQNum(quotations),
      quote_date: today(),
      status: 'unpaid',
      deliverables: q.deliverables.map((d) => ({ ...d, id: uid() })),
      company_brand: q.company_brand ?? '',
      project_title: q.project_title ?? '',
      project_description: q.project_description ?? '',
      payment_method: q.payment_method ?? 'Bank Transfer',
      custom_payment_method: q.custom_payment_method ?? '',
      additional_notes: q.additional_notes ?? '',
    });
    setActiveTab('editor');
  }

  function applyClientProfile(clientId: string) {
    if (!clientId) {
      setField('client_profile_id', null);
      return;
    }
    const profile = profiles.find((p) => p.client_id === clientId);
    if (!profile) return;
    const hasManualEdits = !!(
      form.client_name.trim() ||
      form.company_brand.trim() ||
      form.project_title.trim() ||
      form.project_description.trim() ||
      form.deliverables.length > 0 ||
      form.additional_notes.trim()
    );
    if (hasManualEdits && !confirm(t('docQtReplaceTemplateConfirm'))) return;
    const quotationConfig = profile.quotation_template_config ?? {};
    setForm((prev) => ({
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
    if (!form.client_name.trim()) {
      setError(t('docQtClientRequired'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      const url = editingId ? `/api/docs/quotations/${editingId}` : '/api/docs/quotations';
      const res = await fetch(url, {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const errJson = (await res.json()) as { error?: string; code?: string };
        setError(
          errJson.code === 'duplicate_document_number'
            ? t('docDuplicateDocumentNumber')
            : (errJson.error ?? t('docQtSaveFailed')),
        );
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

  async function deleteQ() {
    if (!pendingDeleteQuotation) return;
    setDeletingQuotation(true);
    try {
      await fetch(`/api/docs/quotations/${pendingDeleteQuotation}`, { method: 'DELETE' });
      await load();
      if (editingId === pendingDeleteQuotation) resetForm();
      setPendingDeleteQuotation(null);
    } finally {
      setDeletingQuotation(false);
    }
  }

  function openDeleteQuotation(id: string) {
    setPendingDeleteQuotation(id);
  }

  async function handleBackup() {
    const label = t('docBackupLabelSession', {
      date: new Date().toLocaleDateString(),
      count: quotations.length,
    });
    await fetch('/api/docs/backups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ module: 'quotations', data: quotations, label }),
    });
  }

  async function handleClearAll() {
    await Promise.all(
      quotations.map((q) => fetch(`/api/docs/quotations/${q.id}`, { method: 'DELETE' })),
    );
    await load();
    resetForm();
  }

  async function handleRestoreData(data: unknown) {
    if (!Array.isArray(data) || data.length === 0) {
      alert(t('docQtBackupInvalid'));
      return;
    }
    if (!confirm(t('docQtRestoreConfirm', { n: data.length }))) return;
    let count = 0;
    for (const item of data as DocsQuotation[]) {
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
      const res = await fetch('/api/docs/quotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rest),
      });
      if (res.ok) count++;
    }
    await load();
    alert(t('docQtRestoredCount', { ok: count, total: data.length }));
  }

  async function exportPdf() {
    try {
      await exportPreviewPdf('quotation-preview', form.quote_number, 'quotation');
    } catch (err) {
      console.error('[QuotationPage] PDF export failed:', err);
      setError(t('docQtPdfExportError'));
    }
  }

  const inputCls =
    'w-full px-3 py-1.5 text-sm rounded-lg border outline-none bg-[var(--surface-2)] border-[var(--border)] text-[var(--text)]';

  return (
    <>
      <DocsWorkspaceShell
        toolbar={
          <DocsToolbarLayout
            navigation={<DocsDocTypeTabs active="quotation" />}
            actions={
              <>
                <button
                  onClick={save}
                  disabled={saving}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold text-[var(--accent-foreground)] disabled:opacity-60"
                  style={{ background: 'var(--accent)' }}
                >
                  <Save size={12} className="me-1 inline" />{' '}
                  {saving
                    ? t('docCommonSaving')
                    : editingId
                      ? t('docQtUpdate')
                      : t('docCommonSave')}
                </button>
                <button
                  onClick={exportPdf}
                  className="rounded-lg border px-3 py-1.5 text-xs font-semibold"
                  style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
                >
                  <Printer size={12} className="me-1 inline" /> {t('docQtToolbarPdf')}
                </button>
                <button
                  onClick={() => {
                    const rows = [
                      [
                        t('docQtCsvQuoteNo'),
                        t('docQtCsvClient'),
                        t('docQtCsvDate'),
                        t('docQtCsvCurrency'),
                        t('docQtCsvValue'),
                        t('docQtCsvStatus'),
                      ],
                      [
                        form.quote_number,
                        form.client_name,
                        form.quote_date,
                        form.currency,
                        String(form.total_value),
                        form.status,
                      ],
                    ];
                    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
                    a.download = `${form.quote_number}.csv`;
                    a.click();
                  }}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold"
                  style={{ background: 'var(--accent)', color: 'var(--accent-foreground)' }}
                >
                  <Download size={12} className="me-1 inline" /> {t('docQtToolbarExcel')}
                </button>
              </>
            }
          >
            <div className="docs-workspace-quickbar-grid">
              <div>
                <label>{t('docQtQuoteNumber')}</label>
                <input
                  className={inputCls}
                  value={form.quote_number}
                  readOnly={!editingId}
                  title={!editingId ? t('docDocNumberAutoHint') : undefined}
                  onChange={(e) => setField('quote_number', e.target.value)}
                />
              </div>
              <div>
                <label>{t('date')}</label>
                <input
                  type="date"
                  className={inputCls}
                  value={form.quote_date}
                  onChange={(e) => setField('quote_date', e.target.value)}
                />
              </div>
              <div>
                <label>{t('docInvClientField')}</label>
                <input
                  className={inputCls}
                  value={form.client_name}
                  onChange={(e) => setField('client_name', e.target.value)}
                />
              </div>
              <div>
                <label>{t('docInvHistory')}</label>
                <SelectDropdown
                  fullWidth
                  className={inputCls}
                  value={editingId ?? ''}
                  onChange={(v) => {
                    const selected = quotations.find((q) => q.id === v);
                    if (selected) loadIntoForm(selected);
                    else resetForm();
                  }}
                  options={[
                    { value: '', label: t('docQtNewQuote') },
                    ...quotations.map((q) => ({
                      value: q.id,
                      label: `${q.quote_number} · ${q.client_name}`,
                    })),
                  ]}
                />
              </div>
            </div>
          </DocsToolbarLayout>
        }
        editor={
          <div
            className="flex flex-col overflow-hidden rounded-2xl border"
            style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
          >
            <div className="flex shrink-0 border-b" style={{ borderColor: 'var(--border)' }}>
              {(['editor', 'history'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={clsx(
                    'flex-1 border-b-2 py-3 text-sm font-medium capitalize transition-colors',
                    activeTab === tab
                      ? 'border-[var(--accent)] text-[var(--accent)]'
                      : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text)]',
                  )}
                >
                  {tab === 'editor' ? t('docQtTabEditor') : t('docQtTabHistory')}
                </button>
              ))}
            </div>

            {activeTab === 'editor' ? (
              <div className="flex-1 space-y-5 overflow-y-auto p-4">
                {editingId && (
                  <div
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
                    style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
                  >
                    <Edit2 size={14} /> {t('docQtEditing')}{' '}
                    <button onClick={resetForm} className="underline">
                      {t('docQtCancelEdit')}
                    </button>
                  </div>
                )}
                {error && (
                  <div
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
                    style={{ background: 'var(--surface-muted)', color: 'var(--text-primary)' }}
                  >
                    <AlertCircle size={14} /> {error}
                  </div>
                )}

                <section>
                  <h3
                    className="mb-3 text-xs font-bold uppercase tracking-wider"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {t('docCardDocumentSetup')}
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label
                        className="mb-1 block text-xs font-medium"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {t('docQtQuoteNumber')}
                      </label>
                      <input
                        className={inputCls}
                        value={form.quote_number}
                        readOnly={!editingId}
                        title={!editingId ? t('docDocNumberAutoHint') : undefined}
                        onChange={(e) => setField('quote_number', e.target.value)}
                      />
                    </div>
                    <div>
                      <label
                        className="mb-1 block text-xs font-medium"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {t('date')}
                      </label>
                      <input
                        type="date"
                        className={inputCls}
                        value={form.quote_date}
                        onChange={(e) => setField('quote_date', e.target.value)}
                      />
                    </div>
                    <div>
                      <label
                        className="mb-1 block text-xs font-medium"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {t('docInvCurrency')}
                      </label>
                      <SelectDropdown
                        fullWidth
                        className={inputCls}
                        value={form.currency}
                        onChange={(v) => setField('currency', v)}
                        options={DOCS_CURRENCIES.map((c) => ({ value: c, label: c }))}
                      />
                    </div>
                    <div>
                      <label
                        className="mb-1 block text-xs font-medium"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {t('docInvStatus')}
                      </label>
                      <SelectDropdown
                        fullWidth
                        className={inputCls}
                        value={form.status}
                        onChange={(v) => setField('status', v as 'paid' | 'unpaid')}
                        options={[
                          { value: 'unpaid', label: t('docStatusUnpaid') },
                          { value: 'paid', label: t('docStatusPaid') },
                        ]}
                      />
                    </div>
                  </div>
                </section>

                <section>
                  <h3
                    className="mb-3 text-xs font-bold uppercase tracking-wider"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {t('docQtSectionClientId')}
                  </h3>
                  <div className="space-y-3">
                    <ClientProfileSelector
                      profiles={profiles}
                      selectedClientId={
                        profiles.find((p) => p.id === form.client_profile_id)?.client_id ?? ''
                      }
                      onSelectClientId={applyClientProfile}
                      label={t('docInvClientField')}
                    />
                    <div>
                      <label
                        className="mb-1 block text-xs font-medium"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {t('docQtClientNameStar')}
                      </label>
                      <input
                        className={inputCls}
                        value={form.client_name}
                        onChange={(e) => setField('client_name', e.target.value)}
                      />
                    </div>
                    <div>
                      <label
                        className="mb-1 block text-xs font-medium"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {t('docQtCompanyBrand')}
                      </label>
                      <input
                        className={inputCls}
                        value={form.company_brand}
                        onChange={(e) => setField('company_brand', e.target.value)}
                      />
                    </div>
                    <div>
                      <label
                        className="mb-1 block text-xs font-medium"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {t('docQtProjectTitle')}
                      </label>
                      <input
                        className={inputCls}
                        value={form.project_title}
                        onChange={(e) => setField('project_title', e.target.value)}
                      />
                    </div>
                    <div>
                      <label
                        className="mb-1 block text-xs font-medium"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {t('docQtProjectDescription')}
                      </label>
                      <textarea
                        className={inputCls}
                        rows={2}
                        value={form.project_description}
                        onChange={(e) => setField('project_description', e.target.value)}
                      />
                    </div>
                  </div>
                </section>

                <section>
                  <div className="mb-3 flex items-center justify-between">
                    <h3
                      className="text-xs font-bold uppercase tracking-wider"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {t('docQtDeliverables')}
                    </h3>
                    <button
                      onClick={addDeliverable}
                      className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium"
                      style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
                    >
                      <Plus size={12} /> {t('docQtAddLine')}
                    </button>
                  </div>
                  <div className="space-y-2">
                    {form.deliverables.map((d, i) => (
                      <div key={d.id} className="flex items-center gap-2">
                        <input
                          className="flex-1 rounded-lg border px-3 py-1.5 text-sm outline-none"
                          style={{
                            background: 'var(--surface-2)',
                            borderColor: 'var(--border)',
                            color: 'var(--text)',
                          }}
                          placeholder={t('docQtDelivPlaceholder')}
                          value={d.description}
                          onChange={(e) => {
                            const nd = [...form.deliverables];
                            nd[i] = { ...d, description: e.target.value };
                            setField('deliverables', nd);
                          }}
                        />
                        <input
                          type="number"
                          min={1}
                          className="w-14 rounded-lg border px-2 py-1.5 text-center text-sm outline-none"
                          style={{
                            background: 'var(--surface-2)',
                            borderColor: 'var(--border)',
                            color: 'var(--text)',
                          }}
                          value={d.quantity}
                          onChange={(e) => {
                            const q2 = Math.max(1, Number(e.target.value));
                            const nd = [...form.deliverables];
                            nd[i] = { ...d, quantity: q2, total: q2 * d.unitPrice };
                            setField('deliverables', nd);
                          }}
                        />
                        <input
                          type="number"
                          min={0}
                          className="w-24 rounded-lg border px-2 py-1.5 text-end text-sm outline-none"
                          style={{
                            background: 'var(--surface-2)',
                            borderColor: 'var(--border)',
                            color: 'var(--text)',
                          }}
                          value={d.unitPrice}
                          onChange={(e) => {
                            const p = Math.max(0, Number(e.target.value));
                            const nd = [...form.deliverables];
                            nd[i] = { ...d, unitPrice: p, total: d.quantity * p };
                            setField('deliverables', nd);
                          }}
                        />
                        <button
                          onClick={() =>
                            setField(
                              'deliverables',
                              form.deliverables.filter((_, ii) => ii !== i),
                            )
                          }
                          className="rounded-lg p-1.5 hover:bg-red-50"
                        >
                          <Trash2 size={14} style={{ color: 'var(--text-primary)' }} />
                        </button>
                      </div>
                    ))}
                    {form.deliverables.length === 0 && (
                      <p
                        className="py-3 text-center text-xs"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {t('docQtNoDeliverables')}
                      </p>
                    )}
                  </div>
                </section>

                <section>
                  <h3
                    className="mb-3 text-xs font-bold uppercase tracking-wider"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {t('docQtPricingTerms')}
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label
                        className="mb-1 block text-xs font-medium"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {t('docQtTotalQuoteValue')}
                      </label>
                      <input
                        type="number"
                        min={0}
                        className={inputCls}
                        value={form.total_value}
                        onChange={(e) => setField('total_value', Number(e.target.value))}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label
                          className="mb-1 block text-xs font-medium"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          {t('docQtPaymentDueDays')}
                        </label>
                        <input
                          type="number"
                          min={1}
                          className={inputCls}
                          value={form.payment_due_days}
                          onChange={(e) => setField('payment_due_days', Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <label
                          className="mb-1 block text-xs font-medium"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          {t('docQtPaymentMethod')}
                        </label>
                        <SelectDropdown
                          fullWidth
                          className={inputCls}
                          value={form.payment_method}
                          onChange={(v) => setField('payment_method', v)}
                          options={DOCS_PAYMENT_METHODS.map((m) => ({
                            value: m,
                            label: docsPaymentMethodLabel(m, t),
                          }))}
                        />
                      </div>
                    </div>
                    {form.payment_method === 'Custom' && (
                      <div>
                        <label
                          className="mb-1 block text-xs font-medium"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          {t('docQtCustomMethod')}
                        </label>
                        <input
                          className={inputCls}
                          value={form.custom_payment_method}
                          onChange={(e) => setField('custom_payment_method', e.target.value)}
                        />
                      </div>
                    )}
                    <div>
                      <label
                        className="mb-1 block text-xs font-medium"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {t('docQtAdditionalNotes')}
                      </label>
                      <textarea
                        className={inputCls}
                        rows={3}
                        value={form.additional_notes}
                        onChange={(e) => setField('additional_notes', e.target.value)}
                      />
                    </div>
                  </div>
                </section>

                <div className="pb-4">
                  <button
                    onClick={save}
                    disabled={saving}
                    className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-[var(--accent-foreground)] disabled:opacity-60"
                    style={{ background: 'var(--accent)' }}
                  >
                    {saved ? (
                      <>
                        <Check size={16} /> {t('docQtSaved')}
                      </>
                    ) : saving ? (
                      t('docCommonSaving')
                    ) : (
                      <>
                        <Save size={16} />{' '}
                        {editingId ? t('docQtUpdateQuotation') : t('docQtSaveQuotation')}
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <HistoryPanel
                quotations={quotations}
                loading={loading}
                onEdit={loadIntoForm}
                onDuplicate={duplicateQuotation}
                onDelete={openDeleteQuotation}
                onReload={load}
                onBackup={handleBackup}
                onClearAll={handleClearAll}
                onRestoreData={handleRestoreData}
              />
            )}
          </div>
        }
        preview={
          <ScaledDocumentPreview>
            <QuotationPreview form={form} />
          </ScaledDocumentPreview>
        }
      />
      <ConfirmDialog
        open={Boolean(pendingDeleteQuotation)}
        title="Delete quotation"
        description="Delete this quotation? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel={t('cancel')}
        destructive
        loading={deletingQuotation}
        onCancel={() => {
          if (deletingQuotation) return;
          setPendingDeleteQuotation(null);
        }}
        onConfirm={deleteQ}
      />
    </>
  );
}
