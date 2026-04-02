'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Building2, Mail, Phone, Globe, Upload, Pencil, Trash2, File } from 'lucide-react';
import supabase from '@/lib/supabase';
import { useLang } from '@/lib/lang-context';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import type { Client, Task, ContentItem, Asset, Activity } from '@/lib/types';

const tabs = ['overview', 'tasks', 'content', 'assets', 'approvals', 'activity'] as const;

const statusVariant = (s: string) => {
  if (s === 'active')  return 'success' as const;
  if (s === 'inactive') return 'default' as const;
  return 'info' as const;
};

const taskStatusVariant = (s: string) => {
  if (s === 'done') return 'success' as const;
  if (s === 'overdue') return 'danger' as const;
  return 'info' as const;
};

export default function ClientWorkspace() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t } = useLang();
  const fileRef = useRef<HTMLInputElement>(null);

  const [client, setClient] = useState<Client | null>(null);
  const [activeTab, setActiveTab] = useState<typeof tabs[number]>('overview');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [content, setContent] = useState<ContentItem[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [approvals, setApprovals] = useState<{ id: string; title: string; status: string; created_at: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '', website: '', industry: '', status: 'active', notes: '' });
  const [saving, setSaving] = useState(false);

  const logActivity = async (description: string) => {
    await supabase.from('activities').insert({ type: 'client', description, client_id: id });
  };

  const loadAll = useCallback(async () => {
    const [c, tk, ct, a, act, appr] = await Promise.allSettled([
      supabase.from('clients').select('*').eq('id', id).single(),
      supabase.from('tasks').select('*').eq('client_id', id).order('created_at', { ascending: false }).limit(50),
      supabase.from('content_items').select('*').eq('client_id', id).order('created_at', { ascending: false }).limit(50),
      supabase.from('assets').select('*').eq('client_id', id).order('created_at', { ascending: false }).limit(50),
      supabase.from('activities').select('*').eq('client_id', id).order('created_at', { ascending: false }).limit(50),
      supabase.from('approvals').select('*').eq('client_id', id).order('created_at', { ascending: false }).limit(50),
    ]);

    if (c.status === 'fulfilled' && !c.value.error) setClient(c.value.data as Client);
    if (tk.status === 'fulfilled' && !tk.value.error) setTasks((tk.value.data ?? []) as Task[]);
    if (ct.status === 'fulfilled' && !ct.value.error) setContent((ct.value.data ?? []) as ContentItem[]);
    if (a.status === 'fulfilled' && !a.value.error) setAssets((a.value.data ?? []) as Asset[]);
    if (act.status === 'fulfilled' && !act.value.error) setActivities((act.value.data ?? []) as Activity[]);
    if (appr.status === 'fulfilled' && !appr.value.error) setApprovals((appr.value.data ?? []) as typeof approvals);
    setLoading(false);
  }, [id]);

  useEffect(() => { loadAll(); }, [loadAll]);

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
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      setClient(data as Client);
      setEditOpen(false);
      await logActivity(`Client "${editForm.name}" updated`);
    } catch (err: unknown) {
      if (process.env.NODE_ENV === 'development') console.error('[client update]', err);
      alert(err instanceof Error ? err.message : 'Failed to update client');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!client) return;
    if (!confirm(`Delete client "${client.name}"? This cannot be undone.`)) return;
    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (error) {
      if (process.env.NODE_ENV === 'development') console.error('[client delete]', error);
      alert(error.message);
      return;
    }
    await logActivity(`Client "${client.name}" deleted`);
    router.push('/clients');
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const filePath = `${id}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('client-assets')
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('client-assets').getPublicUrl(filePath);
      const { error: dbError } = await supabase.from('assets').insert({
        name: file.name,
        file_path: filePath,
        file_url: urlData.publicUrl,
        client_id: id,
      });
      if (dbError) throw dbError;
      await logActivity(`Asset "${file.name}" uploaded`);
      loadAll();
    } catch (err: unknown) {
      if (process.env.NODE_ENV === 'development') console.error('[asset upload]', err);
      alert(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleDeleteAsset = async (asset: Asset) => {
    if (!confirm(`Delete "${asset.name}"?`)) return;
    await supabase.storage.from('client-assets').remove([asset.file_path]);
    const { error } = await supabase.from('assets').delete().eq('id', asset.id);
    if (error) {
      if (process.env.NODE_ENV === 'development') console.error('[asset delete]', error);
      return;
    }
    setAssets(prev => prev.filter(a => a.id !== asset.id));
    await logActivity(`Asset "${asset.name}" deleted`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 rounded-full animate-spin"
          style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }} />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="text-center py-20">
        <p style={{ color: 'var(--text-secondary)' }}>Client not found</p>
        <button onClick={() => router.back()} className="mt-4 text-sm" style={{ color: 'var(--accent)' }}>
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-sm hover:opacity-80 transition-opacity"
        style={{ color: 'var(--text-secondary)' }}
      >
        <ArrowLeft size={16} />{t('clients')}
      </button>

      {/* Client header */}
      <div className="rounded-2xl border p-6" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="flex items-start gap-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold text-white shrink-0"
            style={{ background: 'var(--accent)' }}
          >
            {client.name?.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>{client.name}</h1>
              <Badge variant={statusVariant(client.status)}>{t(client.status)}</Badge>
            </div>
            <div className="flex flex-wrap gap-4 mt-2">
              {client.email && (
                <span className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <Mail size={14} />{client.email}
                </span>
              )}
              {client.phone && (
                <span className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <Phone size={14} />{client.phone}
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
                  <Globe size={14} />{client.website}
                </a>
              )}
              {client.industry && (
                <span className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <Building2 size={14} />{client.industry}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleEdit}
              className="flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium transition-colors"
              style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
            >
              <Pencil size={14} /> Edit
            </button>
            <button
              onClick={handleDelete}
              className="flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium text-red-500 transition-colors"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
            >
              <Trash2 size={14} /> Delete
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b" style={{ borderColor: 'var(--border)' }}>
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="px-4 py-2.5 text-sm font-medium transition-colors capitalize border-b-2 -mb-px"
            style={{
              color: activeTab === tab ? 'var(--accent)' : 'var(--text-secondary)',
              borderColor: activeTab === tab ? 'var(--accent)' : 'transparent',
            }}
          >
            {t(tab)}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {client.notes && (
              <div className="rounded-2xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text)' }}>{t('notes')}</h3>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{client.notes}</p>
              </div>
            )}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: t('tasks'), value: tasks.length },
                { label: t('content'), value: content.length },
                { label: t('assets'), value: assets.length },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-2xl border p-5 text-center"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                  <div className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{value}</div>
                  <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'tasks' && (
          <div className="space-y-3">
            {tasks.length === 0 ? (
              <div className="py-16 text-center" style={{ color: 'var(--text-secondary)' }}>{t('noTasksYet')}</div>
            ) : tasks.map(task => (
              <div key={task.id} className="flex items-center gap-4 rounded-xl border px-5 py-3"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                <div className="flex-1">
                  <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{task.title}</p>
                  {task.due_date && (
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{task.due_date}</p>
                  )}
                </div>
                <Badge variant={taskStatusVariant(task.status)}>{t(task.status)}</Badge>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'content' && (
          <div className="space-y-3">
            {content.length === 0 ? (
              <div className="py-16 text-center" style={{ color: 'var(--text-secondary)' }}>No content yet</div>
            ) : content.map(item => (
              <div key={item.id} className="flex items-center gap-4 rounded-xl border px-5 py-3"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                <div className="flex-1">
                  <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{item.title}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{item.platform}</p>
                </div>
                <Badge>{item.status}</Badge>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'assets' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium text-white disabled:opacity-60 transition-opacity"
                style={{ background: 'var(--accent)' }}
              >
                <Upload size={14} />{uploading ? t('loading') : t('uploadFile')}
              </button>
              <input ref={fileRef} type="file" className="hidden" onChange={handleUpload} />
            </div>
            {assets.length === 0 ? (
              <div className="py-16 text-center" style={{ color: 'var(--text-secondary)' }}>{t('noAssetsYet')}</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {assets.map(a => {
                  const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(a.name);
                  return (
                    <div
                      key={a.id}
                      className="group relative rounded-2xl border overflow-hidden"
                      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                    >
                      {isImage ? (
                        <div className="aspect-square overflow-hidden">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={a.file_url} alt={a.name} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="aspect-square flex items-center justify-center" style={{ background: 'var(--surface-2)' }}>
                          <File size={32} style={{ color: 'var(--text-secondary)' }} />
                        </div>
                      )}
                      <div className="p-3">
                        <p className="text-xs font-medium truncate" style={{ color: 'var(--text)' }}>{a.name}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteAsset(a)}
                        className="absolute top-2 right-2 p-1.5 rounded-lg bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'approvals' && (
          <div className="space-y-3">
            {approvals.length === 0 ? (
              <div className="py-16 text-center" style={{ color: 'var(--text-secondary)' }}>No approvals yet</div>
            ) : approvals.map(a => (
              <div key={a.id} className="flex items-center gap-4 rounded-xl border px-5 py-3"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                <div className="flex-1">
                  <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{a.title}</p>
                </div>
                <Badge>{a.status}</Badge>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="space-y-3">
            {activities.length === 0 ? (
              <div className="py-16 text-center" style={{ color: 'var(--text-secondary)' }}>No activity yet</div>
            ) : activities.map(a => (
              <div key={a.id} className="flex gap-3 rounded-xl border px-5 py-3"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                <div className="w-2 h-2 rounded-full mt-2 shrink-0" style={{ background: 'var(--accent)' }} />
                <div>
                  <p className="text-sm" style={{ color: 'var(--text)' }}>{a.description}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    {new Date(a.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Client">
        <form onSubmit={handleEditSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { label: t('companyName') + ' *', key: 'name', type: 'text', required: true },
              { label: t('email'), key: 'email', type: 'email', required: false },
              { label: t('phone'), key: 'phone', type: 'text', required: false },
              { label: t('website'), key: 'website', type: 'text', required: false },
              { label: t('industry'), key: 'industry', type: 'text', required: false },
            ].map(({ label, key, type, required }) => (
              <div key={key} className="space-y-1">
                <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>{label}</label>
                <input
                  type={type}
                  required={required}
                  value={editForm[key as keyof typeof editForm]}
                  onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                  className="w-full h-9 px-3 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
                />
              </div>
            ))}
            <div className="space-y-1">
              <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>{t('status')}</label>
              <select
                value={editForm.status}
                onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}
                className="w-full h-9 px-3 rounded-lg text-sm outline-none"
                style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
              >
                <option value="active">{t('active')}</option>
                <option value="inactive">{t('inactive')}</option>
                <option value="prospect">{t('prospect')}</option>
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>{t('notes')}</label>
            <textarea
              value={editForm.notes}
              onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none focus:ring-2 focus:ring-[var(--accent)]"
              style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setEditOpen(false)}
              className="h-9 px-4 rounded-lg text-sm font-medium"
              style={{ background: 'var(--surface-2)', color: 'var(--text)' }}
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="h-9 px-4 rounded-lg text-sm font-medium text-white disabled:opacity-60"
              style={{ background: 'var(--accent)' }}
            >
              {saving ? t('loading') : t('save')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
