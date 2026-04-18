'use client';

import { useMemo, useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FileText, Plus, Search, Trash2, ChevronRight, LayoutGrid, List, Eye, ExternalLink,
  Instagram, Linkedin, Youtube, Globe, XCircle, Pencil, Link2, Calendar,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import type { ContentItem, ContentItemStatus, Client } from '@/lib/types';
import { createClient as createSupabase } from '@/lib/supabase/client';

const STATUS_PIPELINE: { status: ContentItemStatus; label: string; color: string; bg: string }[] = [
  { status: 'draft', label: 'Draft', color: '#9ca3af', bg: 'rgba(156,163,175,0.1)' },
  { status: 'pending_review', label: 'In Review', color: '#d97706', bg: 'rgba(217,119,6,0.1)' },
  { status: 'approved', label: 'Approved', color: '#16a34a', bg: 'rgba(22,163,74,0.1)' },
  { status: 'scheduled', label: 'Scheduled', color: '#7c3aed', bg: 'rgba(124,58,237,0.1)' },
  { status: 'published', label: 'Published', color: 'var(--accent)', bg: 'var(--accent-soft)' },
  { status: 'rejected', label: 'Rejected', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
];

const PLATFORMS = ['instagram', 'facebook', 'tiktok', 'linkedin', 'twitter', 'snapchat', 'youtube_shorts'];
const POST_TYPES = ['post', 'reel', 'carousel', 'story'];
const PURPOSES = ['awareness', 'engagement', 'promotion', 'branding', 'lead_generation', 'announcement', 'offer_campaign'];
const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  instagram: <Instagram size={12} />,
  linkedin: <Linkedin size={12} />,
  youtube_shorts: <Youtube size={12} />,
};

function getStatusCfg(status: ContentItemStatus) {
  return STATUS_PIPELINE.find(s => s.status === status) ?? STATUS_PIPELINE[0];
}

function StatusBadge({ status }: { status: ContentItemStatus }) {
  const cfg = getStatusCfg(status);
  return (
    <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  );
}

function fmtDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString();
}

interface NewContentModalProps {
  open: boolean;
  onClose: () => void;
  clients: Client[];
  team: { id: string; full_name: string }[];
  onCreated: (item: ContentItem) => void;
}

