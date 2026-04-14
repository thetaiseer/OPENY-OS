'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Building2, Mail, Phone, Globe, Upload, Pencil, Trash2, File,
  Calendar, User, Users, Tag, AlertCircle, Plus, Download,
  CheckCircle, X, ThumbsUp, ThumbsDown,
} from 'lucide-react';
import supabase from '@/lib/supabase';
import { useLang } from '@/lib/lang-context';
import { useAuth } from '@/lib/auth-context';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import ActivityLog from '@/components/ui/ActivityLog';
import AiImproveButton from '@/components/ui/AiImproveButton';
import SelectDropdown from '@/components/ui/SelectDropdown';
import UploadModal, { type UploadFileItem } from '@/components/upload/UploadModal';
import { useUpload, type InitialUploadItem } from '@/lib/upload-context';
import { contentTypeLabel } from '@/lib/asset-utils';
import FilePreviewModal from '@/components/ui/FilePreviewModal';
import { AssetsGrid, isPdf as isPdfFile } from '@/components/ui/AssetsGrid';
import type { Client, Task, ContentItem, Asset, Activity, TeamMember } from '@/lib/types';
import { generateVideoThumbnail, isVideoFile } from '@/lib/video-thumbnail';
import { generatePdfPreview } from '@/lib/pdf-preview';


// ── Toast ─────────────────────────────────────────────────────────────────────

interface ToastMsg { id: number; message: string; type: 'success' | 'error' }

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

const tabs = ['overview', 'tasks', 'content', 'assets', 'approvals', 'activity'] as const;

const statusVariant = (s: string) => {
  if (s === 'active')  return 'success' as const;
  if (s === 'inactive') return 'default' as const;
  return 'info' as const;
};

const taskStatusVariant = (s: string) => {
  if (s === 'done') return 'success' as const;
  if (s === 'overdue') return 'danger' as const;
  if (s === 'in_progress') return 'info' as const;
  return 'default' as const;
};

const taskPriorityVariant = (p: string) => {
  if (p === 'high') return 'danger' as const;
  if (p === 'medium') return 'warning' as const;
  return 'default' as const;
};

function isOverdue(due_date?: string, status?: string) {
  if (!due_date || status === 'done') return false;
  return new Date(due_date) < new Date(new Date().toDateString());
}

