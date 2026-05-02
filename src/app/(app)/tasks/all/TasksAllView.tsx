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
  Plus,
  CheckSquare,
  ChevronDown,
  Pencil,
  Trash2,
  Eye,
  Calendar,
  User,
  Users,
  Tag,
  AlertCircle,
  Clock,
  LayoutGrid,
  List,
  Search,
  Send,
  ArrowUpDown,
  GripVertical,
  SlidersHorizontal,
} from 'lucide-react';
import supabase from '@/lib/supabase';
import { ClientBrandMark } from '@/components/ui/ClientBrandMark';
import { useLang } from '@/context/lang-context';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/context/toast-context';
import { useAppPeriod } from '@/context/app-period-context';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import StatCard from '@/components/ui/StatCard';
import AiImproveButton from '@/components/ui/AiImproveButton';
import SelectDropdown from '@/components/ui/SelectDropdown';
import {
  OPENY_MENU_ITEM_COMPACT_CLASS,
  OPENY_MENU_PANEL_COMPACT_CLASS,
} from '@/components/ui/menu-system';
import Button from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Input, Textarea } from '@/components/ui/Input';
import { PageShell, PageHeader } from '@/components/layout/PageLayout';
import {
  PLATFORMS,
  POST_TYPES,
  getPlatformDisplayColor,
} from '@/components/features/publishing/SchedulePublishingModal';
import type { Task, Client, TeamMember, Project } from '@/lib/types';
import { taskStatusLabel } from '@/lib/task-status-labels';
import { applyUtcTimestampRange } from '@/lib/date-range';
import { LoadingState, ErrorState, EmptyState as GlobalEmptyState } from '@/components/ui/states';
import ConfirmDialog from '@/components/ui/actions/ConfirmDialog';
import EntityActionsMenu from '@/components/ui/actions/EntityActionsMenu';
import { canDelete as canDeleteEntity, canEdit as canEditEntity } from '@/lib/permissions';
import { useDeleteTask } from '@/hooks/mutations/useDeleteTask';
import { DayPicker, type DateRange } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { addDays, endOfWeek, format, startOfWeek } from 'date-fns';

// ─── helpers ────────────────────────────────────────────────────────────────

const priorityVariant = (p: string) => {
  if (p === 'high') return 'danger' as const;
  if (p === 'medium') return 'warning' as const;
  return 'default' as const;
};

const statusVariant = (s: string) => {
  if (s === 'done') return 'success' as const;
  if (s === 'delivered') return 'success' as const;
  if (s === 'overdue') return 'danger' as const;
  if (s === 'in_progress') return 'info' as const;
  if (s === 'review') return 'warning' as const;
  return 'default' as const;
};

const COMPLETED_STATUSES = new Set<Task['status']>([
  'done',
  'completed',
  'delivered',
  'published',
  'cancelled',
]);

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
  return tags
    ? tags
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
}

function fmtDate(d?: string) {
  if (!d) return '';
  return new Date(d).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function parseDateOnly(value?: string | null): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day);
  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day)
    return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function toYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

type TaskDateFilter =
  | 'today'
  | 'tomorrow'
  | 'this_week'
  | 'next_7_days'
  | 'overdue'
  | 'no_due_date'
  | 'custom';
type TaskQuickFilter = 'all' | 'mine' | 'overdue' | 'due_today' | 'no_assignee';

const TASK_DATE_OPTIONS: Array<{ value: TaskDateFilter; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: 'tomorrow', label: 'Tomorrow' },
  { value: 'this_week', label: 'This week' },
  { value: 'next_7_days', label: 'Next 7 days' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'no_due_date', label: 'No due date' },
  { value: 'custom', label: 'Custom range' },
];

