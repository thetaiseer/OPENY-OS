'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, CheckSquare } from 'lucide-react';
import pb from '@/lib/pocketbase';
import { useLang } from '@/lib/lang-context';
import EmptyState from '@/components/ui/EmptyState';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import type { Task, Client } from '@/lib/types';

const priorityVariant = (p: string) => {
  if (p === 'high')   return 'danger'  as const;
  if (p === 'medium') return 'warning' as const;
  return 'default' as const;
};

const statusVariant = (s: string) => {
  if (s === 'done')        return 'success' as const;
  if (s === 'overdue')     return 'danger'  as const;
  if (s === 'in_progress') return 'info'    as const;
  return 'default' as const;
};

export default function TasksPage() {
  const { t } = useLang();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [form, setForm] = useState({
    title: '', description: '', status: 'todo', priority: 'medium', due_date: '', client: '',
  });

  const fetchTasks = useCallback(async () => {
    try {
      const filter = statusFilter !== 'all' ? `status = "${statusFilter}"` : '';
      const [tasksRes, clientsRes] = await Promise.allSettled([
        pb.collection('tasks').getList(1, 100, { sort: '-created', filter, expand: 'client' }),
        pb.collection('clients').getList(1, 100, {}),
      ]);
      if (tasksRes.status   === 'fulfilled') setTasks(tasksRes.value.items as unknown as Task[]);
      if (clientsRes.status === 'fulfilled') setClients(clientsRes.value.items as unknown as Client[]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const data: Record<string, unknown> = { ...form };
      if (!data.client)   delete data.client;
      if (!data.due_date) delete data.due_date;
      await pb.collection('tasks').create(data);
      setModalOpen(false);
      setForm({ title: '', description: '', status: 'todo', priority: 'medium', due_date: '', client: '' });
      fetchTasks();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setSaving(false);
    }
  };

  const statuses = ['all', 'todo', 'in_progress', 'done', 'overdue'];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{t('tasks')}</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>All tasks across clients</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium text-white hover:opacity-90 transition-opacity"
          style={{ background: 'var(--accent)' }}
        >
          <Plus size={16} />{t('newTask')}
        </button>
      </div>

      <div className="flex gap-1 flex-wrap">
        {statuses.map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className="h-8 px-3 rounded-lg text-xs font-medium transition-colors capitalize"
            style={{
              background: statusFilter === s ? 'var(--accent)' : 'var(--surface)',
              color: statusFilter === s ? '#fff' : 'var(--text-secondary)',
              border: '1px solid var(--border)',
            }}
          >
            {s === 'all' ? 'All' : t(s === 'in_progress' ? 'inProgress' : s)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: 'var(--surface)' }} />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title={t('noTasksYet')}
          description={t('noTasksDesc')}
          action={
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium text-white"
              style={{ background: 'var(--accent)' }}
            >
              <Plus size={16} />{t('newTask')}
            </button>
          }
        />
      ) : (
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          {tasks.map(task => (
            <div
              key={task.id}
              className="flex items-center gap-4 px-6 py-4 border-b last:border-b-0"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{task.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {task.expand?.client && (
                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {task.expand.client.name}
                    </span>
                  )}
                  {task.due_date && (
                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{task.due_date}</span>
                  )}
                </div>
              </div>
              <Badge variant={priorityVariant(task.priority)}>{t(task.priority)}</Badge>
              <Badge variant={statusVariant(task.status)}>
                {t(task.status === 'in_progress' ? 'inProgress' : task.status)}
              </Badge>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={t('newTask')}>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>{t('title')} *</label>
            <input
              required
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="w-full h-9 px-3 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]"
              style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>{t('description')}</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none focus:ring-2 focus:ring-[var(--accent)]"
              style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>{t('priority')}</label>
              <select
                value={form.priority}
                onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                className="w-full h-9 px-3 rounded-lg text-sm outline-none"
                style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
              >
                <option value="low">{t('low')}</option>
                <option value="medium">{t('medium')}</option>
                <option value="high">{t('high')}</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>{t('status')}</label>
              <select
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                className="w-full h-9 px-3 rounded-lg text-sm outline-none"
                style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
              >
                <option value="todo">{t('todo')}</option>
                <option value="in_progress">{t('inProgress')}</option>
                <option value="done">{t('done')}</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>{t('dueDate')}</label>
              <input
                type="date"
                value={form.due_date}
                onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                className="w-full h-9 px-3 rounded-lg text-sm outline-none"
                style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>{t('clients')}</label>
              <select
                value={form.client}
                onChange={e => setForm(f => ({ ...f, client: e.target.value }))}
                className="w-full h-9 px-3 rounded-lg text-sm outline-none"
                style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
              >
                <option value="">None</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="h-9 px-4 rounded-lg text-sm font-medium"
              style={{ background: 'var(--surface-2)', color: 'var(--text)' }}
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="h-9 px-4 rounded-lg text-sm font-medium text-white disabled:opacity-60 transition-opacity"
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
