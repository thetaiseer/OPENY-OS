'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
  const quickAddRef = useRef<HTMLDivElement | null>(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<QuickAddKind | null>(null);

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
    const onInteract = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (target && quickAddRef.current && !quickAddRef.current.contains(target)) {
        setMenuOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };

    window.addEventListener('mousedown', onInteract);
    window.addEventListener('touchstart', onInteract);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onInteract);
      window.removeEventListener('touchstart', onInteract);
      window.removeEventListener('keydown', onKeyDown);
    };
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
      <div ref={quickAddRef} className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-3 sm:bottom-7 sm:right-7">
        <div
          className="hidden sm:flex flex-col gap-2 rounded-2xl border p-2 transition-all duration-200"
          style={{
            minWidth: 248,
            background: 'rgba(15, 23, 42, 0.94)',
            borderColor: 'rgba(148, 163, 184, 0.24)',
            boxShadow: '0 20px 48px rgba(2, 6, 23, 0.35)',
            transform: menuOpen ? 'translateY(0) scale(1)' : 'translateY(8px) scale(0.96)',
            opacity: menuOpen ? 1 : 0,
            pointerEvents: menuOpen ? 'auto' : 'none',
            transformOrigin: 'bottom right',
            backdropFilter: 'blur(16px)',
          }}
          role="menu"
          aria-hidden={!menuOpen}
        >
          {MENU_ITEMS.map((item, index) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveModal(item.key)}
                aria-label={item.label}
                className="flex h-11 items-center gap-3 rounded-2xl px-3 text-sm font-medium text-white/95 transition-all duration-200 hover:bg-white/12"
                style={{
                  transform: menuOpen ? 'translateY(0) scale(1)' : 'translateY(6px) scale(0.96)',
                  opacity: menuOpen ? 1 : 0,
                  transitionDelay: menuOpen ? `${index * 38}ms` : '0ms',
                }}
              >
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                  style={{ background: 'rgba(59, 130, 246, 0.26)', color: '#dbeafe' }}
                >
                  <Icon size={16} />
                </span>
                <span className="truncate text-sm">{item.label}</span>
              </button>
            );
          })}
        </div>

        <div
          className="fixed bottom-24 left-4 right-4 z-40 flex flex-col gap-2 rounded-3xl border p-3 sm:hidden transition-all duration-200"
          style={{
            background: 'rgba(15, 23, 42, 0.95)',
            borderColor: 'rgba(148, 163, 184, 0.3)',
            boxShadow: '0 20px 52px rgba(2, 6, 23, 0.42)',
            backdropFilter: 'blur(16px)',
            transform: menuOpen ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.97)',
            opacity: menuOpen ? 1 : 0,
            pointerEvents: menuOpen ? 'auto' : 'none',
          }}
          role="menu"
          aria-hidden={!menuOpen}
        >
          {MENU_ITEMS.map((item, index) => {
            const Icon = item.icon;
            return (
              <button
                key={`mobile-${item.key}`}
                type="button"
                onClick={() => setActiveModal(item.key)}
                aria-label={item.label}
                className="flex h-12 items-center gap-3 rounded-2xl px-4 text-sm font-semibold text-white/95 transition-all duration-200 hover:bg-white/10"
                style={{
                  transform: menuOpen ? 'translateY(0) scale(1)' : 'translateY(8px) scale(0.96)',
                  opacity: menuOpen ? 1 : 0,
                  transitionDelay: menuOpen ? `${index * 40}ms` : '0ms',
                }}
              >
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                  style={{ background: 'rgba(59, 130, 246, 0.3)', color: '#dbeafe' }}
                >
                  <Icon size={16} />
                </span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label={menuOpen ? 'Close global quick add' : 'Open global quick add'}
          className="flex h-14 w-14 items-center justify-center rounded-full border text-white transition-all duration-300 active:scale-95"
          style={{
            background: 'linear-gradient(180deg, #1e3a8a 0%, #1d4ed8 100%)',
            borderColor: 'rgba(191, 219, 254, 0.35)',
            boxShadow: menuOpen
              ? '0 22px 38px rgba(30, 58, 138, 0.42)'
              : '0 18px 34px rgba(30, 64, 175, 0.36)',
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
                options={clientOptions}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Assignee *</label>
              <SelectDropdown
                fullWidth
                value={taskAssignee}
                onChange={setTaskAssignee}
                placeholder="Select assignee"
                options={team.map((member) => ({
                  value: member.id,
                  label: member.full_name ?? member.email ?? member.id,
                }))}
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
              className="glass glass-btn glass-btn--ghost h-10 rounded-xl px-4 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="glass glass-btn glass-btn--primary h-10 rounded-xl px-4 text-sm font-semibold disabled:opacity-60"
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
              className="glass glass-btn glass-btn--ghost h-10 rounded-xl px-4 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="glass glass-btn glass-btn--primary h-10 rounded-xl px-4 text-sm font-semibold disabled:opacity-60"
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
              className="glass glass-btn glass-btn--ghost h-10 rounded-xl px-4 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="glass glass-btn glass-btn--primary h-10 rounded-xl px-4 text-sm font-semibold disabled:opacity-60"
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
              className="glass glass-btn glass-btn--ghost h-10 rounded-xl px-4 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="glass glass-btn glass-btn--primary h-10 rounded-xl px-4 text-sm font-semibold disabled:opacity-60"
            >
              {submitting ? 'Creating...' : 'Create Asset'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
