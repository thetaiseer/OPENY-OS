'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  CheckSquare,
  FileText,
  ImagePlus,
  Plus,
  X,
} from 'lucide-react';
import { createClient as createSupabase } from '@/lib/supabase/client';
import { useToast } from '@/lib/toast-context';
import { useAuth } from '@/lib/auth-context';
import Modal from '@/components/ui/Modal';

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

const MENU_ITEMS: { key: QuickAddKind; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { key: 'task', label: 'Add Task', icon: CheckSquare },
  { key: 'client', label: 'Add Client', icon: Building2 },
  { key: 'content', label: 'Add Content', icon: FileText },
  { key: 'asset', label: 'Add Asset', icon: ImagePlus },
];

const baseInputCls = 'w-full h-10 px-3 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]';
const baseInputStyle = {
  background: 'var(--surface-2)',
  borderColor: 'var(--border)',
  color: 'var(--text)',
};

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export default function GlobalQuickAdd() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const supabase = useMemo(() => createSupabase(), []);

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
    if (!taskAssignee && user.id) {
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
      const selectedClient = clients.find((client) => client.id === taskClientId);
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
      const selectedClient = clients.find((client) => client.id === assetClientId);
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
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3">
        <div className="relative flex flex-col items-end gap-2">
          {MENU_ITEMS.map((item, index) => {
            const Icon = item.icon;
            const visible = menuOpen;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveModal(item.key)}
                aria-label={item.label}
                className="group flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm shadow-lg transition-all duration-300"
                style={{
                  background: 'var(--surface)',
                  borderColor: 'var(--border)',
                  color: 'var(--text)',
                  transform: visible
                    ? 'translateY(0) scale(1)'
                    : 'translateY(12px) scale(0.94)',
                  opacity: visible ? 1 : 0,
                  pointerEvents: visible ? 'auto' : 'none',
                  transitionDelay: visible ? `${index * 45}ms` : '0ms',
                }}
              >
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-full"
                  style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
                >
                  <Icon size={14} />
                </span>
                <span className="whitespace-nowrap text-xs font-semibold">{item.label}</span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label="Open global quick add"
          className="flex h-14 w-14 items-center justify-center rounded-full text-white shadow-2xl transition-all duration-300"
          style={{
            background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%)',
            transform: menuOpen ? 'rotate(45deg) scale(1.04)' : 'rotate(0deg) scale(1)',
            boxShadow: '0 16px 34px rgba(99,102,241,0.35)',
          }}
        >
          {menuOpen ? <X size={24} /> : <Plus size={24} />}
        </button>
      </div>

      <Modal
        open={activeModal === 'task'}
        onClose={() => setActiveModal(null)}
        title="Add Task"
        size="md"
      >
        <form className="space-y-4" onSubmit={handleTaskSubmit}>
          <div>
            <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Title *</label>
            <input
              required
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              className={baseInputCls}
              style={baseInputStyle}
              placeholder="Enter task title"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Description</label>
            <textarea
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
              className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]"
              style={baseInputStyle}
              rows={3}
              placeholder="Add context for the task"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Client *</label>
              <select
                required
                value={taskClientId}
                onChange={(e) => setTaskClientId(e.target.value)}
                className={baseInputCls}
                style={baseInputStyle}
              >
                <option value="">Select client</option>
                {clientOptions.map((client) => (
                  <option key={client.value} value={client.value}>{client.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Assignee *</label>
              <select
                required
                value={taskAssignee}
                onChange={(e) => setTaskAssignee(e.target.value)}
                className={baseInputCls}
                style={baseInputStyle}
              >
                <option value="">Select assignee</option>
                {team.map((member) => (
                  <option key={member.id} value={member.id}>{member.full_name ?? member.email ?? member.id}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Priority</label>
              <select
                value={taskPriority}
                onChange={(e) => setTaskPriority(e.target.value as 'low' | 'medium' | 'high')}
                className={baseInputCls}
                style={baseInputStyle}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Due date *</label>
              <input
                type="date"
                required
                value={taskDueDate}
                onChange={(e) => setTaskDueDate(e.target.value)}
                className={baseInputCls}
                style={baseInputStyle}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="h-10 rounded-xl px-4 text-sm font-medium"
              style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="h-10 rounded-xl px-4 text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: 'var(--accent)' }}
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
        size="sm"
      >
        <form className="space-y-4" onSubmit={handleClientSubmit}>
          <div>
            <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Name *</label>
            <input
              required
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className={baseInputCls}
              style={baseInputStyle}
              placeholder="Client or company name"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Email</label>
            <input
              type="email"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              className={baseInputCls}
              style={baseInputStyle}
              placeholder="contact@company.com"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="h-10 rounded-xl px-4 text-sm font-medium"
              style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="h-10 rounded-xl px-4 text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: 'var(--accent)' }}
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
        size="sm"
      >
        <form className="space-y-4" onSubmit={handleContentSubmit}>
          <div>
            <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Title *</label>
            <input
              required
              value={contentTitle}
              onChange={(e) => setContentTitle(e.target.value)}
              className={baseInputCls}
              style={baseInputStyle}
              placeholder="Content title"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Client</label>
            <select
              value={contentClientId}
              onChange={(e) => setContentClientId(e.target.value)}
              className={baseInputCls}
              style={baseInputStyle}
            >
              <option value="">No client</option>
              {clientOptions.map((client) => (
                <option key={client.value} value={client.value}>{client.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Caption</label>
            <textarea
              value={contentCaption}
              onChange={(e) => setContentCaption(e.target.value)}
              className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]"
              style={baseInputStyle}
              rows={3}
              placeholder="Optional caption"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="h-10 rounded-xl px-4 text-sm font-medium"
              style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="h-10 rounded-xl px-4 text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: 'var(--accent)' }}
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
        size="sm"
      >
        <form className="space-y-4" onSubmit={handleAssetSubmit}>
          <div>
            <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Asset name *</label>
            <input
              required
              value={assetName}
              onChange={(e) => setAssetName(e.target.value)}
              className={baseInputCls}
              style={baseInputStyle}
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
              className={baseInputCls}
              style={baseInputStyle}
              placeholder="https://..."
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Client</label>
            <select
              value={assetClientId}
              onChange={(e) => setAssetClientId(e.target.value)}
              className={baseInputCls}
              style={baseInputStyle}
            >
              <option value="">No client</option>
              {clientOptions.map((client) => (
                <option key={client.value} value={client.value}>{client.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>File type</label>
            <select
              value={assetType}
              onChange={(e) => setAssetType(e.target.value)}
              className={baseInputCls}
              style={baseInputStyle}
            >
              <option value="document">Document</option>
              <option value="image">Image</option>
              <option value="video">Video</option>
              <option value="audio">Audio</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="h-10 rounded-xl px-4 text-sm font-medium"
              style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="h-10 rounded-xl px-4 text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: 'var(--accent)' }}
            >
              {submitting ? 'Creating...' : 'Create Asset'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
