'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, FolderOpen, Pencil, Trash2, Check, Calendar } from 'lucide-react';
import { useClientWorkspace } from '../client-context';
import type { Project, Task, TeamMember, Activity as ActivityItem } from '@/lib/types';
import supabase from '@/lib/supabase';
import Badge from '@/components/ui/Badge';
import FormModal from '@/components/ui/FormModal';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import Skeleton from '@/components/ui/Skeleton';

type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled';

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: 'planning', label: 'Planning' },
  { value: 'active', label: 'Active' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const statusVariant = (s: string) => {
  if (s === 'active') return 'success' as const;
  if (s === 'completed') return 'default' as const;
  if (s === 'on_hold') return 'warning' as const;
  if (s === 'cancelled') return 'danger' as const;
  return 'info' as const;
};

function formatDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

async function fetchProjects(clientId: string): Promise<Project[]> {
  const res = await fetch(`/api/projects?client_id=${encodeURIComponent(clientId)}`);
  const json = (await res.json()) as { success: boolean; projects: Project[] };
  if (!json.success) throw new Error('Failed to load projects');
  return json.projects;
}

export default function ClientProjectsPage() {
  const { clientId, client } = useClientWorkspace();
  const queryClient = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    status: 'active' as ProjectStatus,
    start_date: '',
    end_date: '',
    color: '#6366f1',
  });
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ['projects', clientId],
    queryFn: () => fetchProjects(clientId),
    enabled: !!clientId,
  });

  const { data: projectTasks = [] } = useQuery({
    queryKey: ['client-project-tasks', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('id, project_id, status, priority, due_date, assigned_to')
        .eq('client_id', clientId)
        .not('project_id', 'is', null)
        .limit(1500);
      if (error) throw new Error(error.message);
      return (data ?? []) as Pick<
        Task,
        'id' | 'project_id' | 'status' | 'priority' | 'due_date' | 'assigned_to'
      >[];
    },
    enabled: !!clientId,
    staleTime: 60_000,
  });

  const { data: teamMembers = [] } = useQuery({
    queryKey: ['client-project-team', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_members')
        .select('id, full_name, profile_id')
        .limit(500);
      if (error) throw new Error(error.message);
      return (data ?? []) as Pick<TeamMember, 'id' | 'full_name' | 'profile_id'>[];
    },
    enabled: !!clientId,
    staleTime: 120_000,
  });

  const { data: projectActivities = [] } = useQuery({
    queryKey: ['client-project-activities', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activities')
        .select('id, entity_id, entity_type, description, created_at')
        .eq('entity_type', 'project')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw new Error(error.message);
      return (data ?? []) as Pick<
        ActivityItem,
        'id' | 'entity_id' | 'entity_type' | 'description' | 'created_at'
      >[];
    },
    enabled: !!clientId,
    staleTime: 60_000,
  });

  const openCreate = () => {
    setEditProject(null);
    setForm({
      name: '',
      description: '',
      status: 'active',
      start_date: '',
      end_date: '',
      color: '#6366f1',
    });
    setSaveErr(null);
    setModalOpen(true);
  };

  const openEdit = (project: Project) => {
    setEditProject(project);
    setForm({
      name: project.name,
      description: project.description ?? '',
      status: project.status as ProjectStatus,
      start_date: project.start_date ?? '',
      end_date: project.end_date ?? '',
      color: project.color ?? '#6366f1',
    });
    setSaveErr(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveErr(null);
    try {
      const url = editProject ? `/api/projects/${editProject.id}` : '/api/projects';
      const method = editProject ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, client_id: clientId }),
      });
      const json = (await res.json()) as { success: boolean; project?: Project; error?: string };
      if (!json.success) throw new Error(json.error ?? 'Save failed');
      if (json.project) {
        queryClient.setQueryData<Project[]>(['projects', clientId], (old) => {
          const existing = old ?? [];
          const withoutCurrent = existing.filter((p) => p.id !== json.project?.id);
          return [json.project as Project, ...withoutCurrent];
        });
      }
      setModalOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['projects', clientId] });
    } catch (err) {
      setSaveErr(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this project? Tasks linked to it will lose their project association.'))
      return;
    await fetch(`/api/projects/${id}`, { method: 'DELETE' });
    queryClient.setQueryData<Project[]>(['projects', clientId], (old) =>
      (old ?? []).filter((project) => project.id !== id),
    );
    void queryClient.invalidateQueries({ queryKey: ['projects', clientId] });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>
          Projects
          {projects.length > 0 && (
            <span className="ml-2 text-xs font-normal" style={{ color: 'var(--text-secondary)' }}>
              {projects.length}
            </span>
          )}
        </h2>
        <Button type="button" variant="primary" onClick={openCreate}>
          <Plus size={14} /> New Project
        </Button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-10">
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && projects.length === 0 && (
        <EmptyState
          icon={FolderOpen}
          title="No projects yet"
          description={`Create a project to organize tasks for ${client?.name ?? 'this client'}.`}
        />
      )}

      {/* Project cards */}
      {!isLoading && projects.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {projects.map((project) => (
            <div
              key={project.id}
              className="group rounded-2xl border p-4 transition-colors hover:border-[var(--accent)]"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              {/* Card top */}
              <div className="flex items-start gap-3">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: `${project.color ?? '#6366f1'}20` }}
                >
                  <FolderOpen size={18} style={{ color: project.color ?? '#6366f1' }} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                      {project.name}
                    </h3>
                    <Badge variant={statusVariant(project.status)}>
                      {STATUS_OPTIONS.find((s) => s.value === project.status)?.label ??
                        project.status}
                    </Badge>
                  </div>
                  {project.description && (
                    <p
                      className="mt-1 line-clamp-2 text-xs"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {project.description}
                    </p>
                  )}
                  {(() => {
                    const tasks = projectTasks.filter((task) => task.project_id === project.id);
                    const completed = tasks.filter((task) =>
                      ['done', 'completed', 'delivered', 'cancelled'].includes(task.status),
                    ).length;
                    const progress = tasks.length
                      ? Math.round((completed / tasks.length) * 100)
                      : 0;
                    const priority = tasks.some((task) => task.priority === 'high')
                      ? 'high'
                      : tasks.some((task) => task.priority === 'medium')
                        ? 'medium'
                        : tasks.some((task) => task.priority === 'low')
                          ? 'low'
                          : 'none';
                    const latest = projectActivities.find((a) => a.entity_id === project.id);
                    const assignedNames = Array.from(
                      new Set(
                        tasks
                          .map((task) => task.assigned_to)
                          .filter((assignee): assignee is string => Boolean(assignee))
                          .map(
                            (assignee) =>
                              teamMembers.find(
                                (member) =>
                                  member.id === assignee || member.profile_id === assignee,
                              )?.full_name ?? assignee,
                          ),
                      ),
                    );
                    return (
                      <div className="mt-2 space-y-2">
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="info">Progress {progress}%</Badge>
                          <Badge
                            variant={
                              priority === 'high'
                                ? 'danger'
                                : priority === 'medium'
                                  ? 'warning'
                                  : 'default'
                            }
                          >
                            Priority {priority}
                          </Badge>
                          <Badge variant="default">Tasks {tasks.length}</Badge>
                        </div>
                        <p className="line-clamp-1 text-xs text-secondary">
                          Activity: {latest?.description ?? 'No project activity yet'}
                        </p>
                        {assignedNames.length > 0 && (
                          <p className="line-clamp-1 text-xs text-secondary">
                            Team: {assignedNames.slice(0, 3).join(', ')}
                            {assignedNames.length > 3 ? ` +${assignedNames.length - 3}` : ''}
                          </p>
                        )}
                      </div>
                    );
                  })()}
                </div>
                {/* Actions */}
                <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => openEdit(project)}
                    className="rounded p-1 hover:bg-[var(--surface-2)]"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => void handleDelete(project.id)}
                    className="rounded p-1 text-red-500 hover:bg-[var(--surface-2)]"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* Dates */}
              {(project.start_date || project.end_date) && (
                <div
                  className="mt-3 flex items-center gap-1.5 text-xs"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <Calendar size={11} />
                  <span>{formatDate(project.start_date)}</span>
                  {project.end_date && (
                    <>
                      <span>—</span>
                      <span>{formatDate(project.end_date)}</span>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <FormModal
          open
          onClose={() => setModalOpen(false)}
          title={editProject ? 'Edit Project' : 'New Project'}
          icon={<FolderOpen size={15} />}
          size="sm"
          onSubmit={(e) => void handleSave(e)}
          footer={
            <>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="openy-modal-btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="openy-modal-btn-primary flex items-center gap-2 disabled:opacity-60"
              >
                {saving ? (
                  'Saving…'
                ) : (
                  <>
                    <Check size={14} /> Save
                  </>
                )}
              </button>
            </>
          }
        >
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text)' }}>
              Name *
            </label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Project name…"
              className="h-9 w-full rounded-lg px-3 text-sm outline-none"
              style={{
                background: 'var(--surface-2)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
              }}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text)' }}>
              Status
            </label>
            <select
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as ProjectStatus }))}
              className="h-9 w-full rounded-lg px-3 text-sm outline-none"
              style={{
                background: 'var(--surface-2)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
              }}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text)' }}>
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
              placeholder="Optional description…"
              className="w-full resize-none rounded-lg px-3 py-2 text-sm outline-none"
              style={{
                background: 'var(--surface-2)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
              }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text)' }}>
                Start Date
              </label>
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                className="h-9 w-full rounded-lg px-3 text-sm outline-none"
                style={{
                  background: 'var(--surface-2)',
                  color: 'var(--text)',
                  border: '1px solid var(--border)',
                }}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text)' }}>
                End Date
              </label>
              <input
                type="date"
                value={form.end_date}
                onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                className="h-9 w-full rounded-lg px-3 text-sm outline-none"
                style={{
                  background: 'var(--surface-2)',
                  color: 'var(--text)',
                  border: '1px solid var(--border)',
                }}
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text)' }}>
              Color
            </label>
            <input
              type="color"
              value={form.color}
              onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
              className="h-9 w-20 cursor-pointer rounded-lg border"
              style={{ borderColor: 'var(--border)' }}
            />
          </div>

          {saveErr && <p className="text-xs text-red-500">{saveErr}</p>}
        </FormModal>
      )}
    </div>
  );
}
