'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  CheckSquare, AlertCircle, Calendar, User,
  Clock, CheckCheck, LayoutList,
} from 'lucide-react';
import supabase from '@/lib/supabase';
import { useLang } from '@/lib/lang-context';
import { useAuth } from '@/lib/auth-context';
import Badge from '@/components/ui/Badge';
import type { Task, TeamMember } from '@/lib/types';

// ─── helpers ────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function weekLaterStr() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

function isTaskOverdue(task: Task) {
  if (!task.due_date) return false;
  if (task.status === 'done' || task.status === 'delivered') return false;
  return task.due_date < todayStr();
}

function isDueToday(task: Task) {
  if (!task.due_date) return false;
  if (task.status === 'done' || task.status === 'delivered') return false;
  return task.due_date === todayStr();
}

function fmtDate(d?: string) {
  if (!d) return '';
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

const priorityVariant = (p: string) => {
  if (p === 'high')   return 'danger'  as const;
  if (p === 'medium') return 'warning' as const;
  return 'default' as const;
};

const statusVariant = (s: string) => {
  if (s === 'done' || s === 'delivered') return 'success' as const;
  if (s === 'overdue')                   return 'danger'  as const;
  if (s === 'in_progress')               return 'info'    as const;
  if (s === 'review')                    return 'warning' as const;
  return 'default' as const;
};

function statusLabel(s: string, t: (k: string) => string) {
  if (s === 'in_progress') return t('inProgress');
  if (s === 'review')      return t('review');
  if (s === 'delivered')   return t('delivered');
  return t(s);
}

// ─── Section definitions ─────────────────────────────────────────────────────

type SectionKey = 'all' | 'dueToday' | 'overdue' | 'inProgress' | 'inReview' | 'completed';

const SECTIONS: { key: SectionKey; labelKey: string; icon: React.ElementType; color: string }[] = [
  { key: 'dueToday',   labelKey: 'tasksDueToday',   icon: Calendar,    color: '#f59e0b' },
  { key: 'overdue',    labelKey: 'tasksOverdue',     icon: AlertCircle, color: '#ef4444' },
  { key: 'inProgress', labelKey: 'tasksInProgress',  icon: Clock,       color: 'var(--accent)' },
  { key: 'inReview',   labelKey: 'tasksInReview',    icon: CheckSquare, color: '#8b5cf6' },
  { key: 'completed',  labelKey: 'tasksCompleted',   icon: CheckCheck,  color: '#22c55e' },
];

// ─── TaskRow ─────────────────────────────────────────────────────────────────

function TaskRow({ task, t }: { task: Task; t: (k: string) => string }) {
  const overdue = isTaskOverdue(task);
  return (
    <div
      className="flex items-center gap-4 px-4 py-3 rounded-xl border transition-shadow hover:shadow-sm"
      style={{
        background: 'var(--surface)',
        borderColor: 'var(--border)',
        borderLeft: `3px solid ${overdue ? '#ef4444' : task.status === 'done' || task.status === 'delivered' ? '#22c55e' : 'var(--accent)'}`,
      }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>{task.title}</p>
        <div className="flex flex-wrap gap-2 mt-1 items-center text-xs" style={{ color: 'var(--text-secondary)' }}>
          {task.client && (
            <span className="flex items-center gap-1">
              <User size={11} />{task.client.name}
            </span>
          )}
          {task.due_date && (
            <span className={`flex items-center gap-1 ${overdue ? 'text-red-500 font-medium' : ''}`}>
              <Calendar size={11} />{fmtDate(task.due_date)}{overdue ? ` · ${t('overdue')}` : ''}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Badge variant={priorityVariant(task.priority)}>{t(task.priority)}</Badge>
        <Badge variant={statusVariant(task.status)}>{statusLabel(task.status, t)}</Badge>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function MyTasksPage() {
  const { t } = useLang();
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState<string>('');
  const [activeSection, setActiveSection] = useState<SectionKey>('all');

  useEffect(() => {
    const FETCH_TIMEOUT_MS = 15_000;
    const fetchData = async () => {
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error('TIMEOUT')), FETCH_TIMEOUT_MS);
        });
        const [tasksRes, teamRes] = await Promise.race([
          Promise.allSettled([
            supabase.from('tasks').select('*, client:clients(id,name)').order('due_date', { ascending: true }).limit(500),
            supabase.from('team_members').select('*').order('name'),
          ]),
          timeoutPromise,
        ]);
        if (tasksRes.status === 'fulfilled' && !tasksRes.value.error)
          setTasks((tasksRes.value.data ?? []) as Task[]);
        if (teamRes.status === 'fulfilled' && !teamRes.value.error)
          setTeam((teamRes.value.data ?? []) as TeamMember[]);
      } catch (err) {
        const isTimeout = err instanceof Error && err.message === 'TIMEOUT';
        console.error('[my-tasks] fetch error:', isTimeout ? 'timeout' : err);
      } finally {
        clearTimeout(timeoutId);
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Filter tasks by selected team member (if any)
  const memberTasks = useMemo(() => {
    if (!selectedMember) return tasks;
    return tasks.filter(t => t.assigned_to === selectedMember);
  }, [tasks, selectedMember]);

  // Section counts
  const counts = useMemo(() => ({
    dueToday:   memberTasks.filter(isDueToday).length,
    overdue:    memberTasks.filter(isTaskOverdue).length,
    inProgress: memberTasks.filter(t => t.status === 'in_progress').length,
    inReview:   memberTasks.filter(t => t.status === 'review').length,
    completed:  memberTasks.filter(t => t.status === 'done' || t.status === 'delivered').length,
  }), [memberTasks]);

  // Tasks shown in list based on active section
  const visibleTasks = useMemo(() => {
    switch (activeSection) {
      case 'dueToday':   return memberTasks.filter(isDueToday);
      case 'overdue':    return memberTasks.filter(isTaskOverdue);
      case 'inProgress': return memberTasks.filter(t => t.status === 'in_progress');
      case 'inReview':   return memberTasks.filter(t => t.status === 'review');
      case 'completed':  return memberTasks.filter(t => t.status === 'done' || t.status === 'delivered');
      default:           return memberTasks;
    }
  }, [memberTasks, activeSection]);

  const overdueCount = memberTasks.filter(isTaskOverdue).length;
  const selectedMemberName = team.find(m => m.id === selectedMember)?.name ?? user.name;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{t('myTasks')}</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          {selectedMemberName} &mdash; {memberTasks.length} tasks total
          {overdueCount > 0 && (
            <span className="ml-2 text-red-500 font-medium">{overdueCount} {t('overdueCount')}</span>
          )}
        </p>
      </div>

      {/* Team member selector */}
      <div className="flex items-center gap-3">
        <User size={16} style={{ color: 'var(--text-secondary)' }} />
        <select
          value={selectedMember}
          onChange={e => { setSelectedMember(e.target.value); setActiveSection('all'); }}
          className="h-9 px-3 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]"
          style={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)' }}
        >
          <option value="">{t('allTeamMembers')}</option>
          {team.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>

      {/* Stat cards */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ background: 'var(--surface)' }} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {SECTIONS.map(sec => {
            const count = counts[sec.key as keyof typeof counts];
            const Icon = sec.icon;
            const active = activeSection === sec.key;
            return (
              <button
                key={sec.key}
                onClick={() => setActiveSection(active ? 'all' : sec.key)}
                className="rounded-2xl border p-4 text-left transition-all hover:shadow-sm"
                style={{
                  background: active ? sec.color : 'var(--surface)',
                  borderColor: active ? sec.color : 'var(--border)',
                  color: active ? '#fff' : 'var(--text)',
                  outline: active ? `2px solid ${sec.color}` : 'none',
                  outlineOffset: '2px',
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <Icon size={18} style={{ color: active ? '#fff' : sec.color }} />
                  <span
                    className="text-2xl font-bold tabular-nums"
                    style={{ color: active ? '#fff' : 'var(--text)' }}
                  >
                    {count}
                  </span>
                </div>
                <p className="text-xs font-medium leading-tight" style={{ color: active ? 'rgba(255,255,255,0.85)' : 'var(--text-secondary)' }}>
                  {t(sec.labelKey)}
                </p>
              </button>
            );
          })}
        </div>
      )}

      {/* Task list */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <LayoutList size={16} style={{ color: 'var(--accent)' }} />
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
            {activeSection === 'all' ? t('allTasks') : t(SECTIONS.find(s => s.key === activeSection)?.labelKey ?? '')}
            <span className="ml-2 text-xs font-normal" style={{ color: 'var(--text-secondary)' }}>({visibleTasks.length})</span>
          </h2>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: 'var(--surface)' }} />
            ))}
          </div>
        ) : visibleTasks.length === 0 ? (
          <div className="rounded-2xl border p-10 text-center" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <CheckSquare size={32} className="mx-auto mb-3 opacity-30" style={{ color: 'var(--text-secondary)' }} />
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('noTasksInSection')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {visibleTasks.map(task => (
              <TaskRow key={task.id} task={task} t={t} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
