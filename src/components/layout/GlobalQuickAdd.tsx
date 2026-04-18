'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  CheckSquare,
  FileText,
  ImagePlus,
  type LucideIcon,
  Plus,
  X,
} from 'lucide-react';
import { createClient as createSupabase } from '@/lib/supabase/client';
import { useToast } from '@/lib/toast-context';
import { useAuth } from '@/lib/auth-context';
import Modal from '@/components/ui/Modal';
import SelectDropdown from '@/components/ui/SelectDropdown';

type QuickAddKind = 'task' | 'client' | 'content' | 'asset';

interface QuickClient {
  id: string;
  name: string;
}

interface QuickTeamMember {
  id: string;
  full_name: string | null;
  email: string | null;
}

const MENU_ITEMS: { key: QuickAddKind; label: string; icon: LucideIcon }[] = [
  { key: 'task', label: 'Add Task', icon: CheckSquare },
  { key: 'client', label: 'Add Client', icon: Building2 },
  { key: 'content', label: 'Add Content', icon: FileText },
  { key: 'asset', label: 'Add Asset', icon: ImagePlus },
];

const baseFieldCls = 'openy-field w-full h-10 px-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]';
const QUICK_ADD_USAGE_KEY = 'openy_quick_add_usage_v1';
const QUICK_ADD_LAST_ACTION_KEY = 'openy_quick_add_last_action_v1';
const FALLBACK_CLIENT_INITIALS = 'CL';

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function generateInitialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (!parts.length) return FALLBACK_CLIENT_INITIALS;
  const initials = parts
    .map(p => p[0]?.toUpperCase() ?? '')
    .filter(Boolean)
    .join('');
  return initials || FALLBACK_CLIENT_INITIALS;
}

function generateClientNameSuggestion(base: string) {
  const clean = base.trim();
  if (!clean) return 'Acme Studio';
  return clean.toLowerCase().includes('client') ? clean : `${clean} Client`;
}

