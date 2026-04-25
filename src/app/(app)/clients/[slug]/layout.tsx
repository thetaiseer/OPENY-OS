'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { ArrowLeft, Building2, Globe, Mail, Pencil, Phone, Trash2 } from 'lucide-react';
import supabase from '@/lib/supabase';
import { useLang } from '@/context/lang-context';
import { useToast } from '@/context/toast-context';
import AiImproveButton from '@/components/ui/AiImproveButton';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Field, Input, Textarea } from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import { PageHeader, PageShell } from '@/components/layout/PageLayout';
import SelectDropdown from '@/components/ui/SelectDropdown';
import type { Client } from '@/lib/types';
import { CLIENT_LIST_COLUMNS } from '@/lib/supabase-list-columns';
import { isClientUuid, sanitizeClientRouteToken } from '@/lib/client-route-utils';
import { ClientWorkspaceContext } from './client-context';

const tabs = ['overview', 'projects', 'tasks', 'content', 'assets', 'activity'] as const;
type TabSlug = (typeof tabs)[number];

const statusVariant = (status: string) => {
  if (status === 'active') return 'success' as const;
  if (status === 'inactive') return 'default' as const;
  return 'info' as const;
};

export default function ClientWorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { slug } = useParams<{ slug: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLang();
  const { toast } = useToast();

  const [client, setClient] = useState<Client | null>(null);
  const [clientId, setClientId] = useState('');
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    phone: '',
    website: '',
    industry: '',
    status: 'active',
    notes: '',
  });

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

    const byId = isClientUuid(normalizedParam);
    const primary: 'id' | 'slug' = byId ? 'id' : 'slug';
    const fallback: 'id' | 'slug' = byId ? 'slug' : 'id';

    const lookup = async (field: 'id' | 'slug') =>
      supabase.from('clients').select(CLIENT_LIST_COLUMNS).eq(field, normalizedParam).single();

    let { data, error } = await lookup(primary);
    if (!data) {
      const fallbackResult = await lookup(fallback);
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

  const handleEditSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('clients')
        .update({ ...editForm, updated_at: new Date().toISOString() })
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
    } catch (error: unknown) {
      toast(error instanceof Error ? error.message : 'Failed to update client', 'error');
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

  const lastSegment = pathname.split('/').pop() as TabSlug;
  const activeTab = tabs.includes(lastSegment as TabSlug) ? lastSegment : 'overview';

  if (loading) {
    return (
      <PageShell>
        <Card>
          <CardContent className="py-10 text-center text-sm text-secondary">
            {t('loading')}...
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  if (!client) {
    return (
      <PageShell>
        <Card>
          <CardContent className="space-y-3 py-8 text-center">
            <p className="text-sm text-secondary">Client not found.</p>
            <Button type="button" variant="secondary" onClick={() => router.push('/clients')}>
              Back to clients
            </Button>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  return (
    <ClientWorkspaceContext.Provider value={{ client, clientId, setClient, reload: loadClient }}>
      <PageShell className="space-y-6">
        <PageHeader
          title={client.name}
          subtitle={client.industry ?? client.email ?? 'Client workspace'}
          actions={
            <div className="flex items-center gap-2">
              <Button type="button" variant="secondary" onClick={handleEdit}>
                <Pencil size={14} />
                Edit
              </Button>
              <Button type="button" variant="danger" onClick={() => void handleDelete()}>
                <Trash2 size={14} />
                Delete
              </Button>
            </div>
          }
        />

        <Link
          href="/clients"
          className="inline-flex items-center gap-2 text-sm text-secondary hover:text-primary"
        >
          <ArrowLeft size={16} />
          {t('clients')}
        </Link>

        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-control bg-accent text-sm font-semibold text-white">
                {client.name?.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <CardTitle className="truncate">{client.name}</CardTitle>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-secondary">
                  {client.email ? (
                    <span className="inline-flex items-center gap-1">
                      <Mail size={12} />
                      {client.email}
                    </span>
                  ) : null}
                  {client.phone ? (
                    <span className="inline-flex items-center gap-1">
                      <Phone size={12} />
                      {client.phone}
                    </span>
                  ) : null}
                  {client.website ? (
                    <a
                      href={client.website}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-accent hover:text-accent-hover"
                    >
                      <Globe size={12} />
                      {client.website}
                    </a>
                  ) : null}
                  {client.industry ? (
                    <span className="inline-flex items-center gap-1">
                      <Building2 size={12} />
                      {client.industry}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
            <Badge variant={statusVariant(client.status)}>{t(client.status)}</Badge>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {tabs.map((tab) => (
                <Link
                  key={tab}
                  href={`/clients/${slug}/${tab}`}
                  className={`rounded-control border px-3 py-1.5 text-sm capitalize transition-colors ${
                    activeTab === tab
                      ? 'border-accent bg-accent text-white'
                      : 'border-border bg-surface text-secondary hover:text-primary'
                  }`}
                >
                  {t(tab)}
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent>{children}</CardContent>
        </Card>

        <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Client">
          <form onSubmit={(event) => void handleEditSave(event)} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {(
                [
                  { label: `${t('companyName')} *`, key: 'name', type: 'text', required: true },
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
                    onChange={(event) =>
                      setEditForm((prev) => ({ ...prev, [key]: event.target.value }))
                    }
                  />
                </Field>
              ))}
              <Field label={t('status')}>
                <SelectDropdown
                  fullWidth
                  value={editForm.status}
                  onChange={(value) => setEditForm((prev) => ({ ...prev, status: value }))}
                  options={[
                    { value: 'active', label: t('active') },
                    { value: 'inactive', label: t('inactive') },
                    { value: 'prospect', label: t('prospect') },
                  ]}
                />
              </Field>
            </div>
            <Field label={t('notes')}>
              <div className="space-y-2">
                <div className="flex justify-end">
                  <AiImproveButton
                    value={editForm.notes}
                    onImproved={(value) => setEditForm((prev) => ({ ...prev, notes: value }))}
                    showMenu
                  />
                </div>
                <Textarea
                  value={editForm.notes}
                  onChange={(event) =>
                    setEditForm((prev) => ({ ...prev, notes: event.target.value }))
                  }
                  rows={3}
                />
              </div>
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setEditOpen(false)}>
                {t('cancel')}
              </Button>
              <Button type="submit" variant="primary" disabled={saving}>
                {saving ? t('loading') : t('save')}
              </Button>
            </div>
          </form>
        </Modal>
      </PageShell>
    </ClientWorkspaceContext.Provider>
  );
}
