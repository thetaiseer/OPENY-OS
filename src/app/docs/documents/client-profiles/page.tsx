'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Plus, Save, Search, Trash2 } from 'lucide-react';
import type { DocsClientProfile } from '@/lib/docs-client-profiles';
import { buildClientSlug, fetchDocsClientProfiles, isVirtualDocsProfileId } from '@/lib/docs-client-profiles';
import { DOCS_CURRENCIES } from '@/lib/docs-types';
import {
  DocsEmptyState,
  DocsErrorState,
  DocsInput,
  DocsLoadingState,
  DocsPageHeader,
  DocsSectionCard,
  DocsSelect,
  DocsTextarea,
} from '@/components/docs/DocsUi';

type EditableProfile = DocsClientProfile & {
  isDirty?: boolean;
};

const SUPPORTED_DOC_TYPES = ['Invoice', 'Quotation', 'Client Contract', 'HR Contract', 'Employees', 'Accounting'];

const LAYOUT_MODE_OPTIONS = [
  { value: 'branch_platform', label: 'Branch / Platform' },
  { value: 'simple_service', label: 'Simple Service' },
  { value: 'global', label: 'Global' },
];

const BOOL_OPTIONS = [
  { value: 'true', label: 'Yes' },
  { value: 'false', label: 'No' },
];

