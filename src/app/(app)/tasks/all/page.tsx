'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Plus, CheckSquare, ChevronDown, Pencil, Trash2, Eye,
  Calendar, User, Users, Tag, AlertCircle, Clock,
  LayoutGrid, List, Search, Send, Filter, ArrowUpDown, GripVertical,
} from 'lucide-react';
import supabase from '@/lib/supabase';
import { useLang } from '@/lib/lang-context';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import EmptyState from '@/components/ui/EmptyState';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import AiImproveButton from '@/components/ui/AiImproveButton';
import SelectDropdown from '@/components/ui/SelectDropdown';
import { PLATFORMS, POST_TYPES, getPlatformDisplayColor } from '@/components/publishing/SchedulePublishingModal';
import type { Task, Client, TeamMember, Project } from '@/lib/types';

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
  if (!due_date || ['done', 'completed', 'delivered', 'published', 'cancelled'].includes(status ?? '')) return false;
  return new Date(due_date) < todayMidnight();
}

function isDueSoon(due_date?: string, status?: string) {
  if (!due_date || ['done', 'completed', 'delivered', 'published', 'cancelled'].includes(status ?? '')) return false;
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
const frostedPanelStyle = {
  background: 'color-mix(in srgb, var(--surface) 90%, transparent)',
  border: '1px solid var(--border)',
  backdropFilter: 'blur(16px) saturate(140%)',
  WebkitBackdropFilter: 'blur(16px) saturate(140%)',
};
const glassInputStyle = { background: 'color-mix(in srgb, var(--surface-2) 92%, transparent)', color: 'var(--text)', border: '1px solid var(--border)' };

function statusLabel(s: string, t: (k: string) => string): string {
  if (s === 'in_progress') return t('inProgress');
  if (s === 'in_review' || s === 'review') return t('review');
  if (s === 'delivered')   return t('delivered');
  return t(s);
}

const statusTone: Record<string, { bg: string; text: string; border: string; glow: string }> = {
  todo: { bg: 'rgba(99,102,241,0.12)', text: '#4f46e5', border: 'rgba(99,102,241,0.22)', glow: 'rgba(99,102,241,0.24)' },
  in_progress: { bg: 'var(--color-info-bg)', text: 'var(--color-info)', border: 'var(--color-info-border)', glow: 'rgba(59,130,246,0.22)' },
  in_review: { bg: 'var(--color-warning-bg)', text: 'var(--color-warning)', border: 'var(--color-warning-border)', glow: 'rgba(245,158,11,0.24)' },
  review: { bg: 'var(--color-warning-bg)', text: 'var(--color-warning)', border: 'var(--color-warning-border)', glow: 'rgba(245,158,11,0.24)' },
  done: { bg: 'var(--color-success-bg)', text: 'var(--color-success)', border: 'var(--color-success-border)', glow: 'rgba(16,185,129,0.24)' },
  delivered: { bg: 'rgba(20,184,166,0.12)', text: '#0f766e', border: 'rgba(20,184,166,0.28)', glow: 'rgba(20,184,166,0.24)' },
  overdue: { bg: 'var(--color-danger-bg)', text: 'var(--color-danger)', border: 'var(--color-danger-border)', glow: 'rgba(239,68,68,0.24)' },
  default: { bg: 'var(--surface-2)', text: 'var(--text-secondary)', border: 'var(--border)', glow: 'rgba(86,116,167,0.2)' },
};

function getStatusTone(status: string) {
  return statusTone[status] ?? statusTone.default;
}

// ─── blank form ─────────────────────────────────────────────────────────────

const blankForm = {
  title: '', description: '', status: 'todo', priority: 'medium',
  start_date: '', due_date: '', client_id: '', project_id: '', assigned_to: '', created_by: '',
  mentions: [] as string[], tags: '',
};

// ─── TaskForm ────────────────────────────────────────────────────────────────

interface TaskFormProps {
  form: typeof blankForm;
  setForm: React.Dispatch<React.SetStateAction<typeof blankForm>>;
  clients: Client[];
  projects: Project[];
  team: TeamMember[];
  saving: boolean;
  onCancel: () => void;
  t: (k: string) => string;
}

function TaskForm({ form, setForm, clients, projects, team, saving, onCancel, t }: TaskFormProps) {
  const projectOptions = useMemo(
    () => projects.filter(p => Boolean(form.client_id) && p.client_id === form.client_id),
    [projects, form.client_id],
  );

  const toggleMention = (id: string) => {
    setForm(f => ({
      ...f,
      mentions: f.mentions.includes(id) ? f.mentions.filter(m => m !== id) : [...f.mentions, id],
    }));
  };

  return (
    <div className="space-y-4">
      <section className="openy-form-section space-y-3">
        <div className="flex items-center justify-between gap-3 mb-1">
          <label className="openy-label">{t('title')} *</label>
          <AiImproveButton value={form.title} onImproved={v => setForm(f => ({ ...f, title: v }))} />
        </div>
        <input
          required
          value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          className={inputCls}
          style={glassInputStyle}
          placeholder="Task title"
        />
        <div className="flex items-center justify-between gap-3 mb-1">
          <label className="openy-label">{t('description')}</label>
          <AiImproveButton value={form.description} onImproved={v => setForm(f => ({ ...f, description: v }))} showMenu />
        </div>
        <textarea
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          rows={4}
          className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none focus:ring-2 focus:ring-[var(--accent)]"
          style={glassInputStyle}
          placeholder="Detailed description..."
        />
      </section>

      <section className="openy-form-section space-y-3">
        <p className="openy-label">Task setup</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>{t('clients')} *</label>
            <SelectDropdown
              fullWidth
              value={form.client_id}
              onChange={v => setForm(f => ({ ...f, client_id: v }))}
              placeholder={t('none')}
              options={[
                { value: '', label: t('none') },
                ...clients.map(c => ({ value: c.id, label: c.name })),
              ]}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>Project</label>
            <SelectDropdown
              fullWidth
              value={form.project_id}
              onChange={v => setForm(f => ({ ...f, project_id: v }))}
              placeholder={t('none')}
              options={[
                { value: '', label: t('none') },
                ...projectOptions.map(p => ({ value: p.id, label: p.name })),
              ]}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>{t('startDate')}</label>
            <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} className={inputCls} style={glassInputStyle} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>{t('deadline')} *</label>
            <input required type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} className={inputCls} style={glassInputStyle} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>{t('priority')}</label>
            <SelectDropdown
              fullWidth
              value={form.priority}
              onChange={v => setForm(f => ({ ...f, priority: v }))}
              options={[
                { value: 'low', label: t('low') },
                { value: 'medium', label: t('medium') },
                { value: 'high', label: t('high') },
              ]}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>{t('status')}</label>
            <SelectDropdown
              fullWidth
              value={form.status}
              onChange={v => setForm(f => ({ ...f, status: v }))}
              options={[
                { value: 'todo', label: t('todo') },
                { value: 'in_progress', label: t('inProgress') },
                { value: 'in_review', label: t('review') },
                { value: 'done', label: t('done') },
                { value: 'delivered', label: t('delivered') },
                { value: 'overdue', label: t('overdue') },
              ]}
            />
          </div>
        </div>
      </section>

      <section className="openy-form-section space-y-3">
        <p className="openy-label">Ownership</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>{t('assignedTo')} *</label>
            <SelectDropdown
              fullWidth
              value={form.assigned_to}
              onChange={v => setForm(f => ({ ...f, assigned_to: v }))}
              placeholder={t('unassigned')}
              options={[
                { value: '', label: t('unassigned') },
                ...team.map(m => ({ value: m.id, label: m.full_name })),
              ]}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>{t('createdBy')}</label>
            <SelectDropdown
              fullWidth
              value={form.created_by}
              onChange={v => setForm(f => ({ ...f, created_by: v }))}
              placeholder={t('none')}
              options={[
                { value: '', label: t('none') },
                ...team.map(m => ({ value: m.id, label: m.full_name })),
              ]}
            />
          </div>
        </div>

        {team.length > 0 && (
          <div className="space-y-1">
            <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>{t('mentions')}</label>
            <div className="flex flex-wrap gap-2 p-2 rounded-lg" style={glassInputStyle}>
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
                      border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
                    }}
                  >
                    @{m.full_name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="space-y-1">
          <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>{t('tags')}</label>
          <input
            value={form.tags}
            onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
            className={inputCls}
            style={glassInputStyle}
            placeholder="design, urgent, review"
          />
        </div>
      </section>

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} className="btn-secondary h-10 px-4 text-sm">
          {t('cancel')}
        </button>
        <button type="submit" disabled={saving} className="btn-primary h-10 px-4 text-sm">
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
  const mentionedMembers = (task.mentions ?? []).map(id => team.find(m => m.id === id)).filter(Boolean) as TeamMember[];
  const tone = getStatusTone(overdue ? 'overdue' : task.status);
  const projectLabel = task.client?.name ?? (task.project_id ? 'Project linked' : null);

  return (
    <div
      className="rounded-2xl border p-4 md:p-4.5 space-y-3 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-xl"
      style={{
        ...frostedPanelStyle,
        borderColor: tone.border,
        boxShadow: `0 8px 22px color-mix(in srgb, ${tone.glow} 35%, transparent)`,
      }}
    >
      <div className="flex items-start gap-2.5">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-snug" style={{ color: 'var(--text)' }}>{task.title}</p>
          {task.description && (
            <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{task.description}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => onView(task)} title="View" className="btn-ghost p-1.5 rounded-lg" style={{ color: 'var(--text-secondary)' }}>
            <Eye size={14} />
          </button>
          <button onClick={() => onEdit(task)} title="Edit" className="btn-ghost p-1.5 rounded-lg" style={{ color: 'var(--text-secondary)' }}>
            <Pencil size={14} />
          </button>
          <button onClick={() => onDelete(task)} title="Delete" className="btn-ghost p-1.5 rounded-lg text-red-500 hover:bg-red-500/10">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center text-xs" style={{ color: 'var(--text-secondary)' }}>
        {projectLabel && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full border" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
            <User size={11} />{projectLabel}
          </span>
        )}
        {task.due_date && (
          <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full border ${overdue ? 'text-red-500' : soon ? 'text-amber-500' : ''}`}
            style={{ background: overdue ? 'var(--color-danger-bg)' : soon ? 'var(--color-warning-bg)' : 'var(--surface-2)', borderColor: overdue ? 'var(--color-danger-border)' : soon ? 'var(--color-warning-border)' : 'var(--border)' }}>
            {overdue ? <AlertCircle size={11} /> : <Calendar size={11} />}
            {fmtDate(task.due_date)}
          </span>
        )}
        {assignee && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full border" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
            <User size={11} />{assignee.full_name}
          </span>
        )}
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full border" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
          <Calendar size={11} />{fmtDate(task.created_at)}
        </span>
      </div>

      {((task.platforms && task.platforms.length > 0) || (task.post_types && task.post_types.length > 0)) && (
        <div className="flex flex-wrap gap-1.5 items-center rounded-xl p-2 border" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
          <Send size={11} style={{ color: '#7c3aed' }} />
          {(task.platforms ?? []).map(p => {
            const pl = PLATFORMS.find(x => x.value === p);
            return (
              <span key={p} className="text-[10px] px-1.5 py-0.5 rounded font-medium text-white" style={{ background: getPlatformDisplayColor(p) }}>
                {pl ? pl.label : p}
              </span>
            );
          })}
          {(task.post_types ?? []).map(pt => {
            const typ = POST_TYPES.find(x => x.value === pt);
            return (
              <span key={pt} className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: 'rgba(99,102,241,0.12)', color: 'var(--accent)' }}>
                {typ ? typ.label : pt}
              </span>
            );
          })}
        </div>
      )}

      {mentionedMembers.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <Users size={12} style={{ color: 'var(--text-secondary)' }} />
          {mentionedMembers.map(m => (
            <span key={m.id} className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'var(--accent-soft, #ede9fe)', color: 'var(--accent)' }}>
              @{m.full_name}
            </span>
          ))}
        </div>
      )}

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

      <div className="flex items-center gap-2 pt-1 flex-wrap">
        <div className="relative">
          <button
            onClick={() => setStatusOpen(o => !o)}
            className="flex items-center gap-1 text-xs rounded-full px-2.5 py-1 font-semibold"
            style={{ background: tone.bg, color: tone.text, border: `1px solid ${tone.border}` }}
          >
            {statusLabel(task.status, t)}
            <ChevronDown size={10} />
          </button>
          {statusOpen && (
            <div className="absolute top-full left-0 mt-1 z-10 rounded-xl border shadow-lg overflow-hidden min-w-[130px]"
              style={{ background: 'var(--menu-bg)', borderColor: 'var(--menu-border)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
              {['todo', 'in_progress', 'in_review', 'done', 'delivered', 'overdue'].map(s => (
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
        <Badge variant={priorityVariant(task.priority)}>{task.priority === 'high' ? `${t('high')} ↑` : t(task.priority)}</Badge>
        {overdue && <Badge variant="danger">{t('overdue')}</Badge>}
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
  const tone = getStatusTone(overdue ? 'overdue' : task.status);

  const row = (label: string, value: React.ReactNode) => (
    <div className="flex items-start gap-3 py-2 border-b last:border-b-0" style={{ borderColor: 'var(--border)' }}>
      <span className="text-xs font-medium w-28 shrink-0 pt-0.5" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span className="text-sm flex-1" style={{ color: 'var(--text)' }}>{value}</span>
    </div>
  );

  return (
    <Modal open={open} onClose={onClose} title={t('taskDetails')} size="lg">
      <div className="space-y-4">
        <div className="space-y-2">
          <h3 className="text-lg font-bold" style={{ color: 'var(--text)' }}>{task.title}</h3>
          {task.description && (
            <p className="mt-2 text-sm whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>{task.description}</p>
          )}
          <div className="flex flex-wrap gap-2">
            <span className="text-xs px-2.5 py-1 rounded-full border font-semibold" style={{ background: tone.bg, color: tone.text, borderColor: tone.border }}>
              {statusLabel(overdue ? 'overdue' : task.status, t)}
            </span>
            <Badge variant={priorityVariant(task.priority)}>{t(task.priority)}</Badge>
          </div>
        </div>
        <div className="openy-form-section">
          {row(t('status'), <span className="text-xs px-2.5 py-1 rounded-full border font-semibold inline-flex" style={{ background: tone.bg, color: tone.text, borderColor: tone.border }}>{statusLabel(overdue ? 'overdue' : task.status, t)}</span>)}
          {row(t('priority'), <Badge variant={priorityVariant(task.priority)}>{t(task.priority)}</Badge>)}
          {task.client && row(t('clients'), task.client.name)}
          {task.start_date && row(t('startDate'), fmtDate(task.start_date))}
          {task.due_date && row(t('deadline'),
            <span className={overdue ? 'text-red-500 font-medium' : ''}>{fmtDate(task.due_date)}{overdue ? ` (${t('overdue')})` : ''}</span>
          )}
          {assignee && row(t('assignedTo'), assignee.full_name)}
          {creator && row(t('createdBy'), creator.full_name)}
          {row(t('createdOn'), fmtDate(task.created_at))}
          {mentionedMembers.length > 0 && row(t('mentions'),
            <div className="flex flex-wrap gap-1">
              {mentionedMembers.map(m => (
                <span key={m.id} className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'var(--accent-soft, #ede9fe)', color: 'var(--accent)' }}>@{m.full_name}</span>
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

type KanbanColumnId = 'todo' | 'in_progress' | 'in_review' | 'done' | 'delivered' | 'overdue';

const KANBAN_COLS: { key: KanbanColumnId; label: string }[] = [
  { key: 'todo', label: 'todo' },
  { key: 'in_progress', label: 'inProgress' },
  { key: 'in_review', label: 'review' },
  { key: 'done', label: 'done' },
  { key: 'delivered', label: 'delivered' },
  { key: 'overdue', label: 'overdue' },
];

const KANBAN_STATUS_MAP: Record<KanbanColumnId, Task['status'][]> = {
  todo: ['todo'],
  in_progress: ['in_progress'],
  in_review: ['in_review', 'review', 'waiting_client', 'approved', 'scheduled'],
  done: ['done', 'completed', 'published', 'cancelled'],
  delivered: ['delivered'],
  overdue: ['overdue'],
};

function getKanbanColumn(task: Task): KanbanColumnId | null {
  if (isOverdue(task.due_date, task.status) || KANBAN_STATUS_MAP.overdue.includes(task.status)) return 'overdue';
  if (KANBAN_STATUS_MAP.todo.includes(task.status)) return 'todo';
  if (KANBAN_STATUS_MAP.in_progress.includes(task.status)) return 'in_progress';
  if (KANBAN_STATUS_MAP.in_review.includes(task.status)) return 'in_review';
  if (KANBAN_STATUS_MAP.done.includes(task.status)) return 'done';
  if (KANBAN_STATUS_MAP.delivered.includes(task.status)) return 'delivered';
  return null;
}

function getPersistedStatus(col: KanbanColumnId): Task['status'] {
  if (col === 'in_review') return 'in_review';
  if (col === 'done') return 'done';
  if (col === 'delivered') return 'delivered';
  if (col === 'overdue') return 'overdue';
  return col;
}

function getPosition(task: Task): number {
  if (typeof task.position === 'number' && Number.isFinite(task.position)) return task.position;
  return Number.MAX_SAFE_INTEGER;
}

function sortKanbanTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const pos = getPosition(a) - getPosition(b);
    if (pos !== 0) return pos;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}

type KanbanPatch = { id: string; status: Task['status']; position: number };

const KanbanPreviewCard = React.memo(function KanbanPreviewCard({ task, team, t }: { task: Task; team: TeamMember[]; t: (k: string) => string }) {
  const assignee = team.find(m => m.id === task.assigned_to);
  const overdue = isOverdue(task.due_date, task.status);
  const tone = getStatusTone(overdue ? 'overdue' : task.status);
  return (
    <div
      className="rounded-2xl border p-3 space-y-2 shadow-2xl opacity-95 scale-[1.02]"
      style={{
        width: '18rem',
        ...frostedPanelStyle,
        borderColor: tone.border,
        boxShadow: `0 20px 40px color-mix(in srgb, ${tone.glow} 55%, transparent)`,
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
            <User size={10} />{assignee.full_name}
          </span>
        )}
        {task.due_date && (
          <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full ${overdue ? 'text-red-500' : ''}`}
            style={{ background: overdue ? '#fef2f2' : 'var(--surface)' }}>
            <Calendar size={10} />{fmtDate(task.due_date)}
          </span>
        )}
      </div>
      <div className="flex items-center justify-between">
        <Badge variant={priorityVariant(task.priority)}>{t(task.priority)}</Badge>
        <span className="text-[10px] px-2 py-0.5 rounded-full border" style={{ background: tone.bg, color: tone.text, borderColor: tone.border }}>
          {statusLabel(overdue ? 'overdue' : task.status, t)}
        </span>
      </div>
    </div>
  );
});

