'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Plus, CheckSquare, ChevronDown, Pencil, Trash2, Eye,
  Calendar, User, Users, Tag, AlertCircle, Clock,
  LayoutGrid, List, Search,
} from 'lucide-react';
import supabase from '@/lib/supabase';
import { useLang } from '@/lib/lang-context';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import EmptyState from '@/components/ui/EmptyState';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import AiImproveButton from '@/components/ui/AiImproveButton';
import type { Task, Client, TeamMember } from '@/lib/types';

// ─── helpers ────────────────────────────────────────────────────────────────

const priorityVariant = (p: string) => {
  if (p === 'high')   return 'danger'  as const;
  if (p === 'medium') return 'warning' as const;
  return 'default' as const;
};

const statusVariant = (s: string) => {
  if (s === 'done')        return 'success' as const;
  if (s === 'delivered')   return 'success' as const;
  if (s === 'overdue')     return 'danger'  as const;
  if (s === 'in_progress') return 'info'    as const;
  if (s === 'review')      return 'warning' as const;
  return 'default' as const;
};

function todayMidnight() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function isOverdue(due_date?: string, status?: string) {
  if (!due_date || status === 'done') return false;
  return new Date(due_date) < todayMidnight();
}

function isDueSoon(due_date?: string, status?: string) {
  if (!due_date || status === 'done') return false;
  const diff = (new Date(due_date).getTime() - todayMidnight().getTime()) / 86400000;
  return diff >= 0 && diff <= 3;
}

function parseTags(tags: string): string[] {
  return tags ? tags.split(',').map(s => s.trim()).filter(Boolean) : [];
}

