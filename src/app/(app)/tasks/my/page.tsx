'use client';

import { useEffect, useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckSquare,
  AlertCircle,
  Calendar,
  User,
  Clock,
  CheckCheck,
  LayoutList,
  Plus,
  Send,
  Filter,
  X,
  Paperclip,
  Zap,
  Copy,
} from 'lucide-react';
import supabase from '@/lib/supabase';
import { useLang } from '@/context/lang-context';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/context/toast-context';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { Card, cardSurfaceClass } from '@/components/ui/Card';
import { PageShell, PageHeader, SectionTitle } from '@/components/layout/PageLayout';
import { cn } from '@/lib/cn';
import NewTaskModal from '@/components/tasks/NewTaskModal';
import SelectDropdown from '@/components/ui/SelectDropdown';
import {
  PLATFORMS,
  POST_TYPES,
  getPlatformDisplayColor,
} from '@/components/publishing/SchedulePublishingModal';
import type { Task, TeamMember, Client } from '@/lib/types';
import { useQuickActions } from '@/context/quick-actions-context';

// ─── helpers ────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function isTaskOverdue(task: Task) {
  if (!task.due_date) return false;
  const done = ['done', 'completed', 'delivered', 'published', 'cancelled'];
  if (done.includes(task.status)) return false;
  return task.due_date < todayStr();
}

function isDueToday(task: Task) {
  if (!task.due_date) return false;
  const done = ['done', 'completed', 'delivered', 'published', 'cancelled'];
  if (done.includes(task.status)) return false;
  return task.due_date === todayStr();
}

