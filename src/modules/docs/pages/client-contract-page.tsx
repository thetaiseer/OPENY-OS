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
  type DocsClientContract,
  type ContractClause,
  DOCS_CURRENCIES,
  DOCS_PAYMENT_METHODS,
} from '@/lib/docs-types';
import {
  OpenyClientBlock,
  OpenyDocumentHeader,
  OpenyDocumentPage,
  OpenySectionTitle,
} from '@/components/docs/DocumentDesign';
import { OPENY_DOC_STYLE } from '@/lib/openy-brand';
import ClientProfileSelector from '@/components/docs/ClientProfileSelector';
import {
  type DocsClientProfile,
  fetchDocsClientProfiles,
  isVirtualDocsProfileId,
} from '@/lib/docs-client-profiles';
import { exportPreviewPdf } from '@/lib/docs-print';
import AppModal from '@/components/ui/AppModal';
import SelectDropdown from '@/components/ui/SelectDropdown';
import { DocsDocTypeTabs, DocsWorkspaceShell } from '@/components/docs/DocsWorkspace';

function uid() {
  return Math.random().toString(36).slice(2, 10);
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

interface FormState {
  client_profile_id: string | null;
  contract_number: string;
  contract_date: string;
  duration_months: number;
  status: string;
  currency: string;
  language: 'ar' | 'en';
  party1_company_name: string;
  party1_representative: string;
  party1_address: string;
  party1_email: string;
  party1_phone: string;
  party1_website: string;
  party1_tax_reg: string;
  party2_client_name: string;
  party2_contact_person: string;
  party2_address: string;
  party2_email: string;
  party2_phone: string;
  party2_website: string;
  party2_tax_reg: string;
  services: string[];
  total_value: number;
  payment_method: string;
  payment_terms: string;
  notes: string;
  legal_clauses: ContractClause[];
  sig_party1: string;
  sig_party2: string;
  sig_date: string;
  sig_place: string;
}

function blank(num: string): FormState {
  return {
    client_profile_id: null,
    contract_number: num,
    contract_date: today(),
    duration_months: 12,
    status: 'draft',
    currency: 'SAR',
    language: 'en',
    party1_company_name: '',
    party1_representative: '',
    party1_address: '',
    party1_email: '',
    party1_phone: '',
    party1_website: '',
    party1_tax_reg: '',
    party2_client_name: '',
    party2_contact_person: '',
    party2_address: '',
    party2_email: '',
    party2_phone: '',
    party2_website: '',
    party2_tax_reg: '',
    services: [],
    total_value: 0,
    payment_method: 'Bank Transfer',
    payment_terms: '',
    notes: '',
    legal_clauses: [],
    sig_party1: '',
    sig_party2: '',
    sig_date: today(),
    sig_place: '',
  };
}

function fmt(n: number, cur: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: cur,
    minimumFractionDigits: 2,
  }).format(n);
}

function nextCNum(list: DocsClientContract[]) {
  const nums = list
    .map((c) => parseInt(c.contract_number.replace(/\D/g, '') || '0'))
    .filter(Boolean);
  return `CC-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(4, '0')}`;
}

