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
import { ClientBrandMark } from '@/components/ui/ClientBrandMark';
import { useLang } from '@/context/lang-context';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/context/toast-context';
import { useAppPeriod } from '@/context/app-period-context';
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
} from '@/components/features/publishing/SchedulePublishingModal';
import type { Task, TeamMember, Client } from '@/lib/types';
import { taskStatusLabel } from '@/lib/task-status-labels';
import { applyUtcTimestampRange } from '@/lib/date-range';

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

function fmtDate(d?: string | null, lang?: 'en' | 'ar') {
  if (!d) return '';
  return new Date(d).toLocaleDateString(lang === 'ar' ? 'ar-SA' : undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function fmtTime(time?: string | null, lang?: 'en' | 'ar') {
  if (!time) return '';
  const [h, m] = time.split(':');
  const hr = parseInt(h ?? '', 10);
  const min = parseInt(m ?? '0', 10);
  if (Number.isNaN(hr) || Number.isNaN(min)) return '';
  const d = new Date(2000, 0, 1, hr, min, 0, 0);
  return d.toLocaleTimeString(lang === 'ar' ? 'ar-SA' : 'en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
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

const CATEGORY_TKEY: Record<string, string> = {
  internal_task: 'taskCategoryInternal',
  content_creation: 'taskCategoryContent',
  design_task: 'taskCategoryDesign',
  publishing_task: 'taskCategoryPublishing',
  asset_upload_task: 'taskCategoryAssetUpload',
  follow_up_task: 'taskCategoryFollowUp',
};

function categoryLabel(cat: string | null | undefined, t: (k: string) => string): string {
  if (!cat) return '';
  const key = CATEGORY_TKEY[cat];
  return key ? t(key) : cat;
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
  { value: 'content_creation', labelKey: 'taskCategoryContent' },
  { value: 'publishing_task', labelKey: 'taskCategoryPublishing' },
  { value: 'design_task', labelKey: 'taskCategoryDesign' },
  { value: 'internal_task', labelKey: 'taskCategoryInternal' },
  { value: 'follow_up_task', labelKey: 'taskCategoryFollowUp' },
  { value: 'asset_upload_task', labelKey: 'taskCategoryAssetUpload' },
] as const;

// ─── TaskCard ─────────────────────────────────────────────────────────────────

function TaskCard({ task, onDuplicate }: { task: Task; onDuplicate?: (task: Task) => void }) {
  const { t, lang } = useLang();
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
      className="flex flex-col gap-2.5 border-s-[3px] px-4 py-3 transition-shadow hover:shadow-sm"
      style={{ borderInlineStartColor: borderColor }}
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
          <Badge variant={priorityVariant(task.priority)}>{t(task.priority)}</Badge>
          <Badge variant={statusVariant(task.status)}>{taskStatusLabel(task.status, t)}</Badge>
        </div>
      </div>

      {/* Row 2: meta info */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--text-secondary)]">
        {cat && (
          <span
            className="rounded-full px-2 py-0.5 font-medium text-white"
            style={{ background: categoryColor(cat), fontSize: '10px' }}
          >
            {categoryLabel(cat, t)}
          </span>
        )}
        {task.client && (
          <span className="flex items-center gap-1.5 rounded-full bg-[var(--surface-2)] px-2 py-0.5">
            <ClientBrandMark
              name={task.client.name}
              logoUrl={task.client.logo}
              size={18}
              roundedClassName="rounded-full"
            />
            {task.client.name}
          </span>
        )}
        {task.due_date && (
          <span
            className={`flex items-center gap-1 rounded-full px-2 py-0.5 ${overdue ? 'font-medium text-red-500' : isToday ? 'font-medium text-amber-600' : ''}`}
            style={{ background: overdue ? '#fef2f2' : isToday ? '#fffbeb' : 'var(--surface-2)' }}
          >
            <Calendar size={10} />
            {fmtDate(task.due_date, lang)}
            {task.due_time && ` · ${fmtTime(task.due_time, lang)}`}
            {overdue ? ` · ${t('dueChipOverdue')}` : isToday ? ` · ${t('dueChipToday')}` : ''}
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
              <Paperclip size={9} className="me-0.5 inline" />
              {t('taskLinkedAsset')}
            </span>
          )}
          {hasPubSchedule && (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{ background: '#f3e8ff', color: '#7c3aed' }}
            >
              <Send size={9} className="me-0.5 inline" />
              {t('taskLinkedSchedule')}
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
            title={t('duplicateTaskTitle')}
          >
            <Copy size={11} /> {t('duplicateTask')}
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
  const { periodStart, periodEnd } = useAppPeriod();
  const queryClient = useQueryClient();

  const { data: queryData, isLoading: loading } = useQuery({
    queryKey: ['tasks-my', periodStart, periodEnd],
    queryFn: async () => {
      const [tasksRes, teamRes, clientsRes] = await Promise.allSettled([
        applyUtcTimestampRange(
          supabase.from('tasks').select('*, client:clients(id,name,logo,slug)'),
          'updated_at',
          periodStart,
          periodEnd,
        )
          .order('due_date', { ascending: true })
          .limit(500),
        supabase
          .from('team_members')
          .select('id,full_name,email,role,avatar_url,job_title,created_at')
          .order('full_name'),
        supabase.from('clients').select('id,name,status,logo,slug').order('name'),
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
  }>(['tasks-my', periodStart, periodEnd]);
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
  const selectedMemberName = selectedMember
    ? (team.find((m) => m.id === selectedMember)?.full_name ?? '')
    : t('allTeamMembers');

  function handleTaskCreated(task: Task) {
    setTasks((prev) => [task, ...prev]);
    toast(`Create task / ${task.title}: ${t('taskCreatedSuccess')}`, 'success');
  }

  async function duplicateTask(task: Task) {
    try {
      const copyPrefix = t('copyOfPrefix');
      const legacyCopyPrefix = t('taskDuplicateLegacyPrefix');
      let baseTitle = task.title;
      if (baseTitle.startsWith(copyPrefix)) baseTitle = baseTitle.slice(copyPrefix.length);
      else if (baseTitle.startsWith(legacyCopyPrefix))
        baseTitle = baseTitle.slice(legacyCopyPrefix.length);
      const body: Record<string, unknown> = {
        title: `${copyPrefix}${baseTitle}`,
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
        setTasks((prev) => [json.task as Task, ...prev]);
        toast(`Duplicate task / ${task.title}: ${t('taskDuplicated')}`, 'success');
      } else {
        toast(`Duplicate task / ${task.title}: ${json.error ?? t('failedDuplicateTask')}`, 'error');
      }
    } catch (err) {
      toast(`Duplicate task / ${task.title}: ${t('failedDuplicateTask')}`, 'error');
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
            {t('myTasksSubtitle', { name: selectedMemberName, count: memberTasks.length })}
            {overdueCount > 0 && (
              <span className="ms-2 font-medium text-red-500">
                {t('myTasksOverdueCount', { count: overdueCount })}
              </span>
            )}
          </>
        }
        actions={
          <Button type="button" variant="primary" onClick={() => setShowNewTask(true)}>
            <Plus size={16} /> {t('newTask')}
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
                <X size={10} /> {t('clear')}
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
                  {t(cf.labelKey)}
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
                  'w-full p-4 text-start transition-shadow hover:shadow-sm',
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
            <Plus size={12} /> {t('addTask')}
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
              <Plus size={14} /> {t('createYourFirstTask')}
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
