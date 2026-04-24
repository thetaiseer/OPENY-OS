'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FolderKanban,
  Plus,
  Pencil,
  Trash2,
  Search,
  LayoutGrid,
  Calendar,
} from 'lucide-react';
import supabase from '@/lib/supabase';
import type { Client, Project } from '@/lib/types';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import StatCard from '@/components/ui/StatCard';
import SelectDropdown from '@/components/ui/SelectDropdown';
import { useLang } from '@/context/lang-context';
import { useAuth } from '@/context/auth-context';

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
  const queryClient = useQueryClient();
  const canManage =
    role === 'owner' || role === 'admin' || role === 'manager' || role === 'team_member';
  const canDelete =
    role === 'owner' || role === 'admin' || role === 'manager';

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

  const openCreate = () => {
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
  };

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
    <div className="app-page-shell mx-auto max-w-7xl space-y-6">
      <div className="app-page-header">
        <div>
          <h1 className="app-page-title">{t('projects')}</h1>
          <p className="app-page-subtitle">
            All workspace projects · {metrics.total} total
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={openCreate}
            className="flex h-10 items-center gap-2 rounded-xl px-5 text-sm font-semibold text-white shadow-md transition-opacity hover:opacity-90"
            style={{ background: 'var(--accent)' }}
          >
            <Plus size={18} />
            New project
          </button>
        )}
      </div>

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

      <div
        className="flex flex-col gap-4 rounded-2xl border p-4 shadow-card sm:flex-row sm:items-center sm:justify-between"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Project filters">
          {tabs.map(({ id, label }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(id)}
                className="rounded-xl px-4 py-2 text-sm font-semibold transition-colors"
                style={{
                  background: active ? 'var(--accent)' : 'var(--surface-2)',
                  color: active ? 'var(--accent-contrast)' : 'var(--text-secondary)',
                  border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--text-tertiary)' }}
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects…"
            className="h-10 w-full rounded-xl border pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]"
            style={{
              background: 'var(--surface-2)',
              borderColor: 'var(--border)',
              color: 'var(--text)',
            }}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="h-44 animate-pulse rounded-2xl"
              style={{ background: 'var(--surface-2)' }}
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center rounded-2xl border py-20 text-center shadow-card"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <FolderKanban
            size={40}
            className="mb-4 opacity-30"
            style={{ color: 'var(--text-secondary)' }}
          />
          <p className="text-base font-semibold" style={{ color: 'var(--text)' }}>
            No projects found
          </p>
          <p className="mt-1 max-w-sm text-sm" style={{ color: 'var(--text-secondary)' }}>
            {tab === 'all'
              ? 'Create a project to organize work for your clients.'
              : 'Try another filter or clear search.'}
          </p>
          {canManage && tab === 'all' && !search && (
            <button
              type="button"
              onClick={openCreate}
              className="mt-6 rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
              style={{ background: 'var(--accent)' }}
            >
              + New project
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((project) => {
            const slug = project.client?.slug;
            const clientHref = slug ? `/clients/${slug}/overview` : null;
            return (
              <div
                key={project.id}
                className="flex flex-col rounded-2xl border p-5 shadow-card transition-transform hover:-translate-y-0.5"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
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
                      <h2 className="truncate text-base font-bold" style={{ color: 'var(--text)' }}>
                        {project.name}
                      </h2>
                      {project.client?.name && (
                        <p className="mt-0.5 truncate text-xs" style={{ color: 'var(--text-secondary)' }}>
                          {clientHref ? (
                            <Link href={clientHref} className="hover:underline" style={{ color: 'var(--accent)' }}>
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
                  <p className="mb-4 line-clamp-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {project.description}
                  </p>
                )}
                <div className="mt-auto flex flex-wrap gap-3 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  <span>Start {formatDate(project.start_date)}</span>
                  <span>·</span>
                  <span>Due {formatDate(project.end_date)}</span>
                </div>
                {canManage && (
                  <div className="mt-4 flex gap-2 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
                    <button
                      type="button"
                      onClick={() => openEdit(project)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition-opacity hover:opacity-90"
                      style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
                    >
                      <Pencil size={14} /> Edit
                    </button>
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => void handleDelete(project.id)}
                        className="flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-opacity hover:opacity-90"
                        style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                )}
              </div>
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
      >
        <form onSubmit={handleSave} className="space-y-4">
          {saveErr && (
            <p className="rounded-xl px-3 py-2 text-sm" style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}>
              {saveErr}
            </p>
          )}
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
              Client
            </label>
            <SelectDropdown
              fullWidth
              value={form.client_id}
              onChange={(v) => setForm((f) => ({ ...f, client_id: v }))}
              options={clients.map((c) => ({ value: c.id, label: c.name }))}
              placeholder="Select client"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
              Name
            </label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="h-10 w-full rounded-xl border px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]"
              style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
              className="w-full resize-none rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]"
              style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
                Status
              </label>
              <SelectDropdown
                fullWidth
                value={form.status}
                onChange={(v) => setForm((f) => ({ ...f, status: v as ProjectStatus }))}
                options={(
                  ['planning', 'active', 'on_hold', 'completed', 'cancelled'] as ProjectStatus[]
                ).map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
                Color
              </label>
              <input
                type="color"
                value={form.color}
                onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                className="h-10 w-full cursor-pointer rounded-xl border"
                style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
                Start
              </label>
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                className="h-10 w-full rounded-xl border px-3 text-sm outline-none"
                style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
                End
              </label>
              <input
                type="date"
                value={form.end_date}
                onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                className="h-10 w-full rounded-xl border px-3 text-sm outline-none"
                style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="rounded-xl px-4 py-2 text-sm font-semibold"
              style={{ background: 'var(--surface-2)', color: 'var(--text)' }}
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: 'var(--accent)' }}
            >
              {saving ? t('loading') : t('save')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