function fmtDate(d?: string) {
  if (!d) return '';
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

const inputCls = 'w-full h-9 px-3 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]';
const inputStyle = { background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' };

function statusLabel(s: string, t: (k: string) => string): string {
  if (s === 'in_progress') return t('inProgress');
  if (s === 'review')      return t('review');
  if (s === 'delivered')   return t('delivered');
  return t(s);
}

// ─── blank form ─────────────────────────────────────────────────────────────

const blankForm = {
  title: '', description: '', status: 'todo', priority: 'medium',
  start_date: '', due_date: '', client_id: '', assigned_to: '', created_by: '',
  mentions: [] as string[], tags: '',
};

// ─── TaskForm ────────────────────────────────────────────────────────────────

interface TaskFormProps {
  form: typeof blankForm;
  setForm: React.Dispatch<React.SetStateAction<typeof blankForm>>;
  clients: Client[];
  team: TeamMember[];
  saving: boolean;
  onCancel: () => void;
  t: (k: string) => string;
}

function TaskForm({ form, setForm, clients, team, saving, onCancel, t }: TaskFormProps) {
  const toggleMention = (id: string) => {
    setForm(f => ({
      ...f,
      mentions: f.mentions.includes(id) ? f.mentions.filter(m => m !== id) : [...f.mentions, id],
    }));
  };

  return (
    <div className="space-y-4">
      {/* Title */}
      <div className="space-y-1">
        <div className="flex items-center justify-between mb-1">
          <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>{t('title')} *</label>
          <AiImproveButton
            value={form.title}
            onImproved={v => setForm(f => ({ ...f, title: v }))}
          />
        </div>
        <input
          required
          value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          className={inputCls}
          style={inputStyle}
          placeholder="Task title"
        />
      </div>

      {/* Description */}
      <div className="space-y-1">
        <div className="flex items-center justify-between mb-1">
          <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>{t('description')}</label>
          <AiImproveButton
            value={form.description}
            onImproved={v => setForm(f => ({ ...f, description: v }))}
            showMenu
          />
        </div>
        <textarea
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          rows={3}
          className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none focus:ring-2 focus:ring-[var(--accent)]"
          style={inputStyle}
          placeholder="Detailed description..."
        />
      </div>

      {/* Client + Start Date + Deadline */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>{t('clients')} *</label>
          <select required value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))} className={inputCls} style={inputStyle}>
            <option value="">{t('none')}</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>{t('startDate')}</label>
          <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} className={inputCls} style={inputStyle} />
        </div>
      </div>

      {/* Deadline */}
      <div className="space-y-1">
        <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>{t('deadline')} *</label>
        <input required type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} className={inputCls} style={inputStyle} />
      </div>

      {/* Priority + Status */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>{t('priority')}</label>
          <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} className={inputCls} style={inputStyle}>
            <option value="low">{t('low')}</option>
            <option value="medium">{t('medium')}</option>
            <option value="high">{t('high')}</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>{t('status')}</label>
          <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inputCls} style={inputStyle}>
            <option value="todo">{t('todo')}</option>
            <option value="in_progress">{t('inProgress')}</option>
            <option value="review">{t('review')}</option>
            <option value="done">{t('done')}</option>
            <option value="delivered">{t('delivered')}</option>
          </select>
        </div>
      </div>

      {/* Assigned To + Created By */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>{t('assignedTo')} *</label>
          <select required value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))} className={inputCls} style={inputStyle}>
            <option value="">{t('unassigned')}</option>
            {team.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>{t('createdBy')}</label>
          <select value={form.created_by} onChange={e => setForm(f => ({ ...f, created_by: e.target.value }))} className={inputCls} style={inputStyle}>
            <option value="">{t('none')}</option>
            {team.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
      </div>

      {/* Mentions */}
      {team.length > 0 && (
        <div className="space-y-1">
          <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>{t('mentions')}</label>
          <div className="flex flex-wrap gap-2 p-2 rounded-lg" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            {team.map(m => {
              const selected = form.mentions.includes(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggleMention(m.id)}
                  className="h-7 px-3 rounded-full text-xs font-medium transition-colors"
                  style={{
                    background: selected ? 'var(--accent)' : 'var(--surface)',
                    color: selected ? '#fff' : 'var(--text-secondary)',
                    border: '1px solid var(--border)',
                  }}
                >
                  @{m.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Tags */}
      <div className="space-y-1">
        <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>{t('tags')}</label>
        <input
          value={form.tags}
          onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
          className={inputCls}
          style={inputStyle}
          placeholder="design, urgent, review"
        />
      </div>

      {/* Buttons */}
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="h-9 px-4 rounded-lg text-sm font-medium" style={{ background: 'var(--surface-2)', color: 'var(--text)' }}>
          {t('cancel')}
        </button>
        <button type="submit" disabled={saving} className="h-9 px-4 rounded-lg text-sm font-medium text-white disabled:opacity-60 transition-opacity" style={{ background: 'var(--accent)' }}>
          {saving ? t('loading') : t('save')}
        </button>
      </div>
    </div>
  );
}

// ─── TaskCard ────────────────────────────────────────────────────────────────

interface TaskCardProps {
  task: Task;
  team: TeamMember[];
  onView: (t: Task) => void;
  onEdit: (t: Task) => void;
  onDelete: (t: Task) => void;
  onStatusChange: (t: Task, s: string) => void;
  t: (k: string) => string;
}

function TaskCard({ task, team, onView, onEdit, onDelete, onStatusChange, t }: TaskCardProps) {
  const [statusOpen, setStatusOpen] = useState(false);
  const overdue = isOverdue(task.due_date, task.status);
  const soon = isDueSoon(task.due_date, task.status);
  const assignee = team.find(m => m.id === task.assigned_to);
  const creator = team.find(m => m.id === task.created_by);
  const mentionedMembers = (task.mentions ?? []).map(id => team.find(m => m.id === id)).filter(Boolean) as TeamMember[];

  const borderLeft = overdue ? '#ef4444' : soon ? '#f59e0b' : task.status === 'done' ? '#22c55e' : 'var(--border)';

  return (
    <div
      className="rounded-xl border p-4 space-y-3 transition-shadow hover:shadow-sm"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)', borderLeft: `3px solid ${borderLeft}` }}
    >
      {/* Header row */}
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-snug" style={{ color: 'var(--text)' }}>{task.title}</p>
          {task.description && (
            <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{task.description}</p>
          )}
        </div>
        {/* Action buttons */}
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => onView(task)} title="View" className="p-1.5 rounded-lg hover:bg-[var(--surface-2)] transition-colors" style={{ color: 'var(--text-secondary)' }}>
            <Eye size={14} />
          </button>
          <button onClick={() => onEdit(task)} title="Edit" className="p-1.5 rounded-lg hover:bg-[var(--surface-2)] transition-colors" style={{ color: 'var(--text-secondary)' }}>
            <Pencil size={14} />
          </button>
          <button onClick={() => onDelete(task)} title="Delete" className="p-1.5 rounded-lg hover:bg-red-50 transition-colors text-red-500">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap gap-2 items-center text-xs" style={{ color: 'var(--text-secondary)' }}>
        {task.client && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: 'var(--surface-2)' }}>
            <User size={11} />{task.client.name}
          </span>
        )}
        {task.due_date && (
          <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${overdue ? 'text-red-500' : soon ? 'text-amber-500' : ''}`}
            style={{ background: overdue ? '#fef2f2' : soon ? '#fffbeb' : 'var(--surface-2)' }}>
            {overdue ? <AlertCircle size={11} /> : <Calendar size={11} />}
            {fmtDate(task.due_date)}
          </span>
        )}
        {assignee && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: 'var(--surface-2)' }}>
            <User size={11} />{assignee.name}
          </span>
        )}
        {creator && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: 'var(--surface-2)' }}>
            <Clock size={11} />by {creator.name}
          </span>
        )}
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: 'var(--surface-2)' }}>
          <Calendar size={11} />{fmtDate(task.created_at)}
        </span>
      </div>

      {/* Mentions */}
      {mentionedMembers.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <Users size={12} style={{ color: 'var(--text-secondary)' }} />
          {mentionedMembers.map(m => (
            <span key={m.id} className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'var(--accent-soft, #ede9fe)', color: 'var(--accent)' }}>
              @{m.name}
            </span>
          ))}
        </div>
      )}

      {/* Tags */}
      {task.tags && task.tags.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <Tag size={12} style={{ color: 'var(--text-secondary)' }} />
          {task.tags.map(tag => (
            <span key={tag} className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Footer: status + priority */}
      <div className="flex items-center gap-2 pt-1">
        <div className="relative">
          <button
            onClick={() => setStatusOpen(o => !o)}
            className="flex items-center gap-1 text-xs rounded-full px-2.5 py-0.5 font-medium"
            style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
          >
            {statusLabel(task.status, t)}
            <ChevronDown size={10} />
          </button>
          {statusOpen && (
            <div className="absolute top-full left-0 mt-1 z-10 rounded-xl border shadow-lg overflow-hidden min-w-[130px]"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
              {['todo', 'in_progress', 'review', 'done', 'delivered', 'overdue'].map(s => (
                <button
                  key={s}
                  onClick={() => { onStatusChange(task, s); setStatusOpen(false); }}
                  className="w-full text-left px-4 py-2 text-xs hover:bg-[var(--surface-2)] transition-colors"
                  style={{ color: 'var(--text)' }}
                >
                  {statusLabel(s, t)}
                </button>
              ))}
            </div>
          )}
        </div>
        <Badge variant={priorityVariant(task.priority)}>{t(task.priority)}</Badge>
      </div>
    </div>
  );
}

// ─── TaskDetailModal ─────────────────────────────────────────────────────────

function TaskDetailModal({ task, team, open, onClose, t }: { task: Task | null; team: TeamMember[]; open: boolean; onClose: () => void; t: (k: string) => string }) {
  if (!task) return null;
  const assignee = team.find(m => m.id === task.assigned_to);
  const creator = team.find(m => m.id === task.created_by);
  const mentionedMembers = (task.mentions ?? []).map(id => team.find(m => m.id === id)).filter(Boolean) as TeamMember[];
  const overdue = isOverdue(task.due_date, task.status);

  const row = (label: string, value: React.ReactNode) => (
    <div className="flex items-start gap-3 py-2 border-b last:border-b-0" style={{ borderColor: 'var(--border)' }}>
      <span className="text-xs font-medium w-28 shrink-0 pt-0.5" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span className="text-sm flex-1" style={{ color: 'var(--text)' }}>{value}</span>
    </div>
  );

  return (
    <Modal open={open} onClose={onClose} title={t('taskDetails')} size="lg">
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-bold" style={{ color: 'var(--text)' }}>{task.title}</h3>
          {task.description && (
            <p className="mt-2 text-sm whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>{task.description}</p>
          )}
        </div>
        <div className="rounded-xl border" style={{ borderColor: 'var(--border)' }}>
          {row(t('status'), <Badge variant={statusVariant(task.status)}>{statusLabel(task.status, t)}</Badge>)}
          {row(t('priority'), <Badge variant={priorityVariant(task.priority)}>{t(task.priority)}</Badge>)}
          {task.client && row(t('clients'), task.client.name)}
          {task.start_date && row(t('startDate'), fmtDate(task.start_date))}
          {task.due_date && row(t('deadline'),
            <span className={overdue ? 'text-red-500 font-medium' : ''}>{fmtDate(task.due_date)}{overdue ? ` (${t('overdue')})` : ''}</span>
          )}
          {assignee && row(t('assignedTo'), assignee.name)}
          {creator && row(t('createdBy'), creator.name)}
          {row(t('createdOn'), fmtDate(task.created_at))}
          {mentionedMembers.length > 0 && row(t('mentions'),
            <div className="flex flex-wrap gap-1">
              {mentionedMembers.map(m => (
                <span key={m.id} className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'var(--accent-soft, #ede9fe)', color: 'var(--accent)' }}>@{m.name}</span>
              ))}
            </div>
          )}
          {task.tags && task.tags.length > 0 && row(t('tags'),
            <div className="flex flex-wrap gap-1">
              {task.tags.map(tag => <span key={tag} className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>{tag}</span>)}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ─── KanbanBoard ─────────────────────────────────────────────────────────────

const KANBAN_COLS: { key: Task['status']; label: string }[] = [
  { key: 'todo',        label: 'todo'        },
  { key: 'in_progress', label: 'inProgress'  },
  { key: 'review',      label: 'review'      },
  { key: 'done',        label: 'done'        },
  { key: 'delivered',   label: 'delivered'   },
];

interface KanbanBoardProps {
  tasks: Task[];
  team: TeamMember[];
  onView: (t: Task) => void;
  onEdit: (t: Task) => void;
  onDelete: (t: Task) => void;
  onStatusChange: (t: Task, s: string) => void;
  t: (k: string) => string;
}

function KanbanBoard({ tasks, team, onView, onEdit, onDelete, onStatusChange, t }: KanbanBoardProps) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {KANBAN_COLS.map(col => {
        const colTasks = tasks.filter(task => task.status === col.key);
        return (
          <div
            key={col.key}
            className="flex-shrink-0 w-72 rounded-2xl border flex flex-col"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            {/* Column header */}
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
              <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{t(col.label)}</span>
              <span
                className="text-xs font-bold h-5 min-w-[1.25rem] px-1.5 rounded-full flex items-center justify-center"
                style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
              >
                {colTasks.length}
              </span>
            </div>
            {/* Cards */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 max-h-[calc(100vh-280px)]">
              {colTasks.length === 0 ? (
                <p className="text-xs text-center py-6" style={{ color: 'var(--text-secondary)' }}>{t('noTasksKanban')}</p>
              ) : (
                colTasks.map(task => {
                  const overdue = isOverdue(task.due_date, task.status);
                  const assignee = team.find(m => m.id === task.assigned_to);
                  return (
                    <div
                      key={task.id}
                      className="rounded-xl border p-3 space-y-2 transition-shadow hover:shadow-sm cursor-pointer"
                      style={{
                        background: 'var(--surface-2)',
                        borderColor: 'var(--border)',
                        borderLeft: `3px solid ${overdue ? '#ef4444' : 'var(--accent)'}`,
                      }}
                    >
                      <p className="text-sm font-semibold leading-snug" style={{ color: 'var(--text)' }}>{task.title}</p>
                      <div className="flex flex-wrap gap-1.5 items-center text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {task.client && (
                          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full" style={{ background: 'var(--surface)' }}>
                            <User size={10} />{task.client.name}
                          </span>
                        )}
                        {assignee && (
                          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full" style={{ background: 'var(--surface)' }}>
                            <User size={10} />{assignee.name}
                          </span>
                        )}
                        {task.due_date && (
                          <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full ${overdue ? 'text-red-500' : ''}`}
                            style={{ background: overdue ? '#fef2f2' : 'var(--surface)' }}>
                            <Calendar size={10} />{fmtDate(task.due_date)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant={priorityVariant(task.priority)}>{t(task.priority)}</Badge>
                        <div className="flex items-center gap-1">
                          <button onClick={() => onView(task)} className="p-1 rounded hover:bg-[var(--surface)] transition-colors" style={{ color: 'var(--text-secondary)' }}><Eye size={13} /></button>
                          <button onClick={() => onEdit(task)} className="p-1 rounded hover:bg-[var(--surface)] transition-colors" style={{ color: 'var(--text-secondary)' }}><Pencil size={13} /></button>
                          <button onClick={() => onDelete(task)} className="p-1 rounded hover:bg-red-50 text-red-500 transition-colors"><Trash2 size={13} /></button>
                        </div>
                      </div>
                      {/* Quick status change */}
                      <select
                        value={task.status}
                        onChange={e => onStatusChange(task, e.target.value)}
                        className="w-full h-7 px-2 rounded-lg text-xs outline-none"
                        style={{ background: 'var(--surface)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                        onClick={e => e.stopPropagation()}
                      >
                        {['todo', 'in_progress', 'review', 'done', 'delivered', 'overdue'].map(s => (
                          <option key={s} value={s}>{statusLabel(s, t)}</option>
                        ))}
                      </select>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── DeleteConfirmModal ──────────────────────────────────────────────────────

function DeleteConfirmModal({ task, open, onClose, onConfirm, error, t }: { task: Task | null; open: boolean; onClose: () => void; onConfirm: () => void; error: string | null; t: (k: string) => string }) {
  return (
    <Modal open={open} onClose={onClose} title={t('deleteTask')} size="sm">
      <div className="space-y-4">
        <p className="text-sm" style={{ color: 'var(--text)' }}>{t('confirmDeleteTask')}</p>
        {task && <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>&ldquo;{task.title}&rdquo;</p>}
        {error && (
          <div className="flex items-start gap-2 rounded-lg px-3 py-2 text-sm" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444' }}>
            <AlertCircle size={15} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="h-9 px-4 rounded-lg text-sm font-medium" style={{ background: 'var(--surface-2)', color: 'var(--text)' }}>
            {t('cancel')}
          </button>
          <button type="button" onClick={onConfirm} className="h-9 px-4 rounded-lg text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition-colors">
            {t('deleteTask')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

const FETCH_TIMEOUT_MS    = 15_000;
const MUTATION_TIMEOUT_MS = 15_000;

// Accent-soft fallback color for filter active states (matches --accent-soft CSS var)
const ACCENT_SOFT = 'var(--accent-soft, #ede9fe)';

// ─── FilterSelect ─────────────────────────────────────────────────────────────
// Styled chip-like select wrapper used for the dropdown filter controls.

interface FilterSelectProps {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}

function FilterSelect({ value, onChange, children }: FilterSelectProps) {
  const isActive = !!value;
  return (
    <div className="relative inline-flex items-center">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="h-8 pl-3 pr-7 rounded-full text-xs appearance-none outline-none cursor-pointer transition-all"
        style={{
          background: isActive ? ACCENT_SOFT : 'var(--surface)',
          color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
          border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
        }}
      >
        {children}
      </select>
      <ChevronDown
        size={12}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
        style={{ color: isActive ? 'var(--accent)' : 'var(--text-secondary)' }}
      />
    </div>
  );
}


export default function TasksPage() {
  const { t } = useLang();
  const { role } = useAuth();
  const { toast } = useToast();
  const canManageTasks = role === 'admin' || role === 'manager' || role === 'team';
  const [tasks, setTasks] = useState<Task[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Modals
  const [createOpen, setCreateOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [viewTask, setViewTask] = useState<Task | null>(null);
  const [deleteTask, setDeleteTask] = useState<Task | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [clientFilter, setClientFilter] = useState('');
  const [assignedFilter, setAssignedFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [view, setView] = useState<'list' | 'kanban'>('list');

  // Forms
  const [createForm, setCreateForm] = useState({ ...blankForm });
  const [editForm, setEditForm] = useState({ ...blankForm });

  // ── Fire-and-forget activity logger ─────────────────────────────────────
  // Note: activity logging for create/edit/delete is handled server-side in
  // the API routes. This helper is kept for any future client-side use.


  // ── fetch ────────────────────────────────────────────────────────────────
  // silent=true → background refresh after mutations; no loading spinner,
  // no error banner, and existing data is NOT cleared on failure.
  // Returns true if tasks were fetched successfully (used to detect refresh failures).
  const fetchAll = useCallback(async (silent = false): Promise<boolean> => {
    if (!silent) {
      setLoading(true);
      setFetchError(null);
    }
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      const dataPromise = Promise.allSettled([
        supabase.from('tasks').select('*, client:clients(id,name)').order('created_at', { ascending: false }).limit(200),
        supabase.from('clients').select('id,name').order('name'),
        supabase.from('team_members').select('*').order('name'),
      ]);

      const settled = silent
        ? await dataPromise
        : await Promise.race([
            dataPromise,
            new Promise<never>((_, reject) => {
              timeoutId = setTimeout(() => reject(new Error('TIMEOUT')), FETCH_TIMEOUT_MS);
            }),
          ]);

      const [tasksRes, clientsRes, teamRes] = settled;

      let tasksOk = false;
      if (tasksRes.status === 'fulfilled' && !tasksRes.value.error) {
        setTasks((tasksRes.value.data ?? []) as Task[]);
        tasksOk = true;
      } else {
        console.error('[tasks] tasks fetch error:', tasksRes.status === 'rejected' ? tasksRes.reason : tasksRes.value.error);
        if (!silent) setTasks([]);
      }
      if (clientsRes.status === 'fulfilled' && !clientsRes.value.error) {
        setClients((clientsRes.value.data ?? []) as Client[]);
      } else {
        console.error('[tasks] clients fetch error:', clientsRes.status === 'rejected' ? clientsRes.reason : clientsRes.value.error);
        if (!silent) setClients([]);
      }
      if (teamRes.status === 'fulfilled' && !teamRes.value.error) {
        setTeam((teamRes.value.data ?? []) as TeamMember[]);
      } else {
        console.error('[tasks] team fetch error:', teamRes.status === 'rejected' ? teamRes.reason : teamRes.value.error);
        if (!silent) setTeam([]);
      }
      return tasksOk;
    } catch (err) {
      if (!silent) {
        const isTimeout = err instanceof Error && err.message === 'TIMEOUT';
        const msg = isTimeout
          ? 'Tasks data took too long to load. Please refresh the page.'
          : 'Failed to load tasks. Please try again.';
        console.error('[tasks] fetchAll error:', err);
        setFetchError(msg);
        setTasks([]);
        setClients([]);
        setTeam([]);
      } else {
        console.warn('[tasks] silent refresh failed (ignored):', err);
      }
      return false;
    } finally {
      clearTimeout(timeoutId);
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── filtered tasks ───────────────────────────────────────────────────────
  const filtered = tasks.filter(task => {
    if (statusFilter !== 'all' && task.status !== statusFilter) return false;
    if (clientFilter && task.client_id !== clientFilter) return false;
    if (assignedFilter && task.assigned_to !== assignedFilter) return false;
    if (priorityFilter && task.priority !== priorityFilter) return false;
    if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  // ── create ───────────────────────────────────────────────────────────────
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    if (!canManageTasks) { setCreateError('Only admin or team members can create tasks.'); return; }
    if (!createForm.title.trim()) return;
    if (!createForm.client_id) { setCreateError(t('pleaseSelectClient')); return; }
    if (!createForm.assigned_to) { setCreateError(t('pleaseAssignMember')); return; }
    if (!createForm.due_date) { setCreateError(t('pleaseSetDueDate')); return; }
    setSaving(true);

    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    try {
      const payload = {
        title:       createForm.title.trim(),
        description: createForm.description || null,
        status:      createForm.status,
        priority:    createForm.priority,
        start_date:  createForm.start_date || null,
        due_date:    createForm.due_date,
        client_id:   createForm.client_id,
        assigned_to: createForm.assigned_to,
        created_by:  createForm.created_by || null,
        mentions:    Array.isArray(createForm.mentions) ? createForm.mentions : [],
        tags:        parseTags(createForm.tags),
      };

      console.log('[task create] form submit started', { title: payload.title });
      console.log('[task create] request payload:', JSON.stringify(payload));

      const fetchWithTimeout = new Promise<Response>((resolve, reject) => {
        timeoutHandle = setTimeout(
          () => reject(new Error('Request timed out. Please try again.')),
          MUTATION_TIMEOUT_MS,
        );
        fetch('/api/tasks', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(payload),
        }).then(resolve, reject);
      });

      const res = await fetchWithTimeout;
      clearTimeout(timeoutHandle); // Clear as soon as the fetch resolves
      let result: { success: boolean; task?: { id?: string; title?: string }; step?: string; error?: string };
      try {
        result = await res.json() as typeof result;
      } catch {
        throw new Error(`Server returned status ${res.status} with non-JSON body`);
      }

      console.log('[task create] API response:', JSON.stringify(result));

      if (!result.success) {
        const step = result.step ? ` [${result.step}]` : '';
        const msg  = result.error ?? 'Failed to create task';
        throw new Error(`${msg}${step}`);
      }

      console.log('[task create] insert success, id:', result.task?.id);

      // — SUCCESS PATH —
      setCreateOpen(false);
      setCreateForm({ ...blankForm });
      toast(`Task "${createForm.title}" created successfully.`, 'success');

      // Refresh list non-blocking — warn if it fails
      console.log('[task create] triggering list refetch');
      void fetchAll(true).then(ok => {
        console.log('[task create] list refetch result, ok:', ok);
        if (!ok) {
          toast('Task was created but the list failed to refresh. Please reload the page.', 'warning', 6000);
        }
      }).catch((err: unknown) => {
        console.warn('[task create] list refetch threw unexpectedly:', err);
      });
    } catch (err: unknown) {
      console.error('[task create] error:', err);
      const message = err instanceof Error
        ? err.message
        : (err as { message?: string })?.message ?? 'Failed to create task';
      setCreateError(message);
    } finally {
      clearTimeout(timeoutHandle);
      setSaving(false);
    }
  };

  // ── edit ─────────────────────────────────────────────────────────────────
  const openEdit = (task: Task) => {
    setEditForm({
      title: task.title,
      description: task.description ?? '',
      status: task.status,
      priority: task.priority,
      start_date: task.start_date ?? '',
      due_date: task.due_date ?? '',
      client_id: task.client_id ?? '',
      assigned_to: task.assigned_to ?? '',
      created_by: task.created_by ?? '',
      mentions: task.mentions ?? [],
      tags: (task.tags ?? []).join(', '),
    });
    setEditTask(task);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTask) return;
    setSaving(true);
    setEditError(null);

    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    try {
      const payload = {
        title:       editForm.title.trim(),
        description: editForm.description || null,
        status:      editForm.status,
        priority:    editForm.priority,
        start_date:  editForm.start_date || null,
        due_date:    editForm.due_date || null,
        client_id:   editForm.client_id || null,
        assigned_to: editForm.assigned_to || null,
        created_by:  editForm.created_by || null,
        mentions:    Array.isArray(editForm.mentions) ? editForm.mentions : [],
        tags:        parseTags(editForm.tags),
      };

      console.log('[task edit] submit — id:', editTask.id, '| payload:', JSON.stringify(payload));

      const fetchWithTimeout = new Promise<Response>((resolve, reject) => {
        timeoutHandle = setTimeout(
          () => reject(new Error('Request timed out. Please try again.')),
          MUTATION_TIMEOUT_MS,
        );
        fetch(`/api/tasks/${editTask.id}`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(payload),
        }).then(resolve, reject);
      });

      const res = await fetchWithTimeout;
      clearTimeout(timeoutHandle); // Clear as soon as the fetch resolves
      let result: { success: boolean; task?: Task; step?: string; error?: string };
      try {
        result = await res.json() as typeof result;
      } catch {
        throw new Error(`Server returned status ${res.status} with non-JSON body`);
      }

      console.log('[task edit] API response:', JSON.stringify(result));

      if (!result.success) {
        const step = result.step ? ` [${result.step}]` : '';
        const msg  = result.error ?? 'Failed to update task';
        throw new Error(`${msg}${step}`);
      }

      console.log('[task edit] update success — id:', result.task?.id);

      // Update local state immediately with the returned task so the list
      // reflects the change without waiting for a round-trip fetch.
      if (result.task) {
        setTasks(prev => prev.map(tk => tk.id === editTask.id ? (result.task ?? tk) : tk));
      }

      setEditTask(null);
      toast(`Task "${editForm.title}" updated successfully.`, 'success');

      // Background refresh
      void fetchAll(true).then(ok => {
        if (!ok) {
          toast('Task was updated but the list failed to refresh. Please reload the page.', 'warning', 6000);
        }
      }).catch((err: unknown) => {
        console.warn('[task edit] list refetch threw unexpectedly:', err);
      });
    } catch (err: unknown) {
      console.error('[task edit] error:', err);
      const message = err instanceof Error
        ? err.message
        : (err as { message?: string })?.message ?? 'Failed to update task';
      setEditError(message);
    } finally {
      clearTimeout(timeoutHandle);
      setSaving(false);
    }
  };

  // ── delete ────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTask) return;
    setDeleteError(null);

    console.log('[task delete] submit — id:', deleteTask.id, '| title:', deleteTask.title);

    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    try {
      const fetchWithTimeout = new Promise<Response>((resolve, reject) => {
        timeoutHandle = setTimeout(
          () => reject(new Error('Request timed out. Please try again.')),
          MUTATION_TIMEOUT_MS,
        );
        fetch(`/api/tasks/${deleteTask.id}`, {
          method: 'DELETE',
        }).then(resolve, reject);
      });

      const res = await fetchWithTimeout;
      clearTimeout(timeoutHandle); // Clear as soon as the fetch resolves
      let result: { success: boolean; step?: string; error?: string };
      try {
        result = await res.json() as typeof result;
      } catch {
        throw new Error(`Server returned status ${res.status} with non-JSON body`);
      }

      console.log('[task delete] API response:', JSON.stringify(result));

      if (!result.success) {
        const step = result.step ? ` [${result.step}]` : '';
        const msg  = result.error ?? 'Failed to delete task';
        throw new Error(`${msg}${step}`);
      }

      console.log('[task delete] delete success — id:', deleteTask.id);

      // Remove from local state immediately
      const deletedTitle = deleteTask.title;
      setTasks(prev => prev.filter(t => t.id !== deleteTask.id));
      setDeleteTask(null);
      toast(`Task "${deletedTitle}" deleted.`, 'success');
    } catch (err: unknown) {
      console.error('[task delete] error:', err);
      const message = err instanceof Error
        ? err.message
        : (err as { message?: string })?.message ?? 'Failed to delete task';
      setDeleteError(message);
    } finally {
      clearTimeout(timeoutHandle);
    }
  };

  // ── status change ─────────────────────────────────────────────────────────
  const handleStatusChange = async (task: Task, newStatus: string) => {
    // Optimistically update local state first for instant UI feedback
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus as Task['status'] } : t));

    console.log('[task status] change — id:', task.id, '| from:', task.status, '| to:', newStatus);

    // Helper to revert the optimistic update on any failure.
    const revertStatus = () =>
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: task.status } : t));

    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status: newStatus }),
      });
      const result = await res.json() as { success: boolean; error?: string };
      if (!result.success) {
        console.error('[task status] update failed:', result.error);
        revertStatus();
        toast(`Failed to update status: ${result.error ?? 'Unknown error'}`, 'warning');
      } else {
        console.log('[task status] update success — id:', task.id);
      }
    } catch (err) {
      console.error('[task status] network error:', err);
      revertStatus();
      toast('Failed to update task status. Please try again.', 'warning');
    }
  };

  const statuses = ['all', 'todo', 'in_progress', 'review', 'done', 'delivered', 'overdue'];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Fetch error banner */}
      {fetchError && (
        <div
          className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm"
          style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}
        >
          <AlertCircle size={16} className="shrink-0" />
          <span>{fetchError}</span>
        </div>
      )}
      {/* Page header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{t('tasks')}</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {filtered.length} task{filtered.length !== 1 ? 's' : ''} across all clients
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View switcher */}
          <div className="flex items-center rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
            <button
              onClick={() => setView('list')}
              className="flex items-center gap-1.5 h-9 px-3 text-xs font-medium transition-colors"
              style={{
                background: view === 'list' ? 'var(--accent)' : 'var(--surface)',
                color: view === 'list' ? '#fff' : 'var(--text-secondary)',
              }}
            >
              <List size={14} />{t('list')}
            </button>
            <button
              onClick={() => setView('kanban')}
              className="flex items-center gap-1.5 h-9 px-3 text-xs font-medium transition-colors"
              style={{
                background: view === 'kanban' ? 'var(--accent)' : 'var(--surface)',
                color: view === 'kanban' ? '#fff' : 'var(--text-secondary)',
              }}
            >
              <LayoutGrid size={14} />{t('kanban')}
            </button>
          </div>
          {canManageTasks && (
            <button
              onClick={() => setCreateOpen(true)}
              className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium text-white hover:opacity-90 transition-opacity"
              style={{ background: 'var(--accent)' }}
            >
              <Plus size={16} />{t('newTask')}
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-secondary)' }} />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder={t('searchTasks')}
          className="w-full h-9 pl-9 pr-3 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]"
          style={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)' }}
        />
      </div>

      {/* Status chips */}
      <div className="flex gap-2 flex-wrap items-center">
        {statuses.map(s => {
          const isActive = statusFilter === s;
          const count = s !== 'all' ? tasks.filter(tk => tk.status === s).length : null;
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full text-xs font-medium transition-all"
              style={{
                background: isActive ? 'var(--accent)' : 'var(--surface)',
                color: isActive ? '#fff' : 'var(--text-secondary)',
                border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
                boxShadow: isActive ? '0 1px 4px rgba(0,0,0,0.15)' : 'none',
              }}
            >
              {s === 'all' ? 'All' : statusLabel(s, t)}
              {count !== null && (
                <span
                  className="inline-flex items-center justify-center h-4 min-w-[1rem] px-1 rounded-full text-[10px] font-bold"
                  style={{
                    background: isActive ? 'rgba(255,255,255,0.25)' : 'var(--surface-2)',
                    color: isActive ? '#fff' : 'var(--text-secondary)',
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Dropdown filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <FilterSelect value={clientFilter} onChange={setClientFilter}>
          <option value="">{t('allClients')}</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </FilterSelect>
        <FilterSelect value={assignedFilter} onChange={setAssignedFilter}>
          <option value="">{t('allMembers')}</option>
          {team.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </FilterSelect>
        <FilterSelect value={priorityFilter} onChange={setPriorityFilter}>
          <option value="">{t('allPriorities')}</option>
          <option value="high">{t('high')}</option>
          <option value="medium">{t('medium')}</option>
          <option value="low">{t('low')}</option>
        </FilterSelect>
        {(clientFilter || assignedFilter || priorityFilter || searchQuery) && (
          <button
            onClick={() => { setClientFilter(''); setAssignedFilter(''); setPriorityFilter(''); setSearchQuery(''); }}
            className="inline-flex items-center h-8 px-3.5 rounded-full text-xs font-medium transition-all"
            style={{ background: 'transparent', color: 'var(--accent)', border: '1px solid var(--accent)' }}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Task list / kanban */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-40 rounded-xl animate-pulse" style={{ background: 'var(--surface)' }} />
          ))}
        </div>
      ) : fetchError ? null : filtered.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title={t('noTasksYet')}
          description={t('noTasksDesc')}
          action={
            canManageTasks ? (
              <button onClick={() => setCreateOpen(true)} className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium text-white" style={{ background: 'var(--accent)' }}>
                <Plus size={16} />{t('newTask')}
              </button>
            ) : undefined
          }
        />
      ) : view === 'kanban' ? (
        <KanbanBoard
          tasks={filtered}
          team={team}
          onView={setViewTask}
          onEdit={openEdit}
          onDelete={setDeleteTask}
          onStatusChange={handleStatusChange}
          t={t}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              team={team}
              onView={setViewTask}
              onEdit={openEdit}
              onDelete={setDeleteTask}
              onStatusChange={handleStatusChange}
              t={t}
            />
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal open={createOpen} onClose={() => { setCreateOpen(false); setCreateError(null); }} title={t('newTask')} size="lg">
        <form onSubmit={handleCreate}>
          {createError && (
            <div className="mb-4 flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444' }}>
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <span>{createError}</span>
            </div>
          )}
          <TaskForm form={createForm} setForm={setCreateForm} clients={clients} team={team} saving={saving} onCancel={() => { setCreateOpen(false); setCreateError(null); }} t={t} />
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!editTask} onClose={() => { setEditTask(null); setEditError(null); }} title={t('editTask')} size="lg">
        <form onSubmit={handleEdit}>
          {editError && (
            <div className="mb-4 flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444' }}>
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <span>{editError}</span>
            </div>
          )}
          <TaskForm form={editForm} setForm={setEditForm} clients={clients} team={team} saving={saving} onCancel={() => { setEditTask(null); setEditError(null); }} t={t} />
        </form>
      </Modal>

      {/* Detail Modal */}
      <TaskDetailModal task={viewTask} team={team} open={!!viewTask} onClose={() => setViewTask(null)} t={t} />

      {/* Delete Modal */}
      <DeleteConfirmModal task={deleteTask} open={!!deleteTask} onClose={() => { setDeleteTask(null); setDeleteError(null); }} onConfirm={handleDelete} error={deleteError} t={t} />
    </div>
  );
}


