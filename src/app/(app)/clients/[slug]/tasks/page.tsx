'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Plus, Calendar, User, Tag, AlertCircle, Trash2,
} from 'lucide-react';
import supabase from '@/lib/supabase';
import { useLang } from '@/context/lang-context';
import { useToast } from '@/context/toast-context';
import Badge from '@/components/ui/Badge';
import NewTaskModal from '@/components/tasks/NewTaskModal';
import { useClientWorkspace } from '../client-context';
import type { Task, TeamMember, Client } from '@/lib/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

const COMPLETED_STATUSES = new Set(['done', 'delivered', 'completed', 'published', 'cancelled']);

const taskStatusVariant = (s: string) => {
  if (s === 'done' || s === 'completed' || s === 'delivered') return 'success' as const;
  if (s === 'overdue')     return 'danger'  as const;
  if (s === 'in_progress' || s === 'in_review') return 'info' as const;
  if (s === 'waiting_client') return 'warning' as const;
  return 'default' as const;
};

const taskPriorityVariant = (p: string) => {
  if (p === 'high')   return 'danger'  as const;
  if (p === 'medium') return 'warning' as const;
  return 'default' as const;
};

function isOverdue(due_date?: string, status?: string) {
  if (!due_date || COMPLETED_STATUSES.has(status ?? '')) return false;
  return new Date(due_date) < new Date(new Date().toDateString());
}

function fmtDate(d?: string) {
  if (!d) return '';
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function humanStatus(s: string): string {
  return s.replace(/_/g, ' ');
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ClientTasksPage() {
  const { client, clientId } = useClientWorkspace();
  const { t } = useLang();
  const { toast: addToast } = useToast();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [team,  setTeam]  = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTaskOpen, setNewTaskOpen] = useState(false);

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
    // Log deletion activity via API so user_uuid and entity_id are tracked properly
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

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl animate-pulse" style={{ background: 'var(--surface)' }} />
        ))}
      </div>
    );
  }

  // Build client array for NewTaskModal (just the current client)
  const clientsForModal: Client[] = client ? [client] : [];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setNewTaskOpen(true)}
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
            const assignee = team.find(m => m.id === task.assigned_to || m.id === task.assignee_id || m.profile_id === task.assignee_id);
            const mentionedMembers = (task.mentions ?? []).map(mid => team.find(m => m.id === mid)).filter(Boolean) as TeamMember[];
            const isCompleted = COMPLETED_STATUSES.has(task.status);
            return (
              <div
                key={task.id}
                className="rounded-xl border p-4 space-y-2"
                style={{
                  background:  'var(--surface)',
                  borderColor: 'var(--border)',
                  borderLeft:  `3px solid ${overdue ? '#ef4444' : isCompleted ? '#22c55e' : 'var(--border)'}`,
                }}
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{task.title}</p>
                    {task.description && (
                      <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{task.description}</p>
                    )}
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
                  {mentionedMembers.length > 0 && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: 'var(--surface-2)' }}>
                      {mentionedMembers.map(m => `@${m.full_name}`).join(', ')}
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
                    {humanStatus(task.status)}
                  </Badge>
                  <Badge variant={taskPriorityVariant(task.priority)}>{t(task.priority)}</Badge>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Full-featured task creation modal — triggers calendar events, notifications, emails */}
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
