'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  Globe,
  Pencil,
  Trash2,
  CheckCircle,
  X,
  CheckSquare,
  FolderOpen,
  FileText,
  Activity,
  Plus,
  Upload,
  Layers,
} from 'lucide-react';
import supabase from '@/lib/supabase';
import { useLang } from '@/lib/lang-context';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import AiImproveButton from '@/components/ui/AiImproveButton';
import SelectDropdown from '@/components/ui/SelectDropdown';
import type { Client } from '@/lib/types';
import { ClientWorkspaceContext } from './client-context';

interface ToastMsg { id: number; message: string; type: 'success' | 'error' }

interface ClientWorkspaceStats {
  tasks: number;
  activeTasks: number;
  assets: number;
  content: number;
}
const COMPLETED_TASK_STATUSES = new Set(['done', 'completed', 'delivered', 'cancelled']);

function ClientToast({ toasts, remove }: { toasts: ToastMsg[]; remove: (id: number) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white"
          style={{ background: toast.type === 'success' ? '#16a34a' : '#dc2626', minWidth: 240, animation: 'fadeSlideUp 0.2s ease' }}
        >
          {toast.type === 'success'
            ? <CheckCircle size={16} className="shrink-0" />
            : <X size={16} className="shrink-0" />}
          <span className="flex-1">{toast.message}</span>
          <button onClick={() => remove(toast.id)} className="shrink-0 opacity-70 hover:opacity-100 transition-opacity">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

const tabs = ['overview', 'projects', 'tasks', 'content', 'assets', 'activity'] as const;
type TabSlug = typeof tabs[number];

const statusVariant = (status: string) => {
  if (status === 'active') return 'success' as const;
  if (status === 'inactive' || status === 'paused') return 'warning' as const;
  return 'default' as const;
};

function statusLabel(status: string) {
  if (status === 'active') return 'Active';
  if (status === 'inactive' || status === 'paused') return 'Paused';
  return 'Archived';
}

export default function ClientWorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { slug: routeParam } = useParams<{ slug: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLang();

  const [client, setClient] = useState<Client | null>(null);
  const [clientId, setClientId] = useState('');
  const [invalidRouteParam, setInvalidRouteParam] = useState(false);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [stats, setStats] = useState<ClientWorkspaceStats>({ tasks: 0, activeTasks: 0, assets: 0, content: 0 });

  const [toastIdRef] = useState({ current: 0 });
  const [toasts, setToasts] = useState<ToastMsg[]>([]);

  const addToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const tid = ++toastIdRef.current;
    setToasts(prev => [...prev, { id: tid, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== tid)), 4500);
  }, [toastIdRef]);

  const removeToast = useCallback((tid: number) => {
    setToasts(prev => prev.filter(t => t.id !== tid));
  }, []);

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '', email: '', phone: '', website: '', industry: '', status: 'active', notes: '',
  });
  const [saving, setSaving] = useState(false);

  const loadStats = useCallback(async (id: string) => {
    if (!id) return;
    setStatsLoading(true);

    const [tasksRes, assetsRes, contentRes] = await Promise.allSettled([
      supabase.from('tasks').select('id,status', { count: 'exact' }).eq('client_id', id),
      supabase.from('assets').select('id', { count: 'exact', head: true }).eq('client_id', id),
      supabase.from('content_items').select('id', { count: 'exact', head: true }).eq('client_id', id),
    ]);

    const allTaskRows = tasksRes.status === 'fulfilled' && !tasksRes.value.error
      ? (tasksRes.value.data ?? []) as { id: string; status: string }[]
      : [];

    const activeTasks = allTaskRows.filter(task => !COMPLETED_TASK_STATUSES.has(task.status ?? '')).length;

    setStats({
      tasks: tasksRes.status === 'fulfilled' ? (tasksRes.value.count ?? allTaskRows.length) : 0,
      activeTasks,
      assets: assetsRes.status === 'fulfilled' ? (assetsRes.value.count ?? 0) : 0,
      content: contentRes.status === 'fulfilled' ? (contentRes.value.count ?? 0) : 0,
    });

    setStatsLoading(false);
  }, []);

  const loadClient = useCallback(async () => {
    const clientRouteId = (routeParam ?? '').trim();
    if (!clientRouteId || clientRouteId === 'null' || clientRouteId === 'undefined') {
      setClient(null);
      setClientId('');
      setInvalidRouteParam(true);
      setLoading(false);
      setStatsLoading(false);
      return;
    }

    setLoading(true);
    setInvalidRouteParam(false);

    const byId = await supabase.from('clients').select('*').eq('id', clientRouteId).maybeSingle();
    let data = byId.data;
    let error = byId.error;

    // Backward compatibility for older slug-based URLs.
    if (!data) {
      const bySlug = await supabase.from('clients').select('*').eq('slug', clientRouteId).maybeSingle();
      if (bySlug.data) {
        data = bySlug.data;
        error = null;
      } else {
        error = bySlug.error ?? error;
      }
    }

    if (error || !data) {
      setLoading(false);
      setStatsLoading(false);
      setClient(null);
      setClientId('');
      return;
    }

    setClient(data as Client);
    setClientId(data.id);
    try {
      window.localStorage.setItem('openy_last_client', JSON.stringify({
        id: data.id,
        slug: data.slug ?? '',
        name: data.name ?? '',
      }));
    } catch {
      // ignore storage errors
    }
    setLoading(false);
    void loadStats(data.id);
  }, [routeParam, loadStats]);

  useEffect(() => { void loadClient(); }, [loadClient]);

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
        .eq('id', client!.id)
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

      addToast('Client updated', 'success');
      await loadStats(clientId);
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Failed to update client', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!client) return;
    if (!confirm(`Delete client "${client.name}"? This cannot be undone.`)) return;

    const { error } = await supabase.from('clients').delete().eq('id', client.id);
    if (error) {
      addToast(error.message, 'error');
      return;
    }

    router.push('/clients');
  };

  const lastSegment = pathname.split('/').pop() as TabSlug;
  const activeTab = tabs.includes(lastSegment as TabSlug) ? lastSegment : 'overview';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }} />
      </div>
    );
  }

  if (!client) {
    if (invalidRouteParam) {
      return (
        <div className="text-center py-20">
          <p style={{ color: 'var(--text-secondary)' }}>Invalid client link.</p>
          <button onClick={() => router.push('/clients')} className="mt-4 text-sm" style={{ color: 'var(--accent)' }}>
            Back to clients
          </button>
        </div>
      );
    }

    return (
      <div className="text-center py-20">
        <p style={{ color: 'var(--text-secondary)' }}>Client not found</p>
        <button onClick={() => router.push('/clients')} className="mt-4 text-sm" style={{ color: 'var(--accent)' }}>
          Back to clients
        </button>
      </div>
    );
  }

  return (
    <ClientWorkspaceContext.Provider value={{ client, clientId, setClient, reload: loadClient }}>
      <style>{`@keyframes fadeSlideUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>

      <div className="max-w-7xl mx-auto space-y-5 pb-2 animate-openy-fade-in">
        <Link href="/clients" className="inline-flex items-center gap-2 text-sm hover:opacity-80 transition-opacity" style={{ color: 'var(--text-secondary)' }}>
          <ArrowLeft size={16} />{t('clients')}
        </Link>

        <div className="glass-card p-5 md:p-6">
          <div className="flex flex-col xl:flex-row gap-5 xl:items-start xl:justify-between">
            <div className="flex items-start gap-4 min-w-0">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold text-white shrink-0" style={{ background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%)' }}>
                {client.name?.charAt(0).toUpperCase()}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--text)' }}>{client.name}</h1>
                  <Badge variant={statusVariant(client.status)}>{statusLabel(client.status)}</Badge>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {client.email && <span className="inline-flex items-center gap-1.5"><Mail size={14} />{client.email}</span>}
                  {client.phone && <span className="inline-flex items-center gap-1.5"><Phone size={14} />{client.phone}</span>}
                  {client.website && (
                    <a href={client.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5" style={{ color: 'var(--accent)' }}>
                      <Globe size={14} />{client.website}
                    </a>
                  )}
                  {client.industry && <span className="inline-flex items-center gap-1.5"><Building2 size={14} />{client.industry}</span>}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 xl:justify-end">
              <button
                onClick={() => router.push(`/clients/${client.id}/tasks?quickAdd=1`)}
                className="btn-primary h-9 px-4 rounded-xl text-sm font-semibold inline-flex items-center gap-2"
              >
                <Plus size={14} /> Add Task
              </button>
              <button
                onClick={() => router.push(`/clients/${client.id}/assets?quickAction=upload`)}
                className="btn-secondary h-9 px-4 rounded-xl text-sm font-semibold inline-flex items-center gap-2"
              >
                <Upload size={14} /> Add Asset
              </button>
              <button
                onClick={() => router.push(`/clients/${client.id}/content?quickAdd=1`)}
                className="btn-secondary h-9 px-4 rounded-xl text-sm font-semibold inline-flex items-center gap-2"
              >
                <FileText size={14} /> Add Content
              </button>
              <button onClick={handleEdit} className="btn-ghost h-9 px-3 rounded-xl text-sm font-semibold inline-flex items-center gap-1.5">
                <Pencil size={14} /> Edit
              </button>
              <button onClick={() => void handleDelete()} className="btn-ghost h-9 px-3 rounded-xl text-sm font-semibold inline-flex items-center gap-1.5 text-red-500">
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mt-5">
            {[
              { icon: <CheckSquare size={14} />, label: 'Tasks', value: stats.tasks, href: `/clients/${client.id}/tasks` },
              { icon: <Activity size={14} />, label: 'Active Tasks', value: stats.activeTasks, href: `/clients/${client.id}/tasks` },
              { icon: <FolderOpen size={14} />, label: 'Assets', value: stats.assets, href: `/clients/${client.id}/assets` },
              { icon: <Layers size={14} />, label: 'Content', value: stats.content, href: `/clients/${client.id}/content` },
            ].map(item => (
              <Link
                key={item.label}
                href={item.href}
                className="rounded-xl border px-3 py-3 transition-all hover:-translate-y-0.5"
                style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}
              >
                <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-secondary)' }}>
                  <span className="inline-flex items-center gap-1.5">{item.icon}{item.label}</span>
                </div>
                <div className="text-xl font-bold mt-1" style={{ color: 'var(--text)' }}>
                  {statsLoading ? '—' : item.value}
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto no-scrollbar">
          <div className="inline-flex min-w-full gap-1 rounded-2xl border p-1" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
            {tabs.map(tab => (
              <Link
                key={tab}
                href={`/clients/${client.id}/${tab}`}
                className="px-4 py-2.5 text-sm font-semibold capitalize rounded-xl transition-all whitespace-nowrap"
                style={{
                  color: activeTab === tab ? 'var(--accent)' : 'var(--text-secondary)',
                  background: activeTab === tab ? 'var(--accent-soft)' : 'transparent',
                  boxShadow: activeTab === tab ? 'var(--shadow-sm)' : undefined,
                }}
              >
                {t(tab)}
              </Link>
            ))}
          </div>
        </div>

        <div>{children}</div>

        <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Client">
          <form onSubmit={e => void handleEditSave(e)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {([
                { label: t('companyName') + ' *', key: 'name', type: 'text', required: true },
                { label: t('email'), key: 'email', type: 'email', required: false },
                { label: t('phone'), key: 'phone', type: 'text', required: false },
                { label: t('website'), key: 'website', type: 'text', required: false },
                { label: t('industry'), key: 'industry', type: 'text', required: false },
              ] as const).map(({ label, key, type, required }) => (
                <div key={key} className="space-y-1">
                  <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>{label}</label>
                  <input
                    type={type}
                    required={required}
                    value={editForm[key]}
                    onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                    className="w-full h-9 px-3 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
                  />
                </div>
              ))}
              <div className="space-y-1">
                <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>{t('status')}</label>
                <SelectDropdown
                  fullWidth
                  value={editForm.status}
                  onChange={v => setEditForm(f => ({ ...f, status: v }))}
                  options={[
                    { value: 'active', label: t('active') },
                    { value: 'inactive', label: t('inactive') },
                    { value: 'prospect', label: t('prospect') },
                  ]}
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>{t('notes')}</label>
                <AiImproveButton value={editForm.notes} onImproved={v => setEditForm(f => ({ ...f, notes: v }))} showMenu />
              </div>
              <textarea
                value={editForm.notes}
                onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none focus:ring-2 focus:ring-[var(--accent)]"
                style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setEditOpen(false)} className="h-9 px-4 rounded-lg text-sm font-medium" style={{ background: 'var(--surface-2)', color: 'var(--text)' }}>
                {t('cancel')}
              </button>
              <button type="submit" disabled={saving} className="h-9 px-4 rounded-lg text-sm font-medium text-white disabled:opacity-60" style={{ background: 'var(--accent)' }}>
                {saving ? t('loading') : t('save')}
              </button>
            </div>
          </form>
        </Modal>
      </div>

      <ClientToast toasts={toasts} remove={removeToast} />
    </ClientWorkspaceContext.Provider>
  );
}
