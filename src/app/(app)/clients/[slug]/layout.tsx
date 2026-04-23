'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { ArrowLeft, Building2, Mail, Phone, Globe, Pencil, Trash2 } from 'lucide-react';
import supabase from '@/lib/supabase';
import { useLang } from '@/context/lang-context';
import { useToast } from '@/context/toast-context';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import AiImproveButton from '@/components/ui/AiImproveButton';
import SelectDropdown from '@/components/ui/SelectDropdown';
import type { Client } from '@/lib/types';
import {
  debugClientRouting,
  isClientUuid,
  sanitizeClientRouteToken,
  warnClientRouting,
} from '@/lib/client-route-utils';
import { ClientWorkspaceContext } from './client-context';

// ── Helpers ───────────────────────────────────────────────────────────────────

const tabs = ['overview', 'projects', 'tasks', 'content', 'assets', 'activity'] as const;
type TabSlug = (typeof tabs)[number];

const statusVariant = (s: string) => {
  if (s === 'active') return 'success' as const;
  if (s === 'inactive') return 'default' as const;
  return 'info' as const;
};

// ── Layout ────────────────────────────────────────────────────────────────────

export default function ClientWorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { slug } = useParams<{ slug: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLang();
  const { toast } = useToast();

  const [client, setClient] = useState<Client | null>(null);
  const [clientId, setClientId] = useState('');
  const [loading, setLoading] = useState(true);

  // Edit modal state
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    phone: '',
    website: '',
    industry: '',
    status: 'active',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  const loadClient = useCallback(async () => {
    setLoading(true);

    const routeParam = typeof slug === 'string' ? slug : '';
    const decodedParam = (() => {
      try {
        return decodeURIComponent(routeParam);
      } catch {
        return routeParam;
      }
    })();
    const normalizedParam = sanitizeClientRouteToken(decodedParam);

    debugClientRouting('[client layout] route param received', {
      routeParam,
      normalizedParam,
      decodedParam,
    });

    if (!normalizedParam) {
      warnClientRouting('[client layout] invalid route param', { decodedParam });
      setClient(null);
      setClientId('');
      setLoading(false);
      return;
    }
    const shouldLookupByIdFirst = isClientUuid(normalizedParam);

    const findByField = async (field: 'slug' | 'id') => {
      debugClientRouting('[client layout] querying client', { field, value: normalizedParam });
      const result = await supabase.from('clients').select('*').eq(field, normalizedParam).single();
      debugClientRouting('[client layout] query result', {
        field,
        hasData: !!result.data,
        error: result.error?.message ?? null,
      });
      return result;
    };

    const primaryLookupField: 'slug' | 'id' = shouldLookupByIdFirst ? 'id' : 'slug';
    const fallbackLookupField: 'slug' | 'id' = shouldLookupByIdFirst ? 'slug' : 'id';

    let { data, error } = await findByField(primaryLookupField);

    if (!data) {
      const fallbackResult = await findByField(fallbackLookupField);
      data = fallbackResult.data;
      error = fallbackResult.error;
    }

    if (error || !data) {
      setClient(null);
      setClientId('');
      setLoading(false);
      return;
    }
    setClient(data as Client);
    setClientId(data.id);
    setLoading(false);
  }, [slug]);

  useEffect(() => {
    void loadClient();
  }, [loadClient]);

  const handleEdit = () => {
    if (!client) return;
    setEditForm({
      name: client.name,
      email: client.email ?? '',
      phone: client.phone ?? '',
      website: client.website ?? '',
      industry: client.industry ?? '',
      status: client.status,
      notes: client.notes ?? '',
    });
    setEditOpen(true);
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('clients')
        .update({ ...editForm, updated_at: new Date().toISOString() })
        .eq('id', client?.id ?? '')
        .select()
        .single();
      if (error) throw error;
      setClient(data as Client);
      setEditOpen(false);
      await supabase.from('activities').insert({
        type: 'client',
        description: `Client "${editForm.name}" updated`,
        client_id: clientId,
      });
      toast('Client updated', 'success');
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Failed to update client', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!client) return;
    if (!confirm(`Delete client "${client.name}"? This cannot be undone.`)) return;
    const { error } = await supabase.from('clients').delete().eq('id', client.id);
    if (error) {
      toast(error.message, 'error');
      return;
    }
    router.push('/clients');
  };

  // Determine active tab from pathname
  const lastSegment = pathname.split('/').pop() as TabSlug;
  const activeTab = tabs.includes(lastSegment as TabSlug) ? lastSegment : 'overview';

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div
          className="h-6 w-6 animate-spin rounded-full border-2"
          style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }}
        />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="py-20 text-center">
        <p style={{ color: 'var(--text-secondary)' }}>Client not found</p>
        <button
          onClick={() => router.push('/clients')}
          className="mt-4 text-sm"
          style={{ color: 'var(--accent)' }}
        >
          Back to clients
        </button>
      </div>
    );
  }

  return (
    <ClientWorkspaceContext.Provider value={{ client, clientId, setClient, reload: loadClient }}>
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Back link */}
        <Link
          href="/clients"
          className="inline-flex items-center gap-2 text-sm transition-opacity hover:opacity-80"
          style={{ color: 'var(--text-secondary)' }}
        >
          <ArrowLeft size={16} />
          {t('clients')}
        </Link>

        {/* Client header */}
        <div
          className="rounded-2xl border p-6"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <div className="flex items-start gap-4">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-xl font-bold text-white"
              style={{ background: 'var(--accent)' }}
            >
              {client.name?.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>
                  {client.name}
                </h1>
                <Badge variant={statusVariant(client.status)}>{t(client.status)}</Badge>
              </div>
              <div className="mt-2 flex flex-wrap gap-4">
                {client.email && (
                  <span
                    className="flex items-center gap-1.5 text-sm"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <Mail size={14} />
                    {client.email}
                  </span>
                )}
                {client.phone && (
                  <span
                    className="flex items-center gap-1.5 text-sm"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <Phone size={14} />
                    {client.phone}
                  </span>
                )}
                {client.website && (
                  <a
                    href={client.website}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 text-sm"
                    style={{ color: 'var(--accent)' }}
                  >
                    <Globe size={14} />
                    {client.website}
                  </a>
                )}
                {client.industry && (
                  <span
                    className="flex items-center gap-1.5 text-sm"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <Building2 size={14} />
                    {client.industry}
                  </span>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={handleEdit}
                className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors"
                style={{
                  background: 'var(--surface-2)',
                  color: 'var(--text)',
                  border: '1px solid var(--border)',
                }}
              >
                <Pencil size={14} /> Edit
              </button>
              <button
                onClick={() => void handleDelete()}
                className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-red-500 transition-colors"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
              >
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="flex gap-1 border-b" style={{ borderColor: 'var(--border)' }}>
          {tabs.map((tab) => (
            <Link
              key={tab}
              href={`/clients/${slug}/${tab}`}
              className="-mb-px border-b-2 px-4 py-2.5 text-sm font-medium capitalize transition-colors"
              style={{
                color: activeTab === tab ? 'var(--accent)' : 'var(--text-secondary)',
                borderColor: activeTab === tab ? 'var(--accent)' : 'transparent',
              }}
            >
              {t(tab)}
            </Link>
          ))}
        </div>

        {/* Tab content */}
        <div>{children}</div>

        {/* Edit Client Modal */}
        <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Client">
          <form onSubmit={(e) => void handleEditSave(e)} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {(
                [
                  { label: t('companyName') + ' *', key: 'name', type: 'text', required: true },
                  { label: t('email'), key: 'email', type: 'email', required: false },
                  { label: t('phone'), key: 'phone', type: 'text', required: false },
                  { label: t('website'), key: 'website', type: 'text', required: false },
                  { label: t('industry'), key: 'industry', type: 'text', required: false },
                ] as const
              ).map(({ label, key, type, required }) => (
                <div key={key} className="space-y-1">
                  <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                    {label}
                  </label>
                  <input
                    type={type}
                    required={required}
                    value={editForm[key]}
                    onChange={(e) => setEditForm((f) => ({ ...f, [key]: e.target.value }))}
                    className="h-9 w-full rounded-lg px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    style={{
                      background: 'var(--surface-2)',
                      color: 'var(--text)',
                      border: '1px solid var(--border)',
                    }}
                  />
                </div>
              ))}
              <div className="space-y-1">
                <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                  {t('status')}
                </label>
                <SelectDropdown
                  fullWidth
                  value={editForm.status}
                  onChange={(v) => setEditForm((f) => ({ ...f, status: v }))}
                  options={[
                    { value: 'active', label: t('active') },
                    { value: 'inactive', label: t('inactive') },
                    { value: 'prospect', label: t('prospect') },
                  ]}
                />
              </div>
            </div>
            <div className="space-y-1">
              <div className="mb-1 flex items-center justify-between">
                <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                  {t('notes')}
                </label>
                <AiImproveButton
                  value={editForm.notes}
                  onImproved={(v) => setEditForm((f) => ({ ...f, notes: v }))}
                  showMenu
                />
              </div>
              <textarea
                value={editForm.notes}
                onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                rows={3}
                className="w-full resize-none rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]"
                style={{
                  background: 'var(--surface-2)',
                  color: 'var(--text)',
                  border: '1px solid var(--border)',
                }}
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="h-9 rounded-lg px-4 text-sm font-medium"
                style={{ background: 'var(--surface-2)', color: 'var(--text)' }}
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="h-9 rounded-lg px-4 text-sm font-medium text-white disabled:opacity-60"
                style={{ background: 'var(--accent)' }}
              >
                {saving ? t('loading') : t('save')}
              </button>
            </div>
          </form>
        </Modal>
      </div>
    </ClientWorkspaceContext.Provider>
  );
}
