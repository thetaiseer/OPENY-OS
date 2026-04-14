'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Plus, Calendar, User, Users, Tag, AlertCircle, Trash2,
} from 'lucide-react';
import supabase from '@/lib/supabase';
import { useLang } from '@/lib/lang-context';
import { useToast } from '@/lib/toast-context';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import AiImproveButton from '@/components/ui/AiImproveButton';
import SelectDropdown from '@/components/ui/SelectDropdown';
import { useClientWorkspace } from '../client-context';
import type { Task, TeamMember } from '@/lib/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

const taskStatusVariant = (s: string) => {
  if (s === 'done')        return 'success' as const;
  if (s === 'overdue')     return 'danger'  as const;
  if (s === 'in_progress') return 'info'    as const;
  return 'default' as const;
};

const taskPriorityVariant = (p: string) => {
  if (p === 'high')   return 'danger'  as const;
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ClientTasksPage() {
  const { clientId } = useClientWorkspace();
  const { t } = useLang();
  const { toast: addToast } = useToast();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [team,  setTeam]  = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskForm, setTaskForm] = useState({
    title: '', priority: 'medium', due_date: '', assigned_to: '', status: 'todo',
  });
  const [taskSaving, setTaskSaving] = useState(false);

  const load = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    const [tk, tm] = await Promise.allSettled([
      supabase.from('tasks').select('*').eq('client_id', clientId).order('created_at', { ascending: false }).limit(100),
      supabase.from('team_members').select('*').order('full_name'),
    ]);
    if (tk.status === 'fulfilled' && !tk.value.error) setTasks((tk.value.data ?? []) as Task[]);
    if (tm.status === 'fulfilled' && !tm.value.error) setTeam((tm.value.data ?? []) as TeamMember[]);
    setLoading(false);
  }, [clientId]);

  useEffect(() => { void load(); }, [load]);

  const handleDeleteTask = async (taskId: string, taskTitle: string) => {
    if (!confirm(`Delete task "${taskTitle}"? This cannot be undone.`)) return;
    const { error } = await supabase.from('tasks').delete().eq('id', taskId);
    if (error) { addToast(error.message, 'error'); return; }
    setTasks(prev => prev.filter(t => t.id !== taskId));
    await supabase.from('activities').insert({
      type: 'task', description: `Task "${taskTitle}" deleted`, client_id: clientId,
    });
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskForm.title.trim()) return;
    setTaskSaving(true);
    try {
      const { error } = await supabase.from('tasks').insert({
        title:       taskForm.title.trim(),
        priority:    taskForm.priority,
        due_date:    taskForm.due_date || null,
        assigned_to: taskForm.assigned_to || null,
        status:      taskForm.status,
        client_id:   clientId,
      });
      if (error) throw error;
      await supabase.from('activities').insert({
        type: 'task', description: `Task "${taskForm.title}" created`, client_id: clientId,
      });
      setTaskModalOpen(false);
      setTaskForm({ title: '', priority: 'medium', due_date: '', assigned_to: '', status: 'todo' });
      void load();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Failed to create task', 'error');
    } finally {
      setTaskSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl animate-pulse" style={{ background: 'var(--surface)' }} />
        ))}
      </div>
    );
  }

  return (
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
            const overdue         = isOverdue(task.due_date, task.status);
            const assignee        = team.find(m => m.id === task.assigned_to);
            const creator         = team.find(m => m.id === task.created_by);
            const mentionedMembers = (task.mentions ?? []).map(mid => team.find(m => m.id === mid)).filter(Boolean) as TeamMember[];
            return (
              <div
                key={task.id}
                className="rounded-xl border p-4 space-y-2"
                style={{
                  background:  'var(--surface)',
                  borderColor: 'var(--border)',
                  borderLeft:  `3px solid ${overdue ? '#ef4444' : task.status === 'done' ? '#22c55e' : 'var(--border)'}`,
                }}
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{task.title}</p>
                    {task.description && (
                      <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{task.description}</p>
                    )}
                  </div>
                  <button
                    onClick={() => void handleDeleteTask(task.id, task.title)}
                    className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 items-center text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {task.due_date && (
                    <span
                      className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${overdue ? 'text-red-500' : ''}`}
                      style={{ background: overdue ? '#fef2f2' : 'var(--surface-2)' }}
                    >
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
                  <Badge variant={taskStatusVariant(task.status)}>
                    {t(task.status === 'in_progress' ? 'inProgress' : task.status)}
                  </Badge>
                  <Badge variant={taskPriorityVariant(task.priority)}>{t(task.priority)}</Badge>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Quick-create task modal */}
      <Modal open={taskModalOpen} onClose={() => setTaskModalOpen(false)} title={t('newTask')} size="sm">
        <form onSubmit={e => void handleCreateTask(e)} className="space-y-4">
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
                  { value: 'low',    label: t('low')    },
                  { value: 'medium', label: t('medium') },
                  { value: 'high',   label: t('high')   },
                ]}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>{t('deadline')}</label>
              <input
                type="date"
                value={taskForm.due_date}
                onChange={e => setTaskForm(f => ({ ...f, due_date: e.target.value }))}
                className="w-full h-9 px-3 rounded-lg text-sm outline-none"
                style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
              />
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
            <button
              type="button"
              onClick={() => setTaskModalOpen(false)}
              className="h-9 px-4 rounded-lg text-sm font-medium"
              style={{ background: 'var(--surface-2)', color: 'var(--text)' }}
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={taskSaving}
              className="h-9 px-4 rounded-lg text-sm font-medium text-white disabled:opacity-60"
              style={{ background: 'var(--accent)' }}
            >
              {taskSaving ? t('loading') : t('save')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