function fmtDate(d?: string | null) {
  if (!d) return '';
  return new Date(d).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function fmtTime(t?: string | null) {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hr = parseInt(h, 10);
  const ampm = hr >= 12 ? 'PM' : 'AM';
  const h12 = hr % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

const priorityVariant = (p: string) => {
  if (p === 'high') return 'danger' as const;
  if (p === 'medium') return 'warning' as const;
  return 'default' as const;
};

const statusVariant = (s: string) => {
  if (['done', 'completed', 'delivered'].includes(s)) return 'success' as const;
  if (['published', 'approved'].includes(s)) return 'success' as const;
  if (['overdue', 'cancelled'].includes(s)) return 'danger' as const;
  if (['in_progress', 'scheduled'].includes(s)) return 'info' as const;
  if (['in_review', 'review', 'waiting_client'].includes(s)) return 'warning' as const;
  return 'default' as const;
};

function statusLabel(s: string): string {
  const labels: Record<string, string> = {
    in_progress: 'In Progress',
    in_review: 'In Review',
    waiting_client: 'Waiting Client',
    review: 'Review',
    delivered: 'Delivered',
    published: 'Published',
    completed: 'Completed',
    cancelled: 'Cancelled',
    scheduled: 'Scheduled',
    approved: 'Approved',
    todo: 'To Do',
    done: 'Done',
    overdue: 'Overdue',
  };
  return labels[s] ?? s;
}

function categoryLabel(cat?: string | null): string {
  const labels: Record<string, string> = {
    internal_task: 'Internal',
    content_creation: 'Content',
    design_task: 'Design',
    publishing_task: 'Publishing',
    asset_upload_task: 'Asset Upload',
    follow_up_task: 'Follow-up',
  };
  return cat ? (labels[cat] ?? cat) : '';
}

function categoryColor(cat?: string | null): string {
  const colors: Record<string, string> = {
    internal_task: '#6b7280',
    content_creation: '#2563eb',
    design_task: '#d946ef',
    publishing_task: '#7c3aed',
    asset_upload_task: '#0891b2',
    follow_up_task: '#16a34a',
  };
  return cat ? (colors[cat] ?? 'var(--accent)') : 'var(--accent)';
}

// ─── Section definitions ─────────────────────────────────────────────────────

type SectionKey = 'all' | 'dueToday' | 'overdue' | 'inProgress' | 'inReview' | 'completed';

const SECTIONS: { key: SectionKey; labelKey: string; icon: React.ElementType; color: string }[] = [
  { key: 'dueToday', labelKey: 'tasksDueToday', icon: Calendar, color: '#f59e0b' },
  { key: 'overdue', labelKey: 'tasksOverdue', icon: AlertCircle, color: '#ef4444' },
  { key: 'inProgress', labelKey: 'tasksInProgress', icon: Clock, color: 'var(--accent)' },
  { key: 'inReview', labelKey: 'tasksInReview', icon: CheckSquare, color: '#8b5cf6' },
  { key: 'completed', labelKey: 'tasksCompleted', icon: CheckCheck, color: '#22c55e' },
];

const CATEGORY_FILTERS = [
  { value: 'content_creation', label: 'Content' },
  { value: 'publishing_task', label: 'Publishing' },
  { value: 'design_task', label: 'Design' },
  { value: 'internal_task', label: 'Internal' },
  { value: 'follow_up_task', label: 'Follow-up' },
  { value: 'asset_upload_task', label: 'Asset Upload' },
];

// ─── TaskCard ─────────────────────────────────────────────────────────────────

function TaskCard({ task, onDuplicate }: { task: Task; onDuplicate?: (task: Task) => void }) {
  const overdue = isTaskOverdue(task);
  const isToday = isDueToday(task);
  const hasPlatforms = (task.platforms ?? []).length > 0;
  const hasPostTypes = (task.post_types ?? []).length > 0;
  const hasAsset = !!task.asset_id;
  const hasPubSchedule = !!task.publishing_schedule_id;
  const cat = task.task_category;

  const borderColor = overdue
    ? '#ef4444'
    : isToday
      ? '#f59e0b'
      : cat
        ? categoryColor(cat)
        : 'var(--border)';

  return (
    <Card
      padding="none"
      className="flex flex-col gap-2.5 border-l-[3px] px-4 py-3 transition-shadow hover:shadow-sm"
      style={{ borderLeftColor: borderColor }}
    >
      {/* Row 1: title + status badges */}
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[var(--text)]">{task.title}</p>
          {task.description && (
            <p className="mt-0.5 line-clamp-1 text-xs text-[var(--text-secondary)]">
              {task.description}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Badge variant={priorityVariant(task.priority)}>{task.priority}</Badge>
          <Badge variant={statusVariant(task.status)}>{statusLabel(task.status)}</Badge>
        </div>
      </div>

      {/* Row 2: meta info */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--text-secondary)]">
        {cat && (
          <span
            className="rounded-full px-2 py-0.5 font-medium text-white"
            style={{ background: categoryColor(cat), fontSize: '10px' }}
          >
            {categoryLabel(cat)}
          </span>
        )}
        {task.client && (
          <span className="flex items-center gap-1 rounded-full bg-[var(--surface-2)] px-2 py-0.5">
            <User size={10} />
            {task.client.name}
          </span>
        )}
        {task.due_date && (
          <span
            className={`flex items-center gap-1 rounded-full px-2 py-0.5 ${overdue ? 'font-medium text-red-500' : isToday ? 'font-medium text-amber-600' : ''}`}
            style={{ background: overdue ? '#fef2f2' : isToday ? '#fffbeb' : 'var(--surface-2)' }}
          >
            <Calendar size={10} />
            {fmtDate(task.due_date)}
            {task.due_time && ` · ${fmtTime(task.due_time)}`}
            {overdue ? ' · Overdue' : isToday ? ' · Today' : ''}
          </span>
        )}
      </div>

      {/* Row 3: publishing badges */}
      {(hasPlatforms || hasPostTypes) && (
        <div className="flex flex-wrap items-center gap-1">
          <Send size={10} className="text-[#7c3aed]" />
          {(task.platforms ?? []).map((p) => {
            const pl = PLATFORMS.find((x) => x.value === p);
            return (
              <span
                key={p}
                className="rounded px-1.5 py-0.5 font-medium text-white"
                style={{ background: getPlatformDisplayColor(p), fontSize: '10px' }}
              >
                {pl?.label ?? p}
              </span>
            );
          })}
          {(task.post_types ?? []).map((pt) => {
            const typ = POST_TYPES.find((x) => x.value === pt);
            return (
              <span
                key={pt}
                className="rounded px-1.5 py-0.5 font-medium"
                style={{ background: 'rgba(124,58,237,0.12)', color: '#7c3aed', fontSize: '10px' }}
              >
                {typ?.label ?? pt}
              </span>
            );
          })}
        </div>
      )}

      {/* Row 4: linked record badges */}
      {(hasAsset || hasPubSchedule) && (
        <div className="flex items-center gap-1.5">
          {hasAsset && (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{ background: '#e0f2fe', color: '#0284c7' }}
            >
              <Paperclip size={9} className="mr-0.5 inline" />
              Asset
            </span>
          )}
          {hasPubSchedule && (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{ background: '#f3e8ff', color: '#7c3aed' }}
            >
              <Send size={9} className="mr-0.5 inline" />
              Schedule
            </span>
          )}
        </div>
      )}

      {/* Row 5: actions */}
      {onDuplicate && (
        <div className="mt-1 flex justify-end">
          <Button
            type="button"
            variant="ghost"
            className="h-8 min-h-0 gap-1 px-2 py-1 text-xs opacity-70 hover:opacity-100"
            onClick={() => onDuplicate(task)}
            title="Duplicate task"
          >
            <Copy size={11} /> Duplicate
          </Button>
        </div>
      )}
    </Card>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function MyTasksPage() {
  const { t } = useLang();
  const { user } = useAuth();
  const { toast } = useToast();
  const { registerQuickActionHandler } = useQuickActions();
  const queryClient = useQueryClient();

  const { data: queryData, isLoading: loading } = useQuery({
    queryKey: ['tasks-my'],
    queryFn: async () => {
      const [tasksRes, teamRes, clientsRes] = await Promise.allSettled([
        supabase
          .from('tasks')
          .select('*, client:clients(id,name)')
          .order('due_date', { ascending: true })
          .limit(500),
        supabase
          .from('team_members')
          .select('id,full_name,email,role,avatar_url,job_title,created_at')
          .order('full_name'),
        supabase.from('clients').select('id,name,status').order('name'),
      ]);
      if (tasksRes.status === 'rejected')
        console.error('[my-tasks] tasks fetch rejected:', tasksRes.reason);
      else if (tasksRes.value.error)
        console.error('[my-tasks] tasks fetch error:', tasksRes.value.error);
      if (teamRes.status === 'rejected')
        console.error('[my-tasks] team fetch rejected:', teamRes.reason);
      if (clientsRes.status === 'rejected')
        console.error('[my-tasks] clients fetch rejected:', clientsRes.reason);
      return {
        tasks:
          tasksRes.status === 'fulfilled' && !tasksRes.value.error
            ? ((tasksRes.value.data ?? []) as Task[])
            : [],
        team:
          teamRes.status === 'fulfilled' && !teamRes.value.error
            ? ((teamRes.value.data ?? []) as TeamMember[])
            : [],
        clients:
          clientsRes.status === 'fulfilled' && !clientsRes.value.error
            ? ((clientsRes.value.data ?? []) as Client[])
            : [],
      };
    },
  });

  // Seed local state from React Query cache for instant display on re-navigation
  const cachedOnMount = queryClient.getQueryData<{
    tasks: Task[];
    team: TeamMember[];
    clients: Client[];
  }>(['tasks-my']);
  const [tasks, setTasks] = useState<Task[]>(() => cachedOnMount?.tasks ?? []);
  const [team, setTeam] = useState<TeamMember[]>(() => cachedOnMount?.team ?? []);
  const [clients, setClients] = useState<Client[]>(() => cachedOnMount?.clients ?? []);

  useEffect(() => {
    if (queryData) {
      setTasks(queryData.tasks);
      setTeam(queryData.team);
      setClients(queryData.clients);
    }
  }, [queryData]);

  const [selectedMember, setSelectedMember] = useState<string>('');
  const [activeSection, setActiveSection] = useState<SectionKey>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [showNewTask, setShowNewTask] = useState(false);

  useEffect(() => {
    return registerQuickActionHandler('add-task', () => {
      setShowNewTask(true);
    });
  }, [registerQuickActionHandler, setShowNewTask]);

  const memberTasks = useMemo(() => {
    let result = tasks;
    if (selectedMember) result = result.filter((t) => t.assigned_to === selectedMember);
    if (categoryFilter) result = result.filter((t) => t.task_category === categoryFilter);
    return result;
  }, [tasks, selectedMember, categoryFilter]);

  const counts = useMemo(
    () => ({
      dueToday: memberTasks.filter(isDueToday).length,
      overdue: memberTasks.filter(isTaskOverdue).length,
      inProgress: memberTasks.filter((t) => t.status === 'in_progress').length,
      inReview: memberTasks.filter((t) => ['in_review', 'review'].includes(t.status)).length,
      completed: memberTasks.filter((t) =>
        ['done', 'completed', 'delivered', 'published'].includes(t.status),
      ).length,
    }),
    [memberTasks],
  );

  const visibleTasks = useMemo(() => {
    switch (activeSection) {
      case 'dueToday':
        return memberTasks.filter(isDueToday);
      case 'overdue':
        return memberTasks.filter(isTaskOverdue);
      case 'inProgress':
        return memberTasks.filter((t) => t.status === 'in_progress');
      case 'inReview':
        return memberTasks.filter((t) => ['in_review', 'review'].includes(t.status));
      case 'completed':
        return memberTasks.filter((t) =>
          ['done', 'completed', 'delivered', 'published'].includes(t.status),
        );
      default:
        return memberTasks;
    }
  }, [memberTasks, activeSection]);

  const overdueCount = memberTasks.filter(isTaskOverdue).length;
  const selectedMemberName =
    team.find((m) => m.id === selectedMember)?.full_name ?? user.name ?? 'All';

  function handleTaskCreated(task: Task) {
    setTasks((prev) => [task, ...prev]);
    toast('Task created successfully', 'success');
  }

  async function duplicateTask(task: Task) {
    try {
      const baseTitle = task.title.replace(/^Copy of /, '');
      const body: Record<string, unknown> = {
        title: `Copy of ${baseTitle}`,
        description: task.description ?? '',
        status: 'todo',
        priority: task.priority,
        due_date: task.due_date ?? new Date().toISOString().slice(0, 10),
        due_time: task.due_time ?? '',
        timezone: task.timezone ?? 'UTC',
        task_category: task.task_category ?? '',
        client_id: task.client_id ?? '',
        client_name: task.client_name ?? '',
        assigned_to: task.assigned_to ?? '',
        content_purpose: task.content_purpose ?? '',
        caption: task.caption ?? '',
        platforms: task.platforms ?? [],
        post_types: task.post_types ?? [],
        created_by: user?.id ?? '',
      };
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { success: boolean; task?: Task; error?: string };
      if (json.success && json.task) {
        setTasks((prev) => [json.task!, ...prev]);
        toast('Task duplicated', 'success');
      } else {
        toast(json.error ?? 'Failed to duplicate task', 'error');
      }
    } catch (err) {
      toast('Failed to duplicate task', 'error');
      console.error('[duplicateTask] error:', err);
    }
  }

  const sectionHeaderLabel =
    activeSection === 'all'
      ? t('allTasks')
      : t(SECTIONS.find((s) => s.key === activeSection)?.labelKey ?? '');

  return (
    <PageShell className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <Zap size={22} className="text-[var(--accent)]" />
            {t('myTasks')}
          </span>
        }
        subtitle={
          <>
            {selectedMemberName} &mdash; {memberTasks.length} tasks
            {overdueCount > 0 && (
              <span className="ml-2 font-medium text-red-500">{overdueCount} overdue</span>
            )}
          </>
        }
        actions={
          <Button type="button" variant="primary" onClick={() => setShowNewTask(true)}>
            <Plus size={16} /> New Task
          </Button>
        }
      />

      <Card padding="sm" className="sm:p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <User size={14} className="text-[var(--text-secondary)]" />
            <SelectDropdown
              value={selectedMember}
              onChange={(v) => {
                setSelectedMember(v);
                setActiveSection('all');
              }}
              placeholder={t('allTeamMembers')}
              options={[
                { value: '', label: t('allTeamMembers') },
                ...team.map((m) => ({ value: m.id, label: m.full_name })),
              ]}
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <Filter size={13} className="text-[var(--text-secondary)]" />
            {categoryFilter && (
              <Button
                type="button"
                variant="secondary"
                className="h-7 min-h-0 gap-1 rounded-full px-2.5 py-0 text-xs"
                onClick={() => setCategoryFilter('')}
              >
                <X size={10} /> Clear
              </Button>
            )}
            {CATEGORY_FILTERS.map((cf) => {
              const active = categoryFilter === cf.value;
              return (
                <Button
                  key={cf.value}
                  type="button"
                  variant={active ? 'primary' : 'secondary'}
                  className="h-7 min-h-0 rounded-full px-2.5 py-0 text-xs"
                  onClick={() => setCategoryFilter(active ? '' : cf.value)}
                >
                  {cf.label}
                </Button>
              );
            })}
          </div>
        </div>
      </Card>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-[var(--surface)]" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {SECTIONS.map((sec) => {
            const count = counts[sec.key as keyof typeof counts] ?? 0;
            const Icon = sec.icon;
            const active = activeSection === sec.key;
            return (
              <button
                key={sec.key}
                type="button"
                onClick={() => setActiveSection(active ? 'all' : sec.key)}
                className={cn(
                  cardSurfaceClass,
                  'w-full p-4 text-left transition-shadow hover:shadow-sm',
                  active &&
                    'border-[var(--accent)] ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--bg)]',
                )}
              >
                <div className="mb-2 flex items-center justify-between">
                  <Icon
                    size={18}
                    className={active ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'}
                  />
                  <span className="text-2xl font-bold tabular-nums text-[var(--text)]">
                    {count}
                  </span>
                </div>
                <p className="text-xs font-medium leading-tight text-[var(--text-secondary)]">
                  {t(sec.labelKey)}
                </p>
              </button>
            );
          })}
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <LayoutList size={16} className="shrink-0 text-[var(--accent)]" />
            <SectionTitle
              as="h2"
              className="!mb-0 flex min-w-0 flex-wrap items-baseline gap-2 text-sm"
            >
              <span className="truncate">{sectionHeaderLabel}</span>
              <span className="text-xs font-normal text-[var(--text-secondary)]">
                ({visibleTasks.length})
              </span>
            </SectionTitle>
          </div>
          <Button
            type="button"
            variant="ghost"
            className="h-8 shrink-0 text-xs"
            onClick={() => setShowNewTask(true)}
          >
            <Plus size={12} /> Add task
          </Button>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-[var(--surface)]" />
            ))}
          </div>
        ) : visibleTasks.length === 0 ? (
          <Card padding="md" className="p-10 text-center">
            <CheckSquare
              size={32}
              className="mx-auto mb-3 text-[var(--text-secondary)] opacity-30"
            />
            <p className="mb-4 text-sm text-[var(--text-secondary)]">{t('noTasksInSection')}</p>
            <Button type="button" variant="primary" onClick={() => setShowNewTask(true)}>
              <Plus size={14} /> Create your first task
            </Button>
          </Card>
        ) : (
          <div className="space-y-2">
            {visibleTasks.map((task) => (
              <TaskCard key={task.id} task={task} onDuplicate={duplicateTask} />
            ))}
          </div>
        )}
      </div>

      <NewTaskModal
        open={showNewTask}
        onClose={() => setShowNewTask(false)}
        onCreated={handleTaskCreated}
        clients={clients}
        team={team}
      />
    </PageShell>
  );
}
