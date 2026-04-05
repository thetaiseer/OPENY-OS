'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Building2, Mail, Phone, Globe, Upload, Pencil, Trash2, File,
  Calendar, User, Users, Tag, AlertCircle, Plus,
  FileText, FileImage, FileVideo, FileAudio, Eye, Download, Link, ExternalLink,
  CheckCircle, X, ThumbsUp, ThumbsDown,
} from 'lucide-react';
import supabase from '@/lib/supabase';
import { useLang } from '@/lib/lang-context';
import { useAuth } from '@/lib/auth-context';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import ActivityLog from '@/components/ui/ActivityLog';
import AiImproveButton from '@/components/ui/AiImproveButton';
import UploadModal, { type UploadFileItem } from '@/components/upload/UploadModal';
import { useUpload, type InitialUploadItem } from '@/lib/upload-context';
import { contentTypeLabel } from '@/lib/asset-utils';
import type { Client, Task, ContentItem, Asset, Activity, TeamMember } from '@/lib/types';


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

function formatAssetSize(bytes?: number): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatAssetDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function isImageFile(name: string, type?: string): boolean {
  return /\.(jpg|jpeg|png|gif|webp|svg|bmp|avif)$/i.test(name) || (type?.startsWith('image/') ?? false);
}

function getFileTypeLabel(name: string, type?: string): string {
  if (type) {
    const sub = type.split('/')[1]?.toUpperCase();
    if (sub) return sub;
  }
  return name.split('.').pop()?.toUpperCase() ?? 'FILE';
}

function AssetFileIcon({ name, type, size = 36 }: { name: string; type?: string; size?: number }) {
  if (isImageFile(name, type)) return <FileImage size={size} style={{ color: '#3b82f6' }} />;
  if (/\.pdf$/i.test(name) || type === 'application/pdf') return <FileText size={size} style={{ color: '#ef4444' }} />;
  if (type?.startsWith('video/')) return <FileVideo size={size} style={{ color: '#8b5cf6' }} />;
  if (type?.startsWith('audio/')) return <FileAudio size={size} style={{ color: '#06b6d4' }} />;
  return <File size={size} style={{ color: 'var(--text-secondary)' }} />;
}