const DraggableKanbanTaskCard = React.memo(function DraggableKanbanTaskCard({
  task,
  team,
  onView,
  onEdit,
  onDelete,
  t,
  showDropIndicator,
}: {
  task: Task;
  team: TeamMember[];
  onView: (t: Task) => void;
  onEdit: (t: Task) => void;
  onDelete: (t: Task) => void;
  t: (k: string) => string;
  showDropIndicator: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: 'task', taskId: task.id },
  });
  const overdue = isOverdue(task.due_date, task.status);
  const assignee = team.find(m => m.id === task.assigned_to);
  const tone = getStatusTone(overdue ? 'overdue' : task.status);

  return (
    <div className="space-y-2">
      {showDropIndicator && (
        <div className="h-1.5 rounded-full animate-openy-slide-down" style={{ background: `linear-gradient(90deg, ${tone.bg}, ${tone.text})` }} />
      )}
      <div
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        className="rounded-2xl border p-3 space-y-2 transition-all duration-200 ease-out cursor-grab active:cursor-grabbing select-none hover:-translate-y-0.5"
        style={{
          transform: CSS.Transform.toString(transform),
          transition,
          opacity: isDragging ? 0.2 : 1,
          ...frostedPanelStyle,
          borderColor: tone.border,
          boxShadow: isDragging ? 'none' : `0 10px 22px color-mix(in srgb, ${tone.glow} 38%, transparent)`,
        }}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold leading-snug flex-1" style={{ color: 'var(--text)' }}>{task.title}</p>
          <GripVertical size={14} style={{ color: 'var(--text-tertiary)' }} />
        </div>
        <div className="flex flex-wrap gap-1.5 items-center text-xs" style={{ color: 'var(--text-secondary)' }}>
          {task.client && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full" style={{ background: 'var(--surface)' }}>
              <User size={10} />{task.client.name}
            </span>
          )}
          {assignee && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full" style={{ background: 'var(--surface)' }}>
              <User size={10} />{assignee.full_name}
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
          <span className="text-[10px] px-2 py-0.5 rounded-full border" style={{ background: tone.bg, color: tone.text, borderColor: tone.border }}>
            {statusLabel(overdue ? 'overdue' : task.status, t)}
          </span>
          <div className="flex items-center gap-1">
            <button onClick={(e) => { e.stopPropagation(); onView(task); }} className="p-1 rounded hover:bg-[var(--surface)] transition-colors" style={{ color: 'var(--text-secondary)' }}><Eye size={13} /></button>
            <button onClick={(e) => { e.stopPropagation(); onEdit(task); }} className="p-1 rounded hover:bg-[var(--surface)] transition-colors" style={{ color: 'var(--text-secondary)' }}><Pencil size={13} /></button>
            <button onClick={(e) => { e.stopPropagation(); onDelete(task); }} className="p-1 rounded hover:bg-red-50 text-red-500 transition-colors"><Trash2 size={13} /></button>
          </div>
        </div>
      </div>
    </div>
  );
});

