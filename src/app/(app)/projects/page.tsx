'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FolderKanban,
  FolderOpen,
  Plus,
  Pencil,
  Trash2,
  Search,
  LayoutGrid,
  Calendar,
} from 'lucide-react';
import supabase from '@/lib/supabase';
import type { Client, Project, Task, TeamMember, Activity as ActivityItem } from '@/lib/types';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Input, Textarea, Field } from '@/components/ui/Input';
import StatCard from '@/components/ui/StatCard';
import { PageShell, PageHeader } from '@/components/layout/PageLayout';
import SelectDropdown from '@/components/ui/SelectDropdown';
import EmptyState from '@/components/ui/EmptyState';
import { Tabs, TabButton } from '@/components/ui/Tabs';
import { useLang } from '@/context/lang-context';
import { useAuth } from '@/context/auth-context';
import { useQuickActions } from '@/context/quick-actions-context';
import { consumePendingQuickAction } from '@/lib/pending-quick-action';

type ProjectTab = 'all' | 'active' | 'completed' | 'archived';
type ProjectStatus = Project['status'];

const STATUS_LABEL: Record<ProjectStatus, string> = {
  planning: 'Planning',
  active: 'Active',
  on_hold: 'On hold',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

function statusVariant(s: string) {
  if (s === 'active') return 'success' as const;
  if (s === 'completed') return 'default' as const;
  if (s === 'on_hold') return 'warning' as const;
  if (s === 'cancelled') return 'danger' as const;
  return 'info' as const;
}

function formatDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatRelativeDate(d: string | null | undefined) {
  if (!d) return 'No activity yet';
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(d);
}

function derivePriority(tasks: Task[]): 'high' | 'medium' | 'low' | 'none' {
  const openTasks = tasks.filter(
    (task) => !['done', 'completed', 'cancelled', 'delivered'].includes(task.status),
  );
  if (openTasks.some((task) => task.priority === 'high')) return 'high';
  if (openTasks.some((task) => task.priority === 'medium')) return 'medium';
  if (openTasks.some((task) => task.priority === 'low')) return 'low';
  return 'none';
}

function priorityVariant(priority: 'high' | 'medium' | 'low' | 'none') {
  if (priority === 'high') return 'danger' as const;
  if (priority === 'medium') return 'warning' as const;
  if (priority === 'low') return 'info' as const;
  return 'default' as const;
}

async function fetchAllProjects(): Promise<Project[]> {
  const res = await fetch('/api/projects');
  const json = (await res.json()) as { success: boolean; projects?: Project[] };
  if (!json.success) throw new Error('Failed to load projects');
  return json.projects ?? [];
}

function tabMatches(tab: ProjectTab, status: ProjectStatus): boolean {
  if (tab === 'all') return true;
  if (tab === 'active') return status === 'active';
  if (tab === 'completed') return status === 'completed';
  if (tab === 'archived') return status === 'cancelled' || status === 'on_hold';
  return false;
}

export default function ProjectsPage() {
  const { t } = useLang();
  const { role } = useAuth();
  const { registerQuickActionHandler } = useQuickActions();
  const queryClient = useQueryClient();
  const canManage =
    role === 'owner' || role === 'admin' || role === 'manager' || role === 'team_member';
  const canDelete = role === 'owner' || role === 'admin' || role === 'manager';

  const [tab, setTab] = useState<ProjectTab>('all');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    status: 'active' as ProjectStatus,
    client_id: '',
    start_date: '',
    end_date: '',
    color: '#6366f1',
  });

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects-all'],
    queryFn: fetchAllProjects,
    staleTime: 60_000,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['projects-clients-picker'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('id,name').order('name');
      if (error) throw new Error(error.message);
      return (data ?? []) as Pick<Client, 'id' | 'name'>[];
    },
    staleTime: 120_000,
  });

  const { data: projectTasks = [] } = useQuery({
    queryKey: ['projects-task-metadata'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('id, project_id, status, priority, due_date, assigned_to')
        .not('project_id', 'is', null)
        .limit(2000);
      if (error) throw new Error(error.message);
      return (data ?? []) as Pick<
        Task,
        'id' | 'project_id' | 'status' | 'priority' | 'due_date' | 'assigned_to'
      >[];
    },
    staleTime: 60_000,
  });

  const { data: teamMembers = [] } = useQuery({
    queryKey: ['projects-team-members'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_members')
        .select('id, full_name, profile_id')
        .limit(500);
      if (error) throw new Error(error.message);
      return (data ?? []) as Pick<TeamMember, 'id' | 'full_name' | 'profile_id'>[];
    },
    staleTime: 120_000,
  });

  const { data: projectActivities = [] } = useQuery({
    queryKey: ['projects-activity-metadata'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activities')
        .select('id, entity_id, entity_type, created_at, description')
        .eq('entity_type', 'project')
        .order('created_at', { ascending: false })
        .limit(1000);
      if (error) throw new Error(error.message);
      return (data ?? []) as Pick<
        ActivityItem,
        'id' | 'entity_id' | 'entity_type' | 'created_at' | 'description'
      >[];
    },
    staleTime: 60_000,
  });

  const projectMeta = useMemo(() => {
    const tasksByProject = new Map<
      string,
      Pick<Task, 'id' | 'status' | 'priority' | 'due_date' | 'assigned_to'>[]
    >();
    for (const task of projectTasks) {
      if (!task.project_id) continue;
      const bucket = tasksByProject.get(task.project_id) ?? [];
      bucket.push(task);
      tasksByProject.set(task.project_id, bucket);
    }

    const memberNameById = new Map<string, string>();
    for (const member of teamMembers) {
      if (member.id) memberNameById.set(member.id, member.full_name);
      if (member.profile_id) memberNameById.set(member.profile_id, member.full_name);
    }

    const latestActivityByProject = new Map<
      string,
      Pick<ActivityItem, 'created_at' | 'description'>
    >();
    for (const activity of projectActivities) {
      if (!activity.entity_id || latestActivityByProject.has(activity.entity_id)) continue;
      latestActivityByProject.set(activity.entity_id, {
        created_at: activity.created_at,
        description: activity.description,
      });
    }

    return new Map(
      projects.map((project) => {
        const tasks = tasksByProject.get(project.id) ?? [];
        const totalTasks = tasks.length;
        const completedTasks = tasks.filter((task) =>
          ['done', 'completed', 'delivered', 'cancelled'].includes(task.status),
        ).length;
        const openTasks = Math.max(0, totalTasks - completedTasks);
        const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
        const nextDue = tasks
          .filter(
            (task) =>
              task.due_date &&
              !['done', 'completed', 'delivered', 'cancelled'].includes(task.status),
          )
          .sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''))[0]?.due_date;
        const priority = derivePriority(tasks as Task[]);
        const assignedNames = Array.from(
          new Set(
            tasks
              .map((task) => task.assigned_to)
              .filter((assignedTo): assignedTo is string => Boolean(assignedTo))
              .map((id) => memberNameById.get(id) ?? id),
          ),
        );
        const activity = latestActivityByProject.get(project.id) ?? null;
        return [
          project.id,
          {
            totalTasks,
            completedTasks,
            openTasks,
            progress,
            nextDue,
            priority,
            assignedNames,
            activity,
          },
        ];
      }),
    );
  }, [projectTasks, teamMembers, projectActivities, projects]);

  const metrics = useMemo(() => {
    let active = 0;
    let completed = 0;
    let archived = 0;
    for (const p of projects) {
      if (p.status === 'active') active += 1;
      else if (p.status === 'completed') completed += 1;
      else if (p.status === 'cancelled' || p.status === 'on_hold') archived += 1;
    }
    return { total: projects.length, active, completed, archived };
  }, [projects]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return projects.filter((p) => {
      if (!tabMatches(tab, p.status)) return false;
      if (!q) return true;
      const name = (p.name ?? '').toLowerCase();
      const clientName = (p.client?.name ?? '').toLowerCase();
      return name.includes(q) || clientName.includes(q);
    });
  }, [projects, tab, search]);

  const openCreate = useCallback(() => {
    setEditProject(null);
    setForm({
      name: '',
      description: '',
      status: 'active',
      client_id: clients[0]?.id ?? '',
      start_date: '',
      end_date: '',
      color: '#6366f1',
    });
    setSaveErr(null);
    setModalOpen(true);
  }, [clients]);

  useEffect(() => {
    return registerQuickActionHandler('add-project', openCreate);
  }, [registerQuickActionHandler, openCreate]);

  useEffect(() => {
    if (consumePendingQuickAction() === 'add-project' && canManage) openCreate();
    // intentionally once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openEdit = (project: Project) => {
    setEditProject(project);
    setForm({
      name: project.name,
      description: project.description ?? '',
      status: project.status,
      client_id: project.client_id ?? '',
      start_date: project.start_date ?? '',
      end_date: project.end_date ?? '',
      color: project.color ?? '#6366f1',
    });
    setSaveErr(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.client_id) {
      setSaveErr('Please select a client.');
      return;
    }
    setSaving(true);
    setSaveErr(null);
    try {
      const url = editProject ? `/api/projects/${editProject.id}` : '/api/projects';
      const method = editProject ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim() || null,
          status: form.status,
          client_id: form.client_id,
          start_date: form.start_date || null,
          end_date: form.end_date || null,
          color: form.color,
        }),
      });
      const json = (await res.json()) as { success: boolean; project?: Project; error?: string };
      if (!json.success) throw new Error(json.error ?? 'Save failed');
      setModalOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['projects-all'] });
      void queryClient.invalidateQueries({ queryKey: ['projects'] });
    } catch (err) {
      setSaveErr(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this project?')) return;
    await fetch(`/api/projects/${id}`, { method: 'DELETE' });
    void queryClient.invalidateQueries({ queryKey: ['projects-all'] });
    void queryClient.invalidateQueries({ queryKey: ['projects'] });
  };

  const tabs: { id: ProjectTab; label: string }[] = [
    { id: 'all', label: t('all') },
    { id: 'active', label: t('active') },
    { id: 'completed', label: t('done') },
    { id: 'archived', label: 'Archived' },
  ];

  return (
    <PageShell>
      <PageHeader
        title={t('projects')}
        subtitle={`All workspace projects · ${metrics.total} total`}
        actions={
          canManage ? (
            <Button type="button" variant="primary" onClick={openCreate}>
              <Plus size={18} />
              New project
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total projects"
          value={metrics.total}
          icon={<FolderKanban size={18} />}
          color="blue"
        />
        <StatCard
          label="Active"
          value={metrics.active}
          icon={<LayoutGrid size={18} />}
          color="mint"
        />
        <StatCard
          label="Completed"
          value={metrics.completed}
          icon={<Calendar size={18} />}
          color="green"
        />
        <StatCard
          label="Archived"
          value={metrics.archived}
          icon={<FolderKanban size={18} />}
          color="violet"
        />
      </div>

      <Card padding="sm" className="sm:p-6">
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Tabs className="w-fit" aria-label="Project filters">
            {tabs.map(({ id, label }) => {
              const active = tab === id;
              return (
                <TabButton key={id} type="button" active={active} onClick={() => setTab(id)}>
                  {label}
                </TabButton>
              );
            })}
          </Tabs>
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 z-[1] -translate-y-1/2"
              style={{ color: 'var(--text-tertiary)' }}
            />
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects…"
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {projects.length === 0 && isLoading ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <div
              className="relative mb-5 flex h-24 w-24 animate-pulse items-center justify-center rounded-2xl ring-1 ring-[var(--border)]"
              style={{ background: 'var(--surface-2)' }}
            >
              <FolderOpen
                className="absolute opacity-25"
                size={52}
                style={{ color: 'var(--accent)' }}
              />
              <FolderKanban size={34} style={{ color: 'var(--text-secondary)' }} />
            </div>
            <h3 className="mb-2 text-xl font-semibold" style={{ color: 'var(--text)' }}>
              Loading projects…
            </h3>
            <p className="max-w-xs text-sm" style={{ color: 'var(--text-secondary)' }}>
              Fetching your workspace.
            </p>
          </CardContent>
        </Card>
      ) : projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <div
              className="relative mb-5 flex h-24 w-24 items-center justify-center rounded-2xl ring-1 ring-[var(--border)]"
              style={{ background: 'var(--surface-2)' }}
            >
              <FolderOpen
                className="absolute opacity-20"
                size={52}
                style={{ color: 'var(--accent)' }}
              />
              <FolderKanban size={34} style={{ color: 'var(--text-secondary)' }} />
            </div>
            <h3 className="mb-2 text-xl font-semibold" style={{ color: 'var(--text)' }}>
              No projects yet
            </h3>
            <p className="mb-6 max-w-xs text-sm" style={{ color: 'var(--text-secondary)' }}>
              Create a project to organize work for your clients.
            </p>
            {canManage ? (
              <Button type="button" variant="primary" onClick={openCreate}>
                <Plus size={16} />
                Create Project
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects found"
          description={
            tab === 'all'
              ? 'Create a project to organize work for your clients.'
              : 'Try another filter or clear search.'
          }
          action={
            canManage && tab === 'all' && !search ? (
              <Button type="button" variant="primary" onClick={openCreate}>
                + New project
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((project) => {
            const slug = project.client?.slug;
            const clientHref = slug ? `/clients/${slug}/overview` : null;
            const meta = projectMeta.get(project.id);
            return (
              <Card
                key={project.id}
                className="flex flex-col transition-transform hover:-translate-y-0.5"
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                      style={{ background: `${project.color ?? '#6366f1'}22` }}
                    >
                      <FolderKanban size={20} style={{ color: project.color ?? '#6366f1' }} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-base font-bold" style={{ color: 'var(--text)' }}>
                        {project.name}
                      </p>
                      {project.client?.name && (
                        <p
                          className="mt-0.5 truncate text-xs"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          {clientHref ? (
                            <Link
                              href={clientHref}
                              className="hover:underline"
                              style={{ color: 'var(--accent)' }}
                            >
                              {project.client.name}
                            </Link>
                          ) : (
                            project.client.name
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                  <Badge variant={statusVariant(project.status)}>
                    {STATUS_LABEL[project.status] ?? project.status}
                  </Badge>
                </div>
                {project.description && (
                  <p
                    className="mb-4 line-clamp-2 text-sm"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {project.description}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant={priorityVariant(meta?.priority ?? 'none')}>
                    Priority: {meta?.priority === 'none' ? 'n/a' : meta?.priority}
                  </Badge>
                  <Badge variant="info">Progress: {meta?.progress ?? 0}%</Badge>
                  <Badge variant="default">
                    Tasks: {meta?.openTasks ?? 0} open / {meta?.totalTasks ?? 0}
                  </Badge>
                  <Badge variant="default">Assigned: {meta?.assignedNames.length ?? 0}</Badge>
                </div>
                <div
                  className="mt-auto flex flex-wrap gap-3 text-xs"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  <span>Start {formatDate(project.start_date)}</span>
                  <span>·</span>
                  <span>Due {formatDate(meta?.nextDue ?? project.end_date)}</span>
                </div>
                <p className="mt-2 line-clamp-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  Activity:{' '}
                  {meta?.activity?.description
                    ? `${meta.activity.description} · ${formatRelativeDate(meta.activity.created_at)}`
                    : 'No project activity yet'}
                </p>
                {meta?.assignedNames && meta.assignedNames.length > 0 && (
                  <p
                    className="mt-1 line-clamp-1 text-xs"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Team: {meta.assignedNames.slice(0, 3).join(', ')}
                    {meta.assignedNames.length > 3 ? ` +${meta.assignedNames.length - 3}` : ''}
                  </p>
                )}
                {canManage && (
                  <div
                    className="mt-4 flex gap-2 border-t pt-4"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <Button
                      type="button"
                      variant="secondary"
                      className="h-9 flex-1 text-xs"
                      onClick={() => openEdit(project)}
                    >
                      <Pencil size={14} /> Edit
                    </Button>
                    {canDelete && (
                      <Button
                        type="button"
                        variant="danger"
                        className="h-9 px-3 text-xs"
                        onClick={() => void handleDelete(project.id)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSaveErr(null);
        }}
        title={editProject ? 'Edit project' : 'New project'}
        size="md"
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
              {t('cancel')}
            </Button>
            <Button type="submit" variant="primary" form="project-form" disabled={saving}>
              {saving ? t('loading') : t('save')}
            </Button>
          </>
        }
      >
        <form id="project-form" onSubmit={handleSave} className="space-y-4">
          {saveErr && (
            <p
              className="rounded-xl px-3 py-2 text-sm"
              style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}
            >
              {saveErr}
            </p>
          )}
          <Field label="Client">
            <SelectDropdown
              fullWidth
              value={form.client_id}
              onChange={(v) => setForm((f) => ({ ...f, client_id: v }))}
              options={[
                { value: '', label: 'Select client' },
                ...clients.map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
          </Field>
          <Field label="Name" id="project-name">
            <Input
              id="project-name"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </Field>
          <Field label="Description">
            <Textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
            />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Status">
              <SelectDropdown
                fullWidth
                value={form.status}
                onChange={(v) => setForm((f) => ({ ...f, status: v as ProjectStatus }))}
                options={(
                  ['planning', 'active', 'on_hold', 'completed', 'cancelled'] as ProjectStatus[]
                ).map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
              />
            </Field>
            <Field label="Color" id="project-color">
              <input
                id="project-color"
                type="color"
                value={form.color}
                onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                className="h-10 w-full cursor-pointer rounded-xl border border-[var(--border)] bg-[var(--surface-2)]"
              />
            </Field>
            <Field label="Start" id="project-start">
              <Input
                id="project-start"
                type="date"
                value={form.start_date}
                onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
              />
            </Field>
            <Field label="End" id="project-end">
              <Input
                id="project-end"
                type="date"
                value={form.end_date}
                onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
              />
            </Field>
          </div>
        </form>
      </Modal>
    </PageShell>
  );
}
