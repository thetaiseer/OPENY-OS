"use client";
import { useState } from "react";
import { FolderKanban, Plus, Search, Calendar, Users, Pencil, Trash2 } from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { useProjects } from "@/lib/AppContext";
import { useLanguage } from "@/lib/LanguageContext";
import type { Project } from "@/lib/types";

const statusColors: Record<string, "green" | "blue" | "yellow" | "gray"> = {
  active: "green",
  planning: "blue",
  review: "yellow",
  completed: "gray",
  paused: "gray",
};

export default function ProjectsPage() {
  const { projects, addProject, updateProject, deleteProject } = useProjects();
  const { t } = useLanguage();
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [form, setForm] = useState({ name: "", description: "", client: "", dueDate: "" });

  const filtered = projects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.client.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = () => {
    if (!form.name) return;
    addProject({ name: form.name, description: form.description, client: form.client, dueDate: form.dueDate });
    setForm({ name: "", description: "", client: "", dueDate: "" });
    setModalOpen(false);
  };

  const openEdit = (project: Project) => {
    setEditProject(project);
    setForm({ name: project.name, description: project.description, client: project.client, dueDate: project.dueDate });
  };

  const handleEdit = () => {
    if (!editProject || !form.name) return;
    updateProject(editProject.id, {
      name: form.name,
      description: form.description,
      client: form.client || "—",
      dueDate: form.dueDate || "TBD",
    });
    setEditProject(null);
    setForm({ name: "", description: "", client: "", dueDate: "" });
  };

  const handleDelete = (id: string) => {
    deleteProject(id);
  };

  const activeCount = projects.filter((p) => p.status === "active").length;
  const subtitle = `${projects.length} ${t("projects.projects")} · ${activeCount} ${t("projects.active")}`;

  return (
    <div>
      <SectionHeader
        title={t("projects.title")}
        subtitle={subtitle}
        icon={FolderKanban}
        action={<Button icon={Plus} onClick={() => setModalOpen(true)}>{t("projects.addProject")}</Button>}
      />

      <div className="mb-5">
        <Input placeholder={t("projects.searchPlaceholder")} value={search} onChange={setSearch} icon={Search} />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title={t("projects.noProjectsTitle")}
          description={t("projects.noProjectsDesc")}
          action={<Button icon={Plus} onClick={() => setModalOpen(true)}>{t("projects.addProject")}</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((project) => (
            <Card key={project.id}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-10 rounded-full flex-shrink-0" style={{ background: project.color }} />
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{project.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{project.description}</p>
                  </div>
                </div>
                <Badge label={t(`status.${project.status}`) || project.status} color={statusColors[project.status]} />
              </div>

              <div className="mb-4">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>{t("projects.progress")}</span>
                  <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{project.progress}%</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface-4)" }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${project.progress}%`, background: project.color }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <Users size={12} style={{ color: "var(--text-muted)" }} />
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>{project.team}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar size={12} style={{ color: "var(--text-muted)" }} />
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>{project.dueDate}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>{project.client}</span>
                  <Button variant="ghost" size="sm" icon={Pencil} onClick={() => openEdit(project)} />
                  <Button variant="ghost" size="sm" icon={Trash2} onClick={() => handleDelete(project.id)} />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add Project Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={t("projects.modalTitle")}>
        <div className="space-y-4">
          <Input
            label={t("projects.nameLabel")}
            placeholder={t("projects.namePlaceholder")}
            value={form.name}
            onChange={(v) => setForm((p) => ({ ...p, name: v }))}
            required
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{t("projects.descLabel")}</label>
            <textarea
              placeholder={t("projects.descPlaceholder")}
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              rows={3}
              className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none resize-none transition-all"
              style={{ background: "var(--surface-3)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            />
          </div>
          <Input label={t("projects.clientLabel")} placeholder={t("projects.clientPlaceholder")} value={form.client} onChange={(v) => setForm((p) => ({ ...p, client: v }))} />
          <Input label={t("projects.dueDateLabel")} placeholder={t("projects.dueDatePlaceholder")} value={form.dueDate} onChange={(v) => setForm((p) => ({ ...p, dueDate: v }))} />
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" fullWidth onClick={() => setModalOpen(false)}>{t("common.cancel")}</Button>
            <Button fullWidth onClick={handleAdd} disabled={!form.name}>{t("projects.createButton")}</Button>
          </div>
        </div>
      </Modal>

      {/* Edit Project Modal */}
      <Modal open={!!editProject} onClose={() => { setEditProject(null); setForm({ name: "", description: "", client: "", dueDate: "" }); }} title={t("projects.editTitle") || t("common.edit")}>
        <div className="space-y-4">
          <Input
            label={t("projects.nameLabel")}
            placeholder={t("projects.namePlaceholder")}
            value={form.name}
            onChange={(v) => setForm((p) => ({ ...p, name: v }))}
            required
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{t("projects.descLabel")}</label>
            <textarea
              placeholder={t("projects.descPlaceholder")}
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              rows={3}
              className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none resize-none transition-all"
              style={{ background: "var(--surface-3)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            />
          </div>
          <Input label={t("projects.clientLabel")} placeholder={t("projects.clientPlaceholder")} value={form.client} onChange={(v) => setForm((p) => ({ ...p, client: v }))} />
          <Input label={t("projects.dueDateLabel")} placeholder={t("projects.dueDatePlaceholder")} value={form.dueDate} onChange={(v) => setForm((p) => ({ ...p, dueDate: v }))} />
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" fullWidth onClick={() => { setEditProject(null); setForm({ name: "", description: "", client: "", dueDate: "" }); }}>{t("common.cancel")}</Button>
            <Button fullWidth onClick={handleEdit} disabled={!form.name}>{t("common.save") || t("common.edit")}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