export default function ClientProfilesPage() {
  const [profiles, setProfiles] = useState<EditableProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newClientName, setNewClientName] = useState('');
  const [query, setQuery] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchDocsClientProfiles();
      setProfiles(data.map((p) => ({ ...p, isDirty: false })));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load client document profiles.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filteredProfiles = useMemo(() => {
    const term = query.trim().toLowerCase();
    const sorted = [...profiles].sort((a, b) => a.client_name.localeCompare(b.client_name));
    if (!term) return sorted;
    return sorted.filter((p) => (
      p.client_name.toLowerCase().includes(term)
      || (p.client_slug ?? '').toLowerCase().includes(term)
      || (p.default_currency ?? '').toLowerCase().includes(term)
    ));
  }, [profiles, query]);

  function patchProfile(id: string, patch: Partial<EditableProfile>) {
    setProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch, isDirty: true } : p)));
  }

  function showSuccess(message: string) {
    setSuccess(message);
    setTimeout(() => setSuccess(''), 2400);
  }

  async function createClientAndProfile() {
    const name = newClientName.trim();
    if (!name) return;
    setError('');
    const createClient = await fetch('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!createClient.ok) {
      setError('Unable to create client.');
      return;
    }
    const clientJson = await createClient.json() as { client?: { id: string } };
    const clientId = clientJson.client?.id;
    if (!clientId) {
      setError('Client created but profile could not be initialized.');
      return;
    }
    const createProfile = await fetch('/api/docs/client-profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, default_currency: 'SAR' }),
    });
    if (!createProfile.ok) {
      setError('Client created but profile could not be initialized.');
      return;
    }
    setNewClientName('');
    showSuccess('Client profile created.');
    void load();
  }

  async function saveProfile(profile: EditableProfile) {
    setError('');
    const payload = {
      default_currency: profile.default_currency,
      invoice_layout_mode: profile.invoice_layout_mode,
      supports_branch_breakdown: profile.supports_branch_breakdown,
      default_platforms: profile.default_platforms,
      default_branch_names: profile.default_branch_names,
      notes: profile.notes,
      invoice_type: profile.invoice_type,
      quotation_type: profile.quotation_type,
      contract_type: profile.contract_type,
      default_template_style: profile.default_template_style,
      billing_address: profile.billing_address,
      tax_info: profile.tax_info,
      service_description_default: profile.service_description_default,
      invoice_template_config: profile.invoice_template_config,
      quotation_template_config: profile.quotation_template_config,
      contract_template_config: profile.contract_template_config,
      hr_contract_template_config: profile.hr_contract_template_config,
      employees_template_config: profile.employees_template_config,
      accounting_template_config: profile.accounting_template_config,
    };
    const endpoint = isVirtualDocsProfileId(profile.id)
      ? '/api/docs/client-profiles'
      : `/api/docs/client-profiles/${profile.id}`;
    const method = isVirtualDocsProfileId(profile.id) ? 'POST' : 'PATCH';
    const res = await fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(isVirtualDocsProfileId(profile.id) ? { client_id: profile.client_id, ...payload } : payload),
    });
    if (!res.ok) {
      setError('Unable to save client profile.');
      return;
    }
    showSuccess(`Saved ${profile.client_name}.`);
    setProfiles((prev) => prev.map((p) => (p.id === profile.id ? { ...p, isDirty: false } : p)));
    void load();
  }

  async function deleteProfile(profile: EditableProfile) {
    if (isVirtualDocsProfileId(profile.id)) return;
    if (!confirm(`Delete profile for ${profile.client_name}?`)) return;
    const res = await fetch(`/api/docs/client-profiles/${profile.id}`, { method: 'DELETE' });
    if (!res.ok) {
      setError('Unable to delete profile.');
      return;
    }
    showSuccess(`Deleted ${profile.client_name}.`);
    setProfiles((prev) => prev.filter((p) => p.id !== profile.id));
    void load();
  }

  return (
    <div className="docs-app p-6 sm:p-8 space-y-5">
      <DocsPageHeader
        title="Clients & Templates"
        subtitle="Manage client-specific document defaults, template behavior, and supported DOCS workflows."
        actions={(
          <Link
            href="/docs/documents"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium hover:bg-[var(--surface-2)]"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
          >
            <ArrowLeft size={14} /> Back
          </Link>
        )}
      />

      <DocsSectionCard
        title="Create Client Profile"
        subtitle="Add a client, then configure invoice, quotation, contract, HR, employees, and accounting defaults."
      >
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">
          <DocsInput
            value={newClientName}
            onChange={(e) => setNewClientName(e.target.value)}
            placeholder="Client name"
          />
          <button
            onClick={createClientAndProfile}
            className="inline-flex items-center justify-center gap-2 px-4 rounded-xl text-sm font-semibold text-white"
            style={{ background: 'var(--accent)' }}
          >
            <Plus size={14} /> Add Client
          </button>
        </div>
      </DocsSectionCard>

      <DocsSectionCard>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:items-center">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-secondary)' }} />
            <DocsInput
              className="pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search clients, slug, or currency"
            />
          </div>
          <div className="text-xs md:text-right" style={{ color: 'var(--text-secondary)' }}>
            {filteredProfiles.length} profile{filteredProfiles.length === 1 ? '' : 's'} found
          </div>
        </div>
      </DocsSectionCard>

      {success ? (
        <div className="docs-state" style={{ borderColor: 'rgba(16,185,129,0.35)', background: 'rgba(16,185,129,0.08)', color: '#047857' }}>
          <div className="inline-flex items-center gap-2"><CheckCircle2 size={15} /> {success}</div>
        </div>
      ) : null}

      {error ? <DocsErrorState message={error} /> : null}
      {loading ? <DocsLoadingState label="Loading client document profiles..." /> : null}

      {!loading && filteredProfiles.length === 0 ? (
        <DocsEmptyState
          title="No client profiles found"
          description={query ? 'Try a different search term or clear filters.' : 'Create your first client profile to start using templates.'}
        />
      ) : null}

      {!loading && filteredProfiles.length > 0 ? (
        <div className="space-y-4">
          {filteredProfiles.map((profile) => {
            const templateStatus = profile.isDirty ? 'Unsaved changes' : 'Synced';
            return (
              <DocsSectionCard
                key={profile.id}
                title={profile.client_name}
                subtitle={`Slug: ${profile.client_slug} · Template status: ${templateStatus}`}
                actions={(
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => void saveProfile(profile)}
                      className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold text-white"
                      style={{ background: 'var(--accent)' }}
                    >
                      <Save size={12} /> Save
                    </button>
                    <button
                      onClick={() => void deleteProfile(profile)}
                      className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold text-white"
                      style={{ background: '#dc2626' }}
                    >
                      <Trash2 size={12} /> Delete
                    </button>
                  </div>
                )}
              >
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                  <Field label="Default Currency">
                    <DocsSelect
                      value={String(profile.default_currency ?? 'SAR')}
                      onChange={(value) => patchProfile(profile.id, { default_currency: value })}
                      options={DOCS_CURRENCIES.map((currency) => ({ value: currency, label: currency }))}
                    />
                  </Field>
                  <Field label="Invoice Layout Mode">
                    <DocsSelect
                      value={profile.invoice_layout_mode || 'branch_platform'}
                      onChange={(value) => patchProfile(profile.id, { invoice_layout_mode: value })}
                      options={LAYOUT_MODE_OPTIONS}
                    />
                  </Field>
                  <Field label="Supports Branch Breakdown">
                    <DocsSelect
                      value={profile.supports_branch_breakdown ? 'true' : 'false'}
                      onChange={(value) => patchProfile(profile.id, { supports_branch_breakdown: value === 'true' })}
                      options={BOOL_OPTIONS}
                    />
                  </Field>
                  <Field label="Invoice Type">
                    <DocsInput value={profile.invoice_type ?? ''} onChange={(e) => patchProfile(profile.id, { invoice_type: e.target.value })} />
                  </Field>
                  <Field label="Quotation Type">
                    <DocsInput value={profile.quotation_type ?? ''} onChange={(e) => patchProfile(profile.id, { quotation_type: e.target.value })} />
                  </Field>
                  <Field label="Contract Type">
                    <DocsInput value={profile.contract_type ?? ''} onChange={(e) => patchProfile(profile.id, { contract_type: e.target.value })} />
                  </Field>
                  <Field label="Default Branch Names (comma-separated)">
                    <DocsInput
                      value={profile.default_branch_names.join(', ')}
                      onChange={(e) => patchProfile(profile.id, { default_branch_names: e.target.value.split(',').map((v) => v.trim()).filter(Boolean) })}
                    />
                  </Field>
                  <Field label="Default Platforms (comma-separated)">
                    <DocsInput
                      value={profile.default_platforms.join(', ')}
                      onChange={(e) => patchProfile(profile.id, { default_platforms: e.target.value.split(',').map((v) => v.trim()).filter(Boolean) })}
                    />
                  </Field>
                  <Field label="Updated At">
                    <DocsInput value={(profile.updated_at ?? '').slice(0, 10)} readOnly />
                  </Field>
                </div>
                <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <Field label="Service Description Default">
                    <DocsInput
                      value={profile.service_description_default ?? ''}
                      onChange={(e) => patchProfile(profile.id, { service_description_default: e.target.value })}
                    />
                  </Field>
                  <Field label="Supported Document Types">
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {SUPPORTED_DOC_TYPES.map((docType) => (
                        <span
                          key={docType}
                          className="px-2 py-1 rounded-full text-[11px] font-semibold"
                          style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
                        >
                          {docType}
                        </span>
                      ))}
                    </div>
                  </Field>
                </div>
                <div className="mt-3">
                  <Field label="Notes">
                    <DocsTextarea rows={3} value={profile.notes ?? ''} onChange={(e) => patchProfile(profile.id, { notes: e.target.value })} />
                  </Field>
                </div>
              </DocsSectionCard>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block">{label}</label>
      {children}
    </div>
  );
}
