'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { ArrowLeft, Building2, Mail, Phone, Globe, Pencil, Trash2 } from 'lucide-react';
import supabase from '@/lib/supabase';
import { useLang } from '@/context/lang-context';
import { useToast } from '@/context/toast-context';
import { useAuth } from '@/context/auth-context';
import { useAppPeriod } from '@/context/app-period-context';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import AiImproveButton from '@/components/ui/AiImproveButton';
import SelectDropdown from '@/components/ui/SelectDropdown';
import Button from '@/components/ui/Button';
import { Input, Textarea, Field } from '@/components/ui/Input';
import { Tabs } from '@/components/ui/Tabs';
import EmptyState from '@/components/ui/EmptyState';
import Skeleton from '@/components/ui/Skeleton';
import type { Client } from '@/lib/types';
import { isClientUuid, sanitizeClientRouteToken } from '@/lib/client-route-utils';
import { CLIENT_LIST_COLUMNS } from '@/lib/supabase-list-columns';
import { ClientWorkspaceContext } from './client-context';
import { ClientBrandMark } from '@/components/ui/ClientBrandMark';

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
  const { role } = useAuth();
  const { periodYm } = useAppPeriod();

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
    logo: '' as string,
  });
  const [saving, setSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoFileRef = useRef<HTMLInputElement>(null);

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

    if (!normalizedParam) {
      setClient(null);
      setClientId('');
      setLoading(false);
      return;
    }
    const shouldLookupByIdFirst = isClientUuid(normalizedParam);

    const findByField = async (field: 'slug' | 'id') => {
      const result = await supabase
        .from('clients')
        .select(CLIENT_LIST_COLUMNS)
        .eq(field, normalizedParam)
        .single();
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
      logo: client.logo ?? '',
    });
    setEditOpen(true);
  };

  const persistLogo = async (logoUrl: string | null) => {
    if (!client) return;
    const { data, error } = await supabase
      .from('clients')
      .update({ logo: logoUrl, updated_at: new Date().toISOString() })
      .eq('id', client.id)
      .select(CLIENT_LIST_COLUMNS)
      .single();
    if (error) throw error;
    setClient(data as Client);
    setEditForm((f) => ({ ...f, logo: logoUrl ?? '' }));
  };

  const uploadClientLogoFile = async (file: File) => {
    if (!client) return;
    if (!file.type.startsWith('image/')) {
      toast(t('clientLogoImageOnly'), 'error');
      return;
    }
    setLogoUploading(true);
    try {
      const fd = new FormData();
      fd.set('file', file);
      fd.set('fileName', file.name);
      fd.set('fileType', file.type);
      fd.set('fileSize', String(file.size));
      fd.set('clientName', client.name);
      fd.set('clientId', client.id);
      fd.set('mainCategory', 'other');
      fd.set('subCategory', '');
      fd.set('monthKey', periodYm);
      fd.set('customFileName', 'brand-logo');
      const res = await fetch('/api/upload/presign', { method: 'POST', body: fd });
      const j = (await res.json()) as { publicUrl?: string; error?: string };
      if (!res.ok) throw new Error(j.error ?? t('clientLogoUploadFailed'));
      if (!j.publicUrl) throw new Error(t('clientLogoUploadFailed'));
      await persistLogo(j.publicUrl);
      toast(t('clientLogoUploadOk'), 'success');
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : t('clientLogoUploadFailed'), 'error');
    } finally {
      setLogoUploading(false);
    }
  };

  const clearClientLogo = async () => {
    if (!client?.logo && !editForm.logo) return;
    setLogoUploading(true);
    try {
      await persistLogo(null);
      toast(t('clientLogoRemoved'), 'success');
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : t('clientLogoUploadFailed'), 'error');
    } finally {
      setLogoUploading(false);
    }
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { logo: _logoIgnored, ...restForm } = editForm;
      const { data, error } = await supabase
        .from('clients')
        .update({ ...restForm, updated_at: new Date().toISOString() })
        .eq('id', client?.id ?? '')
        .select(CLIENT_LIST_COLUMNS)
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
    if (!confirm(t('clientDeleteConfirm', { name: client.name }))) return;
    try {
      const res = await fetch(`/api/clients/${client.id}`, { method: 'DELETE' });
      const json = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !json.success) {
        toast(json.error ?? t('clientDeleteFailed'), 'error');
        return;
      }
      router.push('/clients');
    } catch {
      toast(t('clientDeleteFailed'), 'error');
    }
  };

  // Determine active tab from pathname
  const lastSegment = pathname.split('/').pop() as TabSlug;
  const activeTab = tabs.includes(lastSegment as TabSlug) ? lastSegment : 'overview';

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
    );
  }

  if (!client) {
    return (
      <EmptyState
        title="Client not found"
        description="This client may not exist anymore."
        action={
          <Button type="button" variant="secondary" onClick={() => router.push('/clients')}>
            Back to clients
          </Button>
        }
      />
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
            <ClientBrandMark
              name={client.name}
              logoUrl={client.logo}
              size={56}
              roundedClassName="rounded-2xl"
            />
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
              <Button type="button" variant="secondary" onClick={handleEdit}>
                <Pencil size={14} /> Edit
              </Button>
              {role === 'owner' ? (
                <Button type="button" variant="danger" onClick={() => void handleDelete()}>
                  <Trash2 size={14} /> {t('deleteAction')}
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        {/* Tab navigation */}
        <Tabs>
          {tabs.map((tab) => (
            <Link
              key={tab}
              href={`/clients/${slug}/${tab}`}
              role="tab"
              aria-selected={activeTab === tab}
              className="h-8 rounded-control px-3 py-1.5 text-xs font-semibold no-underline transition-colors"
              style={{
                background: activeTab === tab ? 'var(--accent)' : 'transparent',
                color: activeTab === tab ? 'var(--accent-contrast)' : 'var(--text-secondary)',
              }}
            >
              {t(tab)}
            </Link>
          ))}
        </Tabs>

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
                <Field key={key} label={label}>
                  <Input
                    type={type}
                    required={required}
                    value={editForm[key]}
                    onChange={(e) => setEditForm((f) => ({ ...f, [key]: e.target.value }))}
                  />
                </Field>
              ))}
              <Field label={t('status')}>
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
              </Field>
            </div>
            <Field label={t('clientLogoField')}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <ClientBrandMark
                  name={editForm.name || client.name}
                  logoUrl={editForm.logo || undefined}
                  size={72}
                  roundedClassName="rounded-2xl"
                />
                <div className="flex flex-wrap gap-2">
                  <input
                    ref={logoFileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = '';
                      if (f) void uploadClientLogoFile(f);
                    }}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={logoUploading}
                    onClick={() => logoFileRef.current?.click()}
                  >
                    {logoUploading ? t('loading') : t('clientLogoUpload')}
                  </Button>
                  {editForm.logo ? (
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={logoUploading}
                      onClick={() => void clearClientLogo()}
                    >
                      {t('clientLogoRemove')}
                    </Button>
                  ) : null}
                </div>
              </div>
              <p className="mt-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                {t('clientLogoHelp')}
              </p>
            </Field>
            <Field label={t('notes')}>
              <div className="mb-1 flex items-center justify-between">
                <AiImproveButton
                  value={editForm.notes}
                  onImproved={(v) => setEditForm((f) => ({ ...f, notes: v }))}
                  showMenu
                />
              </div>
              <Textarea
                value={editForm.notes}
                onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                rows={3}
              />
            </Field>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="ghost" onClick={() => setEditOpen(false)}>
                {t('cancel')}
              </Button>
              <Button type="submit" variant="primary" disabled={saving}>
                {saving ? t('loading') : t('save')}
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    </ClientWorkspaceContext.Provider>
  );
}
