'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, FolderOpen, Pencil, Trash2, Check, Calendar } from 'lucide-react';
import { useClientWorkspace } from '../client-context';
import type { Project } from '@/lib/types';
import Badge from '@/components/ui/Badge';
import FormModal from '@/components/ui/FormModal';

type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled';

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: 'planning',  label: 'Planning' },
  { value: 'active',    label: 'Active' },
  { value: 'on_hold',   label: 'On Hold' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const statusVariant = (s: string) => {
  if (s === 'active')    return 'success' as const;
  if (s === 'completed') return 'default' as const;
  if (s === 'on_hold')   return 'warning' as const;
  if (s === 'cancelled') return 'danger' as const;
  return 'info' as const;
};

function formatDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

async function fetchProjects(clientId: string): Promise<Project[]> {
  const res = await fetch(`/api/projects?client_id=${encodeURIComponent(clientId)}`);
  const json = await res.json() as { success: boolean; projects: Project[] };
  if (!json.success) throw new Error('Failed to load projects');
  return json.projects;
}

export default function ClientProjectsPage() {
  const { clientId, client } = useClientWorkspace();
  const queryClient = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [form, setForm] = useState({
    name: '', description: '', status: 'active' as ProjectStatus,
    start_date: '', end_date: '', color: '#6366f1',
  });
  const [saving, setSaving]   = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ['projects', clientId],
    queryFn: () => fetchProjects(clientId),
    enabled: !!clientId,
  });

  const openCreate = () => {
    setEditProject(null);
    setForm({ name: '', description: '', status: 'active', start_date: '', end_date: '', color: '#6366f1' });
    setSaveErr(null);
    setModalOpen(true);
  };

  const openEdit = (project: Project) => {
    setEditProject(project);
    setForm({
      name:        project.name,
      description: project.description ?? '',
      status:      project.status as ProjectStatus,
      start_date:  project.start_date ?? '',
      end_date:    project.end_date ?? '',
      color:       project.color ?? '#6366f1',
    });
    setSaveErr(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveErr(null);
    try {
      const url    = editProject ? `/api/projects/${editProject.id}` : '/api/projects';
      const method = editProject ? 'PATCH' : 'POST';
      const res  = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, client_id: clientId }),
      });
      const json = await res.json() as { success: boolean; project?: Project; error?: string };
      if (!json.success) throw new Error(json.error ?? 'Save failed');
      if (json.project) {
        queryClient.setQueryData<Project[]>(
          ['projects', clientId],
          old => {
            const existing = old ?? [];
            const withoutCurrent = existing.filter(p => p.id !== json.project?.id);
            return [json.project as Project, ...withoutCurrent];
          },
        );
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
    if (!confirm('Delete this project? Tasks linked to it will lose their project association.')) return;
    await fetch(`/api/projects/${id}`, { method: 'DELETE' });
    queryClient.setQueryData<Project[]>(
      ['projects', clientId],
      old => (old ?? []).filter(project => project.id !== id),
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
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-sm font-medium text-white hover:opacity-90 transition-opacity"
          style={{ background: 'var(--accent)' }}
        >
          <Plus size={14} /> New Project
        </button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-10">
          <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }} />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && projects.length === 0 && (
        <div className="text-center py-14 rounded-2xl border" style={{ borderColor: 'var(--border)' }}>
          <FolderOpen size={36} className="mx-auto mb-3 opacity-30" style={{ color: 'var(--text-secondary)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>No projects yet</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
            Create a project to organize tasks for {client?.name}
          </p>
        </div>
      )}

      {/* Project cards */}
      {!isLoading && projects.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {projects.map(project => (
            <div
              key={project.id}
              className="group rounded-2xl border p-4 hover:border-[var(--accent)] transition-colors"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              {/* Card top */}
              <div className="flex items-start gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: `${project.color ?? '#6366f1'}20` }}
                >
                  <FolderOpen size={18} style={{ color: project.color ?? '#6366f1' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{project.name}</h3>
                    <Badge variant={statusVariant(project.status)}>
                      {STATUS_OPTIONS.find(s => s.value === project.status)?.label ?? project.status}
                    </Badge>
                  </div>
                  {project.description && (
                    <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                      {project.description}
                    </p>
                  )}
                </div>
                {/* Actions */}
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button
                    onClick={() => openEdit(project)}
                    className="p-1 rounded hover:bg-[var(--surface-2)]"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => void handleDelete(project.id)}
                    className="p-1 rounded hover:bg-[var(--surface-2)] text-red-500"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* Dates */}
              {(project.start_date || project.end_date) && (
                <div className="flex items-center gap-1.5 mt-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  <Calendar size={11} />
                  <span>{formatDate(project.start_date)}</span>
                  {project.end_date && <><span>—</span><span>{formatDate(project.end_date)}</span></>}
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
          onSubmit={e => void handleSave(e)}
          footer={(
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
                className="openy-modal-btn-primary disabled:opacity-60 flex items-center gap-2"
              >
                {saving ? 'Saving…' : <><Check size={14} /> Save</>}
              </button>
            </>
          )}
        >
              <div>
                <label className="text-sm font-medium block mb-1" style={{ color: 'var(--text)' }}>Name *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Project name…"
                  className="w-full h-9 px-3 rounded-lg text-sm outline-none"
                  style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1" style={{ color: 'var(--text)' }}>Status</label>
                <select
                  value={form.status}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value as ProjectStatus }))}
                  className="w-full h-9 px-3 rounded-lg text-sm outline-none"
                  style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
                >
                  {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1" style={{ color: 'var(--text)' }}>Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={3}
                  placeholder="Optional description…"
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none"
                  style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium block mb-1" style={{ color: 'var(--text)' }}>Start Date</label>
                  <input
                    type="date"
                    value={form.start_date}
                    onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                    className="w-full h-9 px-3 rounded-lg text-sm outline-none"
                    style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1" style={{ color: 'var(--text)' }}>End Date</label>
                  <input
                    type="date"
                    value={form.end_date}
                    onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                    className="w-full h-9 px-3 rounded-lg text-sm outline-none"
                    style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1" style={{ color: 'var(--text)' }}>Color</label>
                <input
                  type="color"
                  value={form.color}
                  onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                  className="h-9 w-20 rounded-lg cursor-pointer border"
                  style={{ borderColor: 'var(--border)' }}
                />
              </div>

              {saveErr && <p className="text-xs text-red-500">{saveErr}</p>}
        </FormModal>
      )}
    </div>
  );
}