function KanbanColumn({
  col,
  colTasks,
  team,
  onView,
  onEdit,
  onDelete,
  t,
  isOver,
  overTaskId,
}: {
  col: { key: KanbanColumnId; label: string };
  colTasks: Task[];
  team: TeamMember[];
  onView: (t: Task) => void;
  onEdit: (t: Task) => void;
  onDelete: (t: Task) => void;
  t: (k: string) => string;
  isOver: boolean;
  overTaskId: string | null;
}) {
  const { setNodeRef } = useDroppable({
    id: `column-${col.key}`,
    data: { type: 'column', columnId: col.key },
  });

  return (
    <div
      ref={setNodeRef}
      className="flex-shrink-0 snap-start w-[18rem] sm:w-[19rem] rounded-2xl border flex flex-col transition-all duration-200"
      style={{
        ...frostedPanelStyle,
        borderColor: isOver ? 'var(--accent)' : 'var(--border)',
        boxShadow: isOver ? '0 0 0 2px color-mix(in srgb, var(--accent) 28%, transparent), 0 18px 34px rgba(47,107,255,0.18)' : '0 10px 24px rgba(6,23,55,0.1)',
      }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
        <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{t(col.label)}</span>
        <span
          className="text-xs font-bold h-5 min-w-[1.25rem] px-1.5 rounded-full flex items-center justify-center"
          style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
        >
          {colTasks.length}
        </span>
      </div>
      <SortableContext items={colTasks.map(task => task.id)} strategy={verticalListSortingStrategy}>
        <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[calc(100vh-310px)]">
          {colTasks.length === 0 ? (
            <p className="text-xs text-center py-8" style={{ color: 'var(--text-secondary)' }}>{t('noTasksKanban')}</p>
          ) : (
            colTasks.map(task => (
              <DraggableKanbanTaskCard
                key={task.id}
                task={task}
                team={team}
                onView={onView}
                onEdit={onEdit}
                onDelete={onDelete}
                t={t}
                showDropIndicator={overTaskId === task.id}
              />
            ))
          )}
          {isOver && colTasks.length > 0 && !overTaskId && (
            <div className="h-1 rounded-full mt-2" style={{ background: 'var(--accent)' }} />
          )}
        </div>
      </SortableContext>
    </div>
  );
}

interface KanbanBoardProps {
  tasks: Task[];
  team: TeamMember[];
  onView: (t: Task) => void;
  onEdit: (t: Task) => void;
  onDelete: (t: Task) => void;
  t: (k: string) => string;
  onReorder: (nextTasks: Task[], previousTasks: Task[], updates: KanbanPatch[]) => void;
}

function KanbanBoard({ tasks, team, onView, onEdit, onDelete, t, onReorder }: KanbanBoardProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [overColumnId, setOverColumnId] = useState<KanbanColumnId | null>(null);
  const [overTaskId, setOverTaskId] = useState<string | null>(null);

  const columns = useMemo(() => {
    const mapped: Record<KanbanColumnId, Task[]> = {
      todo: [],
      in_progress: [],
      in_review: [],
      done: [],
      delivered: [],
      overdue: [],
    };
    for (const task of tasks) {
      const col = getKanbanColumn(task);
      if (!col) continue;
      mapped[col].push(task);
    }
    return {
      todo: sortKanbanTasks(mapped.todo),
      in_progress: sortKanbanTasks(mapped.in_progress),
      in_review: sortKanbanTasks(mapped.in_review),
      done: sortKanbanTasks(mapped.done),
      delivered: sortKanbanTasks(mapped.delivered),
      overdue: sortKanbanTasks(mapped.overdue),
    };
  }, [tasks]);

  const activeTask = activeTaskId ? tasks.find(task => task.id === activeTaskId) ?? null : null;

  const getColumnByTaskId = useCallback((taskId: string): KanbanColumnId | null => {
    const task = tasks.find(t => t.id === taskId);
    return task ? getKanbanColumn(task) : null;
  }, [tasks]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveTaskId(String(event.active.id));
  };

  const handleDragOver = (event: DragOverEvent) => {
    const over = event.over;
    if (!over) {
      setOverColumnId(null);
      setOverTaskId(null);
      return;
    }

    const overId = String(over.id);
    if (overId.startsWith('column-')) {
      setOverColumnId(overId.replace('column-', '') as KanbanColumnId);
      setOverTaskId(null);
      return;
    }

    const col = getColumnByTaskId(overId);
    setOverColumnId(col);
    setOverTaskId(overId);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTaskId(null);
    setOverColumnId(null);
    setOverTaskId(null);

    const over = event.over;
    const activeId = String(event.active.id);
    if (!over || !activeId) return;

    const overId = String(over.id);
    const activeTask = tasks.find(task => task.id === activeId);
    if (!activeTask) return;

    const sourceColumn = getKanbanColumn(activeTask);
    if (!sourceColumn) return;

    const destinationColumn = overId.startsWith('column-')
      ? (overId.replace('column-', '') as KanbanColumnId)
      : getColumnByTaskId(overId);
    if (!destinationColumn) return;

    const sourceTasks = [...columns[sourceColumn]];
    const destinationTasks = sourceColumn === destinationColumn
      ? sourceTasks
      : [...columns[destinationColumn]];
    const oldIndex = sourceTasks.findIndex(task => task.id === activeId);
    if (oldIndex < 0) return;

    if (sourceColumn === destinationColumn) {
      const newIndex = overId.startsWith('column-')
        ? sourceTasks.length - 1
        : sourceTasks.findIndex(task => task.id === overId);
      if (newIndex < 0 || newIndex === oldIndex) return;

      const reordered = arrayMove(sourceTasks, oldIndex, newIndex);
      const updateMap = new Map<string, { status: Task['status']; position: number }>();
      reordered.forEach((task, index) => updateMap.set(task.id, { status: task.status, position: index }));
      const updates = reordered
        .filter(task => updateMap.has(task.id) && (
          task.status !== updateMap.get(task.id)!.status ||
          getPosition(task) !== updateMap.get(task.id)!.position
        ))
        .map(task => ({ id: task.id, ...updateMap.get(task.id)! }));
      if (updates.length === 0) return;
      const nextTasks = tasks.map(task => updateMap.has(task.id)
        ? { ...task, status: updateMap.get(task.id)!.status, position: updateMap.get(task.id)!.position }
        : task);
      onReorder(nextTasks, tasks, updates);
      return;
    }

    const [movedTask] = sourceTasks.splice(oldIndex, 1);
    const targetIndex = overId.startsWith('column-')
      ? destinationTasks.length
      : destinationTasks.findIndex(task => task.id === overId);
    const insertAt = targetIndex < 0 ? destinationTasks.length : targetIndex;
    destinationTasks.splice(insertAt, 0, movedTask);

    const updateMap = new Map<string, { status: Task['status']; position: number }>();
    sourceTasks.forEach((task, index) => updateMap.set(task.id, { status: task.status, position: index }));
    destinationTasks.forEach((task, index) => updateMap.set(task.id, {
      status: task.id === movedTask.id ? getPersistedStatus(destinationColumn) : task.status,
      position: index,
    }));

    const updates = Array.from(updateMap.entries())
      .map(([id, value]) => ({ id, ...value }))
      .filter(update => {
        const current = tasks.find(task => task.id === update.id);
        return current && (current.status !== update.status || getPosition(current) !== update.position);
      });
    if (updates.length === 0) return;

    const nextTasks = tasks.map(task =>
      updateMap.has(task.id)
        ? { ...task, status: updateMap.get(task.id)!.status, position: updateMap.get(task.id)!.position }
        : task,
    );
    onReorder(nextTasks, tasks, updates);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => { setActiveTaskId(null); setOverColumnId(null); setOverTaskId(null); }}
    >
      <div className="flex gap-4 overflow-x-auto pb-4 pr-2 snap-x snap-mandatory">
        {KANBAN_COLS.map(col => (
          <KanbanColumn
            key={col.key}
            col={col}
            colTasks={columns[col.key]}
            team={team}
            onView={onView}
            onEdit={onEdit}
            onDelete={onDelete}
            t={t}
            isOver={overColumnId === col.key}
            overTaskId={overColumnId === col.key ? overTaskId : null}
          />
        ))}
      </div>
      <DragOverlay>
        {activeTask ? <KanbanPreviewCard task={activeTask} team={team} t={t} /> : null}
      </DragOverlay>
    </DndContext>
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
          <button type="button" onClick={onClose} className="btn-secondary h-9 px-4 text-sm">
            {t('cancel')}
          </button>
          <button type="button" onClick={onConfirm} className="btn-danger h-9 px-4 text-sm">
            {t('deleteTask')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

const MUTATION_TIMEOUT_MS = 15_000;
const INVALIDATION_DELAY_MS = 120;




export default function TasksPage() {
  const { t } = useLang();
  const { role } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const invalidateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canManageTasks = role === 'admin' || role === 'manager' || role === 'team_member';

  // ── React Query: fetch and cache tasks, clients, and team ────────────────
  // Caching across navigations means re-visiting this page within the
  // staleTime window renders data immediately without a loading spinner,
  // then background-refetches to stay fresh.
  const { data: queryData, isLoading: loading, error: queryError } = useQuery({
    queryKey: ['tasks-all'],
    queryFn: async () => {
      const [tasksRes, clientsRes, projectsRes, teamRes] = await Promise.allSettled([
        supabase.from('tasks').select('*, client:clients(id,name)').order('created_at', { ascending: false }).limit(200),
        supabase.from('clients').select('id,name').order('name'),
        supabase.from('projects').select('id,name,client_id').order('name'),
        // Select only the columns the UI actually uses to reduce payload size.
        supabase.from('team_members').select('id,full_name,email,role,avatar_url,job_title,created_at').order('full_name'),
      ]);

      if (tasksRes.status === 'rejected') {
        console.error('[tasks] tasks fetch rejected:', tasksRes.reason);
      } else if (tasksRes.value.error) {
        console.error('[tasks] tasks fetch error:', tasksRes.value.error);
        throw new Error(tasksRes.value.error.message);
      }
      if (clientsRes.status === 'rejected') console.error('[tasks] clients fetch rejected:', clientsRes.reason);
      else if (clientsRes.value.error) console.error('[tasks] clients fetch error:', clientsRes.value.error);
      if (projectsRes.status === 'rejected') console.error('[tasks] projects fetch rejected:', projectsRes.reason);
      else if (projectsRes.value.error) console.error('[tasks] projects fetch error:', projectsRes.value.error);
      if (teamRes.status === 'rejected') console.error('[tasks] team fetch rejected:', teamRes.reason);
      else if (teamRes.value.error) console.error('[tasks] team fetch error:', teamRes.value.error);

      return {
        tasks:   (tasksRes.status   === 'fulfilled' && !tasksRes.value.error)   ? (tasksRes.value.data   ?? []) as Task[]       : [],
        clients: (clientsRes.status === 'fulfilled' && !clientsRes.value.error) ? (clientsRes.value.data ?? []) as Client[]     : [],
        projects: (projectsRes.status === 'fulfilled' && !projectsRes.value.error) ? (projectsRes.value.data ?? []) as Project[] : [],
        team:    (teamRes.status    === 'fulfilled' && !teamRes.value.error)    ? (teamRes.value.data    ?? []) as TeamMember[]  : [],
      };
    },
  });

  const fetchError = queryError ? (queryError as Error).message : null;

  // Local state for optimistic updates — seeded from React Query cache on
  // first render and kept in sync when the background fetch completes.
  const cachedOnMount = queryClient.getQueryData<{ tasks: Task[]; clients: Client[]; projects: Project[]; team: TeamMember[] }>(['tasks-all']);
  const [tasks,   setTasks]   = useState<Task[]>      (() => cachedOnMount?.tasks   ?? []);
  const [clients, setClients] = useState<Client[]>    (() => cachedOnMount?.clients ?? []);
  const [projects, setProjects] = useState<Project[]>(() => cachedOnMount?.projects ?? []);
  const [team,    setTeam]    = useState<TeamMember[]>(() => cachedOnMount?.team    ?? []);

  // Keep local state in sync when React Query data arrives / updates.
  useEffect(() => {
    if (queryData) {
      setTasks(queryData.tasks);
      setClients(queryData.clients);
      setProjects(queryData.projects);
      setTeam(queryData.team);
    }
  }, [queryData]);

  useEffect(() => () => {
    if (invalidateTimerRef.current) clearTimeout(invalidateTimerRef.current);
  }, []);

  const [saving, setSaving] = useState(false);
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
  const [platformFilter, setPlatformFilter] = useState('');
  const [postTypeFilter, setPostTypeFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [view, setView] = useState<'list' | 'kanban'>('kanban');

  useEffect(() => {
    const savedView = window.localStorage.getItem('tasks-all-view');
    if (savedView === 'list' || savedView === 'kanban') setView(savedView);
  }, []);

  useEffect(() => {
    window.localStorage.setItem('tasks-all-view', view);
  }, [view]);

  // Forms
  const [createForm, setCreateForm] = useState({ ...blankForm });
  const [editForm, setEditForm] = useState({ ...blankForm });

  // ── filtered tasks ───────────────────────────────────────────────────────
  const filtered = useMemo(() => tasks.filter(task => {
    if (statusFilter !== 'all' && task.status !== statusFilter) return false;
    if (clientFilter && task.client_id !== clientFilter) return false;
    if (assignedFilter && task.assigned_to !== assignedFilter) return false;
    if (priorityFilter && task.priority !== priorityFilter) return false;
    if (platformFilter && !(task.platforms ?? []).includes(platformFilter)) return false;
    if (postTypeFilter && !(task.post_types ?? []).includes(postTypeFilter)) return false;
    if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  }), [tasks, statusFilter, clientFilter, assignedFilter, priorityFilter, platformFilter, postTypeFilter, searchQuery]);

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
        project_id:  createForm.project_id || null,
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
      let result: { success: boolean; task?: Task; step?: string; error?: string };
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

      if (result.task) {
        const createdTask = result.task;
        setTasks(prev => [createdTask, ...prev.filter(t => t.id !== createdTask.id)]);
        queryClient.setQueryData<{ tasks: Task[]; clients: Client[]; projects: Project[]; team: TeamMember[] }>(
          ['tasks-all'],
          old => old
            ? { ...old, tasks: [createdTask, ...old.tasks.filter(t => t.id !== createdTask.id)] }
            : old,
        );
      }

      // Refresh list non-blocking via React Query cache invalidation
      console.log('[task create] triggering list refetch');
      void queryClient.invalidateQueries({ queryKey: ['tasks-all'] });
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
      project_id: task.project_id ?? '',
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
        project_id:  editForm.project_id || null,
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

      // Background refresh via React Query cache invalidation
      void queryClient.invalidateQueries({ queryKey: ['tasks-all'] });
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

  const invalidateTaskRelatedQueries = useCallback(() => {
    const previousTimer = invalidateTimerRef.current;
    const nextTimer = setTimeout(() => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tasks-all'] }),
        queryClient.invalidateQueries({ queryKey: ['tasks-my'] }),
        queryClient.invalidateQueries({ queryKey: ['tasks'] }),
        queryClient.invalidateQueries({ queryKey: ['at-risk-tasks'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard-trends'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard-team-performance'] }),
        queryClient.invalidateQueries({ queryKey: ['reports-overview'] }),
      ]).catch((err: unknown) => {
        console.warn('[tasks] query invalidation failed:', err);
      });
    }, INVALIDATION_DELAY_MS);
    invalidateTimerRef.current = nextTimer;
    if (previousTimer) clearTimeout(previousTimer);
  }, [queryClient]);

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
        invalidateTaskRelatedQueries();
      }
    } catch (err) {
      console.error('[task status] network error:', err);
      revertStatus();
      toast('Failed to update task status. Please try again.', 'warning');
    }
  };

  const handleKanbanReorder = useCallback(async (nextTasks: Task[], previousTasks: Task[], updates: KanbanPatch[]) => {
    setTasks(nextTasks);
    try {
      const results = await Promise.all(updates.map(async (update) => {
        const res = await fetch(`/api/tasks/${update.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: update.status, position: update.position }),
        });
        const json = await res.json() as { success: boolean; error?: string };
        return { ok: res.ok && json.success, error: json.error };
      }));
      const failed = results.find(r => !r.ok);
      if (failed) throw new Error(failed.error ?? 'Failed to update task order');
      invalidateTaskRelatedQueries();
    } catch (err) {
      setTasks(previousTasks);
      toast(err instanceof Error ? err.message : 'Failed to move task. Changes were reverted.', 'warning');
    }
  }, [invalidateTaskRelatedQueries, setTasks, toast]);

  const statuses = ['all', 'todo', 'in_progress', 'in_review', 'done', 'delivered', 'overdue'];
  const totalOverdue = useMemo(() => tasks.filter(task => isOverdue(task.due_date, task.status) || task.status === 'overdue').length, [tasks]);
  const doneCount = useMemo(() => tasks.filter(task => ['done', 'completed', 'delivered', 'published'].includes(task.status)).length, [tasks]);
  const inProgressCount = useMemo(() => tasks.filter(task => ['in_progress', 'in_review', 'review', 'waiting_client'].includes(task.status)).length, [tasks]);
  const activeFilterCount = [statusFilter !== 'all', clientFilter, assignedFilter, priorityFilter, platformFilter, postTypeFilter, searchQuery]
    .filter(Boolean).length;

  return (
    <div className="w-full max-w-[1500px] mx-auto space-y-4 sm:space-y-5 animate-openy-fade-in">
      {/* Fetch error banner */}
      {fetchError && (
        <div
          className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm border"
          style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)', borderColor: 'var(--color-danger-border)' }}
        >
          <AlertCircle size={16} className="shrink-0" />
          <span>{fetchError}</span>
        </div>
      )}
      <div className="glass-card p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight" style={{ color: 'var(--text)' }}>{t('tasks')}</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              {filtered.length} task{filtered.length !== 1 ? 's' : ''} shown • {tasks.length} total
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap sm:justify-end">
            <div className="openy-tabs">
              <button onClick={() => setView('list')} className={`openy-tab ${view === 'list' ? 'openy-tab-active' : ''}`}>
                <List size={14} className="inline mr-1" />{t('list')}
              </button>
              <button onClick={() => setView('kanban')} className={`openy-tab ${view === 'kanban' ? 'openy-tab-active' : ''}`}>
                <LayoutGrid size={14} className="inline mr-1" />{t('kanban')}
              </button>
            </div>
            {canManageTasks && (
              <button onClick={() => setCreateOpen(true)} className="btn-primary h-10 px-4 text-sm">
                <Plus size={16} />{t('newTask')}
              </button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mt-4">
          {[
            { label: 'Total', value: tasks.length, tone: 'var(--text)' },
            { label: t('inProgress'), value: inProgressCount, tone: 'var(--color-info)' },
            { label: t('done'), value: doneCount, tone: 'var(--color-success)' },
            { label: t('overdue'), value: totalOverdue, tone: 'var(--color-danger)' },
          ].map(item => (
            <div key={item.label} className="rounded-xl px-3 py-2 border" style={{ ...glassInputStyle }}>
              <p className="text-[11px] uppercase tracking-wide font-semibold" style={{ color: 'var(--text-tertiary)' }}>{item.label}</p>
              <p className="text-xl font-bold" style={{ color: item.tone }}>{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="openy-filter-bar">
        <div className="relative min-w-[220px] flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-secondary)' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={t('searchTasks')}
            className="input-glass w-full h-9 pl-9 pr-3 rounded-lg text-sm outline-none"
          />
        </div>
        <div className="flex items-center gap-2 text-xs px-2">
          <Filter size={14} style={{ color: 'var(--text-secondary)' }} />
          <span style={{ color: 'var(--text-secondary)' }}>{activeFilterCount} active</span>
        </div>
        <SelectDropdown
          value={clientFilter}
          onChange={setClientFilter}
          placeholder={t('allClients')}
          options={[
            { value: '', label: t('allClients') },
            ...clients.map(c => ({ value: c.id, label: c.name })),
          ]}
        />
        <SelectDropdown
          value={assignedFilter}
          onChange={setAssignedFilter}
          placeholder={t('allMembers')}
          options={[
            { value: '', label: t('allMembers') },
            ...team.map(m => ({ value: m.id, label: m.full_name })),
          ]}
        />
        <SelectDropdown
          value={priorityFilter}
          onChange={setPriorityFilter}
          placeholder={t('allPriorities')}
          options={[
            { value: '', label: t('allPriorities') },
            { value: 'high', label: t('high') },
            { value: 'medium', label: t('medium') },
            { value: 'low', label: t('low') },
          ]}
        />
        <SelectDropdown
          value={platformFilter}
          onChange={setPlatformFilter}
          placeholder="All platforms"
          options={[
            { value: '', label: 'All platforms' },
            ...PLATFORMS.map(p => ({ value: p.value, label: p.label })),
          ]}
        />
        <SelectDropdown
          value={postTypeFilter}
          onChange={setPostTypeFilter}
          placeholder="All post types"
          options={[
            { value: '', label: 'All post types' },
            ...POST_TYPES.map(pt => ({ value: pt.value, label: pt.label })),
          ]}
        />
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        {statuses.map(s => {
          const isActive = statusFilter === s;
          const count = s === 'all'
            ? tasks.length
            : (s === 'overdue'
              ? tasks.filter(tk => isOverdue(tk.due_date, tk.status) || tk.status === 'overdue').length
              : tasks.filter(tk => tk.status === s).length);
          const tone = getStatusTone(s);
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full text-xs font-semibold transition-all"
              style={{
                background: isActive ? tone.bg : 'var(--surface)',
                color: isActive ? tone.text : 'var(--text-secondary)',
                border: `1px solid ${isActive ? tone.border : 'var(--border)'}`,
                boxShadow: isActive ? `0 8px 18px color-mix(in srgb, ${tone.glow} 48%, transparent)` : 'none',
              }}
            >
              {s === 'all' ? 'All' : statusLabel(s, t)}
              <span className="inline-flex items-center justify-center h-4 min-w-[1rem] px-1 rounded-full text-[10px] font-bold" style={{ background: isActive ? 'rgba(255,255,255,0.35)' : 'var(--surface-2)', color: isActive ? tone.text : 'var(--text-secondary)' }}>
                {count}
              </span>
            </button>
          );
        })}
        {(clientFilter || assignedFilter || priorityFilter || platformFilter || postTypeFilter || searchQuery || statusFilter !== 'all') && (
          <button
            onClick={() => { setClientFilter(''); setAssignedFilter(''); setPriorityFilter(''); setPlatformFilter(''); setPostTypeFilter(''); setSearchQuery(''); setStatusFilter('all'); }}
            className="btn-ghost h-8 px-3 text-xs"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Task list / kanban */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-40 rounded-xl skeleton-shimmer" />
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
        <div className="rounded-2xl border p-2 sm:p-3 overflow-hidden" style={frostedPanelStyle}>
          <KanbanBoard
            tasks={filtered}
            team={team}
            onView={setViewTask}
            onEdit={openEdit}
            onDelete={setDeleteTask}
            t={t}
            onReorder={handleKanbanReorder}
          />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="hidden md:grid grid-cols-[2fr,1.2fr,1fr,1fr,1fr,auto] gap-3 px-4 py-2 rounded-xl border text-[11px] uppercase tracking-wide font-semibold" style={{ ...glassInputStyle, color: 'var(--text-tertiary)' }}>
            <span>Task</span>
            <span>Client / Project</span>
            <span>{t('status')}</span>
            <span>{t('priority')}</span>
            <span>{t('deadline')}</span>
            <span><ArrowUpDown size={12} /></span>
          </div>
          <div className="space-y-2">
            {filtered.map(task => {
              const overdue = isOverdue(task.due_date, task.status);
              const assignee = team.find(m => m.id === task.assigned_to);
              const tone = getStatusTone(overdue ? 'overdue' : task.status);
              return (
                <div key={task.id}>
                  <div className="hidden md:grid grid-cols-[2fr,1.2fr,1fr,1fr,1fr,auto] gap-3 items-center px-4 py-3 rounded-2xl border transition-all hover:-translate-y-0.5 hover:shadow-lg" style={{ ...frostedPanelStyle, borderColor: tone.border }}>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>{task.title}</p>
                      {task.description && <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{task.description}</p>}
                      {assignee && <p className="text-[11px] mt-1" style={{ color: 'var(--text-tertiary)' }}>{assignee.full_name}</p>}
                    </div>
                    <p className="text-sm truncate" style={{ color: 'var(--text-secondary)' }}>{task.client?.name ?? '-'}</p>
                    <span className="text-xs px-2.5 py-1 rounded-full border font-semibold justify-self-start" style={{ background: tone.bg, color: tone.text, borderColor: tone.border }}>
                      {statusLabel(overdue ? 'overdue' : task.status, t)}
                    </span>
                    <Badge variant={priorityVariant(task.priority)}>{task.priority === 'high' ? `${t('high')} ↑` : t(task.priority)}</Badge>
                    <p className={`text-sm ${overdue ? 'font-semibold' : ''}`} style={{ color: overdue ? 'var(--color-danger)' : 'var(--text-secondary)' }}>{task.due_date ? fmtDate(task.due_date) : '-'}</p>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setViewTask(task)} className="btn-ghost p-1.5"><Eye size={14} /></button>
                      <button onClick={() => openEdit(task)} className="btn-ghost p-1.5"><Pencil size={14} /></button>
                      <button onClick={() => setDeleteTask(task)} className="btn-ghost p-1.5 text-red-500"><Trash2 size={14} /></button>
                    </div>
                  </div>
                  <div className="md:hidden">
                    <TaskCard
                      task={task}
                      team={team}
                      onView={setViewTask}
                      onEdit={openEdit}
                      onDelete={setDeleteTask}
                      onStatusChange={handleStatusChange}
                      t={t}
                    />
                  </div>
                </div>
              );
            })}
          </div>
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
          <TaskForm form={createForm} setForm={setCreateForm} clients={clients} projects={projects} team={team} saving={saving} onCancel={() => { setCreateOpen(false); setCreateError(null); }} t={t} />
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
          <TaskForm form={editForm} setForm={setEditForm} clients={clients} projects={projects} team={team} saving={saving} onCancel={() => { setEditTask(null); setEditError(null); }} t={t} />
        </form>
      </Modal>

      {/* Detail Modal */}
      <TaskDetailModal task={viewTask} team={team} open={!!viewTask} onClose={() => setViewTask(null)} t={t} />

      {/* Delete Modal */}
      <DeleteConfirmModal task={deleteTask} open={!!deleteTask} onClose={() => { setDeleteTask(null); setDeleteError(null); }} onConfirm={handleDelete} error={deleteError} t={t} />
    </div>
  );
}
