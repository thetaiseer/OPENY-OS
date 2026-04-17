'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Plus,
  Calendar,
  User,
  Tag,
  AlertCircle,
  Trash2,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import supabase from '@/lib/supabase';
import { useLang } from '@/lib/lang-context';
import { useToast } from '@/lib/toast-context';
import Badge from '@/components/ui/Badge';
import NewTaskModal from '@/components/tasks/NewTaskModal';
import EmptyState from '@/components/ui/EmptyState';
import { useClientWorkspace } from '../client-context';
import type { Task, TeamMember, Client } from '@/lib/types';

const COMPLETED_STATUSES = new Set(['done', 'delivered', 'completed', 'published', 'cancelled']);

const taskStatusVariant = (status: string) => {
  if (status === 'done' || status === 'completed' || status === 'delivered') return 'success' as const;
  if (status === 'overdue') return 'danger' as const;
  if (status === 'in_progress' || status === 'in_review') return 'info' as const;
  if (status === 'waiting_client') return 'warning' as const;
  return 'default' as const;
};

const taskPriorityVariant = (priority: string) => {
  if (priority === 'high') return 'danger' as const;
  if (priority === 'medium') return 'warning' as const;
  return 'default' as const;
};

function isOverdue(dueDate?: string, status?: string) {
  if (!dueDate || COMPLETED_STATUSES.has(status ?? '')) return false;
  return new Date(dueDate) < new Date(new Date().toDateString());
}

function fmtDate(date?: string) {
  if (!date) return '';
  return new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function humanStatus(status: string): string {
  return status.replace(/_/g, ' ');
}

export default function ClientTasksPage() {
  const { client, clientId } = useClientWorkspace();
  const { t } = useLang();
  const { toast: addToast } = useToast();
  const searchParams = useSearchParams();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTaskOpen, setNewTaskOpen] = useState(false);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | Task['status']>('all');

  const load = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);

    const [tasksResult, teamResult] = await Promise.allSettled([
      supabase.from('tasks').select('*').eq('client_id', clientId).order('created_at', { ascending: false }).limit(100),
      supabase.from('team_members').select('*').order('full_name'),
    ]);

    if (tasksResult.status === 'fulfilled' && !tasksResult.value.error) setTasks((tasksResult.value.data ?? []) as Task[]);
    if (teamResult.status === 'fulfilled' && !teamResult.value.error) setTeam((teamResult.value.data ?? []) as TeamMember[]);

    setLoading(false);
  }, [clientId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (searchParams.get('quickAdd') === '1') {
      setNewTaskOpen(true);
    }
  }, [searchParams]);

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();

    return tasks.filter(task => {
      if (statusFilter !== 'all' && task.status !== statusFilter) return false;
      if (!q) return true;
      return task.title.toLowerCase().includes(q) || task.description?.toLowerCase().includes(q);
    });
  }, [tasks, search, statusFilter]);

  const handleDeleteTask = async (taskId: string, taskTitle: string) => {
    if (!confirm(`Delete task "${taskTitle}"? This cannot be undone.`)) return;

    const { error } = await supabase.from('tasks').delete().eq('id', taskId);
    if (error) {
      addToast(error.message, 'error');
      return;
    }

    setTasks(prev => prev.filter(task => task.id !== taskId));

    void fetch('/api/activities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'task_deleted',
        description: `Task "${taskTitle}" deleted`,
        client_id: clientId,
        entity_type: 'task',
        entity_id: taskId,
      }),
    });
  };

  const clientsForModal: Client[] = client ? [client] : [];

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl animate-pulse" style={{ background: 'var(--surface)' }} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="glass-card p-4">
        <div className="flex flex-col md:flex-row md:items-center gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-secondary)' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input-glass h-9 w-full pl-8 pr-3 text-sm"
              placeholder="Search task title or description"
            />
          </div>

          <label className="relative">
            <SlidersHorizontal size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-secondary)' }} />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as 'all' | Task['status'])}
              className="input-glass h-9 pl-8 pr-7 text-xs font-semibold min-w-[145px]"
            >
              <option value="all">All statuses</option>
              {[...new Set(tasks.map(task => task.status))].map(status => (
                <option key={status} value={status}>{humanStatus(status)}</option>
              ))}
            </select>
          </label>

          <button
            onClick={() => setNewTaskOpen(true)}
            className="btn-primary h-9 px-4 rounded-xl text-sm font-semibold inline-flex items-center gap-2"
          >
            <Plus size={14} />{t('newTask')}
          </button>
        </div>
      </div>

      {filteredTasks.length === 0 ? (
        <div className="glass-card">
          <EmptyState
            icon={AlertCircle}
            title="No tasks yet"
            description="Create client tasks to track deliverables, ownership, and deadlines."
            action={(
              <button
                onClick={() => setNewTaskOpen(true)}
                className="btn-primary h-9 px-4 rounded-xl text-sm font-semibold inline-flex items-center gap-2"
              >
                <Plus size={14} /> Create task
              </button>
            )}
          />
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTasks.map(task => {
            const overdue = isOverdue(task.due_date, task.status);
            const assignee = team.find(member => member.id === task.assigned_to || member.id === task.assignee_id || member.profile_id === task.assignee_id);
            const mentionedMembers = (task.mentions ?? []).map(memberId => team.find(member => member.id === memberId)).filter(Boolean) as TeamMember[];
            const completed = COMPLETED_STATUSES.has(task.status);

            return (
              <div
                key={task.id}
                className="glass-card p-4 space-y-2"
                style={{
                  borderLeft: `3px solid ${overdue ? '#ef4444' : completed ? '#22c55e' : 'var(--border)'}`,
                }}
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{task.title}</p>
                    {task.description && <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{task.description}</p>}
                    {task.task_category && (
                      <p className="text-[10px] mt-0.5 font-medium uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                        {task.task_category.replace(/_/g, ' ')}
                      </p>
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
                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${overdue ? 'text-red-500' : ''}`} style={{ background: overdue ? '#fef2f2' : 'var(--surface-2)' }}>
                      {overdue ? <AlertCircle size={10} /> : <Calendar size={10} />}
                      {fmtDate(task.due_date)}
                    </span>
                  )}
                  {assignee && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: 'var(--surface-2)' }}>
                      <User size={10} />{assignee.full_name}
                    </span>
                  )}
                  {mentionedMembers.length > 0 && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: 'var(--surface-2)' }}>
                      {mentionedMembers.map(member => `@${member.full_name}`).join(', ')}
                    </span>
                  )}
                  {task.tags && task.tags.length > 0 && task.tags.map(tag => (
                    <span key={tag} className="flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: 'var(--surface-2)' }}>
                      <Tag size={10} />{tag}
                    </span>
                  ))}
                </div>

                <div className="flex gap-2">
                  <Badge variant={taskStatusVariant(task.status)}>{humanStatus(task.status)}</Badge>
                  <Badge variant={taskPriorityVariant(task.priority)}>{t(task.priority)}</Badge>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <NewTaskModal
        open={newTaskOpen}
        onClose={() => setNewTaskOpen(false)}
        onCreated={task => {
          setTasks(prev => [task, ...prev]);
          setNewTaskOpen(false);
        }}
        clients={clientsForModal}
        team={team}
        initialClientId={clientId}
      />
    </div>
  );
}