function ContractPreview({ form }: { form: FormState }) {
  const isAr = form.language === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';

  return (
    <OpenyDocumentPage id="client-contract-preview" dir={dir} fontSize={12}>
      <OpenyDocumentHeader
        title={isAr ? 'عقد خدمات' : 'SERVICE CONTRACT'}
        number={form.contract_number}
        date={form.contract_date}
        centerTitle
      />
      <OpenyClientBlock
        label={isAr ? 'مُعَد لـ' : 'PREPARED FOR'}
        name={form.party2_client_name || '—'}
        subtext={form.party2_contact_person || form.party2_email || undefined}
      />
      <div>
        <table style={{ width: '100%', marginBottom: 20, fontSize: 12 }}>
          <tbody>
            <tr>
              <td style={{ color: OPENY_DOC_STYLE.textMuted, width: 140 }}>
                {isAr ? 'تاريخ العقد' : 'Contract Date'}:
              </td>
              <td style={{ fontWeight: 600 }}>{form.contract_date}</td>
              <td style={{ color: OPENY_DOC_STYLE.textMuted, width: 140 }}>
                {isAr ? 'مدة العقد' : 'Duration'}:
              </td>
              <td style={{ fontWeight: 600 }}>
                {form.duration_months} {isAr ? 'شهر' : 'months'}
              </td>
            </tr>
            <tr>
              <td style={{ color: OPENY_DOC_STYLE.textMuted }}>{isAr ? 'الحالة' : 'Status'}:</td>
              <td style={{ fontWeight: 600 }}>{form.status}</td>
              <td style={{ color: OPENY_DOC_STYLE.textMuted }}>{isAr ? 'العملة' : 'Currency'}:</td>
              <td style={{ fontWeight: 600 }}>{form.currency}</td>
            </tr>
          </tbody>
        </table>

        <div style={{ display: 'flex', gap: 20, marginBottom: 20 }}>
          <div
            style={{
              flex: 1,
              border: `1px solid ${OPENY_DOC_STYLE.border}`,
              borderRadius: 8,
              padding: '12px 16px',
              background: OPENY_DOC_STYLE.surface,
            }}
          >
            <OpenySectionTitle>{isAr ? 'الطرف الأول' : 'Party 1 (Company)'}</OpenySectionTitle>
            {[
              ['Company', form.party1_company_name],
              ['Representative', form.party1_representative],
              ['Address', form.party1_address],
              ['Email', form.party1_email],
              ['Phone', form.party1_phone],
              ['Website', form.party1_website],
              ['Tax Reg.', form.party1_tax_reg],
            ].map(([l, v]) =>
              v ? (
                <div key={l} style={{ fontSize: 11, marginBottom: 2 }}>
                  <span style={{ color: OPENY_DOC_STYLE.textMuted }}>{l}: </span>
                  {v}
                </div>
              ) : null,
            )}
          </div>
          <div
            style={{
              flex: 1,
              border: `1px solid ${OPENY_DOC_STYLE.border}`,
              borderRadius: 8,
              padding: '12px 16px',
              background: OPENY_DOC_STYLE.surface,
            }}
          >
            <OpenySectionTitle>{isAr ? 'الطرف الثاني' : 'Party 2 (Client)'}</OpenySectionTitle>
            {[
              ['Client', form.party2_client_name],
              ['Contact', form.party2_contact_person],
              ['Address', form.party2_address],
              ['Email', form.party2_email],
              ['Phone', form.party2_phone],
              ['Website', form.party2_website],
              ['Tax Reg.', form.party2_tax_reg],
            ].map(([l, v]) =>
              v ? (
                <div key={l} style={{ fontSize: 11, marginBottom: 2 }}>
                  <span style={{ color: OPENY_DOC_STYLE.textMuted }}>{l}: </span>
                  {v}
                </div>
              ) : null,
            )}
          </div>
        </div>

        {form.services.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <OpenySectionTitle>{isAr ? 'الخدمات المتضمنة' : 'Included Services'}</OpenySectionTitle>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {form.services.map((s, i) => (
                <li key={i} style={{ fontSize: 12, marginBottom: 2 }}>
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div
          style={{
            border: `1px solid ${OPENY_DOC_STYLE.border}`,
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: 16,
            background: OPENY_DOC_STYLE.surface,
          }}
        >
          <OpenySectionTitle>{isAr ? 'التفاصيل المالية' : 'Financial Details'}</OpenySectionTitle>
          <div style={{ display: 'flex', gap: 32 }}>
            <div>
              <span style={{ color: OPENY_DOC_STYLE.textMuted, fontSize: 11 }}>Total Value: </span>
              <span style={{ fontWeight: 700, fontSize: 14, color: OPENY_DOC_STYLE.title }}>
                {fmt(form.total_value, form.currency)}
              </span>
            </div>
            <div>
              <span style={{ color: OPENY_DOC_STYLE.textMuted, fontSize: 11 }}>Payment: </span>
              <span style={{ fontSize: 12 }}>{form.payment_method}</span>
            </div>
          </div>
          {form.payment_terms && (
            <div style={{ fontSize: 11, color: OPENY_DOC_STYLE.textMuted, marginTop: 4 }}>
              {form.payment_terms}
            </div>
          )}
        </div>

        {form.legal_clauses.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <OpenySectionTitle>{isAr ? 'البنود القانونية' : 'Legal Clauses'}</OpenySectionTitle>
            {form.legal_clauses.map((c, i) => (
              <div key={c.id} style={{ marginBottom: 10 }}>
                <div style={{ fontWeight: 600, fontSize: 12 }}>
                  {i + 1}. {c.title}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: OPENY_DOC_STYLE.textMuted,
                    marginTop: 2,
                    paddingLeft: 14,
                  }}
                >
                  {c.content}
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 40, marginTop: 32 }}>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div
              style={{
                minHeight: 40,
                borderBottom: `1px solid ${OPENY_DOC_STYLE.borderStrong}`,
                marginBottom: 8,
              }}
            >
              {form.sig_party1}
            </div>
            <div style={{ fontSize: 11, color: OPENY_DOC_STYLE.textMuted }}>
              {isAr ? 'الطرف الأول — التوقيع والختم' : 'Party 1 — Signature & Stamp'}
            </div>
          </div>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div
              style={{
                minHeight: 40,
                borderBottom: `1px solid ${OPENY_DOC_STYLE.borderStrong}`,
                marginBottom: 8,
              }}
            >
              {form.sig_party2}
            </div>
            <div style={{ fontSize: 11, color: OPENY_DOC_STYLE.textMuted }}>
              {isAr ? 'الطرف الثاني — التوقيع والختم' : 'Party 2 — Signature & Stamp'}
            </div>
          </div>
        </div>
        <div
          style={{
            textAlign: 'center',
            marginTop: 12,
            fontSize: 11,
            color: OPENY_DOC_STYLE.textMuted,
          }}
        >
          {form.sig_place && `${form.sig_place} · `}
          {form.sig_date}
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
      title="Restore Backup"
      size="sm"
      bodyClassName="space-y-2"
      footer={
        <button onClick={onClose} className="openy-modal-btn-secondary w-full">
          Close
        </button>
      }
    >
      {loading && (
        <p className="py-4 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
          Loading backups…
        </p>
      )}
      {!loading && backups.length === 0 && (
        <p className="py-4 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
          No backups found
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
                {b.label ?? 'Backup'}
              </div>
              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {new Date(b.created_at).toLocaleString()}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => restore(b.id)}
                className="rounded-lg px-2.5 py-1 text-xs font-medium text-white"
                style={{ background: 'var(--accent)' }}
              >
                Restore
              </button>
              <button
                onClick={() => deleteBackup(b.id)}
                className="rounded-lg p-1.5 hover:bg-red-50"
              >
                <Trash2 size={12} style={{ color: '#ef4444' }} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </AppModal>
  );
}

function HistoryPanel({
  contracts,
  loading,
  onEdit,
  onDuplicate,
  onDelete,
  onReload,
  onBackup,
  onClearAll,
  onRestoreData,
}: {
  contracts: DocsClientContract[];
  loading: boolean;
  onEdit: (c: DocsClientContract) => void;
  onDuplicate: (c: DocsClientContract) => void;
  onDelete: (id: string) => void;
  onReload: () => void;
  onBackup: () => Promise<void>;
  onClearAll: () => Promise<void>;
  onRestoreData: (data: unknown) => void;
}) {
  const [search, setSearch] = useState('');
  const [statusF, setStatusF] = useState('all');
  const [showRestore, setShowRestore] = useState(false);
  const [backing, setBacking] = useState(false);
  const [clearing, setClearing] = useState(false);

  const visible = contracts.filter((c) => {
    if (statusF !== 'all' && c.status !== statusF) return false;
    if (
      search &&
      !c.contract_number.toLowerCase().includes(search.toLowerCase()) &&
      !(c.party2_client_name ?? '').toLowerCase().includes(search.toLowerCase())
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
              className="absolute left-2.5 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--text-secondary)' }}
            />
            <input
              className="w-full rounded-lg border py-1.5 pl-8 pr-3 text-sm outline-none"
              style={{
                background: 'var(--surface-2)',
                borderColor: 'var(--border)',
                color: 'var(--text)',
              }}
              placeholder="Search contracts…"
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
            title="Backup all contracts"
          >
            <Archive
              size={14}
              style={{ color: backing ? 'var(--text-secondary)' : 'var(--accent)' }}
            />
          </button>
          <button
            onClick={() => setShowRestore(true)}
            className="rounded-lg p-1.5 hover:bg-[var(--surface-2)]"
            title="Restore from backup"
          >
            <RotateCcw size={14} style={{ color: '#f59e0b' }} />
          </button>
          <button
            onClick={async () => {
              if (!confirm('Clear ALL contracts? This cannot be undone.')) return;
              setClearing(true);
              try {
                await onClearAll();
              } finally {
                setClearing(false);
              }
            }}
            disabled={clearing}
            className="rounded-lg p-1.5 hover:bg-red-50"
            title="Clear all contracts"
          >
            <Trash2 size={14} style={{ color: '#ef4444' }} />
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {['all', 'draft', 'active', 'signed', 'expired', 'terminated'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusF(s)}
              className={clsx(
                'rounded-full px-2.5 py-1 text-xs font-medium',
                statusF === s
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--surface-2)] text-[var(--text-secondary)]',
              )}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 divide-y overflow-y-auto" style={{ borderColor: 'var(--border)' }}>
        {loading && (
          <div className="p-6 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
            Loading…
          </div>
        )}
        {!loading && visible.length === 0 && (
          <div className="p-6 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
            No contracts found
          </div>
        )}
        {visible.map((c) => (
          <div key={c.id} className="p-3 hover:bg-[var(--surface-2)]">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                    {c.contract_number}
                  </span>
                  <span
                    className="rounded-full bg-[var(--surface-2)] px-1.5 py-0.5 text-[10px] font-bold"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {c.status}
                  </span>
                </div>
                <div className="mt-0.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {c.party2_client_name ?? '—'} · {c.contract_date ?? '—'}
                </div>
                <div className="mt-0.5 text-xs font-semibold" style={{ color: '#0891b2' }}>
                  {fmt(c.total_value, c.currency)}
                </div>
                <a
                  href={`/api/docs/client-contracts/${c.id}/export`}
                  download
                  onClick={(e) => e.stopPropagation()}
                  className="mt-1 flex items-center gap-1 text-[10px] font-medium hover:underline"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <ExternalLink size={9} /> HTML Doc
                </a>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => onEdit(c)}
                  className="rounded-lg p-1.5 hover:bg-[var(--accent-soft)]"
                >
                  <Edit2 size={13} style={{ color: 'var(--accent)' }} />
                </button>
                <button
                  onClick={() => onDuplicate(c)}
                  className="rounded-lg p-1.5 hover:bg-[var(--surface-2)]"
                >
                  <Copy size={13} style={{ color: 'var(--text-secondary)' }} />
                </button>
                <button onClick={() => onDelete(c.id)} className="rounded-lg p-1.5 hover:bg-red-50">
                  <Trash2 size={13} style={{ color: '#ef4444' }} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {showRestore && (
        <BackupModal
          module="client-contracts"
          onClose={() => setShowRestore(false)}
          onRestore={onRestoreData}
        />
      )}
    </div>
  );
}

export default function ClientContractPage() {
  const [contracts, setContracts] = useState<DocsClientContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'editor' | 'history'>('editor');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState<FormState>(() => blank('CC-0001'));
  const [profiles, setProfiles] = useState<DocsClientProfile[]>([]);
  const [newService, setNewService] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/docs/client-contracts');
      const j = await r.json();
      setContracts(j.contracts ?? []);
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

  function addClause() {
    setField('legal_clauses', [...form.legal_clauses, { id: uid(), title: '', content: '' }]);
  }
  function updateClause(i: number, updated: ContractClause) {
    const cl = [...form.legal_clauses];
    cl[i] = updated;
    setField('legal_clauses', cl);
  }
  function removeClause(i: number) {
    setField(
      'legal_clauses',
      form.legal_clauses.filter((_, ii) => ii !== i),
    );
  }

  function resetForm() {
    setEditingId(null);
    setForm(blank(nextCNum(contracts)));
    setError('');
    setActiveTab('editor');
  }

  function loadIntoForm(c: DocsClientContract) {
    setEditingId(c.id);
    setForm({
      client_profile_id: c.client_profile_id ?? null,
      contract_number: c.contract_number,
      contract_date: c.contract_date ?? today(),
      duration_months: c.duration_months,
      status: c.status,
      currency: c.currency,
      language: c.language,
      party1_company_name: c.party1_company_name ?? '',
      party1_representative: c.party1_representative ?? '',
      party1_address: c.party1_address ?? '',
      party1_email: c.party1_email ?? '',
      party1_phone: c.party1_phone ?? '',
      party1_website: c.party1_website ?? '',
      party1_tax_reg: c.party1_tax_reg ?? '',
      party2_client_name: c.party2_client_name ?? '',
      party2_contact_person: c.party2_contact_person ?? '',
      party2_address: c.party2_address ?? '',
      party2_email: c.party2_email ?? '',
      party2_phone: c.party2_phone ?? '',
      party2_website: c.party2_website ?? '',
      party2_tax_reg: c.party2_tax_reg ?? '',
      services: c.services,
      total_value: c.total_value,
      payment_method: c.payment_method ?? 'Bank Transfer',
      payment_terms: c.payment_terms ?? '',
      notes: c.notes ?? '',
      legal_clauses: c.legal_clauses,
      sig_party1: c.sig_party1 ?? '',
      sig_party2: c.sig_party2 ?? '',
      sig_date: c.sig_date ?? today(),
      sig_place: c.sig_place ?? '',
    });
    setActiveTab('editor');
  }

  function duplicateContract(c: DocsClientContract) {
    loadIntoForm(c);
    setEditingId(null);
    setField('contract_number', nextCNum(contracts));
    setField('status', 'draft');
  }

  function applyClientProfile(clientId: string) {
    if (!clientId) {
      setField('client_profile_id', null);
      return;
    }
    const profile = profiles.find((p) => p.client_id === clientId);
    if (!profile) return;
    const hasManualEdits = !!(
      form.party2_client_name.trim() ||
      form.services.length > 0 ||
      form.notes.trim()
    );
    if (
      hasManualEdits &&
      !confirm('Replace current contract defaults with selected client template?')
    )
      return;
    const cfg = profile.contract_template_config ?? {};
    setForm((prev) => ({
      ...prev,
      client_profile_id: isVirtualDocsProfileId(profile.id) ? null : profile.id,
      party2_client_name: profile.client_name,
      currency: profile.default_currency,
      payment_method: (cfg.payment_method as string | undefined) ?? prev.payment_method,
      payment_terms: (cfg.payment_terms as string | undefined) ?? prev.payment_terms,
      notes: prev.notes || profile.notes || '',
      party2_address: prev.party2_address || profile.billing_address || '',
      party2_tax_reg: prev.party2_tax_reg || profile.tax_info || '',
    }));
  }

  async function save() {
    if (!form.contract_number.trim()) {
      setError('Contract number is required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const url = editingId
        ? `/api/docs/client-contracts/${editingId}`
        : '/api/docs/client-contracts';
      const res = await fetch(url, {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        setError((await res.json()).error ?? 'Save failed');
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

  async function deleteC(id: string) {
    if (!confirm('Delete this contract?')) return;
    await fetch(`/api/docs/client-contracts/${id}`, { method: 'DELETE' });
    await load();
    if (editingId === id) resetForm();
  }

  async function handleBackup() {
    const label = `Backup ${new Date().toLocaleDateString()} (${contracts.length} contracts)`;
    await fetch('/api/docs/backups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ module: 'client_contracts', data: contracts, label }),
    });
  }

  async function handleClearAll() {
    await Promise.all(
      contracts.map((c) => fetch(`/api/docs/client-contracts/${c.id}`, { method: 'DELETE' })),
    );
    await load();
    resetForm();
  }

  async function handleRestoreData(data: unknown) {
    if (!Array.isArray(data) || data.length === 0) {
      alert('Invalid or empty backup data.');
      return;
    }
    if (
      !confirm(
        `Restore ${data.length} contract(s) from backup? They will be created as new records.`,
      )
    )
      return;
    let count = 0;
    for (const item of data as DocsClientContract[]) {
      const {
        id: _id,
        created_at: _ca,
        updated_at: _ua,
        created_by: _cb,
        export_pdf_url: _ep,
        export_doc_url: _ed,
        is_duplicate: _dup,
        original_id: _oid,
        ...rest
      } = item;
      const res = await fetch('/api/docs/client-contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rest),
      });
      if (res.ok) count++;
    }
    await load();
    alert(`Restored ${count} of ${data.length} contract(s).`);
  }

  async function exportPdf() {
    try {
      await exportPreviewPdf('client-contract-preview', form.contract_number, 'client-contract');
    } catch (err) {
      console.error('[ClientContractPage] PDF export failed:', err);
      setError('Could not export PDF. Please try again.');
    }
  }

  const inputCls =
    'w-full px-3 py-1.5 text-sm rounded-lg border outline-none bg-[var(--surface-2)] border-[var(--border)] text-[var(--text)]';
  const lbl = (l: string) => (
    <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
      {l}
    </label>
  );

  function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
      <section>
        <h3
          className="mb-3 text-xs font-bold uppercase tracking-wider"
          style={{ color: 'var(--text-secondary)' }}
        >
          {title}
        </h3>
        <div className="space-y-3">{children}</div>
      </section>
    );
  }

  return (
    <DocsWorkspaceShell
      toolbar={
        <div className="docs-workspace-quickbar">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <DocsDocTypeTabs active="client-contract" />
            <div className="flex items-center gap-2">
              <button
                onClick={save}
                disabled={saving}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                style={{ background: 'var(--accent)' }}
              >
                <Save size={12} className="mr-1 inline" />{' '}
                {saving ? 'Saving…' : editingId ? 'Update' : 'Save'}
              </button>
              <button
                onClick={exportPdf}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
                style={{ background: '#0f172a' }}
              >
                <Printer size={12} className="mr-1 inline" /> PDF
              </button>
              <button
                onClick={() => {
                  if (!editingId) {
                    alert('Please save the contract first to export it.');
                    return;
                  }
                  window.open(
                    `/api/docs/client-contracts/${editingId}/export`,
                    '_blank',
                    'noopener,noreferrer',
                  );
                }}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
                style={{ background: '#475569' }}
              >
                <Download size={12} className="mr-1 inline" /> Word
              </button>
            </div>
          </div>
          <div className="docs-workspace-quickbar-grid">
            <div>
              <label>Contract Number</label>
              <input
                className={inputCls}
                value={form.contract_number}
                onChange={(e) => setField('contract_number', e.target.value)}
              />
            </div>
            <div>
              <label>Date</label>
              <input
                type="date"
                className={inputCls}
                value={form.contract_date}
                onChange={(e) => setField('contract_date', e.target.value)}
              />
            </div>
            <div>
              <label>Client</label>
              <input
                className={inputCls}
                value={form.party2_client_name}
                onChange={(e) => setField('party2_client_name', e.target.value)}
              />
            </div>
            <div>
              <label>History</label>
              <SelectDropdown
                fullWidth
                className={inputCls}
                value={editingId ?? ''}
                onChange={(v) => {
                  const selected = contracts.find((c) => c.id === v);
                  if (selected) loadIntoForm(selected);
                  else resetForm();
                }}
                options={[
                  { value: '', label: 'New contract' },
                  ...contracts.map((c) => ({
                    value: c.id,
                    label: `${c.contract_number} · ${c.party2_client_name}`,
                  })),
                ]}
              />
            </div>
          </div>
        </div>
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
                  'flex-1 border-b-2 py-3 text-sm font-medium capitalize',
                  activeTab === tab
                    ? 'border-[var(--accent)] text-[var(--accent)]'
                    : 'border-transparent text-[var(--text-secondary)]',
                )}
              >
                {tab}
              </button>
            ))}
          </div>

          {activeTab === 'editor' ? (
            <div className="flex-1 space-y-5 overflow-y-auto p-4">
              {editingId && (
                <div
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
                  style={{ background: 'rgba(234,179,8,0.1)', color: '#92400e' }}
                >
                  <Edit2 size={14} /> Editing ·{' '}
                  <button onClick={resetForm} className="underline">
                    Cancel
                  </button>
                </div>
              )}
              {error && (
                <div
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
                  style={{ background: 'rgba(239,68,68,0.08)', color: '#dc2626' }}
                >
                  <AlertCircle size={14} /> {error}
                </div>
              )}

              <Section title="Contract Info">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    {lbl('Contract Number')}
                    <input
                      className={inputCls}
                      value={form.contract_number}
                      onChange={(e) => setField('contract_number', e.target.value)}
                    />
                  </div>
                  <div>
                    {lbl('Date')}
                    <input
                      type="date"
                      className={inputCls}
                      value={form.contract_date}
                      onChange={(e) => setField('contract_date', e.target.value)}
                    />
                  </div>
                  <div>
                    {lbl('Duration (months)')}
                    <input
                      type="number"
                      min={1}
                      className={inputCls}
                      value={form.duration_months}
                      onChange={(e) => setField('duration_months', Number(e.target.value))}
                    />
                  </div>
                  <div>
                    {lbl('Status')}
                    <SelectDropdown
                      fullWidth
                      className={inputCls}
                      value={form.status}
                      onChange={(v) => setField('status', v)}
                      options={['draft', 'active', 'signed', 'expired', 'terminated'].map((s) => ({
                        value: s,
                        label: s,
                      }))}
                    />
                  </div>
                  <div>
                    {lbl('Currency')}
                    <SelectDropdown
                      fullWidth
                      className={inputCls}
                      value={form.currency}
                      onChange={(v) => setField('currency', v)}
                      options={DOCS_CURRENCIES.map((c) => ({ value: c, label: c }))}
                    />
                  </div>
                  <div>
                    {lbl('Language')}
                    <SelectDropdown
                      fullWidth
                      className={inputCls}
                      value={form.language}
                      onChange={(v) => setField('language', v as 'ar' | 'en')}
                      options={[
                        { value: 'en', label: 'English' },
                        { value: 'ar', label: 'Arabic' },
                      ]}
                    />
                  </div>
                </div>
              </Section>

              <Section title="Party 1 — Company">
                {[
                  ['Company Name', 'party1_company_name'],
                  ['Representative', 'party1_representative'],
                  ['Address', 'party1_address'],
                  ['Email', 'party1_email'],
                  ['Phone', 'party1_phone'],
                  ['Website', 'party1_website'],
                  ['Tax Registration', 'party1_tax_reg'],
                ].map(([label, field]) => (
                  <div key={field}>
                    {lbl(label)}
                    <input
                      className={inputCls}
                      value={(form as unknown as Record<string, string>)[field]}
                      onChange={(e) => setField(field as keyof FormState, e.target.value as never)}
                    />
                  </div>
                ))}
              </Section>

              <Section title="Party 2 — Client">
                <ClientProfileSelector
                  profiles={profiles}
                  selectedClientId={
                    profiles.find((p) => p.id === form.client_profile_id)?.client_id ?? ''
                  }
                  onSelectClientId={applyClientProfile}
                  label="Client"
                />
                {[
                  ['Client / Company Name', 'party2_client_name'],
                  ['Contact Person', 'party2_contact_person'],
                  ['Address', 'party2_address'],
                  ['Email', 'party2_email'],
                  ['Phone', 'party2_phone'],
                  ['Website', 'party2_website'],
                  ['Tax Registration', 'party2_tax_reg'],
                ].map(([label, field]) => (
                  <div key={field}>
                    {lbl(label)}
                    <input
                      className={inputCls}
                      value={(form as unknown as Record<string, string>)[field]}
                      onChange={(e) => setField(field as keyof FormState, e.target.value as never)}
                    />
                  </div>
                ))}
              </Section>

              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h3
                    className="text-xs font-bold uppercase tracking-wider"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Included Services
                  </h3>
                </div>
                <div className="mb-2 flex gap-2">
                  <input
                    className={inputCls}
                    placeholder="Add a service…"
                    value={newService}
                    onChange={(e) => setNewService(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newService.trim()) {
                        setField('services', [...form.services, newService.trim()]);
                        setNewService('');
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      if (newService.trim()) {
                        setField('services', [...form.services, newService.trim()]);
                        setNewService('');
                      }
                    }}
                    className="rounded-lg px-3 py-1.5 text-sm font-medium"
                    style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
                  >
                    <Plus size={14} />
                  </button>
                </div>
                {form.services.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 py-1">
                    <span className="flex-1 text-sm" style={{ color: 'var(--text)' }}>
                      • {s}
                    </span>
                    <button
                      onClick={() =>
                        setField(
                          'services',
                          form.services.filter((_, ii) => ii !== i),
                        )
                      }
                    >
                      <Trash2 size={13} style={{ color: '#ef4444' }} />
                    </button>
                  </div>
                ))}
              </section>

              <Section title="Financial Details">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    {lbl('Total Contract Value')}
                    <input
                      type="number"
                      min={0}
                      className={inputCls}
                      value={form.total_value}
                      onChange={(e) => setField('total_value', Number(e.target.value))}
                    />
                  </div>
                  <div>
                    {lbl('Payment Method')}
                    <SelectDropdown
                      fullWidth
                      className={inputCls}
                      value={form.payment_method}
                      onChange={(v) => setField('payment_method', v)}
                      options={DOCS_PAYMENT_METHODS.map((m) => ({ value: m, label: m }))}
                    />
                  </div>
                </div>
                <div>
                  {lbl('Payment Terms')}
                  <textarea
                    className={inputCls}
                    rows={2}
                    value={form.payment_terms}
                    onChange={(e) => setField('payment_terms', e.target.value)}
                  />
                </div>
                <div>
                  {lbl('Notes')}
                  <textarea
                    className={inputCls}
                    rows={2}
                    value={form.notes}
                    onChange={(e) => setField('notes', e.target.value)}
                  />
                </div>
              </Section>

              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h3
                    className="text-xs font-bold uppercase tracking-wider"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Legal Clauses
                  </h3>
                  <button
                    onClick={addClause}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium"
                    style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
                  >
                    <Plus size={12} /> Add
                  </button>
                </div>
                {form.legal_clauses.map((cl, i) => (
                  <div
                    key={cl.id}
                    className="mb-3 rounded-lg border p-3"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <input
                        className="mr-2 flex-1 rounded border px-2 py-1 text-sm font-semibold outline-none"
                        style={{
                          background: 'var(--surface-2)',
                          borderColor: 'var(--border)',
                          color: 'var(--text)',
                        }}
                        placeholder={`Clause ${i + 1} title`}
                        value={cl.title}
                        onChange={(e) => updateClause(i, { ...cl, title: e.target.value })}
                      />
                      <button onClick={() => removeClause(i)}>
                        <Trash2 size={13} style={{ color: '#ef4444' }} />
                      </button>
                    </div>
                    <textarea
                      className="w-full rounded border px-2 py-1 text-sm outline-none"
                      rows={3}
                      style={{
                        background: 'var(--surface-2)',
                        borderColor: 'var(--border)',
                        color: 'var(--text)',
                      }}
                      placeholder="Clause content…"
                      value={cl.content}
                      onChange={(e) => updateClause(i, { ...cl, content: e.target.value })}
                    />
                  </div>
                ))}
              </section>

              <Section title="Signatures">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    {lbl('Party 1 Representative')}
                    <input
                      className={inputCls}
                      value={form.sig_party1}
                      onChange={(e) => setField('sig_party1', e.target.value)}
                    />
                  </div>
                  <div>
                    {lbl('Party 2 Representative')}
                    <input
                      className={inputCls}
                      value={form.sig_party2}
                      onChange={(e) => setField('sig_party2', e.target.value)}
                    />
                  </div>
                  <div>
                    {lbl('Signature Date')}
                    <input
                      type="date"
                      className={inputCls}
                      value={form.sig_date}
                      onChange={(e) => setField('sig_date', e.target.value)}
                    />
                  </div>
                  <div>
                    {lbl('Place')}
                    <input
                      className={inputCls}
                      value={form.sig_place}
                      onChange={(e) => setField('sig_place', e.target.value)}
                    />
                  </div>
                </div>
              </Section>

              <div className="pb-4">
                <button
                  onClick={save}
                  disabled={saving}
                  className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                  style={{ background: 'var(--accent)' }}
                >
                  {saved ? (
                    <>
                      <Check size={16} /> Saved!
                    </>
                  ) : saving ? (
                    'Saving…'
                  ) : (
                    <>
                      <Save size={16} /> {editingId ? 'Update Contract' : 'Save Contract'}
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <HistoryPanel
              contracts={contracts}
              loading={loading}
              onEdit={loadIntoForm}
              onDuplicate={duplicateContract}
              onDelete={deleteC}
              onReload={load}
              onBackup={handleBackup}
              onClearAll={handleClearAll}
              onRestoreData={handleRestoreData}
            />
          )}
        </div>
      }
      preview={
        <div className="docs-preview-shell">
          <div className="docs-preview-canvas">
            <ContractPreview form={form} />
          </div>
        </div>
      }
    />
  );
}
