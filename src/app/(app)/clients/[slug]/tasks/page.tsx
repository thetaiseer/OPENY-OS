'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Calendar, User, Tag, AlertCircle, Trash2 } from 'lucide-react';
import supabase from '@/lib/supabase';
import { useLang } from '@/context/lang-context';
import { useToast } from '@/context/toast-context';
import { useAuth } from '@/context/auth-context';
import Badge from '@/components/ui/Badge';
import NewTaskModal from '@/components/tasks/NewTaskModal';
import { ClientBrandMark } from '@/components/ui/ClientBrandMark';
import { useClientWorkspace } from '../client-context';
import type { Task, TeamMember, Client } from '@/lib/types';
import ConfirmDialog from '@/components/ui/actions/ConfirmDialog';
import { canDelete as canDeleteEntity } from '@/lib/permissions';

// ── Helpers ───────────────────────────────────────────────────────────────────

const COMPLETED_STATUSES = new Set(['done', 'delivered', 'completed', 'published', 'cancelled']);

const taskStatusVariant = (s: string) => {
  if (s === 'done' || s === 'completed' || s === 'delivered') return 'success' as const;
  if (s === 'overdue') return 'danger' as const;
  if (s === 'in_progress' || s === 'in_review') return 'info' as const;
  if (s === 'waiting_client') return 'warning' as const;
  return 'default' as const;
};

const taskPriorityVariant = (p: string) => {
  if (p === 'high') return 'danger' as const;
  if (p === 'medium') return 'warning' as const;
  return 'default' as const;
};

function isOverdue(due_date?: string, status?: string) {
  if (!due_date || COMPLETED_STATUSES.has(status ?? '')) return false;
  return new Date(due_date) < new Date(new Date().toDateString());
}