function ClientAssetCard({ asset, onView, onDelete, onCopyLink, onOpenInDrive }: {
  asset: Asset;
  onView: () => void;
  onDelete: () => void;
  onCopyLink: () => void;
  onOpenInDrive: () => void;
}) {
  const img = isImageFile(asset.name, asset.file_type);
  const hasDrive = asset.storage_provider === 'google_drive' && !!asset.view_url;
  const downloadUrl = asset.download_url ?? asset.file_url;
  return (
    <div
      className="group rounded-2xl border overflow-hidden flex flex-col"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <div
        className="relative overflow-hidden cursor-pointer"
        style={{ aspectRatio: '16/10', background: 'var(--surface-2)' }}
        onClick={onView}
      >
        {img
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={asset.file_url} alt={asset.name} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center"><AssetFileIcon name={asset.name} type={asset.file_type} size={32} /></div>}
        <div
          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: 'rgba(0,0,0,0.35)' }}
        >
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm">
            <Eye size={18} className="text-white" />
          </div>
        </div>
      </div>
      <div className="p-3 flex-1 flex flex-col gap-0.5 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }} title={asset.name}>{asset.name}</p>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <span className="text-xs font-medium px-1.5 py-0.5 rounded"
            style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
            {getFileTypeLabel(asset.name, asset.file_type)}
          </span>
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{formatAssetSize(asset.file_size)}</span>
        </div>
        <span className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{formatAssetDate(asset.created_at)}</span>
      </div>
      <div className="px-3 pb-3 flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
        <button onClick={onView} title="View"
          className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs font-medium transition-opacity hover:opacity-70"
          style={{ background: 'var(--surface-2)', color: 'var(--text)' }}>
          <Eye size={13} /><span>View</span>
        </button>
        <a href={downloadUrl} download={asset.name} title="Download"
          className="flex items-center justify-center h-8 w-8 rounded-lg transition-opacity hover:opacity-70"
          style={{ background: 'var(--surface-2)', color: 'var(--text)' }}>
          <Download size={14} />
        </a>
        <button onClick={onCopyLink} title="Copy link"
          className="flex items-center justify-center h-8 w-8 rounded-lg transition-opacity hover:opacity-70"
          style={{ background: 'var(--surface-2)', color: 'var(--text)' }}>
          <Link size={14} />
        </button>
        {hasDrive && (
          <button onClick={onOpenInDrive} title="Open in Drive"
            className="flex items-center justify-center h-8 w-8 rounded-lg transition-opacity hover:opacity-70"
            style={{ background: 'var(--surface-2)', color: 'var(--text)' }}>
            <ExternalLink size={14} />
          </button>
        )}
        <button onClick={onDelete} title="Delete"
          className="flex items-center justify-center h-8 w-8 rounded-lg transition-opacity hover:opacity-70"
          style={{ background: 'var(--surface-2)', color: '#ef4444' }}>
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

function ClientPreviewModal({ asset, onClose }: { asset: Asset; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);
  const downloadUrl = asset.download_url ?? asset.file_url;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)' }} onClick={onClose}>
      <div className="relative max-w-4xl max-h-[90vh] w-full flex flex-col items-center"
        onClick={e => e.stopPropagation()}>
        <button onClick={onClose}
          className="absolute -top-10 right-0 flex items-center justify-center w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors">
          <X size={18} />
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={asset.file_url} alt={asset.name}
          className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-2xl" />
        <p className="mt-3 text-white/70 text-sm truncate max-w-full px-4">{asset.name}</p>
        <div className="mt-3 flex gap-3">
          <a href={downloadUrl} download={asset.name}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors"
            onClick={e => e.stopPropagation()}>
            <Download size={14} /> Download
          </a>
          {asset.view_url && (
            <a href={asset.view_url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors"
              onClick={e => e.stopPropagation()}>
              <ExternalLink size={14} /> Open in Drive
            </a>
          )}
        </div>
      </div>
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
  const { startBatch } = useUpload();

  const [client, setClient] = useState<Client | null>(null);
  const [activeTab, setActiveTab] = useState<typeof tabs[number]>('overview');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [content, setContent] = useState<ContentItem[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [approvals, setApprovals] = useState<{ id: string; title: string; status: string; created_at: string }[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const toastIdRef = useRef(0);

  // Pending upload batch — shown in UploadModal before handing off to UploadContext
  const [pendingItems, setPendingItems] = useState<UploadFileItem[]>([]);
  const [uploadContentType, setUploadContentType] = useState<string>('SOCIAL_POSTS');
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

  const addToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const tid = ++toastIdRef.current;
    setToasts(prev => [...prev, { id: tid, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== tid)), 4500);
  }, []);

  const removeToast = useCallback((tid: number) => {
    setToasts(prev => prev.filter(t => t.id !== tid));
  }, []);

  const loadAll = useCallback(async () => {
    const [c, tk, ct, a, act, appr, tm] = await Promise.allSettled([
      supabase.from('clients').select('*').eq('id', id).single(),
      supabase.from('tasks').select('*').eq('client_id', id).order('created_at', { ascending: false }).limit(50),
      supabase.from('content_items').select('*').eq('client_id', id).order('created_at', { ascending: false }).limit(50),
      supabase.from('assets').select('*').eq('client_id', id).order('created_at', { ascending: false }).limit(50),
      supabase.from('activities').select('*').eq('client_id', id).order('created_at', { ascending: false }).limit(50),
      supabase.from('approvals').select('*').eq('client_id', id).order('created_at', { ascending: false }).limit(50),
      supabase.from('team_members').select('*').order('name'),
    ]);

    if (c.status === 'fulfilled' && !c.value.error) setClient(c.value.data as Client);
    if (tk.status === 'fulfilled' && !tk.value.error) setTasks((tk.value.data ?? []) as Task[]);
    if (ct.status === 'fulfilled' && !ct.value.error) setContent((ct.value.data ?? []) as ContentItem[]);
    if (a.status === 'fulfilled' && !a.value.error) setAssets((a.value.data ?? []) as Asset[]);
    if (act.status === 'fulfilled' && !act.value.error) setActivities((act.value.data ?? []) as Activity[]);
    if (appr.status === 'fulfilled' && !appr.value.error) setApprovals((appr.value.data ?? []) as typeof approvals);
    if (tm.status === 'fulfilled' && !tm.value.error) setTeam((tm.value.data ?? []) as TeamMember[]);
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

  // ── File upload using global UploadContext ────────────────────────────────

  const handleFileChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (fileRef.current) fileRef.current.value = '';
    if (!files.length) return;
    const items: UploadFileItem[] = files.map(file => ({
      id:         crypto.randomUUID(),
      file,
      previewUrl: /^image\//.test(file.type) ? URL.createObjectURL(file) : null,
      uploadName: file.name.replace(/\.[^.]+$/, ''), // base name without extension
    }));
    setPendingItems(items);
    setUploadContentType('SOCIAL_POSTS');
    setUploadMonthKey(new Date().toISOString().slice(0, 7));
  };

  const handleUploadConfirm = () => {
    if (!pendingItems.length || !client) return;
    const initialItems: InitialUploadItem[] = pendingItems.map(i => ({
      id:         i.id,
      file:       i.file,
      previewUrl: i.previewUrl,
      uploadName: i.uploadName,
    }));
    startBatch(initialItems, {
      clientName:  client.name,
      clientId:    id,
      contentType: uploadContentType,
      monthKey:    uploadMonthKey,
      uploadedBy:  user?.name ?? user?.email ?? null,
    });
    // Clear pending items without revoking — UploadContext owns the lifecycle
    setPendingItems([]);
    addToast(`${initialItems.length} file${initialItems.length !== 1 ? 's' : ''} queued for upload`, 'success');
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
                            <User size={10} />{assignee.name}
                          </span>
                        )}
                        {creator && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: 'var(--surface-2)' }}>
                            by {creator.name}
                          </span>
                        )}
                        {mentionedMembers.length > 0 && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: 'var(--surface-2)' }}>
                            <Users size={10} />{mentionedMembers.map(m => `@${m.name}`).join(', ')}
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
            <div className="flex justify-end">
              <button
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
                style={{ background: 'var(--accent)' }}
              >
                <Upload size={14} />{t('uploadFile')}
              </button>
              <input ref={fileRef} type="file" multiple className="hidden" onChange={handleFileChosen} />
            </div>


            {assets.length === 0 ? (
              <div className="py-16 text-center" style={{ color: 'var(--text-secondary)' }}>{t('noAssetsYet')}</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {assets.map(a => (
                  <ClientAssetCard
                    key={a.id}
                    asset={a}
                    onView={() => {
                      if (isImageFile(a.name, a.file_type)) {
                        setPreviewAsset(a);
                      } else {
                        window.open(a.view_url ?? a.file_url, '_blank', 'noopener,noreferrer');
                      }
                    }}
                    onDelete={() => handleDeleteAsset(a)}
                    onCopyLink={async () => {
                      try {
                        await navigator.clipboard.writeText(a.view_url ?? a.file_url);
                        addToast('Link copied', 'success');
                      } catch {
                        addToast('Failed to copy link', 'error');
                      }
                    }}
                    onOpenInDrive={() => {
                      if (a.view_url) window.open(a.view_url, '_blank', 'noopener,noreferrer');
                    }}
                  />
                ))}
              </div>
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
              <select value={taskForm.priority} onChange={e => setTaskForm(f => ({ ...f, priority: e.target.value }))}
                className="w-full h-9 px-3 rounded-lg text-sm outline-none"
                style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}>
                <option value="low">{t('low')}</option>
                <option value="medium">{t('medium')}</option>
                <option value="high">{t('high')}</option>
              </select>
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
              <select value={taskForm.assigned_to} onChange={e => setTaskForm(f => ({ ...f, assigned_to: e.target.value }))}
                className="w-full h-9 px-3 rounded-lg text-sm outline-none"
                style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}>
                <option value="">{t('unassigned')}</option>
                {team.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
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

    {/* Image preview lightbox */}
    {previewAsset && (
      <ClientPreviewModal asset={previewAsset} onClose={() => setPreviewAsset(null)} />
    )}

    {/* Upload modal — shared component, client locked */}
    {pendingItems.length > 0 && client && (
      <UploadModal
        files={pendingItems}
        contentType={uploadContentType}
        monthKey={uploadMonthKey}
        clientName={client.name}
        clientId={id}
        clients={[]}
        lockClient
        onContentTypeChange={setUploadContentType}
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
