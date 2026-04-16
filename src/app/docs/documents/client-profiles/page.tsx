'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Save, Trash2, Plus, ArrowLeft } from 'lucide-react';
import type { DocsClientProfile } from '@/lib/docs-client-profiles';
import { fetchDocsClientProfiles, isVirtualDocsProfileId } from '@/lib/docs-client-profiles';
import { DOCS_CURRENCIES } from '@/lib/docs-types';

type EditableProfile = DocsClientProfile & {
  isDirty?: boolean;
};

export default function ClientProfilesPage() {
  const [profiles, setProfiles] = useState<EditableProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newClientName, setNewClientName] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchDocsClientProfiles();
      setProfiles(data.map(p => ({ ...p, isDirty: false })));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load client profiles.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const sorted = useMemo(
    () => [...profiles].sort((a, b) => a.client_name.localeCompare(b.client_name)),
    [profiles],
  );

  function patchProfile(id: string, patch: Partial<EditableProfile>) {
    setProfiles(prev => prev.map(p => p.id === id ? { ...p, ...patch, isDirty: true } : p));
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
    setProfiles(prev => [
      {
        id: `virtual-${clientId}`,
        client_id: clientId,
        client_name: name,
        client_slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
        default_currency: 'SAR',
        invoice_layout_mode: 'branch_platform',
        supports_branch_breakdown: true,
        default_platforms: [],
        default_branch_names: [],
        default_fees_logic: {},
        default_totals_logic: {},
        invoice_template_config: {},
        quotation_template_config: {},
        contract_template_config: {},
        hr_contract_template_config: {},
        employees_template_config: {},
        accounting_template_config: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        isDirty: false,
      },
      ...prev.filter(p => p.client_id !== clientId),
    ]);
    setNewClientName('');
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
    setProfiles(prev => prev.map(p => p.id === profile.id ? { ...p, isDirty: false } : p));
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
    setProfiles(prev => prev.filter(p => p.id !== profile.id));
    void load();
  }

  return (
    <div className="p-6 sm:p-8 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--text)' }}>Clients & Templates</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Manage client-specific document templates and defaults across all OPENY DOCS modules.
          </p>
        </div>
        <Link
          href="/docs/documents"
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm"
          style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
        >
          <ArrowLeft size={14} /> Back
        </Link>
      </div>

      <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        <div className="flex gap-2">
          <input
            value={newClientName}
            onChange={(e) => setNewClientName(e.target.value)}
            className="flex-1 px-3 py-2 text-sm rounded-lg border outline-none bg-[var(--surface-2)] border-[var(--border)] text-[var(--text)]"
            placeholder="Add new client name"
          />
          <button
            onClick={createClientAndProfile}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-white"
            style={{ background: 'var(--accent)' }}
          >
            <Plus size={14} /> Add Client
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg px-3 py-2 text-sm" style={{ background: 'rgba(239,68,68,0.08)', color: '#dc2626' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading client profiles…</div>
      ) : (
        <div className="space-y-4">
          {sorted.map((profile) => (
            <div
              key={profile.id}
              className="rounded-2xl border p-4"
              style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
            >
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="font-semibold" style={{ color: 'var(--text)' }}>{profile.client_name}</div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => void saveProfile(profile)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                    style={{ background: 'var(--accent)' }}
                  >
                    <Save size={12} /> Save
                  </button>
                  <button
                    onClick={() => void deleteProfile(profile)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                    style={{ background: '#dc2626' }}
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <Field label="Default Currency">
                  <select
                    className={inputCls}
                    value={profile.default_currency}
                    onChange={(e) => patchProfile(profile.id, { default_currency: e.target.value })}
                  >
                    {DOCS_CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Invoice Layout Mode">
                  <select
                    className={inputCls}
                    value={profile.invoice_layout_mode || 'branch_platform'}
                    onChange={(e) => patchProfile(profile.id, { invoice_layout_mode: e.target.value })}
                  >
                    <option value="branch_platform">Branch / Platform</option>
                    <option value="simple_service">Simple Service</option>
                    <option value="global">Global</option>
                  </select>
                </Field>
                <Field label="Supports Branch Breakdown">
                  <select
                    className={inputCls}
                    value={profile.supports_branch_breakdown ? 'true' : 'false'}
                    onChange={(e) => patchProfile(profile.id, { supports_branch_breakdown: e.target.value === 'true' })}
                  >
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </Field>
                <Field label="Invoice Type">
                  <input className={inputCls} value={profile.invoice_type ?? ''} onChange={(e) => patchProfile(profile.id, { invoice_type: e.target.value })} />
                </Field>
                <Field label="Quotation Type">
                  <input className={inputCls} value={profile.quotation_type ?? ''} onChange={(e) => patchProfile(profile.id, { quotation_type: e.target.value })} />
                </Field>
                <Field label="Contract Type">
                  <input className={inputCls} value={profile.contract_type ?? ''} onChange={(e) => patchProfile(profile.id, { contract_type: e.target.value })} />
                </Field>
                <Field label="Default Branch Names (comma-separated)">
                  <input
                    className={inputCls}
                    value={profile.default_branch_names.join(', ')}
                    onChange={(e) => patchProfile(profile.id, { default_branch_names: e.target.value.split(',').map(v => v.trim()).filter(Boolean) })}
                  />
                </Field>
                <Field label="Default Platforms (comma-separated)">
                  <input
                    className={inputCls}
                    value={profile.default_platforms.join(', ')}
                    onChange={(e) => patchProfile(profile.id, { default_platforms: e.target.value.split(',').map(v => v.trim()).filter(Boolean) })}
                  />
                </Field>
                <Field label="Service Description Default">
                  <input className={inputCls} value={profile.service_description_default ?? ''} onChange={(e) => patchProfile(profile.id, { service_description_default: e.target.value })} />
                </Field>
              </div>
              <Field label="Notes">
                <textarea className={inputCls} rows={2} value={profile.notes ?? ''} onChange={(e) => patchProfile(profile.id, { notes: e.target.value })} />
              </Field>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{label}</label>
      {children}
    </div>
  );
}

const inputCls = 'w-full px-3 py-1.5 text-sm rounded-lg border outline-none bg-[var(--surface-2)] border-[var(--border)] text-[var(--text)]';