function NewContentModal({ open, onClose, clients, team, onCreated }: NewContentModalProps) {
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [clientId, setClientId] = useState('');
  const [caption, setCaption] = useState('');
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [postTypes, setPostTypes] = useState<string[]>([]);
  const [scheduleDate, setScheduleDate] = useState('');
  const [purpose, setPurpose] = useState('');
  const [createTask, setCreateTask] = useState(false);
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskAssigneeId, setTaskAssigneeId] = useState('');
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  function toggleSelection(setter: React.Dispatch<React.SetStateAction<string[]>>, value: string) {
    setter(prev => prev.includes(value) ? prev.filter(x => x !== value) : [...prev, value]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { toast('Title is required', 'error'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/content-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          client_id: clientId || null,
          caption,
          platform_targets: platforms,
          post_types: postTypes,
          purpose: purpose || null,
          status: scheduleDate ? 'scheduled' : 'draft',
          schedule_date: scheduleDate || null,
          create_task: createTask,
          task_due_date: taskDueDate || scheduleDate || null,
          task_assignee_id: taskAssigneeId || null,
        }),
      });
      const json = await res.json() as { success: boolean; item?: ContentItem; error?: string };
      if (!json.success) throw new Error(json.error ?? 'Failed to create');
      toast('Content item created', 'success');
      onCreated(json.item!);
      onClose();
      setTitle(''); setClientId(''); setCaption(''); setPlatforms([]); setPostTypes([]); setPurpose('');
      setScheduleDate(''); setCreateTask(false); setTaskDueDate(''); setTaskAssigneeId('');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to create', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="openy-modal-overlay fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="openy-modal-panel w-full max-w-2xl rounded-2xl overflow-hidden my-auto max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)]">
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>New Content Item</h2>
          <button onClick={onClose} className="p-1 rounded hover:opacity-70"><XCircle size={18} style={{ color: 'var(--text-secondary)' }} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>Title *</label>
              <input value={title} onChange={e => setTitle(e.target.value)} required
                className="w-full h-9 rounded-lg px-3 text-sm border" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }} />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>Client</label>
              <select value={clientId} onChange={e => setClientId(e.target.value)}
                className="w-full h-9 rounded-lg px-3 text-sm border" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }}>
                <option value="">— No client —</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>Caption / Copy</label>
            <textarea value={caption} onChange={e => setCaption(e.target.value)} rows={3}
              className="w-full rounded-lg px-3 py-2 text-sm border resize-none" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>Scheduled Date</label>
              <input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)}
                className="w-full h-9 rounded-lg px-3 text-sm border" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }} />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>Purpose</label>
              <select value={purpose} onChange={e => setPurpose(e.target.value)}
                className="w-full h-9 rounded-lg px-3 text-sm border" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }}>
                <option value="">— Select purpose —</option>
                {PURPOSES.map(p => <option key={p} value={p}>{p.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium mb-2 block" style={{ color: 'var(--text-secondary)' }}>Target Platforms</label>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map(p => (
                <button key={p} type="button" onClick={() => toggleSelection(setPlatforms, p)}
                  className="px-3 py-1 rounded-full text-xs font-medium border transition-colors"
                  style={platforms.includes(p)
                    ? { background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' }
                    : { background: 'var(--surface-2)', color: 'var(--text-secondary)', borderColor: 'var(--border)' }}>
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium mb-2 block" style={{ color: 'var(--text-secondary)' }}>Post Type</label>
            <div className="flex flex-wrap gap-2">
              {POST_TYPES.map(type => (
                <button key={type} type="button" onClick={() => toggleSelection(setPostTypes, type)}
                  className="px-3 py-1 rounded-full text-xs font-medium border transition-colors"
                  style={postTypes.includes(type)
                    ? { background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' }
                    : { background: 'var(--surface-2)', color: 'var(--text-secondary)', borderColor: 'var(--border)' }}>
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl p-3 border" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
            <label className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--text)' }}>
              <input type="checkbox" checked={createTask} onChange={e => setCreateTask(e.target.checked)} />
              Create linked task for this content
            </label>
            {createTask && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>Task due date</label>
                  <input type="date" value={taskDueDate} onChange={e => setTaskDueDate(e.target.value)}
                    className="w-full h-9 rounded-lg px-3 text-sm border" style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }} />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>Task assignee (optional)</label>
                  <select value={taskAssigneeId} onChange={e => setTaskAssigneeId(e.target.value)}
                    className="w-full h-9 rounded-lg px-3 text-sm border" style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}>
                    <option value="">— Unassigned —</option>
                    {team.map(member => <option key={member.id} value={member.id}>{member.full_name}</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50" style={{ background: 'var(--accent)' }}>
              {saving ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface ContentCardProps {
  item: ContentItem;
  compact?: boolean;
  onStatusChange: (id: string, status: ContentItemStatus) => void;
  onDelete?: (id: string) => void;
  onPreview: (item: ContentItem) => void;
  onEdit: (item: ContentItem) => void;
}

function ContentCard({ item, compact, onStatusChange, onDelete, onPreview, onEdit }: ContentCardProps) {
  const nextStatuses: Partial<Record<ContentItemStatus, ContentItemStatus>> = {
    draft: 'pending_review',
    pending_review: 'approved',
    approved: 'scheduled',
    scheduled: 'published',
  };

  const nextStatus = nextStatuses[item.status];

  return (
    <div className={`relative group rounded-2xl border p-4 flex ${compact ? 'items-center gap-4' : 'flex-col gap-3'} transition-all hover:shadow-xl`} style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity right-3 top-3 z-10 flex items-center gap-1">
        <button onClick={() => onPreview(item)} className="p-1.5 rounded-lg" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }} title="Quick preview"><Eye size={13} /></button>
        <button onClick={() => onEdit(item)} className="p-1.5 rounded-lg" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }} title="Edit"><Pencil size={13} /></button>
        <button onClick={() => onPreview(item)} className="p-1.5 rounded-lg" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }} title="Open"><ExternalLink size={13} /></button>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>{item.title}</p>
            {item.client && <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{item.client.name}</p>}
          </div>
          <StatusBadge status={item.status} />
        </div>

        {item.caption && <p className="text-xs line-clamp-2 mt-2" style={{ color: 'var(--text-secondary)' }}>{item.caption}</p>}

        <div className="flex flex-wrap gap-1 mt-2">
          {(item.platform_targets ?? []).slice(0, 3).map(p => (
            <span key={p} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
              {PLATFORM_ICONS[p] ?? <Globe size={10} />} {p}
            </span>
          ))}
          {(item.post_types ?? []).slice(0, 2).map(type => (
            <span key={type} className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(99,102,241,0.12)', color: 'var(--accent)' }}>
              {type}
            </span>
          ))}
          {item.task_id && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(34,197,94,0.12)', color: '#16a34a' }}>
              <Link2 size={10} /> Linked Task
            </span>
          )}
        </div>

        <div className="text-xs mt-2 flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
          <Calendar size={12} />
          <span>{item.schedule_date ? `Scheduled ${fmtDate(item.schedule_date)}` : `Created ${fmtDate(item.created_at)}`}</span>
        </div>
      </div>

      <div className={`flex items-center ${compact ? 'ml-auto' : 'justify-between'} gap-2 pt-1`}>
        {nextStatus && (
          <button onClick={() => onStatusChange(item.id, nextStatus)} className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg font-medium" style={{ background: 'var(--accent)', color: '#fff' }}>
            <ChevronRight size={12} /> {getStatusCfg(nextStatus).label}
          </button>
        )}
        {item.status !== 'rejected' && (
          <button onClick={() => onStatusChange(item.id, 'rejected')} className="text-xs px-2 py-1 rounded-lg font-medium" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
            Reject
          </button>
        )}
        {onDelete && (
          <button onClick={() => onDelete(item.id)} className="p-1 rounded hover:opacity-70">
            <Trash2 size={13} style={{ color: 'var(--text-secondary)' }} />
          </button>
        )}
      </div>
    </div>
  );
}

function ContentDetailModal({ item, onClose }: { item: ContentItem | null; onClose: () => void }) {
  if (!item) return null;
  return (
    <div className="openy-modal-overlay fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-4 overflow-y-auto" onClick={onClose}>
      <div className="openy-modal-panel w-full max-w-xl rounded-2xl p-5 my-auto max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold truncate" style={{ color: 'var(--text)' }}>{item.title}</h3>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{item.client?.name ?? 'No client'}</p>
          </div>
          <button onClick={onClose}><XCircle size={18} style={{ color: 'var(--text-secondary)' }} /></button>
        </div>
        <div className="mt-4 space-y-3 text-sm">
          <StatusBadge status={item.status} />
          {item.caption && <p style={{ color: 'var(--text)' }}>{item.caption}</p>}
          <p style={{ color: 'var(--text-secondary)' }}>Platforms: {(item.platform_targets ?? []).join(', ') || '—'}</p>
          <p style={{ color: 'var(--text-secondary)' }}>Post types: {(item.post_types ?? []).join(', ') || '—'}</p>
          <p style={{ color: 'var(--text-secondary)' }}>Schedule: {fmtDate(item.schedule_date)}</p>
          <p style={{ color: 'var(--text-secondary)' }}>Created: {fmtDate(item.created_at)}</p>
        </div>
      </div>
    </div>
  );
}

function EditContentModal({ item, onClose, onSaved }: { item: ContentItem | null; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() => ({
    title: item?.title ?? '',
    caption: item?.caption ?? '',
    schedule_date: item?.schedule_date ?? '',
    status: item?.status ?? 'draft' as ContentItemStatus,
  }));

  if (!item) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!item) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/content-items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json() as { success: boolean; error?: string };
      if (!json.success) throw new Error(json.error ?? 'Failed to update');
      toast('Content updated', 'success');
      onSaved();
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to update', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="openy-modal-overlay fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-4 overflow-y-auto" onClick={onClose}>
      <div className="openy-modal-panel w-full max-w-lg rounded-2xl p-5 my-auto max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h3 className="text-base font-semibold mb-4" style={{ color: 'var(--text)' }}>Edit Content Item</h3>
        <form onSubmit={submit} className="space-y-3">
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full h-9 rounded-lg px-3 text-sm border" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          <textarea value={form.caption} onChange={e => setForm(f => ({ ...f, caption: e.target.value }))} rows={3} className="w-full rounded-lg px-3 py-2 text-sm border" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          <div className="grid grid-cols-2 gap-3">
            <input type="date" value={form.schedule_date || ''} onChange={e => setForm(f => ({ ...f, schedule_date: e.target.value }))} className="w-full h-9 rounded-lg px-3 text-sm border" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }} />
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as ContentItemStatus }))} className="w-full h-9 rounded-lg px-3 text-sm border" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }}>
              {STATUS_PIPELINE.map(s => <option key={s.status} value={s.status}>{s.label}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>Cancel</button>
            <button type="submit" disabled={saving} className="px-3 py-2 rounded-lg text-sm text-white disabled:opacity-60" style={{ background: 'var(--accent)' }}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ContentPage() {
  const { role } = useAuth();
  const canDeleteContent = role === 'admin' || role === 'owner';
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newOpen, setNewOpen] = useState(false);
  const [previewItem, setPreviewItem] = useState<ContentItem | null>(null);
  const [editItem, setEditItem] = useState<ContentItem | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [clientFilter, setClientFilter] = useState<string>('');
  const [platformFilter, setPlatformFilter] = useState<string>('');
  const [postTypeFilter, setPostTypeFilter] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const { data: itemsData, isLoading } = useQuery<{ success: boolean; items: ContentItem[] }>({
    queryKey: ['content-items', clientFilter, statusFilter, platformFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (clientFilter) params.set('client_id', clientFilter);
      if (statusFilter) params.set('status', statusFilter);
      if (platformFilter) params.set('platform', platformFilter);
      const res = await fetch(`/api/content-items?${params}`);
      return res.json() as Promise<{ success: boolean; items: ContentItem[] }>;
    },
    staleTime: 30_000,
  });

  const { data: clientsData } = useQuery<{ data: Client[] }>({
    queryKey: ['clients', 1, 100, ''],
    queryFn: async () => {
      const sb = createSupabase();
      const { data } = await sb.from('clients').select('id, name').order('name');
      return { data: (data ?? []) as Client[] };
    },
    staleTime: 60_000,
  });

  const { data: teamData } = useQuery<{ data: { id: string; full_name: string }[] }>({
    queryKey: ['team-lite'],
    queryFn: async () => {
      const sb = createSupabase();
      const { data } = await sb.from('team_members').select('id, full_name').order('full_name');
      return { data: (data ?? []) as { id: string; full_name: string }[] };
    },
    staleTime: 60_000,
  });

  const items = itemsData?.items ?? [];
  const clients = clientsData?.data ?? [];
  const team = teamData?.data ?? [];

  const filtered = useMemo(() => items.filter(item => {
    if (search.trim()) {
      const q = search.toLowerCase();
      const hit = item.title.toLowerCase().includes(q) || (item.caption?.toLowerCase().includes(q) ?? false);
      if (!hit) return false;
    }
    if (postTypeFilter && !(item.post_types ?? []).includes(postTypeFilter)) return false;
    return true;
  }), [items, search, postTypeFilter]);

  const prependContentItemToCache = useCallback((item: ContentItem) => {
    queryClient.setQueryData<{ success: boolean; items: ContentItem[] }>(
      ['content-items', clientFilter, statusFilter, platformFilter],
      old => {
        if (!old) return old;
        const existingIndex = old.items.findIndex(existing => existing.id === item.id);
        if (existingIndex === -1) return { ...old, items: [item, ...old.items] };
        const nextItems = [...old.items];
        nextItems.splice(existingIndex, 1);
        return { ...old, items: [item, ...nextItems] };
      },
    );
  }, [clientFilter, queryClient, statusFilter, platformFilter]);

  async function handleStatusChange(id: string, status: ContentItemStatus) {
    try {
      const res = await fetch(`/api/content-items/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const json = await res.json() as { success: boolean };
      if (!json.success) throw new Error('Update failed');
      void queryClient.invalidateQueries({ queryKey: ['content-items'] });
      toast(`Status updated to ${status}`, 'success');
    } catch {
      toast('Failed to update status', 'error');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this content item?')) return;
    try {
      const res = await fetch(`/api/content-items/${id}`, { method: 'DELETE' });
      const json = await res.json() as { success: boolean };
      if (!json.success) throw new Error('Delete failed');
      void queryClient.invalidateQueries({ queryKey: ['content-items'] });
      toast('Content item deleted', 'success');
    } catch {
      toast('Failed to delete', 'error');
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Content Workspace</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Unified social posts, campaigns, ideas, and scheduled content
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setViewMode('grid')} className="h-9 px-3 rounded-lg text-sm inline-flex items-center gap-1" style={{ background: viewMode === 'grid' ? 'var(--accent)' : 'var(--surface-2)', color: viewMode === 'grid' ? '#fff' : 'var(--text-secondary)' }}><LayoutGrid size={14} />Grid</button>
          <button onClick={() => setViewMode('list')} className="h-9 px-3 rounded-lg text-sm inline-flex items-center gap-1" style={{ background: viewMode === 'list' ? 'var(--accent)' : 'var(--surface-2)', color: viewMode === 'list' ? '#fff' : 'var(--text-secondary)' }}><List size={14} />List</button>
          {(role === 'admin' || role === 'manager' || role === 'team_member') && (
            <button onClick={() => setNewOpen(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: 'var(--accent)' }}>
              <Plus size={16} /> New Content
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-secondary)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search content…" className="h-9 pl-8 pr-3 rounded-lg border text-sm" style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)', minWidth: 220 }} />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="h-9 px-3 rounded-lg border text-sm" style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}>
          <option value="">All Statuses</option>
          {STATUS_PIPELINE.map(s => <option key={s.status} value={s.status}>{s.label}</option>)}
        </select>
        <select value={clientFilter} onChange={e => setClientFilter(e.target.value)} className="h-9 px-3 rounded-lg border text-sm" style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}>
          <option value="">All Clients</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={platformFilter} onChange={e => setPlatformFilter(e.target.value)} className="h-9 px-3 rounded-lg border text-sm" style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}>
          <option value="">All Platforms</option>
          {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={postTypeFilter} onChange={e => setPostTypeFilter(e.target.value)} className="h-9 px-3 rounded-lg border text-sm" style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}>
          <option value="">All Post Types</option>
          {POST_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="rounded-2xl h-48 animate-pulse" style={{ background: 'var(--surface)' }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border p-16 text-center" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <FileText size={36} className="mx-auto mb-3 opacity-30" style={{ color: 'var(--text-secondary)' }} />
          <p className="text-base font-medium" style={{ color: 'var(--text)' }}>No content items yet</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Create a new item to start the pipeline.</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
          {filtered.map(item => (
            <ContentCard
              key={item.id}
              item={item}
              onStatusChange={handleStatusChange}
              onDelete={canDeleteContent ? handleDelete : undefined}
              onPreview={setPreviewItem}
              onEdit={setEditItem}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(item => (
            <ContentCard
              key={item.id}
              item={item}
              compact
              onStatusChange={handleStatusChange}
              onDelete={canDeleteContent ? handleDelete : undefined}
              onPreview={setPreviewItem}
              onEdit={setEditItem}
            />
          ))}
        </div>
      )}

      <NewContentModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        clients={clients}
        team={team}
        onCreated={(item) => {
          prependContentItemToCache(item);
          void queryClient.invalidateQueries({ queryKey: ['content-items'] });
        }}
      />

      <ContentDetailModal item={previewItem} onClose={() => setPreviewItem(null)} />
      <EditContentModal item={editItem} onClose={() => setEditItem(null)} onSaved={() => { void queryClient.invalidateQueries({ queryKey: ['content-items'] }); }} />
    </div>
  );
}