function fmtDate(d?: string) {
  if (!d) return '';
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ClientWorkspace() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t } = useLang();
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  // Global upload context — uploads run in background via GlobalUploadQueue
  const { startBatch, latestAsset } = useUpload();

  const [client, setClient] = useState<Client | null>(null);
  const [activeTab, setActiveTab] = useState<typeof tabs[number]>('overview');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [content, setContent] = useState<ContentItem[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [approvals, setApprovals] = useState<{ id: string; title: string; status: string; created_at: string }[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const toastIdRef = useRef(0);

  // Pending upload batch — shown in UploadModal before handing off to UploadContext
  const [pendingItems, setPendingItems] = useState<UploadFileItem[]>([]);
  const [uploadMainCategory, setUploadMainCategory] = useState<string>('social-media');
  const [uploadSubCategory, setUploadSubCategory]   = useState<string>('');
  const [uploadMonthKey, setUploadMonthKey] = useState<string>(() => new Date().toISOString().slice(0, 7));

  // Task quick-create
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: '', priority: 'medium', due_date: '', assigned_to: '', status: 'todo' });
  const [taskSaving, setTaskSaving] = useState(false);

  // Edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '', website: '', industry: '', status: 'active', notes: '' });
  const [saving, setSaving] = useState(false);

  const logActivity = async (description: string) => {
    await supabase.from('activities').insert({ type: 'client', description, client_id: id });
  };

  const toastTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const addToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const tid = ++toastIdRef.current;
    setToasts(prev => [...prev, { id: tid, message, type }]);
    const timer = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== tid));
      toastTimersRef.current = toastTimersRef.current.filter(t => t !== timer);
    }, 4500);
    toastTimersRef.current.push(timer);
  }, []);

  // Clean up any pending toast timers when the component unmounts
  useEffect(() => () => { toastTimersRef.current.forEach(clearTimeout); }, []);

  const removeToast = useCallback((tid: number) => {
    setToasts(prev => prev.filter(t => t.id !== tid));
  }, []);

  const loadAll = useCallback(async () => {
    const FETCH_TIMEOUT_MS = 15_000;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('TIMEOUT')), FETCH_TIMEOUT_MS);
      });
      const [c, tk, ct, a, act, appr, tm] = await Promise.race([
        Promise.allSettled([
          supabase.from('clients').select('*').eq('id', id).single(),
          supabase.from('tasks').select('*').eq('client_id', id).order('created_at', { ascending: false }).limit(50),
          supabase.from('content_items').select('*').eq('client_id', id).order('created_at', { ascending: false }).limit(50),
          supabase.from('assets').select('*').eq('client_id', id).order('created_at', { ascending: false }).limit(50),
          supabase.from('activities').select('*').eq('client_id', id).order('created_at', { ascending: false }).limit(50),
          supabase.from('approvals').select('*').eq('client_id', id).order('created_at', { ascending: false }).limit(50),
          supabase.from('team_members').select('*').order('full_name'),
        ]),
        timeoutPromise,
      ]);

      if (c.status === 'fulfilled' && !c.value.error) setClient(c.value.data as Client);
      if (tk.status === 'fulfilled' && !tk.value.error) setTasks((tk.value.data ?? []) as Task[]);
      if (ct.status === 'fulfilled' && !ct.value.error) setContent((ct.value.data ?? []) as ContentItem[]);
      if (a.status === 'fulfilled' && !a.value.error) setAssets((a.value.data ?? []) as Asset[]);
      if (act.status === 'fulfilled' && !act.value.error) setActivities((act.value.data ?? []) as Activity[]);
      if (appr.status === 'fulfilled' && !appr.value.error) setApprovals((appr.value.data ?? []) as typeof approvals);
      if (tm.status === 'fulfilled' && !tm.value.error) setTeam((tm.value.data ?? []) as TeamMember[]);
    } catch (err) {
      const isTimeout = err instanceof Error && err.message === 'TIMEOUT';
      console.error('[client workspace] load error:', isTimeout ? 'timeout' : err);
    } finally {
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Prepend newly uploaded assets belonging to this client without page refresh.
  useEffect(() => {
    if (!latestAsset) return;
    if (latestAsset.client_id !== id) return;
    setAssets(prev => {
      if (prev.some(a => a.id === latestAsset.id)) return prev;
      return [latestAsset, ...prev];
    });
  }, [latestAsset, id]);

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

  // ── File upload using global UploadContext ────────────────────────────────

  const handleFileChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (fileRef.current) fileRef.current.value = '';
    if (!files.length) return;
    const items: UploadFileItem[] = files.map(file => ({
      id:              crypto.randomUUID(),
      file,
      previewUrl:      /^image\//.test(file.type) ? URL.createObjectURL(file) : null,
      uploadName:      file.name.replace(/\.[^.]+$/, ''), // base name without extension
      thumbnailBlob:   null,
      durationSeconds: null,
      previewBlob:     null,
    }));
    setPendingItems(items);
    setUploadMainCategory('social-media');
    setUploadSubCategory('');
    setUploadMonthKey(new Date().toISOString().slice(0, 7));

    // Asynchronously generate thumbnails for video files.
    items.forEach(item => {
      if (!isVideoFile(item.file.name, item.file.type)) return;
      void generateVideoThumbnail(item.file).then(result => {
        if (!result) return;
        setPendingItems(prev =>
          prev.map(i =>
            i.id === item.id
              ? { ...i, previewUrl: result.blobUrl, thumbnailBlob: result.blob, durationSeconds: result.durationSeconds }
              : i,
          ),
        );
      });
    });

    // Asynchronously generate first-page previews for PDF files.
    items.forEach(item => {
      if (!isPdfFile(item.file.name, item.file.type)) return;
      void generatePdfPreview(item.file).then(result => {
        if (!result) return;
        setPendingItems(prev =>
          prev.map(i =>
            i.id === item.id
              ? { ...i, previewUrl: result.blobUrl, previewBlob: result.blob }
              : i,
          ),
        );
      });
    });
  };

  const handleUploadConfirm = () => {
    if (!pendingItems.length || !client) return;
    const initialItems: InitialUploadItem[] = pendingItems.map(i => ({
      id:              i.id,
      file:            i.file,
      previewUrl:      i.previewUrl,
      uploadName:      i.uploadName,
      thumbnailBlob:   i.thumbnailBlob,
      durationSeconds: i.durationSeconds,
      previewBlob:     i.previewBlob,
    }));
    startBatch(initialItems, {
      clientName:   client.name,
      clientId:     id,
      contentType:  '',
      mainCategory: uploadMainCategory,
      subCategory:  uploadSubCategory,
      monthKey:     uploadMonthKey,
      uploadedBy:   user?.name ?? user?.email ?? null,
    });
    // Clear pending items without revoking — UploadContext owns the lifecycle
    setPendingItems([]);
    addToast(`${initialItems.length} file${initialItems.length !== 1 ? 's' : ''} queued for upload`, 'success');
  };

  const handleDownloadZip = async () => {
    if (!client) return;
    setDownloadingZip(true);
    try {
      const res = await fetch(`/api/clients/${id}/download-zip`);
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        const msg: string = json.error ?? `Download failed (HTTP ${res.status})`;
        // Provide a friendlier message when there are simply no R2 assets.
        if (res.status === 404 && msg.includes('No R2-hosted assets')) {
          addToast('No downloadable files found for this client', 'error');
        } else {
          addToast(msg, 'error');
        }
        return;
      }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `${client.name.replace(/[^a-z0-9_\- ]/gi, '_')}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      addToast('Download ready', 'success');
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Download failed', 'error');
    } finally {
      setDownloadingZip(false);
    }
  };

  const handleDeleteAsset = async (asset: Asset) => {
    if (!confirm(`Delete "${asset.name}"?`)) return;
    const res = await fetch(`/api/assets/${asset.id}`, { method: 'DELETE' });
    const json = await res.json();
    if (!res.ok) {
      addToast(`Delete failed: ${json.error ?? `HTTP ${res.status}`}`, 'error');
      return;
    }
    setAssets(prev => prev.filter(a => a.id !== asset.id));
    addToast('File deleted', 'success');
    await logActivity(`Asset "${asset.name}" deleted`);
  };

  const handleCopyAssetLink = async (asset: Asset) => {
    try {
      await navigator.clipboard.writeText(asset.view_url ?? asset.file_url);
      addToast('Link copied', 'success');
    } catch {
      addToast('Failed to copy link', 'error');
    }
  };

  const handleDeleteTask = async (taskId: string, taskTitle: string) => {
    if (!confirm(`Delete task "${taskTitle}"? This cannot be undone.`)) return;
    const { error } = await supabase.from('tasks').delete().eq('id', taskId);
    if (error) { alert(error.message); return; }
    setTasks(prev => prev.filter(t => t.id !== taskId));
    await logActivity(`Task "${taskTitle}" deleted`);
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskForm.title.trim()) return;
    setTaskSaving(true);
    try {
      const { error } = await supabase.from('tasks').insert({
        title: taskForm.title.trim(),
        priority: taskForm.priority,
        due_date: taskForm.due_date || null,
        assigned_to: taskForm.assigned_to || null,
        status: taskForm.status,
        client_id: id,
      });
      if (error) throw error;
      await logActivity(`Task "${taskForm.title}" created`);
      setTaskModalOpen(false);
      setTaskForm({ title: '', priority: 'medium', due_date: '', assigned_to: '', status: 'todo' });
      loadAll();
    } catch (err: unknown) {
      if (process.env.NODE_ENV === 'development') console.error('[task create]', err);
      alert(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setTaskSaving(false);
    }
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
    <>
      <style>{`@keyframes fadeSlideUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: t('tasks'),   value: tasks.length },
                { label: t('assets'),  value: assets.length },
                { label: t('content'), value: content.length },
                { label: t('pendingApprovals'), value: assets.filter(a => (a.approval_status ?? 'pending') === 'pending').length },
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
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                onClick={() => setTaskModalOpen(true)}
                className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium text-white"
                style={{ background: 'var(--accent)' }}
              >
                <Plus size={14} />{t('newTask')}
              </button>
            </div>
            {tasks.length === 0 ? (
              <div className="py-16 text-center" style={{ color: 'var(--text-secondary)' }}>{t('noTasksYet')}</div>
            ) : (
              <div className="space-y-3">
                {tasks.map(task => {
                  const overdue = isOverdue(task.due_date, task.status);
                  const assignee = team.find(m => m.id === task.assigned_to);
                  const creator = team.find(m => m.id === task.created_by);
                  const mentionedMembers = (task.mentions ?? []).map(mid => team.find(m => m.id === mid)).filter(Boolean) as TeamMember[];
                  return (
                    <div
                      key={task.id}
                      className="rounded-xl border p-4 space-y-2"
                      style={{ background: 'var(--surface)', borderColor: 'var(--border)', borderLeft: `3px solid ${overdue ? '#ef4444' : task.status === 'done' ? '#22c55e' : 'var(--border)'}` }}
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{task.title}</p>
                          {task.description && (
                            <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{task.description}</p>
                          )}
                        </div>
                        <button
                          onClick={() => handleDeleteTask(task.id, task.title)}
                          className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2 items-center text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {task.due_date && (
                          <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${overdue ? 'text-red-500' : ''}`}
                            style={{ background: overdue ? '#fef2f2' : 'var(--surface-2)' }}>
                            {overdue ? <AlertCircle size={10} /> : <Calendar size={10} />}
                            {fmtDate(task.due_date)}
                          </span>
                        )}
                        {assignee && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: 'var(--surface-2)' }}>
                            <User size={10} />{assignee.full_name}
                          </span>
                        )}
                        {creator && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: 'var(--surface-2)' }}>
                            by {creator.full_name}
                          </span>
                        )}
                        {mentionedMembers.length > 0 && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: 'var(--surface-2)' }}>
                            <Users size={10} />{mentionedMembers.map(m => `@${m.full_name}`).join(', ')}
                          </span>
                        )}
                        {task.tags && task.tags.length > 0 && task.tags.map(tag => (
                          <span key={tag} className="flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: 'var(--surface-2)' }}>
                            <Tag size={10} />{tag}
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Badge variant={taskStatusVariant(task.status)}>{t(task.status === 'in_progress' ? 'inProgress' : task.status)}</Badge>
                        <Badge variant={taskPriorityVariant(task.priority)}>{t(task.priority)}</Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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
            <div className="flex justify-end gap-2">
              <button
                onClick={handleDownloadZip}
                disabled={downloadingZip || assets.length === 0}
                className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
              >
                <Download size={14} />
                {downloadingZip ? 'Preparing download…' : 'Download Client Folder'}
              </button>
              <button
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
                style={{ background: 'var(--accent)' }}
              >
                <Upload size={14} />{t('uploadFile')}
              </button>
              <input
                ref={fileRef}
                type="file"
                multiple
                aria-label="Upload files"
                className="hidden"
                onChange={handleFileChosen}
              />
            </div>


            {assets.length === 0 ? (
              <div className="py-16 text-center" style={{ color: 'var(--text-secondary)' }}>{t('noAssetsYet')}</div>
            ) : (
              <AssetsGrid
                assets={assets}
                canDelete={user?.role === 'admin' || user?.role === 'owner'}
                onView={asset => setPreviewAsset(asset)}
                onDelete={asset => void handleDeleteAsset(asset)}
                onCopyLink={asset => void handleCopyAssetLink(asset)}
              />
            )}
          </div>
        )}

        {activeTab === 'approvals' && (
          <div className="space-y-3">
            {/* Pending assets first */}
            {assets.filter(a => (a.approval_status ?? 'pending') === 'pending').length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                  Assets Awaiting Approval
                </p>
                {assets
                  .filter(a => (a.approval_status ?? 'pending') === 'pending')
                  .map(a => (
                    <div
                      key={a.id}
                      className="flex items-center gap-4 rounded-xl border px-4 py-3"
                      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{a.name}</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                          {a.content_type ? contentTypeLabel(a.content_type) : 'Asset'} · {new Date(a.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={async () => {
                            await supabase.from('assets').update({ approval_status: 'approved' }).eq('id', a.id);
                            await supabase.from('activities').insert({ type: 'approve', description: `Asset "${a.name}" approved`, client_id: id });
                            void loadAll();
                          }}
                          className="flex items-center gap-1 h-8 px-3 rounded-lg text-xs font-medium transition-opacity hover:opacity-70"
                          style={{ background: 'rgba(22,163,74,0.12)', color: '#16a34a' }}
                        >
                          <ThumbsUp size={13} /> Approve
                        </button>
                        <button
                          onClick={async () => {
                            await supabase.from('assets').update({ approval_status: 'rejected' }).eq('id', a.id);
                            await supabase.from('activities').insert({ type: 'reject', description: `Asset "${a.name}" rejected`, client_id: id });
                            void loadAll();
                          }}
                          className="flex items-center gap-1 h-8 px-3 rounded-lg text-xs font-medium transition-opacity hover:opacity-70"
                          style={{ background: 'rgba(220,38,38,0.12)', color: '#dc2626' }}
                        >
                          <ThumbsDown size={13} /> Reject
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {/* Legacy approvals table */}
            {approvals.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                  Approval Records
                </p>
                {approvals.map(a => (
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

            {assets.filter(a => (a.approval_status ?? 'pending') === 'pending').length === 0 && approvals.length === 0 && (
              <div className="py-16 text-center" style={{ color: 'var(--text-secondary)' }}>No approvals yet</div>
            )}
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="rounded-2xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <ActivityLog clientId={id} limit={30} />
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
              <SelectDropdown
                fullWidth
                value={editForm.status}
                onChange={v => setEditForm(f => ({ ...f, status: v }))}
                options={[
                  { value: 'active',   label: t('active') },
                  { value: 'inactive', label: t('inactive') },
                  { value: 'prospect', label: t('prospect') },
                ]}
              />
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>{t('notes')}</label>
              <AiImproveButton
                value={editForm.notes}
                onImproved={v => setEditForm(f => ({ ...f, notes: v }))}
                showMenu
              />
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

      {/* Quick create task modal */}
      <Modal open={taskModalOpen} onClose={() => setTaskModalOpen(false)} title={t('newTask')} size="sm">
        <form onSubmit={handleCreateTask} className="space-y-4">
          <div className="space-y-1">
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>{t('title')} *</label>
              <AiImproveButton
                value={taskForm.title}
                onImproved={v => setTaskForm(f => ({ ...f, title: v }))}
              />
            </div>
            <input
              required
              value={taskForm.title}
              onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))}
              className="w-full h-9 px-3 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]"
              style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
              placeholder="Task title"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>{t('priority')}</label>
              <SelectDropdown
                fullWidth
                value={taskForm.priority}
                onChange={v => setTaskForm(f => ({ ...f, priority: v }))}
                options={[
                  { value: 'low',    label: t('low') },
                  { value: 'medium', label: t('medium') },
                  { value: 'high',   label: t('high') },
                ]}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>{t('deadline')}</label>
              <input type="date" value={taskForm.due_date} onChange={e => setTaskForm(f => ({ ...f, due_date: e.target.value }))}
                className="w-full h-9 px-3 rounded-lg text-sm outline-none"
                style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }} />
            </div>
          </div>
          {team.length > 0 && (
            <div className="space-y-1">
              <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>{t('assignedTo')}</label>
              <SelectDropdown
                fullWidth
                value={taskForm.assigned_to}
                onChange={v => setTaskForm(f => ({ ...f, assigned_to: v }))}
                placeholder={t('unassigned')}
                options={[
                  { value: '', label: t('unassigned') },
                  ...team.map(m => ({ value: m.id, label: m.full_name })),
                ]}
              />
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setTaskModalOpen(false)} className="h-9 px-4 rounded-lg text-sm font-medium"
              style={{ background: 'var(--surface-2)', color: 'var(--text)' }}>{t('cancel')}</button>
            <button type="submit" disabled={taskSaving} className="h-9 px-4 rounded-lg text-sm font-medium text-white disabled:opacity-60"
              style={{ background: 'var(--accent)' }}>{taskSaving ? t('loading') : t('save')}</button>
          </div>
        </form>
      </Modal>
    </div>

    {/* Asset preview modal */}
    {previewAsset && (
      <FilePreviewModal
        file={{
          name: previewAsset.name,
          url: previewAsset.preview_url || previewAsset.file_url,
          downloadUrl: previewAsset.download_url ?? previewAsset.file_url,
          openUrl: previewAsset.web_view_link || previewAsset.view_url || null,
          mimeType: previewAsset.file_type ?? previewAsset.mime_type ?? null,
          size: previewAsset.file_size ?? null,
        }}
        onClose={() => setPreviewAsset(null)}
      />
    )}

    {/* Upload modal — shared component, client locked */}
    {pendingItems.length > 0 && client && (
      <UploadModal
        files={pendingItems}
        mainCategory={uploadMainCategory}
        subCategory={uploadSubCategory}
        monthKey={uploadMonthKey}
        clientName={client.name}
        clientId={id}
        clients={[]}
        lockClient
        onMainCategoryChange={setUploadMainCategory}
        onSubCategoryChange={setUploadSubCategory}
        onMonthChange={setUploadMonthKey}
        onUploadNameChange={(itemId, name) =>
          setPendingItems(prev => prev.map(i => i.id === itemId ? { ...i, uploadName: name } : i))
        }
        onRemoveFile={itemId => {
          const removed = pendingItems.find(i => i.id === itemId);
          if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
          setPendingItems(prev => prev.filter(i => i.id !== itemId));
        }}
        onConfirm={handleUploadConfirm}
        onCancel={() => {
          pendingItems.forEach(i => { if (i.previewUrl) URL.revokeObjectURL(i.previewUrl); });
          setPendingItems([]);
        }}
      />
    )}

    {/* Toast notifications */}
    <ClientToast toasts={toasts} remove={removeToast} />
    </>
  );
}