function detectAssetTypeFromUrl(url: string): string | null {
  const lower = url.toLowerCase();
  if (/\.(png|jpg|jpeg|webp|gif|svg)(\?|#|$)/.test(lower)) return 'image';
  if (/\.(mp4|mov|avi|mkv|webm)(\?|#|$)/.test(lower)) return 'video';
  if (/\.(mp3|wav|aac|ogg)(\?|#|$)/.test(lower)) return 'audio';
  if (/\.(pdf|doc|docx|ppt|pptx|xls|xlsx|txt)(\?|#|$)/.test(lower)) return 'document';
  return null;
}

export default function GlobalQuickAdd() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const supabase = useMemo(() => createSupabase(), []);

  const [menuOpen, setMenuOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<QuickAddKind | null>(null);
  const [actionUsage, setActionUsage] = useState<Record<QuickAddKind, number>>({
    task: 0,
    client: 0,
    content: 0,
    asset: 0,
  });
  const [lastAction, setLastAction] = useState<QuickAddKind | null>(null);

  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskClientId, setTaskClientId] = useState('');
  const [taskAssignee, setTaskAssignee] = useState('');
  const [taskPriority, setTaskPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [taskDueDate, setTaskDueDate] = useState(todayIsoDate());

  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');

  const [contentTitle, setContentTitle] = useState('');
  const [contentClientId, setContentClientId] = useState('');
  const [contentCaption, setContentCaption] = useState('');

  const [assetName, setAssetName] = useState('');
  const [assetUrl, setAssetUrl] = useState('');
  const [assetClientId, setAssetClientId] = useState('');
  const [assetType, setAssetType] = useState('document');

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    try {
      const usageRaw = window.localStorage.getItem(QUICK_ADD_USAGE_KEY);
      if (usageRaw) {
        const parsed = JSON.parse(usageRaw) as Partial<Record<QuickAddKind, number>>;
        setActionUsage({
          task: parsed.task ?? 0,
          client: parsed.client ?? 0,
          content: parsed.content ?? 0,
          asset: parsed.asset ?? 0,
        });
      }
      const last = window.localStorage.getItem(QUICK_ADD_LAST_ACTION_KEY);
      if (last === 'task' || last === 'client' || last === 'content' || last === 'asset') {
        setLastAction(last);
      }
    } catch {
      // ignore localStorage parse errors
    }
  }, []);

  const orderedMenuItems = useMemo(
    () => [...MENU_ITEMS].sort((a, b) => (actionUsage[b.key] ?? 0) - (actionUsage[a.key] ?? 0)),
    [actionUsage],
  );

  const topAction = orderedMenuItems[0]?.key ?? null;

  function registerAction(kind: QuickAddKind) {
    setActionUsage(prev => {
      const next = { ...prev, [kind]: (prev[kind] ?? 0) + 1 };
      window.localStorage.setItem(QUICK_ADD_USAGE_KEY, JSON.stringify(next));
      return next;
    });
    setLastAction(kind);
    window.localStorage.setItem(QUICK_ADD_LAST_ACTION_KEY, kind);
  }

  const { data: clients = [] } = useQuery<QuickClient[]>({
    queryKey: ['quick-add-clients'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('id,name').order('name');
      if (error) throw new Error(error.message);
      return (data ?? []) as QuickClient[];
    },
    staleTime: 60_000,
  });

  const { data: team = [] } = useQuery<QuickTeamMember[]>({
    queryKey: ['quick-add-team'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_members')
        .select('id,full_name,email')
        .order('full_name');
      if (error) throw new Error(error.message);
      return (data ?? []) as QuickTeamMember[];
    },
    staleTime: 60_000,
  });
  const clientsById = useMemo(() => new Map(clients.map(client => [client.id, client] as const)), [clients]);

  const suggestedTaskTitle = useMemo(() => {
    const selectedClient = clientsById.get(taskClientId);
    if (!selectedClient) return 'Finalize weekly deliverables';
    return `${selectedClient.name} - ${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} follow-up`;
  }, [clientsById, taskClientId]);

  const suggestedClientName = useMemo(() => generateClientNameSuggestion(clientName), [clientName]);
  const clientInitials = useMemo(() => generateInitialsFromName(clientName || suggestedClientName), [clientName, suggestedClientName]);
  const detectedAssetType = useMemo(() => detectAssetTypeFromUrl(assetUrl), [assetUrl]);
  const suggestedAssetFolder = useMemo(() => {
    const selectedClient = clientsById.get(assetClientId);
    const type = detectedAssetType ?? assetType;
    return `${selectedClient?.name ?? 'General'}/${type}`;
  }, [clientsById, assetClientId, detectedAssetType, assetType]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);

  useEffect(() => {
    if (!activeModal) return;
    setMenuOpen(false);
  }, [activeModal]);

  useEffect(() => {
    if (taskAssignee === '' && user.id) {
      setTaskAssignee(user.id);
    }
  }, [taskAssignee, user.id]);

  const clientOptions = useMemo(
    () => clients.map((client) => ({ value: client.id, label: client.name })),
    [clients],
  );

  async function invalidateFor(kind: QuickAddKind) {
    const queryKeys: string[][] = [];

    if (kind === 'task') {
      queryKeys.push(
        ['tasks'], ['tasks-all'], ['tasks-my'], ['tasks-select'],
        ['dashboard-stats'], ['at-risk-tasks'], ['activities'], ['calendar'],
        ['reports-overview'], ['dashboard-trends'], ['dashboard-team-performance'],
      );
    }

    if (kind === 'client') {
      queryKeys.push(
        ['clients-list'], ['clients-stats'], ['clients'],
        ['dashboard-active-clients'], ['tasks-select'],
      );
    }

    if (kind === 'content') {
      queryKeys.push(['content-items'], ['activities'], ['calendar']);
    }

    if (kind === 'asset') {
      queryKeys.push(['dashboard-recent-assets'], ['asset-content-types'], ['calendar']);
    }

    await Promise.all(
      queryKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    );
  }

  function resetForm(kind: QuickAddKind) {
    if (kind === 'task') {
      setTaskTitle('');
      setTaskDescription('');
      setTaskClientId('');
      setTaskPriority('medium');
      setTaskDueDate(todayIsoDate());
      return;
    }
    if (kind === 'client') {
      setClientName('');
      setClientEmail('');
      return;
    }
    if (kind === 'content') {
      setContentTitle('');
      setContentClientId('');
      setContentCaption('');
      return;
    }
    setAssetName('');
    setAssetUrl('');
    setAssetClientId('');
    setAssetType('document');
  }

  async function handleTaskSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!taskClientId) {
      toast('Please select a client', 'error');
      return;
    }
    if (!taskAssignee) {
      toast('Please select an assignee', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const selectedClient = clientsById.get(taskClientId);
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: taskTitle,
          description: taskDescription || undefined,
          priority: taskPriority,
          status: 'todo',
          due_date: taskDueDate,
          client_id: taskClientId,
          client_name: selectedClient?.name,
          assigned_to: taskAssignee,
        }),
      });

      const json = await res.json() as { success?: boolean; error?: string };
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Failed to create task');

      await invalidateFor('task');
      registerAction('task');
      toast('Task created successfully', 'success');
      resetForm('task');
      setActiveModal(null);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to create task', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleClientSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: clientName, email: clientEmail || undefined, status: 'active' }),
      });

      const json = await res.json() as { success?: boolean; error?: string };
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Failed to create client');

      await invalidateFor('client');
      registerAction('client');
      void queryClient.invalidateQueries({ queryKey: ['quick-add-clients'] });
      toast('Client created successfully', 'success');
      resetForm('client');
      setActiveModal(null);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to create client', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleContentSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/content-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: contentTitle,
          client_id: contentClientId || null,
          caption: contentCaption || undefined,
          status: 'draft',
        }),
      });

      const json = await res.json() as { success?: boolean; error?: string };
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Failed to create content item');

      await invalidateFor('content');
      registerAction('content');
      toast('Content item created successfully', 'success');
      resetForm('content');
      setActiveModal(null);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to create content item', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAssetSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const selectedClient = clientsById.get(assetClientId);
      const res = await fetch('/api/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: assetName,
          file_url: assetUrl,
          client_id: assetClientId || null,
          client_name: selectedClient?.name ?? null,
          file_type: assetType,
          storage_provider: 'external',
          content_type: 'OTHER',
        }),
      });

      const json = await res.json() as { success?: boolean; error?: string };
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Failed to create asset');

      await invalidateFor('asset');
      registerAction('asset');
      toast('Asset created successfully', 'success');
      resetForm('asset');
      setActiveModal(null);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to create asset', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="fixed bottom-7 right-7 z-40 flex flex-col items-end gap-3">
        <div className="quick-add-dock relative flex flex-col items-end gap-2.5">
          {orderedMenuItems.map((item, index) => {
            const Icon = item.icon;
            const visible = menuOpen;
            const isLast = lastAction === item.key;
            const isTop = topAction === item.key;
            const tags = [isTop ? 'Most used' : null, isLast ? 'Last' : null].filter(Boolean).join(' • ');
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveModal(item.key)}
                aria-label={item.label}
                className="quick-add-dock-item btn-secondary group flex h-11 w-52 sm:h-12 sm:w-52 items-center gap-2.5 rounded-2xl px-3.5 text-sm transition-all duration-300"
                style={{
                  color: 'var(--text)',
                  border: isLast ? '1px solid var(--accent)' : undefined,
                  boxShadow: isLast ? '0 8px 20px color-mix(in srgb, var(--accent-glow) 52%, transparent)' : undefined,
                  transform: visible
                    ? 'translateY(0) scale(1)'
                    : 'translateY(12px) scale(0.94)',
                  opacity: visible ? 1 : 0,
                  pointerEvents: visible ? 'auto' : 'none',
                  transitionDelay: visible ? `${index * 45}ms` : '0ms',
                }}
              >
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                  style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
                >
                  <Icon size={16} />
                </span>
                <span className="flex h-full min-w-0 flex-1 items-center justify-center">
                  <span className="truncate text-xs font-semibold leading-none">
                    {item.label}{tags ? ` • ${tags}` : ''}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label={menuOpen ? 'Close global quick add' : 'Open global quick add'}
          className="btn-fab flex h-14 w-14 items-center justify-center rounded-full text-white transition-all duration-300 active:scale-95"
          style={{
            transform: menuOpen ? 'rotate(45deg) scale(1.04)' : 'rotate(0deg) scale(1)',
          }}
        >
          {menuOpen ? <X size={24} /> : <Plus size={24} />}
        </button>
      </div>

      <Modal
        open={activeModal === 'task'}
        onClose={() => setActiveModal(null)}
        title="Add Task"
        subtitle="Create and assign a task with client context."
        size="md"
      >
        <form className="space-y-4" onSubmit={handleTaskSubmit}>
          <div>
            <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Title *</label>
            <input
              required
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              className={baseFieldCls}
              placeholder="Enter task title"
            />
            {!taskTitle.trim() && (
              <button
                type="button"
                onClick={() => setTaskTitle(suggestedTaskTitle)}
                className="mt-2 text-xs font-semibold hover:opacity-80"
                style={{ color: 'var(--accent)' }}
              >
                Suggest: {suggestedTaskTitle}
              </button>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Description</label>
            <textarea
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
              className="openy-field w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]"
              rows={3}
              placeholder="Add context for the task"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Client *</label>
              <SelectDropdown
                fullWidth
                value={taskClientId}
                onChange={setTaskClientId}
                placeholder="Select client"
                options={[
                  { value: '', label: 'Select client' },
                  ...clientOptions,
                ]}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Assignee *</label>
              <SelectDropdown
                fullWidth
                value={taskAssignee}
                onChange={setTaskAssignee}
                placeholder="Select assignee"
                options={[
                  { value: '', label: 'Select assignee' },
                  ...team.map((member) => ({
                    value: member.id,
                    label: member.full_name ?? member.email ?? member.id,
                  })),
                ]}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Priority</label>
              <SelectDropdown
                fullWidth
                value={taskPriority}
                onChange={v => setTaskPriority(v as 'low' | 'medium' | 'high')}
                options={[
                  { value: 'low', label: 'Low' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'high', label: 'High' },
                ]}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Due date *</label>
              <input
                type="date"
                required
                value={taskDueDate}
                onChange={(e) => setTaskDueDate(e.target.value)}
                className={baseFieldCls}
              />
            </div>
          </div>

          <div className="openy-modal-actions" data-modal-footer="true">
            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="btn-secondary h-10 rounded-xl px-4 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary h-10 rounded-xl px-4 text-sm font-semibold disabled:opacity-60"
            >
              {submitting ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={activeModal === 'client'}
        onClose={() => setActiveModal(null)}
        title="Add Client"
        subtitle="Create a client profile for workspace operations."
        size="sm"
      >
        <form className="space-y-4" onSubmit={handleClientSubmit}>
          <div>
            <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Name *</label>
            <input
              required
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className={baseFieldCls}
              placeholder="Client or company name"
            />
            <div className="mt-2 flex items-center justify-between text-xs">
              {!clientName.trim() && (
                <button
                  type="button"
                  onClick={() => setClientName(suggestedClientName)}
                  className="font-semibold hover:opacity-80"
                  style={{ color: 'var(--accent)' }}
                >
                  Suggest name: {suggestedClientName}
                </button>
              )}
              <span
                className="inline-flex h-6 min-w-6 items-center justify-center rounded-md px-2 font-semibold"
                style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
                title="Auto initials/logo fallback"
              >
                {clientInitials}
              </span>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Email</label>
            <input
              type="email"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              className={baseFieldCls}
              placeholder="contact@company.com"
            />
          </div>

          <div className="openy-modal-actions" data-modal-footer="true">
            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="btn-secondary h-10 rounded-xl px-4 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary h-10 rounded-xl px-4 text-sm font-semibold disabled:opacity-60"
            >
              {submitting ? 'Creating...' : 'Create Client'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={activeModal === 'content'}
        onClose={() => setActiveModal(null)}
        title="Add Content"
        subtitle="Create a new content item with linked client context."
        size="sm"
      >
        <form className="space-y-4" onSubmit={handleContentSubmit}>
          <div>
            <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Title *</label>
            <input
              required
              value={contentTitle}
              onChange={(e) => setContentTitle(e.target.value)}
              className={baseFieldCls}
              placeholder="Content title"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Client</label>
            <SelectDropdown
              fullWidth
              value={contentClientId}
              onChange={setContentClientId}
              options={[
                { value: '', label: 'No client' },
                ...clientOptions,
              ]}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Caption</label>
            <textarea
              value={contentCaption}
              onChange={(e) => setContentCaption(e.target.value)}
              className="openy-field w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]"
              rows={3}
              placeholder="Optional caption"
            />
          </div>

          <div className="openy-modal-actions" data-modal-footer="true">
            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="btn-secondary h-10 rounded-xl px-4 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary h-10 rounded-xl px-4 text-sm font-semibold disabled:opacity-60"
            >
              {submitting ? 'Creating...' : 'Create Content'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={activeModal === 'asset'}
        onClose={() => setActiveModal(null)}
        title="Add Asset"
        subtitle="Register an external file link as a managed asset."
        size="sm"
      >
        <form className="space-y-4" onSubmit={handleAssetSubmit}>
          <div>
            <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Asset name *</label>
            <input
              required
              value={assetName}
              onChange={(e) => setAssetName(e.target.value)}
              className={baseFieldCls}
              placeholder="Asset name"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>File URL *</label>
            <input
              required
              type="url"
              value={assetUrl}
              onChange={(e) => setAssetUrl(e.target.value)}
              className={baseFieldCls}
              placeholder="https://..."
            />
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              {detectedAssetType && (
                <button
                  type="button"
                  onClick={() => setAssetType(detectedAssetType)}
                  className="rounded-md px-2 py-1 font-semibold hover:opacity-80"
                  style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
                >
                  Detected type: {detectedAssetType}
                </button>
              )}
              <span style={{ color: 'var(--text-secondary)' }}>Suggested folder: {suggestedAssetFolder}</span>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Client</label>
            <SelectDropdown
              fullWidth
              value={assetClientId}
              onChange={setAssetClientId}
              options={[
                { value: '', label: 'No client' },
                ...clientOptions,
              ]}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>File type</label>
            <SelectDropdown
              fullWidth
              value={assetType}
              onChange={setAssetType}
              options={[
                { value: 'document', label: 'Document' },
                { value: 'image', label: 'Image' },
                { value: 'video', label: 'Video' },
                { value: 'audio', label: 'Audio' },
              ]}
            />
          </div>

          <div className="openy-modal-actions" data-modal-footer="true">
            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="btn-secondary h-10 rounded-xl px-4 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary h-10 rounded-xl px-4 text-sm font-semibold disabled:opacity-60"
            >
              {submitting ? 'Creating...' : 'Create Asset'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