function fmtDate(d?: string) {
  if (!d) return '';
  return new Date(d).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function humanStatus(s: string): string {
  return s.replace(/_/g, ' ');
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ClientTasksPage() {
  const { client, clientId } = useClientWorkspace();
  const { t } = useLang();
  const { toast: addToast } = useToast();
  const { role } = useAuth();
  const canDeleteTasks = canDeleteEntity(role, 'task');

  const [tasks, setTasks] = useState<Task[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [pendingDeleteTask, setPendingDeleteTask] = useState<Task | null>(null);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    const [tk, tm] = await Promise.allSettled([
      supabase
        .from('tasks')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(100),
      supabase.from('team_members').select('*').order('full_name'),
    ]);
    if (tk.status === 'fulfilled' && !tk.value.error) setTasks((tk.value.data ?? []) as Task[]);
    if (tm.status === 'fulfilled' && !tm.value.error)
      setTeam((tm.value.data ?? []) as TeamMember[]);
    setLoading(false);
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDeleteTask = async (task: Task) => {
    setDeletingTaskId(task.id);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, { method: 'DELETE' });
      const json = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !json.success) {
        addToast(json.error ?? t('failedDeleteTask'), 'error');
        return;
      }
      setTasks((prev) => prev.filter((row) => row.id !== task.id));
      addToast('Task deleted', 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : t('failedDeleteTask'), 'error');
    } finally {
      setDeletingTaskId((current) => (current === task.id ? null : current));
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-xl"
            style={{ background: 'var(--surface)' }}
          />
        ))}
      </div>
    );
  }

  // Build client array for NewTaskModal (just the current client)
  const clientsForModal: Client[] = client ? [client] : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {client ? (
          <div
            className="flex min-w-0 max-w-full items-center gap-2 rounded-xl border px-3 py-2 text-sm"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
          >
            <ClientBrandMark
              name={client.name}
              logoUrl={client.logo}
              size={28}
              roundedClassName="rounded-lg"
            />
            <span className="min-w-0 truncate" style={{ color: 'var(--text)' }}>
              <span className="font-semibold">{client.name}</span>
              <span style={{ color: 'var(--text-secondary)' }}> — {t('tasksForThisClient')}</span>
            </span>
          </div>
        ) : (
          <span />
        )}
        <button
          onClick={() => setNewTaskOpen(true)}
          className="flex h-9 shrink-0 items-center gap-2 rounded-lg px-4 text-sm font-medium text-[var(--accent-foreground)]"
          style={{ background: 'var(--accent)' }}
        >
          <Plus size={14} />
          {t('newTask')}
        </button>
      </div>

      {tasks.length === 0 ? (
        <div className="py-16 text-center" style={{ color: 'var(--text-secondary)' }}>
          {t('noTasksYet')}
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => {
            const overdue = isOverdue(task.due_date, task.status);
            const assignee = team.find(
              (m) =>
                m.id === task.assigned_to ||
                m.id === task.assignee_id ||
                m.profile_id === task.assignee_id,
            );
            const mentionedMembers = (task.mentions ?? [])
              .map((mid) => team.find((m) => m.id === mid))
              .filter(Boolean) as TeamMember[];
            const isCompleted = COMPLETED_STATUSES.has(task.status);
            return (
              <div
                key={task.id}
                className="space-y-2 rounded-xl border p-4"
                style={{
                  background: 'var(--surface)',
                  borderColor: 'var(--border)',
                  borderLeft: `3px solid ${overdue ? 'var(--border-strong)' : isCompleted ? 'var(--border)' : 'var(--border)'}`,
                }}
              >
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                      {task.title}
                    </p>
                    {task.description && (
                      <p
                        className="mt-0.5 line-clamp-2 text-xs"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {task.description}
                      </p>
                    )}
                    {task.task_category && (
                      <p
                        className="mt-0.5 text-[10px] font-medium uppercase tracking-wide"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {task.task_category.replace(/_/g, ' ')}
                      </p>
                    )}
                  </div>
                  {canDeleteTasks ? (
                    <button
                      onClick={() => setPendingDeleteTask(task)}
                      className="shrink-0 rounded-lg p-1.5 text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
                      disabled={deletingTaskId === task.id}
                    >
                      <Trash2 size={13} />
                    </button>
                  ) : null}
                </div>
                <div
                  className="flex flex-wrap items-center gap-2 text-xs"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {task.due_date && (
                    <span
                      className="flex items-center gap-1 rounded-full px-2 py-0.5"
                      style={{ background: 'var(--surface-2)' }}
                    >
                      {overdue ? <AlertCircle size={10} /> : <Calendar size={10} />}
                      {fmtDate(task.due_date)}
                    </span>
                  )}
                  {assignee && (
                    <span
                      className="flex items-center gap-1 rounded-full px-2 py-0.5"
                      style={{ background: 'var(--surface-2)' }}
                    >
                      <User size={10} />
                      {assignee.full_name}
                    </span>
                  )}
                  {mentionedMembers.length > 0 && (
                    <span
                      className="flex items-center gap-1 rounded-full px-2 py-0.5"
                      style={{ background: 'var(--surface-2)' }}
                    >
                      {mentionedMembers.map((m) => `@${m.full_name}`).join(', ')}
                    </span>
                  )}
                  {task.tags &&
                    task.tags.length > 0 &&
                    task.tags.map((tag) => (
                      <span
                        key={tag}
                        className="flex items-center gap-1 rounded-full px-2 py-0.5"
                        style={{ background: 'var(--surface-2)' }}
                      >
                        <Tag size={10} />
                        {tag}
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

      {/* Full-featured task creation modal — triggers calendar events, notifications, emails */}
      <NewTaskModal
        open={newTaskOpen}
        onClose={() => setNewTaskOpen(false)}
        onCreated={(task) => {
          setTasks((prev) => [task, ...prev]);
          setNewTaskOpen(false);
        }}
        clients={clientsForModal}
        team={team}
        initialClientId={clientId}
      />

      <ConfirmDialog
        open={Boolean(pendingDeleteTask)}
        title={t('deleteTask')}
        description={
          pendingDeleteTask
            ? `${t('confirmDeleteTask')} "${pendingDeleteTask.title}"`
            : t('confirmDeleteTask')
        }
        confirmLabel={t('deleteAction')}
        cancelLabel={t('cancel')}
        destructive
        loading={Boolean(pendingDeleteTask) && deletingTaskId === pendingDeleteTask?.id}
        onCancel={() => setPendingDeleteTask(null)}
        onConfirm={async () => {
          if (!pendingDeleteTask) return;
          await handleDeleteTask(pendingDeleteTask);
          setPendingDeleteTask(null);
        }}
      />
    </div>
  );
}