function TaskDateFilterPill({
  selected,
  customLabel,
  onSelect,
}: {
  selected: TaskDateFilter;
  customLabel: string | null;
  onSelect: (next: TaskDateFilter) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onEscape);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onEscape);
    };
  }, [open]);

  const selectedLabel =
    selected === 'custom'
      ? (customLabel ?? 'Custom range')
      : (TASK_DATE_OPTIONS.find((opt) => opt.value === selected)?.label ?? 'This week');

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex h-10 items-center gap-2 rounded-full border bg-[color:var(--surface)] px-3 text-sm font-medium shadow-sm transition-all hover:bg-[color:var(--surface-soft)]"
        style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Calendar size={14} style={{ color: 'var(--text-secondary)' }} />
        <span className="max-w-[9rem] truncate">{selectedLabel}</span>
        <ChevronDown size={14} style={{ color: 'var(--text-secondary)' }} />
      </button>

      {open && (
        <div
          role="menu"
          className="animate-openy-fade-in absolute end-0 top-full z-30 mt-2 w-[240px] rounded-xl border bg-[color:var(--popover)] p-1.5 shadow-lg"
          style={{ borderColor: 'var(--border)' }}
        >
          {TASK_DATE_OPTIONS.map((option) => {
            const active = selected === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  onSelect(option.value);
                  setOpen(false);
                }}
                className="flex h-9 w-full items-center rounded-lg px-2.5 text-sm transition-colors"
                style={{
                  background: active ? 'var(--accent-soft)' : 'transparent',
                  color: active ? 'var(--accent)' : 'var(--text-secondary)',
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function avatarInitials(name?: string | null) {
  if (!name) return 'UN';
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('') || 'UN';
}

const statusTone: Record<string, { bg: string; text: string; border: string }> = {
  todo: { bg: 'var(--accent-soft)', text: 'var(--accent)', border: 'var(--border)' },
  in_progress: {
    bg: 'var(--color-info-bg)',
    text: 'var(--color-info)',
    border: 'var(--color-info-border)',
  },
  in_review: { bg: 'var(--surface-2)', text: 'var(--text-secondary)', border: 'var(--border)' },
  review: { bg: 'var(--surface-2)', text: 'var(--text-secondary)', border: 'var(--border)' },
  done: {
    bg: 'var(--color-success-bg)',
    text: 'var(--color-success)',
    border: 'var(--color-success-border)',
  },
  delivered: { bg: 'var(--surface-2)', text: 'var(--text)', border: 'var(--border)' },
  overdue: {
    bg: 'var(--color-danger-bg)',
    text: 'var(--color-danger)',
    border: 'var(--color-danger-border)',
  },
  default: { bg: 'var(--surface-2)', text: 'var(--text-secondary)', border: 'var(--border)' },
};

function getStatusTone(status: string) {
  return statusTone[status] ?? statusTone.default;
}

function statusLabel(s: string, t: (k: string) => string): string {
  return taskStatusLabel(s, t);
}

// ─── blank form ─────────────────────────────────────────────────────────────

const blankForm = {
  title: '',
  description: '',
  status: 'todo',
  priority: 'medium',
  start_date: '',
  due_date: '',
  client_id: '',
  project_id: '',
  assigned_to: '',
  created_by: '',
  mentions: [] as string[],
  tags: '',
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
    () => projects.filter((p) => Boolean(form.client_id) && p.client_id === form.client_id),
    [projects, form.client_id],
  );

  const toggleMention = (id: string) => {
    setForm((f) => ({
      ...f,
      mentions: f.mentions.includes(id) ? f.mentions.filter((m) => m !== id) : [...f.mentions, id],
    }));
  };

  return (
    <div className="space-y-4">
      {/* Title */}
      <div className="space-y-1">
        <div className="mb-1 flex items-center justify-between">
          <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>
            {t('title')} *
          </label>
          <AiImproveButton
            value={form.title}
            onImproved={(v) => setForm((f) => ({ ...f, title: v }))}
          />
        </div>
        <Input
          required
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          placeholder={t('taskTitlePlaceholder')}
        />
      </div>

      {/* Description */}
      <div className="space-y-1">
        <div className="mb-1 flex items-center justify-between">
          <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>
            {t('description')}
          </label>
          <AiImproveButton
            value={form.description}
            onImproved={(v) => setForm((f) => ({ ...f, description: v }))}
            showMenu
          />
        </div>
        <Textarea
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          rows={3}
          className="resize-none"
          placeholder={t('taskDescriptionPlaceholder')}
        />
      </div>

      {/* Client + Project */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>
            {t('clients')} *
          </label>
          <SelectDropdown
            fullWidth
            value={form.client_id}
            onChange={(v) => setForm((f) => ({ ...f, client_id: v }))}
            placeholder={t('none')}
            options={[
              { value: '', label: t('none') },
              ...clients.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>
            {t('taskFormProject')}
          </label>
          <SelectDropdown
            fullWidth
            value={form.project_id}
            onChange={(v) => setForm((f) => ({ ...f, project_id: v }))}
            placeholder={t('none')}
            options={[
              { value: '', label: t('none') },
              ...projectOptions.map((p) => ({ value: p.id, label: p.name })),
            ]}
          />
        </div>
      </div>

      {/* Start Date + Deadline */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>
            {t('startDate')}
          </label>
          <Input
            type="date"
            value={form.start_date}
            onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>
            {t('deadline')} *
          </label>
          <Input
            required
            type="date"
            value={form.due_date}
            onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
          />
        </div>
      </div>

      {/* Priority + Status */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>
            {t('priority')}
          </label>
          <SelectDropdown
            fullWidth
            value={form.priority}
            onChange={(v) => setForm((f) => ({ ...f, priority: v }))}
            options={[
              { value: 'low', label: t('low') },
              { value: 'medium', label: t('medium') },
              { value: 'high', label: t('high') },
            ]}
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>
            {t('status')}
          </label>
          <SelectDropdown
            fullWidth
            value={form.status}
            onChange={(v) => setForm((f) => ({ ...f, status: v }))}
            options={[
              { value: 'todo', label: t('todo') },
              { value: 'in_progress', label: t('inProgress') },
              { value: 'in_review', label: t('review') },
              { value: 'done', label: t('done') },
              { value: 'delivered', label: t('delivered') },
            ]}
          />
        </div>
      </div>

      {/* Assigned To + Created By */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>
            {t('assignedTo')} *
          </label>
          <SelectDropdown
            fullWidth
            value={form.assigned_to}
            onChange={(v) => setForm((f) => ({ ...f, assigned_to: v }))}
            placeholder={t('unassigned')}
            options={[
              { value: '', label: t('unassigned') },
              ...team.map((m) => ({ value: m.id, label: m.full_name })),
            ]}
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>
            {t('createdBy')}
          </label>
          <SelectDropdown
            fullWidth
            value={form.created_by}
            onChange={(v) => setForm((f) => ({ ...f, created_by: v }))}
            placeholder={t('none')}
            options={[
              { value: '', label: t('none') },
              ...team.map((m) => ({ value: m.id, label: m.full_name })),
            ]}
          />
        </div>
      </div>

      {/* Mentions */}
      {team.length > 0 && (
        <div className="space-y-1">
          <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>
            {t('mentions')}
          </label>
          <div
            className="flex flex-wrap gap-2 rounded-lg p-2"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
          >
            {team.map((m) => {
              const selected = form.mentions.includes(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggleMention(m.id)}
                  className="h-7 rounded-full px-3 text-xs font-medium transition-colors"
                  style={{
                    background: selected ? 'var(--accent)' : 'var(--surface)',
                    color: selected ? 'var(--accent-foreground)' : 'var(--text-secondary)',
                    border: '1px solid var(--border)',
                  }}
                >
                  @{m.full_name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Tags */}
      <div className="space-y-1">
        <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>
          {t('tags')}
        </label>
        <Input
          value={form.tags}
          onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
          placeholder={t('tagsPlaceholder')}
        />
      </div>

      {/* Buttons */}
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          {t('cancel')}
        </Button>
        <Button type="submit" variant="primary" disabled={saving}>
          {saving ? t('loading') : t('save')}
        </Button>
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
  canEdit: boolean;
  canDelete: boolean;
  t: (k: string) => string;
}

function TaskCard({
  task,
  team,
  onView,
  onEdit,
  onDelete,
  onStatusChange,
  canEdit,
  canDelete,
  t,
}: TaskCardProps) {
  const [statusOpen, setStatusOpen] = useState(false);
  const overdue = isOverdue(task.due_date, task.status);
  const soon = isDueSoon(task.due_date, task.status);
  const assignee = team.find((m) => m.id === task.assigned_to);
  const mentionedMembers = (task.mentions ?? [])
    .map((id) => team.find((m) => m.id === id))
    .filter(Boolean) as TeamMember[];

  const projectLabel = !task.client && task.project_id ? t('projectLinked') : null;

  return (
    <div
      className="space-y-4 rounded-2xl border p-5 transition-all duration-200 ease-out hover:-translate-y-0.5"
      style={{
        background: 'var(--surface)',
        borderColor: 'var(--border)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {/* Header row */}
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug" style={{ color: 'var(--text)' }}>
            {task.title}
          </p>
          {task.description && (
            <p className="mt-0.5 line-clamp-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
              {task.description}
            </p>
          )}
        </div>
        {/* Action buttons */}
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => onView(task)}
            title={t('viewAction')}
            className="rounded-lg p-1.5 transition-colors hover:bg-[var(--surface-2)]"
            style={{ color: 'var(--text-secondary)' }}
          >
            <Eye size={14} />
          </button>
          <div title={canDelete ? undefined : "You don't have permission"}>
            <EntityActionsMenu
              onEdit={canEdit ? () => onEdit(task) : undefined}
              onDelete={canDelete ? () => onDelete(task) : undefined}
              editLabel={t('editAction')}
              deleteLabel={t('deleteAction')}
              disabled={!canEdit && !canDelete}
            />
          </div>
        </div>
      </div>

      <div
        className="flex items-center justify-between gap-2 rounded-2xl border px-3 py-2"
        style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold"
            style={{
              background: 'var(--surface)',
              borderColor: 'var(--border)',
              color: 'var(--text-secondary)',
            }}
          >
            {avatarInitials(assignee?.full_name)}
          </span>
          <span className="truncate text-xs" style={{ color: 'var(--text-secondary)' }}>
            {assignee?.full_name ?? t('unassigned')}
          </span>
        </div>
        {task.due_date ? (
          <span
            className={`inline-flex items-center gap-1 text-xs ${overdue ? 'font-semibold' : ''}`}
            style={{
              color: overdue
                ? 'var(--color-danger)'
                : soon
                  ? 'var(--color-warning)'
                  : 'var(--text-secondary)',
            }}
          >
            {overdue ? <AlertCircle size={12} /> : <Calendar size={12} />}
            {fmtDate(task.due_date)}
          </span>
        ) : null}
        <Badge variant={priorityVariant(task.priority)}>
          {task.priority === 'high' ? `${t('high')} ↑` : t(task.priority)}
        </Badge>
      </div>

      {task.client ? (
        <div
          className="inline-flex max-w-full items-center gap-2 self-start rounded-full border px-2.5 py-1 text-xs"
          style={{
            background: 'var(--surface-2)',
            borderColor: 'var(--border)',
            color: 'var(--text-secondary)',
          }}
        >
          <ClientBrandMark
            name={task.client.name}
            logoUrl={task.client.logo}
            size={22}
            roundedClassName="rounded-full"
          />
          <span className="truncate font-medium" style={{ color: 'var(--text)' }}>
            {task.client.name}
          </span>
        </div>
      ) : projectLabel ? (
        <div
          className="inline-flex items-center gap-1.5 self-start rounded-full border px-2.5 py-1 text-xs"
          style={{
            background: 'var(--surface-2)',
            borderColor: 'var(--border)',
            color: 'var(--text-secondary)',
          }}
        >
          <User size={11} />
          {projectLabel}
        </div>
      ) : null}

      {((task.platforms && task.platforms.length > 0) ||
        (task.post_types && task.post_types.length > 0)) && (
        <div className="flex flex-wrap items-center gap-1.5">
          <Send size={11} style={{ color: 'var(--text-secondary)' }} />
          {(task.platforms ?? []).map((p) => {
            const pl = PLATFORMS.find((x) => x.value === p);
            return (
              <span
                key={p}
                className="rounded px-1.5 py-0.5 text-[10px] font-medium text-[var(--accent-foreground)]"
                style={{ background: getPlatformDisplayColor(p) }}
              >
                {pl ? pl.label : p}
              </span>
            );
          })}
          {(task.post_types ?? []).map((pt) => {
            const typ = POST_TYPES.find((x) => x.value === pt);
            return (
              <span
                key={pt}
                className="rounded px-1.5 py-0.5 text-[10px] font-medium"
                style={{ background: 'rgba(99,102,241,0.12)', color: 'var(--accent)' }}
              >
                {typ ? typ.label : pt}
              </span>
            );
          })}
        </div>
      )}

      {/* Mentions */}
      {mentionedMembers.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <Users size={12} style={{ color: 'var(--text-secondary)' }} />
          {mentionedMembers.map((m) => (
            <span
              key={m.id}
              className="rounded-full px-2 py-0.5 text-xs font-medium"
              style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
            >
              @{m.full_name}
            </span>
          ))}
        </div>
      )}

      {/* Tags */}
      {task.tags && task.tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <Tag size={12} style={{ color: 'var(--text-secondary)' }} />
          {task.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full px-2 py-0.5 text-xs"
              style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Footer: status + priority */}
      <div className="flex items-center gap-2 pt-1">
        <div className="relative">
          <button
            onClick={() => setStatusOpen((o) => !o)}
            className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
            style={{
              background: 'var(--surface-2)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
            }}
          >
            {statusLabel(task.status, t)}
            <ChevronDown size={10} />
          </button>
          {statusOpen && (
            <div
              className={`absolute start-0 top-full z-10 mt-1 min-w-[130px] overflow-hidden ${OPENY_MENU_PANEL_COMPACT_CLASS}`}
            >
              {['todo', 'in_progress', 'in_review', 'done', 'delivered', 'overdue'].map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    onStatusChange(task, s);
                    setStatusOpen(false);
                  }}
                  className={`${OPENY_MENU_ITEM_COMPACT_CLASS} text-start text-xs`}
                  style={{ color: 'var(--text)' }}
                >
                  {statusLabel(s, t)}
                </button>
              ))}
            </div>
          )}
        </div>
        {overdue && <Badge variant="danger">{t('overdue')}</Badge>}
      </div>
    </div>
  );
}

// ─── TaskDetailModal ─────────────────────────────────────────────────────────

function TaskDetailModal({
  task,
  team,
  open,
  onClose,
  t,
}: {
  task: Task | null;
  team: TeamMember[];
  open: boolean;
  onClose: () => void;
  t: (k: string) => string;
}) {
  if (!task) return null;
  const assignee = team.find((m) => m.id === task.assigned_to);
  const creator = team.find((m) => m.id === task.created_by);
  const mentionedMembers = (task.mentions ?? [])
    .map((id) => team.find((m) => m.id === id))
    .filter(Boolean) as TeamMember[];
  const overdue = isOverdue(task.due_date, task.status);

  const row = (label: string, value: React.ReactNode) => (
    <div
      className="flex items-start gap-3 border-b py-2 last:border-b-0"
      style={{ borderColor: 'var(--border)' }}
    >
      <span
        className="w-28 shrink-0 pt-0.5 text-xs font-medium"
        style={{ color: 'var(--text-secondary)' }}
      >
        {label}
      </span>
      <span className="flex-1 text-sm" style={{ color: 'var(--text)' }}>
        {value}
      </span>
    </div>
  );

  return (
    <Modal open={open} onClose={onClose} title={t('taskDetails')} size="lg">
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-bold" style={{ color: 'var(--text)' }}>
            {task.title}
          </h3>
          {task.description && (
            <p
              className="mt-2 whitespace-pre-wrap text-sm"
              style={{ color: 'var(--text-secondary)' }}
            >
              {task.description}
            </p>
          )}
        </div>
        <div className="rounded-xl border" style={{ borderColor: 'var(--border)' }}>
          {row(
            t('status'),
            <Badge variant={statusVariant(task.status)}>{statusLabel(task.status, t)}</Badge>,
          )}
          {row(
            t('priority'),
            <Badge variant={priorityVariant(task.priority)}>{t(task.priority)}</Badge>,
          )}
          {task.client &&
            row(
              t('clients'),
              <span className="inline-flex items-center gap-2">
                <ClientBrandMark
                  name={task.client.name}
                  logoUrl={task.client.logo}
                  size={28}
                  roundedClassName="rounded-lg"
                />
                {task.client.name}
              </span>,
            )}
          {task.start_date && row(t('startDate'), fmtDate(task.start_date))}
          {task.due_date &&
            row(
              t('deadline'),
              <span
                className={overdue ? 'font-medium' : ''}
                style={overdue ? { color: 'var(--color-danger)' } : undefined}
              >
                {fmtDate(task.due_date)}
                {overdue ? ` (${t('overdue')})` : ''}
              </span>,
            )}
          {assignee && row(t('assignedTo'), assignee.full_name)}
          {creator && row(t('createdBy'), creator.full_name)}
          {row(t('createdOn'), fmtDate(task.created_at))}
          {mentionedMembers.length > 0 &&
            row(
              t('mentions'),
              <div className="flex flex-wrap gap-1">
                {mentionedMembers.map((m) => (
                  <span
                    key={m.id}
                    className="rounded-full px-2 py-0.5 text-xs font-medium"
                    style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
                  >
                    @{m.full_name}
                  </span>
                ))}
              </div>,
            )}
          {task.tags &&
            task.tags.length > 0 &&
            row(
              t('tags'),
              <div className="flex flex-wrap gap-1">
                {task.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full px-2 py-0.5 text-xs"
                    style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
                  >
                    {tag}
                  </span>
                ))}
              </div>,
            )}
        </div>
      </div>
    </Modal>
  );
}

// ─── KanbanBoard ─────────────────────────────────────────────────────────────

type KanbanColumnId = 'todo' | 'in_progress' | 'in_review' | 'done';

const KANBAN_COLS: { key: KanbanColumnId; label: string }[] = [
  { key: 'todo', label: 'todo' },
  { key: 'in_progress', label: 'inProgress' },
  { key: 'in_review', label: 'review' },
  { key: 'done', label: 'done' },
];

const KANBAN_STATUS_MAP: Record<KanbanColumnId, Task['status'][]> = {
  todo: ['todo'],
  in_progress: ['in_progress'],
  in_review: ['in_review', 'review'],
  done: ['done', 'completed', 'delivered', 'published'],
};

function getKanbanColumn(status: Task['status']): KanbanColumnId | null {
  if (KANBAN_STATUS_MAP.todo.includes(status)) return 'todo';
  if (KANBAN_STATUS_MAP.in_progress.includes(status)) return 'in_progress';
  if (KANBAN_STATUS_MAP.in_review.includes(status)) return 'in_review';
  if (KANBAN_STATUS_MAP.done.includes(status)) return 'done';
  return null;
}

function getPersistedStatus(col: KanbanColumnId): Task['status'] {
  if (col === 'in_review') return 'in_review';
  if (col === 'done') return 'done';
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

const KanbanPreviewCard = React.memo(function KanbanPreviewCard({
  task,
  team,
  t,
}: {
  task: Task;
  team: TeamMember[];
  t: (k: string) => string;
}) {
  const assignee = team.find((m) => m.id === task.assigned_to);
  const overdue = isOverdue(task.due_date, task.status);
  const tone = getStatusTone(overdue ? 'overdue' : task.status);
  return (
    <div
      className="scale-[1.02] space-y-3 rounded-2xl border p-4 opacity-95"
      style={{
        width: '18rem',
        background: 'var(--surface)',
        borderColor: 'var(--border)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="flex-1 text-sm font-semibold leading-snug" style={{ color: 'var(--text)' }}>
          {task.title}
        </p>
        <span
          className="rounded-full border px-2 py-0.5 text-[10px] font-semibold"
          style={{ background: tone.bg, color: tone.text, borderColor: tone.border }}
        >
          {statusLabel(overdue ? 'overdue' : task.status, t)}
        </span>
      </div>
      {task.description && (
        <p className="line-clamp-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
          {task.description}
        </p>
      )}
      <div className="flex items-center justify-between gap-2 text-xs">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold"
            style={{
              background: 'var(--surface-2)',
              borderColor: 'var(--border)',
              color: 'var(--text-secondary)',
            }}
          >
            {avatarInitials(assignee?.full_name)}
          </span>
          <span className="truncate" style={{ color: 'var(--text-secondary)' }}>
            {assignee?.full_name ?? t('unassigned')}
          </span>
        </div>
        <Badge variant={priorityVariant(task.priority)}>{t(task.priority)}</Badge>
      </div>
      {task.due_date && (
        <div
          className="inline-flex items-center gap-1.5 self-start rounded-full border px-2.5 py-1 text-xs"
          style={{
            background: overdue ? 'var(--color-danger-bg)' : 'var(--surface-2)',
            borderColor: overdue ? 'var(--color-danger-border)' : 'var(--border)',
            color: overdue ? 'var(--color-danger)' : 'var(--text-secondary)',
          }}
        >
          <Calendar size={11} />
          {fmtDate(task.due_date)}
        </div>
      )}
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
  const assignee = team.find((m) => m.id === task.assigned_to);
  const tone = getStatusTone(overdue ? 'overdue' : task.status);

  return (
    <div className="space-y-2">
      {showDropIndicator && (
        <div className="h-1 rounded-full" style={{ background: 'var(--accent)' }} />
      )}
      <div
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        className="cursor-grab select-none space-y-3 rounded-2xl border p-4 transition-all duration-200 ease-out hover:-translate-y-0.5 active:cursor-grabbing"
        style={{
          transform: CSS.Transform.toString(transform),
          transition,
          opacity: isDragging ? 0.2 : 1,
          background: 'var(--surface)',
          borderColor: 'var(--border)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="flex-1 text-sm font-semibold leading-snug" style={{ color: 'var(--text)' }}>
            {task.title}
          </p>
          <GripVertical size={14} style={{ color: 'var(--text-tertiary)' }} />
        </div>
        {task.description && (
          <p className="line-clamp-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
            {task.description}
          </p>
        )}
        {task.client ? (
          <div className="flex min-w-0 items-center gap-2">
            <ClientBrandMark
              name={task.client.name}
              logoUrl={task.client.logo}
              size={24}
              roundedClassName="rounded-lg"
            />
            <span
              className="truncate text-xs font-medium"
              style={{ color: 'var(--text-secondary)' }}
            >
              {task.client.name}
            </span>
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2 text-xs">
            <span
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold"
              style={{
                background: 'var(--surface-2)',
                borderColor: 'var(--border)',
                color: 'var(--text-secondary)',
              }}
            >
              {avatarInitials(assignee?.full_name)}
            </span>
            <span className="truncate" style={{ color: 'var(--text-secondary)' }}>
              {assignee?.full_name ?? t('unassigned')}
            </span>
          </div>
          <Badge variant={priorityVariant(task.priority)}>{t(task.priority)}</Badge>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span
            className="rounded-full border px-2 py-0.5 text-[10px] font-semibold"
            style={{ background: tone.bg, color: tone.text, borderColor: tone.border }}
          >
            {statusLabel(overdue ? 'overdue' : task.status, t)}
          </span>
          {task.due_date && (
            <span
              className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]"
              style={{
                background: overdue ? 'var(--color-danger-bg)' : 'var(--surface-2)',
                borderColor: overdue ? 'var(--color-danger-border)' : 'var(--border)',
                color: overdue ? 'var(--color-danger)' : 'var(--text-secondary)',
              }}
            >
              <Calendar size={10} />
              {fmtDate(task.due_date)}
            </span>
          )}
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onView(task);
              }}
              className="rounded p-1 transition-colors hover:bg-[var(--surface)]"
              style={{ color: 'var(--text-secondary)' }}
            >
              <Eye size={13} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(task);
              }}
              className="rounded p-1 transition-colors hover:bg-[var(--surface)]"
              style={{ color: 'var(--text-secondary)' }}
            >
              <Pencil size={13} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(task);
              }}
              className="rounded p-1 transition-colors hover:bg-[var(--color-danger-bg)]"
              style={{ color: 'var(--color-danger)' }}
            >
              <Trash2 size={13} />
            </button>
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
      className="flex w-[18.25rem] flex-shrink-0 snap-start flex-col rounded-2xl border transition-all duration-200 sm:w-[19.5rem]"
      style={{
        background: 'var(--surface)',
        borderColor: isOver ? 'var(--accent)' : 'var(--border)',
        boxShadow: isOver ? 'var(--shadow-focus)' : 'var(--shadow-sm)',
      }}
    >
      <div
        className="flex items-center justify-between border-b px-4 py-3.5"
        style={{ borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
            {t(col.label)}
          </span>
          <span
            className="flex h-6 min-w-[1.5rem] items-center justify-center rounded-full px-2 text-xs font-bold"
            style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
          >
            {colTasks.length}
          </span>
        </div>
      </div>
      <SortableContext
        items={colTasks.map((task) => task.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="max-h-[calc(100vh-300px)] flex-1 space-y-3 overflow-y-auto p-4">
          {colTasks.length === 0 ? (
            <div
              className="space-y-2 rounded-2xl border px-4 py-8 text-center"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <CheckSquare
                size={16}
                className="mx-auto"
                style={{ color: 'var(--text-tertiary)' }}
              />
              <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                {t('noTasksKanban')}
              </p>
            </div>
          ) : (
            colTasks.map((task) => (
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
            <div className="mt-2 h-1 rounded-full" style={{ background: 'var(--accent)' }} />
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
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [overColumnId, setOverColumnId] = useState<KanbanColumnId | null>(null);
  const [overTaskId, setOverTaskId] = useState<string | null>(null);

  const columns = useMemo(() => {
    const mapped: Record<KanbanColumnId, Task[]> = {
      todo: [],
      in_progress: [],
      in_review: [],
      done: [],
    };
    for (const task of tasks) {
      const col = getKanbanColumn(task.status);
      if (!col) continue;
      mapped[col].push(task);
    }
    return {
      todo: sortKanbanTasks(mapped.todo),
      in_progress: sortKanbanTasks(mapped.in_progress),
      in_review: sortKanbanTasks(mapped.in_review),
      done: sortKanbanTasks(mapped.done),
    };
  }, [tasks]);

  const activeTask = activeTaskId ? (tasks.find((task) => task.id === activeTaskId) ?? null) : null;

  const getColumnByTaskId = useCallback(
    (taskId: string): KanbanColumnId | null => {
      const task = tasks.find((t) => t.id === taskId);
      return task ? getKanbanColumn(task.status) : null;
    },
    [tasks],
  );

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
    const activeTask = tasks.find((task) => task.id === activeId);
    if (!activeTask) return;

    const sourceColumn = getKanbanColumn(activeTask.status);
    if (!sourceColumn) return;

    const destinationColumn = overId.startsWith('column-')
      ? (overId.replace('column-', '') as KanbanColumnId)
      : getColumnByTaskId(overId);
    if (!destinationColumn) return;

    const sourceTasks = [...columns[sourceColumn]];
    const destinationTasks =
      sourceColumn === destinationColumn ? sourceTasks : [...columns[destinationColumn]];
    const oldIndex = sourceTasks.findIndex((task) => task.id === activeId);
    if (oldIndex < 0) return;

    if (sourceColumn === destinationColumn) {
      const newIndex = overId.startsWith('column-')
        ? sourceTasks.length - 1
        : sourceTasks.findIndex((task) => task.id === overId);
      if (newIndex < 0 || newIndex === oldIndex) return;

      const reordered = arrayMove(sourceTasks, oldIndex, newIndex);
      const updateMap = new Map<string, { status: Task['status']; position: number }>();
      reordered.forEach((task, index) =>
        updateMap.set(task.id, { status: task.status, position: index }),
      );
      const updates = reordered
        .map((task) => {
          const update = updateMap.get(task.id);
          if (!update) return null;
          const changed = task.status !== update.status || getPosition(task) !== update.position;
          return changed ? { id: task.id, ...update } : null;
        })
        .filter(
          (item): item is { id: string; status: Task['status']; position: number } => item !== null,
        );
      if (updates.length === 0) return;
      const nextTasks = tasks.map((task) => {
        const update = updateMap.get(task.id);
        if (!update) return task;
        return { ...task, status: update.status, position: update.position };
      });
      onReorder(nextTasks, tasks, updates);
      return;
    }

    const [movedTask] = sourceTasks.splice(oldIndex, 1);
    const targetIndex = overId.startsWith('column-')
      ? destinationTasks.length
      : destinationTasks.findIndex((task) => task.id === overId);
    const insertAt = targetIndex < 0 ? destinationTasks.length : targetIndex;
    destinationTasks.splice(insertAt, 0, movedTask);

    const updateMap = new Map<string, { status: Task['status']; position: number }>();
    sourceTasks.forEach((task, index) =>
      updateMap.set(task.id, { status: task.status, position: index }),
    );
    destinationTasks.forEach((task, index) =>
      updateMap.set(task.id, {
        status: task.id === movedTask.id ? getPersistedStatus(destinationColumn) : task.status,
        position: index,
      }),
    );

    const updates = Array.from(updateMap.entries())
      .map(([id, value]) => ({ id, ...value }))
      .filter((update) => {
        const current = tasks.find((task) => task.id === update.id);
        return (
          current && (current.status !== update.status || getPosition(current) !== update.position)
        );
      });
    if (updates.length === 0) return;

    const nextTasks = tasks.map((task) => {
      const update = updateMap.get(task.id);
      if (!update) return task;
      return { ...task, status: update.status, position: update.position };
    });
    onReorder(nextTasks, tasks, updates);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setActiveTaskId(null);
        setOverColumnId(null);
        setOverTaskId(null);
      }}
    >
      <div className="flex snap-x snap-mandatory gap-5 overflow-x-auto pb-5 pe-2">
        {KANBAN_COLS.map((col) => (
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

const MUTATION_TIMEOUT_MS = 15_000;
const INVALIDATION_DELAY_MS = 120;

export default function TasksPage() {
  const { t } = useLang();
  const { role, user } = useAuth();
  const { toast } = useToast();
  const { periodStart, periodEnd } = useAppPeriod();
  const queryClient = useQueryClient();
  const tasksQueryKey = useMemo(
    () => ['tasks-all', periodStart, periodEnd] as const,
    [periodStart, periodEnd],
  );
  const invalidateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canManageTasks = role === 'admin' || role === 'manager' || role === 'team_member';
  const canEditTasks = canEditEntity(role, 'task');
  const canDeleteTasks = canDeleteEntity(role, 'task');
  const deleteTaskMutation = useDeleteTask();
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);

  // ── React Query: fetch and cache tasks, clients, and team ────────────────
  // Caching across navigations means re-visiting this page within the
  // staleTime window renders data immediately without a loading spinner,
  // then background-refetches to stay fresh.
  const {
    data: queryData,
    isLoading: loading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: tasksQueryKey,
    queryFn: async () => {
      const [tasksRes, clientsRes, projectsRes, teamRes] = await Promise.allSettled([
        // Use updated_at (not due_date) so tasks without due dates are still visible.
        // This keeps list behavior aligned with dashboard task statistics.
        applyUtcTimestampRange(
          supabase.from('tasks').select('*, client:clients(id,name,logo,slug)'),
          'updated_at',
          periodStart,
          periodEnd,
        )
          .order('created_at', { ascending: false })
          .limit(200),
        supabase.from('clients').select('id,name,logo,slug').order('name'),
        supabase.from('projects').select('id,name,client_id').order('name'),
        // Select only the columns the UI actually uses to reduce payload size.
        supabase
          .from('team_members')
          .select('id,full_name,email,role,avatar_url,job_title,created_at')
          .order('full_name'),
      ]);

      if (tasksRes.status === 'rejected') {
        console.error('[tasks] tasks fetch rejected:', tasksRes.reason);
      } else if (tasksRes.value.error) {
        console.error('[tasks] tasks fetch error:', tasksRes.value.error);
        throw new Error(tasksRes.value.error.message);
      }
      if (clientsRes.status === 'rejected')
        console.error('[tasks] clients fetch rejected:', clientsRes.reason);
      else if (clientsRes.value.error)
        console.error('[tasks] clients fetch error:', clientsRes.value.error);
      if (projectsRes.status === 'rejected')
        console.error('[tasks] projects fetch rejected:', projectsRes.reason);
      else if (projectsRes.value.error)
        console.error('[tasks] projects fetch error:', projectsRes.value.error);
      if (teamRes.status === 'rejected')
        console.error('[tasks] team fetch rejected:', teamRes.reason);
      else if (teamRes.value.error) console.error('[tasks] team fetch error:', teamRes.value.error);

      return {
        tasks:
          tasksRes.status === 'fulfilled' && !tasksRes.value.error
            ? ((tasksRes.value.data ?? []) as Task[])
            : [],
        clients:
          clientsRes.status === 'fulfilled' && !clientsRes.value.error
            ? ((clientsRes.value.data ?? []) as Client[])
            : [],
        projects:
          projectsRes.status === 'fulfilled' && !projectsRes.value.error
            ? ((projectsRes.value.data ?? []) as Project[])
            : [],
        team:
          teamRes.status === 'fulfilled' && !teamRes.value.error
            ? ((teamRes.value.data ?? []) as TeamMember[])
            : [],
      };
    },
    retry: 1,
  });

  const fetchError = queryError ? (queryError as Error).message : null;

  // Local state for optimistic updates — seeded from React Query cache on
  // first render and kept in sync when the background fetch completes.
  const cachedOnMount = queryClient.getQueryData<{
    tasks: Task[];
    clients: Client[];
    projects: Project[];
    team: TeamMember[];
  }>(tasksQueryKey);
  const [tasks, setTasks] = useState<Task[]>(() => cachedOnMount?.tasks ?? []);
  const [clients, setClients] = useState<Client[]>(() => cachedOnMount?.clients ?? []);
  const [projects, setProjects] = useState<Project[]>(() => cachedOnMount?.projects ?? []);
  const [team, setTeam] = useState<TeamMember[]>(() => cachedOnMount?.team ?? []);

  // Keep local state in sync when React Query data arrives / updates.
  useEffect(() => {
    if (queryData) {
      setTasks(queryData.tasks);
      setClients(queryData.clients);
      setProjects(queryData.projects);
      setTeam(queryData.team);
    }
  }, [queryData]);

  useEffect(
    () => () => {
      if (invalidateTimerRef.current) clearTimeout(invalidateTimerRef.current);
    },
    [],
  );

  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

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
  const [dateFilter, setDateFilter] = useState<TaskDateFilter>('this_week');
  const [quickFilter, setQuickFilter] = useState<TaskQuickFilter>('all');
  const [customRange, setCustomRange] = useState<{ from: string; to: string } | null>(null);
  const [customRangeOpen, setCustomRangeOpen] = useState(false);
  const [draftCustomRange, setDraftCustomRange] = useState<DateRange | undefined>();
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [view, setView] = useState<'list' | 'kanban'>('kanban');

  useEffect(() => {
    const savedView = window.localStorage.getItem('tasks-all-view');
    if (savedView === 'list' || savedView === 'kanban') setView(savedView);
    try {
      const savedFilters = JSON.parse(window.localStorage.getItem('tasks-all-filters') ?? '{}') as {
        statusFilter?: string;
        clientFilter?: string;
        assignedFilter?: string;
        priorityFilter?: string;
        dateFilter?: TaskDateFilter;
        quickFilter?: TaskQuickFilter;
        customRange?: { from: string; to: string } | null;
        searchQuery?: string;
      };
      if (savedFilters.statusFilter) setStatusFilter(savedFilters.statusFilter);
      if (savedFilters.clientFilter) setClientFilter(savedFilters.clientFilter);
      if (savedFilters.assignedFilter) setAssignedFilter(savedFilters.assignedFilter);
      if (savedFilters.priorityFilter) setPriorityFilter(savedFilters.priorityFilter);
      if (savedFilters.dateFilter) setDateFilter(savedFilters.dateFilter);
      if (savedFilters.quickFilter) setQuickFilter(savedFilters.quickFilter);
      if (savedFilters.customRange) setCustomRange(savedFilters.customRange);
      if (savedFilters.searchQuery) setSearchQuery(savedFilters.searchQuery);
    } catch {
      // ignore invalid saved filters
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem('tasks-all-view', view);
  }, [view]);

  useEffect(() => {
    window.localStorage.setItem(
      'tasks-all-filters',
      JSON.stringify({
        statusFilter,
        clientFilter,
        assignedFilter,
        priorityFilter,
        dateFilter,
        quickFilter,
        customRange,
        searchQuery,
      }),
    );
  }, [
    statusFilter,
    clientFilter,
    assignedFilter,
    priorityFilter,
    dateFilter,
    quickFilter,
    customRange,
    searchQuery,
  ]);

  // Forms
  const [createForm, setCreateForm] = useState({ ...blankForm });
  const [editForm, setEditForm] = useState({ ...blankForm });

  // ── filtered tasks ───────────────────────────────────────────────────────
  const todayDate = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const todayIso = toYmd(todayDate);
  const filtered = useMemo(
    () =>
      tasks.filter((task) => {
        const dueDate = task.due_date ?? null;
        const dueDateObj = parseDateOnly(dueDate);
        if (statusFilter !== 'all' && task.status !== statusFilter) return false;
        if (clientFilter && task.client_id !== clientFilter) return false;
        if (assignedFilter && task.assigned_to !== assignedFilter) return false;
        if (priorityFilter && task.priority !== priorityFilter) return false;
        const tomorrowDate = addDays(todayDate, 1);
        const thisWeekStart = startOfWeek(todayDate, { weekStartsOn: 1 });
        const thisWeekEnd = endOfWeek(todayDate, { weekStartsOn: 1 });
        const nextWeekDate = addDays(todayDate, 7);

        if (dateFilter === 'today' && !(dueDateObj && toYmd(dueDateObj) === todayIso)) return false;
        if (dateFilter === 'tomorrow' && !(dueDateObj && toYmd(dueDateObj) === toYmd(tomorrowDate)))
          return false;
        if (dateFilter === 'this_week') {
          if (!dueDateObj || dueDateObj < thisWeekStart || dueDateObj > thisWeekEnd) return false;
        }
        if (dateFilter === 'next_7_days') {
          if (!dueDateObj || dueDateObj < todayDate || dueDateObj > nextWeekDate) return false;
        }
        if (dateFilter === 'overdue' && !isOverdue(dueDate ?? undefined, task.status)) return false;
        if (dateFilter === 'no_due_date' && dueDateObj) return false;
        if (dateFilter === 'custom') {
          const from = parseDateOnly(customRange?.from);
          const to = parseDateOnly(customRange?.to);
          if (!from || !to || !dueDateObj || dueDateObj < from || dueDateObj > to) return false;
        }

        if (quickFilter === 'mine' && task.assigned_to !== user.id) return false;
        if (quickFilter === 'overdue' && !isOverdue(dueDate ?? undefined, task.status))
          return false;
        if (quickFilter === 'due_today' && !(dueDateObj && toYmd(dueDateObj) === todayIso))
          return false;
        if (quickFilter === 'no_assignee' && task.assigned_to) return false;

        if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase()))
          return false;
        return true;
      }),
    [
      tasks,
      statusFilter,
      clientFilter,
      assignedFilter,
      priorityFilter,
      dateFilter,
      quickFilter,
      customRange,
      searchQuery,
      todayIso,
      todayDate,
      user.id,
    ],
  );

  // ── create ───────────────────────────────────────────────────────────────
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    if (!canManageTasks) {
      setCreateError(t('onlyAdminCanCreateTasks'));
      return;
    }
    if (!createForm.title.trim()) return;
    if (!createForm.client_id) {
      setCreateError(t('pleaseSelectClient'));
      return;
    }
    if (!createForm.assigned_to) {
      setCreateError(t('pleaseAssignMember'));
      return;
    }
    if (!createForm.due_date) {
      setCreateError(t('pleaseSetDueDate'));
      return;
    }
    setSaving(true);

    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    try {
      const payload = {
        title: createForm.title.trim(),
        description: createForm.description || null,
        status: createForm.status,
        priority: createForm.priority,
        start_date: createForm.start_date || null,
        due_date: createForm.due_date,
        client_id: createForm.client_id,
        project_id: createForm.project_id || null,
        assigned_to: createForm.assigned_to,
        created_by: createForm.created_by || null,
        mentions: Array.isArray(createForm.mentions) ? createForm.mentions : [],
        tags: parseTags(createForm.tags),
      };

      const fetchWithTimeout = new Promise<Response>((resolve, reject) => {
        timeoutHandle = setTimeout(
          () => reject(new Error(t('requestTimedOut'))),
          MUTATION_TIMEOUT_MS,
        );
        fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }).then(resolve, reject);
      });

      const res = await fetchWithTimeout;
      clearTimeout(timeoutHandle); // Clear as soon as the fetch resolves
      let result: { success: boolean; task?: Task; step?: string; error?: string };
      try {
        result = (await res.json()) as typeof result;
      } catch {
        throw new Error(t('serverStatusNonJson', { status: res.status }));
      }

      if (!result.success) {
        const step = result.step ? ` [${result.step}]` : '';
        const msg = result.error ?? t('failedCreateTask');
        throw new Error(`${msg}${step}`);
      }

      // — SUCCESS PATH —
      setCreateOpen(false);
      setCreateForm({ ...blankForm });
      toast(`Create task / ${createForm.title}: done`, 'success');

      if (result.task) {
        const createdTask = result.task;
        setTasks((prev) => [createdTask, ...prev.filter((t) => t.id !== createdTask.id)]);
        queryClient.setQueryData<{
          tasks: Task[];
          clients: Client[];
          projects: Project[];
          team: TeamMember[];
        }>(tasksQueryKey, (old) =>
          old
            ? { ...old, tasks: [createdTask, ...old.tasks.filter((t) => t.id !== createdTask.id)] }
            : old,
        );
      }

      void queryClient.invalidateQueries({ queryKey: ['tasks-all'] });
    } catch (err: unknown) {
      console.error('[task create] error:', err);
      const message =
        err instanceof Error
          ? err.message
          : ((err as { message?: string })?.message ?? t('failedCreateTask'));
      setCreateError(message);
      toast(`Create task / ${createForm.title || 'untitled'}: ${message}`, 'error');
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
        title: editForm.title.trim(),
        description: editForm.description || null,
        status: editForm.status,
        priority: editForm.priority,
        start_date: editForm.start_date || null,
        due_date: editForm.due_date || null,
        client_id: editForm.client_id || null,
        project_id: editForm.project_id || null,
        assigned_to: editForm.assigned_to || null,
        created_by: editForm.created_by || null,
        mentions: Array.isArray(editForm.mentions) ? editForm.mentions : [],
        tags: parseTags(editForm.tags),
      };

      const fetchWithTimeout = new Promise<Response>((resolve, reject) => {
        timeoutHandle = setTimeout(
          () => reject(new Error(t('requestTimedOut'))),
          MUTATION_TIMEOUT_MS,
        );
        fetch(`/api/tasks/${editTask.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }).then(resolve, reject);
      });

      const res = await fetchWithTimeout;
      clearTimeout(timeoutHandle); // Clear as soon as the fetch resolves
      let result: { success: boolean; task?: Task; step?: string; error?: string };
      try {
        result = (await res.json()) as typeof result;
      } catch {
        throw new Error(t('serverStatusNonJson', { status: res.status }));
      }

      if (!result.success) {
        const step = result.step ? ` [${result.step}]` : '';
        const msg = result.error ?? t('failedUpdateTask');
        throw new Error(`${msg}${step}`);
      }

      // Update local state immediately with the returned task so the list
      // reflects the change without waiting for a round-trip fetch.
      if (result.task) {
        setTasks((prev) => prev.map((tk) => (tk.id === editTask.id ? (result.task ?? tk) : tk)));
      }

      setEditTask(null);
      toast(`Update task / ${editForm.title}: done`, 'success');

      // Background refresh via React Query cache invalidation
      void queryClient.invalidateQueries({ queryKey: ['tasks-all'] });
    } catch (err: unknown) {
      console.error('[task edit] error:', err);
      const message =
        err instanceof Error
          ? err.message
          : ((err as { message?: string })?.message ?? t('failedUpdateTask'));
      setEditError(message);
      toast(`Update task / ${editForm.title || 'untitled'}: ${message}`, 'error');
    } finally {
      clearTimeout(timeoutHandle);
      setSaving(false);
    }
  };

  // ── delete ────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTask) return;
    try {
      setDeletingTaskId(deleteTask.id);
      const deletedTitle = deleteTask.title;
      await deleteTaskMutation.mutateAsync(deleteTask.id);
      setTasks((prev) => prev.filter((t) => t.id !== deleteTask.id));
      setDeleteTask(null);
      toast(`Delete task / ${deletedTitle}: done`, 'success');
    } catch (err: unknown) {
      console.error('[task delete] error:', err);
      const message =
        err instanceof Error
          ? err.message
          : ((err as { message?: string })?.message ?? t('failedDeleteTask'));
      toast(`Delete task / ${deleteTask?.title || 'task'}: ${message}`, 'error');
    } finally {
      setDeletingTaskId((current) => (current === deleteTask.id ? null : current));
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
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: newStatus as Task['status'] } : t)),
    );

    // Helper to revert the optimistic update on any failure.
    const revertStatus = () =>
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: task.status } : t)));

    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const result = (await res.json()) as { success: boolean; error?: string };
      if (!result.success) {
        console.error('[task status] update failed:', result.error);
        revertStatus();
        toast(
          `Update task status / ${task.title}: ${result.error ?? t('unknownError')}`,
          'warning',
        );
      } else {
        invalidateTaskRelatedQueries();
        toast(`Update task status / ${task.title}: done`, 'success');
      }
    } catch (err) {
      console.error('[task status] network error:', err);
      revertStatus();
      toast(`Update task status / ${task.title}: ${t('failedUpdateTaskStatusRetry')}`, 'warning');
    }
  };

  const handleKanbanReorder = useCallback(
    async (nextTasks: Task[], previousTasks: Task[], updates: KanbanPatch[]) => {
      setTasks(nextTasks);
      try {
        const results = await Promise.all(
          updates.map(async (update) => {
            const res = await fetch(`/api/tasks/${update.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: update.status, position: update.position }),
            });
            const json = (await res.json()) as { success: boolean; error?: string };
            return { ok: res.ok && json.success, error: json.error };
          }),
        );
        const failed = results.find((r) => !r.ok);
        if (failed) throw new Error(failed.error ?? t('failedUpdateTaskOrder'));
        invalidateTaskRelatedQueries();
        toast(`Reorder tasks: done (${updates.length})`, 'success');
      } catch (err) {
        setTasks(previousTasks);
        toast(
          `Reorder tasks: ${err instanceof Error ? err.message : t('failedMoveTaskReverted')}`,
          'warning',
        );
      }
    },
    [invalidateTaskRelatedQueries, setTasks, toast, t],
  );

  const totalOverdue = useMemo(
    () => tasks.filter((task) => isOverdue(task.due_date, task.status)).length,
    [tasks],
  );
  const doneCount = useMemo(
    () => tasks.filter((task) => COMPLETED_STATUSES.has(task.status)).length,
    [tasks],
  );
  const dueBuckets = useMemo(() => {
    return tasks.reduce(
      (acc, task) => {
        if (!task.due_date || COMPLETED_STATUSES.has(task.status)) return acc;
        if (task.due_date < todayIso) acc.overdue += 1;
        else if (task.due_date === todayIso) acc.dueToday += 1;
        else acc.upcoming += 1;
        return acc;
      },
      { overdue: 0, dueToday: 0, upcoming: 0 },
    );
  }, [tasks, todayIso]);
  const activeFilterCount = [
    statusFilter !== 'all',
    clientFilter,
    assignedFilter,
    priorityFilter,
    dateFilter !== 'this_week',
    quickFilter !== 'all',
    searchQuery,
  ].filter(Boolean).length;

  return (
    <PageShell className="openy-tasks-page animate-openy-fade-in space-y-6">
      <Card padding="sm" className="sm:p-6">
        <PageHeader
          title={t('tasks')}
          subtitle={t('tasksPageSubtitle', { shown: filtered.length, total: tasks.length })}
          actions={
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <div
                role="tablist"
                aria-label={t('taskViewsAria')}
                className="openy-segmented flex gap-2"
              >
                <button
                  onClick={() => setView('list')}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl px-4 text-sm font-medium transition-colors"
                  style={{
                    background: view === 'list' ? 'var(--accent)' : 'var(--surface-2)',
                    color: view === 'list' ? 'var(--accent-contrast)' : 'var(--text-secondary)',
                    border: `1px solid ${view === 'list' ? 'var(--accent)' : 'var(--border)'}`,
                  }}
                  role="tab"
                  aria-selected={view === 'list'}
                  aria-controls="tasks-list-panel"
                  id="tasks-list-tab"
                >
                  <List size={14} />
                  {t('list')}
                </button>
                <button
                  onClick={() => setView('kanban')}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl px-4 text-sm font-medium transition-colors"
                  style={{
                    background: view === 'kanban' ? 'var(--accent)' : 'var(--surface-2)',
                    color: view === 'kanban' ? 'var(--accent-contrast)' : 'var(--text-secondary)',
                    border: `1px solid ${view === 'kanban' ? 'var(--accent)' : 'var(--border)'}`,
                  }}
                  role="tab"
                  aria-selected={view === 'kanban'}
                  aria-controls="tasks-kanban-panel"
                  id="tasks-kanban-tab"
                >
                  <LayoutGrid size={14} />
                  {t('kanban')}
                </button>
              </div>
              {canManageTasks && (
                <Button
                  type="button"
                  variant="primary"
                  className="hidden sm:inline-flex"
                  onClick={() => setCreateOpen(true)}
                >
                  <Plus size={16} />
                  {t('newTask')}
                </Button>
              )}
            </div>
          }
        />
        <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-5">
          <div className="min-w-0">
            <StatCard
              label={t('donutTotal')}
              value={tasks.length}
              icon={<LayoutGrid size={18} />}
              color="blue"
            />
          </div>
          <div className="min-w-0">
            <StatCard
              label={t('done')}
              value={doneCount}
              icon={<CheckSquare size={18} />}
              color="green"
            />
          </div>
          <div className="min-w-0">
            <StatCard
              label={t('overdue')}
              value={totalOverdue}
              icon={<AlertCircle size={18} />}
              color="red"
            />
          </div>
          <div className="min-w-0">
            <StatCard
              label={t('today')}
              value={dueBuckets.dueToday}
              icon={<Clock size={18} />}
              color="amber"
            />
          </div>
          <div className="min-w-0">
            <StatCard
              label={t('upcoming')}
              value={dueBuckets.upcoming}
              icon={<Calendar size={18} />}
              color="violet"
            />
          </div>
        </div>
      </Card>

      <Card padding="sm" className="sm:p-5">
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative min-w-[220px] flex-1">
              <Search
                size={15}
                className="pointer-events-none absolute start-3 top-1/2 z-[1] -translate-y-1/2"
                style={{ color: 'var(--text-secondary)' }}
              />
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('searchTasks')}
                className="ps-9"
              />
            </div>
            <TaskDateFilterPill
              selected={dateFilter}
              customLabel={
                customRange?.from && customRange?.to
                  ? `${format(parseDateOnly(customRange.from) ?? new Date(), 'MMM d')} - ${format(
                      parseDateOnly(customRange.to) ?? new Date(),
                      'MMM d',
                    )}`
                  : null
              }
              onSelect={(next) => {
                setDateFilter(next);
                if (next === 'custom') {
                  const fallbackFrom = parseDateOnly(customRange?.from) ?? todayDate;
                  const fallbackTo = parseDateOnly(customRange?.to) ?? addDays(todayDate, 6);
                  setDraftCustomRange({ from: fallbackFrom, to: fallbackTo });
                  setCustomRangeOpen(true);
                }
              }}
            />
            <Button
              type="button"
              variant="secondary"
              className="h-10 shrink-0 px-3"
              onClick={() => setFiltersOpen((prev) => !prev)}
              aria-label={t('toggleFiltersAria')}
              aria-expanded={filtersOpen}
            >
              <SlidersHorizontal size={16} />
              <span className="hidden text-xs sm:inline">
                {t('activeFilterCountLabel', { count: activeFilterCount })}
              </span>
            </Button>
          </div>

          <div
            className={`${filtersOpen ? 'flex' : 'hidden'} flex-wrap items-center gap-2 sm:flex`}
          >
            <SelectDropdown
              value={clientFilter}
              onChange={setClientFilter}
              className="!h-10 min-w-[150px] rounded-lg !px-3"
              placeholder={t('allClients')}
              options={[
                { value: '', label: t('allClients') },
                ...clients.map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
            <SelectDropdown
              value={assignedFilter}
              onChange={setAssignedFilter}
              className="!h-10 min-w-[150px] rounded-lg !px-3"
              placeholder={t('allMembers')}
              options={[
                { value: '', label: t('allMembers') },
                ...team.map((m) => ({ value: m.id, label: m.full_name })),
              ]}
            />
            <SelectDropdown
              value={priorityFilter}
              onChange={setPriorityFilter}
              className="!h-10 min-w-[132px] rounded-lg !px-3"
              placeholder={t('allPriorities')}
              options={[
                { value: '', label: t('allPriorities') },
                { value: 'high', label: t('high') },
                { value: 'medium', label: t('medium') },
                { value: 'low', label: t('low') },
              ]}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {[
              { value: 'all' as const, label: 'All' },
              { value: 'mine' as const, label: 'My tasks' },
              { value: 'overdue' as const, label: 'Overdue' },
              { value: 'due_today' as const, label: 'Due today' },
              { value: 'no_assignee' as const, label: 'No assignee' },
            ].map((chip) => {
              const isActive = quickFilter === chip.value;
              return (
                <button
                  key={chip.value}
                  type="button"
                  onClick={() => setQuickFilter(chip.value)}
                  className="inline-flex h-8 items-center rounded-full border bg-[color:var(--surface)] px-3 text-xs font-medium transition-colors"
                  style={{
                    borderColor: isActive ? 'var(--accent)' : 'var(--border)',
                    color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                    background: isActive ? 'var(--accent-soft)' : 'var(--surface)',
                  }}
                >
                  {chip.label}
                </button>
              );
            })}
            {(clientFilter ||
              assignedFilter ||
              priorityFilter ||
              dateFilter !== 'this_week' ||
              quickFilter !== 'all' ||
              searchQuery ||
              statusFilter !== 'all') && (
              <Button
                type="button"
                variant="ghost"
                className="h-9 px-3 text-xs"
                onClick={() => {
                  setClientFilter('');
                  setAssignedFilter('');
                  setPriorityFilter('');
                  setDateFilter('this_week');
                  setQuickFilter('all');
                  setCustomRange(null);
                  setSearchQuery('');
                  setStatusFilter('all');
                }}
              >
                {t('clearFilters')}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Modal
        open={customRangeOpen}
        onClose={() => {
          setCustomRangeOpen(false);
        }}
        title="Custom range"
        size="md"
      >
        <div className="space-y-4">
          <div className="rounded-xl border p-3" style={{ borderColor: 'var(--border)' }}>
            <DayPicker
              mode="range"
              numberOfMonths={1}
              selected={draftCustomRange}
              onSelect={setDraftCustomRange}
              defaultMonth={draftCustomRange?.from ?? todayDate}
              classNames={{
                months: 'flex flex-col',
                month: 'space-y-2',
                caption:
                  'relative flex items-center justify-center pt-1 text-sm font-semibold text-[color:var(--text)]',
                nav: 'absolute inset-x-0 top-0.5 flex items-center justify-between px-1',
                button_previous:
                  'inline-flex h-7 w-7 items-center justify-center rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-soft)]',
                button_next:
                  'inline-flex h-7 w-7 items-center justify-center rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-soft)]',
                table: 'w-full border-collapse',
                head_cell:
                  'h-8 w-8 text-center text-[11px] font-medium text-[color:var(--text-secondary)]',
                cell: 'h-8 w-8 p-0 text-center align-middle',
                day: 'inline-flex h-8 w-8 items-center justify-center rounded-md text-sm text-[color:var(--text)] hover:bg-[color:var(--surface-soft)]',
                today: 'border border-[color:var(--accent)] text-[color:var(--accent)]',
                selected:
                  'bg-[color:var(--accent)] text-[var(--accent-foreground)] hover:bg-[color:var(--accent)] hover:text-[var(--accent-foreground)]',
                range_start: 'bg-[color:var(--accent)] text-[var(--accent-foreground)]',
                range_end: 'bg-[color:var(--accent)] text-[var(--accent-foreground)]',
                range_middle: 'bg-[color:var(--accent-soft)] text-[color:var(--text)]',
              }}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setCustomRangeOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={!draftCustomRange?.from || !draftCustomRange?.to}
              onClick={() => {
                if (!draftCustomRange?.from || !draftCustomRange?.to) return;
                setCustomRange({
                  from: toYmd(draftCustomRange.from),
                  to: toYmd(draftCustomRange.to),
                });
                setDateFilter('custom');
                setCustomRangeOpen(false);
              }}
            >
              Apply
            </Button>
          </div>
        </div>
      </Modal>

      {/* Task list / kanban */}
      {loading ? (
        <LoadingState rows={6} cardHeightClass="h-40" />
      ) : fetchError ? (
        <ErrorState
          title={t('tasks')}
          description={fetchError}
          actionLabel={t('assetsRetry')}
          onAction={() => void refetch()}
        />
      ) : filtered.length === 0 ? (
        <GlobalEmptyState
          title={t('noTasksYet')}
          description={t('noTasksDesc')}
          actionLabel={canManageTasks ? t('newTask') : undefined}
          onAction={canManageTasks ? () => setCreateOpen(true) : undefined}
        />
      ) : view === 'kanban' ? (
        <Card
          padding="sm"
          className="overflow-hidden sm:p-5"
          role="tabpanel"
          id="tasks-kanban-panel"
          aria-labelledby="tasks-kanban-tab"
        >
          <KanbanBoard
            tasks={filtered}
            team={team}
            onView={setViewTask}
            onEdit={openEdit}
            onDelete={setDeleteTask}
            t={t}
            onReorder={handleKanbanReorder}
          />
        </Card>
      ) : (
        <div
          className="space-y-3"
          role="table"
          aria-label={t('tasksListAriaLabel')}
          aria-rowcount={filtered.length}
          aria-colcount={6}
          id="tasks-list-panel"
          aria-labelledby="tasks-list-tab"
        >
          <div role="rowgroup" className="hidden md:block">
            <div
              role="row"
              className="grid grid-cols-[2fr,1.2fr,1fr,1fr,1fr,auto] gap-3 rounded-xl border px-4 py-2 text-[11px] font-semibold uppercase tracking-wide"
              style={{
                background: 'var(--surface-2)',
                color: 'var(--text-tertiary)',
                borderColor: 'var(--border)',
              }}
            >
              <span role="columnheader">{t('tasksListColTask')}</span>
              <span role="columnheader">{t('tasksListColClientProject')}</span>
              <span role="columnheader">{t('status')}</span>
              <span role="columnheader">{t('priority')}</span>
              <span role="columnheader">{t('deadline')}</span>
              <span role="columnheader">
                <ArrowUpDown size={12} />
              </span>
            </div>
          </div>
          <div role="rowgroup" className="space-y-2">
            {filtered.map((task) => {
              const overdue = isOverdue(task.due_date, task.status);
              const assignee = team.find((m) => m.id === task.assigned_to);
              const tone = getStatusTone(overdue ? 'overdue' : task.status);
              return (
                <div key={task.id}>
                  <div
                    role="row"
                    className="hidden grid-cols-[2fr,1.2fr,1fr,1fr,1fr,auto] items-center gap-3 rounded-2xl border px-5 py-4 transition-all hover:-translate-y-0.5 md:grid"
                    style={{
                      background: 'var(--surface)',
                      borderColor: 'var(--border)',
                      boxShadow: 'var(--shadow-sm)',
                    }}
                  >
                    <div className="min-w-0">
                      <p
                        className="truncate text-sm font-semibold"
                        style={{ color: 'var(--text)' }}
                      >
                        {task.title}
                      </p>
                      {task.description && (
                        <p className="truncate text-xs" style={{ color: 'var(--text-secondary)' }}>
                          {task.description}
                        </p>
                      )}
                      {assignee && (
                        <p className="mt-1 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                          {assignee.full_name}
                        </p>
                      )}
                    </div>
                    <div className="flex min-w-0 items-center gap-2">
                      {task.client ? (
                        <>
                          <ClientBrandMark
                            name={task.client.name}
                            logoUrl={task.client.logo}
                            size={26}
                            roundedClassName="rounded-md"
                          />
                          <p
                            className="truncate text-sm"
                            style={{ color: 'var(--text-secondary)' }}
                          >
                            {task.client.name}
                          </p>
                        </>
                      ) : (
                        <p className="truncate text-sm" style={{ color: 'var(--text-secondary)' }}>
                          -
                        </p>
                      )}
                    </div>
                    <span
                      className="justify-self-start rounded-full border px-2.5 py-1 text-xs font-semibold"
                      style={{ background: tone.bg, color: tone.text, borderColor: tone.border }}
                    >
                      {statusLabel(overdue ? 'overdue' : task.status, t)}
                    </span>
                    <Badge variant={priorityVariant(task.priority)}>
                      {task.priority === 'high' ? `${t('high')} ↑` : t(task.priority)}
                    </Badge>
                    <p
                      className={`text-sm ${overdue ? 'font-semibold' : ''}`}
                      style={{ color: overdue ? 'var(--color-danger)' : 'var(--text-secondary)' }}
                    >
                      {task.due_date ? fmtDate(task.due_date) : '-'}
                    </p>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setViewTask(task)}
                        className="btn-ghost p-1.5"
                        aria-label={t('viewTaskNamed', { name: task.title })}
                      >
                        <Eye size={14} />
                      </button>
                      <div title={canDeleteTasks ? undefined : "You don't have permission"}>
                        <EntityActionsMenu
                          loading={deletingTaskId === task.id}
                          onEdit={canEditTasks ? () => openEdit(task) : undefined}
                          onDelete={canDeleteTasks ? () => setDeleteTask(task) : undefined}
                          editLabel={t('editAction')}
                          deleteLabel={t('deleteAction')}
                          disabled={!canEditTasks && !canDeleteTasks}
                        />
                      </div>
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
                      canEdit={canEditTasks}
                      canDelete={canDeleteTasks}
                      t={t}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {canManageTasks && (
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] end-5 z-30 inline-flex h-14 w-14 items-center justify-center rounded-full text-[var(--accent-foreground)] transition-all duration-200 active:scale-95 sm:bottom-7 sm:end-7"
          style={{
            background: 'var(--accent)',
            boxShadow: 'var(--shadow-md)',
            border: '1px solid transparent',
          }}
          aria-label={t('createNewTaskAria')}
        >
          <Plus size={20} />
        </button>
      )}

      {/* Create Modal */}
      <Modal
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          setCreateError(null);
        }}
        title={t('newTask')}
        size="lg"
      >
        <form onSubmit={handleCreate}>
          {createError && (
            <div
              className="mb-4 flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm"
              style={{
                background: 'var(--color-danger-bg)',
                border: '1px solid var(--color-danger-border)',
                color: 'var(--color-danger)',
              }}
            >
              <AlertCircle size={15} className="mt-0.5 shrink-0" />
              <span>{createError}</span>
            </div>
          )}
          <TaskForm
            form={createForm}
            setForm={setCreateForm}
            clients={clients}
            projects={projects}
            team={team}
            saving={saving}
            onCancel={() => {
              setCreateOpen(false);
              setCreateError(null);
            }}
            t={t}
          />
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        open={!!editTask}
        onClose={() => {
          setEditTask(null);
          setEditError(null);
        }}
        title={t('editTask')}
        size="lg"
      >
        <form onSubmit={handleEdit}>
          {editError && (
            <div
              className="mb-4 flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm"
              style={{
                background: 'var(--color-danger-bg)',
                border: '1px solid var(--color-danger-border)',
                color: 'var(--color-danger)',
              }}
            >
              <AlertCircle size={15} className="mt-0.5 shrink-0" />
              <span>{editError}</span>
            </div>
          )}
          <TaskForm
            form={editForm}
            setForm={setEditForm}
            clients={clients}
            projects={projects}
            team={team}
            saving={saving}
            onCancel={() => {
              setEditTask(null);
              setEditError(null);
            }}
            t={t}
          />
        </form>
      </Modal>

      {/* Detail Modal */}
      <TaskDetailModal
        task={viewTask}
        team={team}
        open={!!viewTask}
        onClose={() => setViewTask(null)}
        t={t}
      />

      <ConfirmDialog
        open={Boolean(deleteTask)}
        title={t('deleteTask')}
        description={
          deleteTask ? `${t('confirmDeleteTask')} "${deleteTask.title}"` : t('confirmDeleteTask')
        }
        confirmLabel={t('deleteTask')}
        cancelLabel={t('cancel')}
        destructive
        loading={Boolean(deleteTask) && deletingTaskId === deleteTask?.id}
        onCancel={() => {
          setDeleteTask(null);
        }}
        onConfirm={handleDelete}
      />
    </PageShell>
  );
}
