"use client";
import { useState } from "react";
import { CheckSquare, Plus, Search, Circle, CheckCircle2, AlertCircle, Clock, Trash2 } from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { useTasks } from "@/lib/AppContext";
import { useLanguage } from "@/lib/LanguageContext";
import type { Task } from "@/lib/types";

type Priority = Task["priority"];
type Status = Task["status"];

const priorityColors: Record<Priority, "red" | "yellow" | "blue"> = {
  high: "red", medium: "yellow", low: "blue",
};

export default function TasksPage() {
  const { tasks, addTask, toggleTaskDone, deleteTask } = useTasks();
  const { t } = useLanguage();
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ title: "", project: "", assignee: "", priority: "medium" as Priority, dueDate: "" });

  const statusGroups: { key: Status; label: string; icon: typeof Circle }[] = [
    { key: "todo",        label: t("tasks.statusTodo"),       icon: Circle },
    { key: "in-progress", label: t("tasks.statusInProgress"), icon: AlertCircle },
    { key: "done",        label: t("tasks.statusDone"),       icon: CheckCircle2 },
  ];

  const priorityLabels: Record<Priority, string> = {
    high: t("tasks.priorityHigh"),
    medium: t("tasks.priorityMedium"),
    low: t("tasks.priorityLow"),
  };

  const filtered = tasks.filter((t) =>
    t.title.toLowerCase().includes(search.toLowerCase()) ||
    t.project.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = () => {
    if (!form.title) return;
    addTask({ title: form.title, project: form.project, assignee: form.assignee, priority: form.priority, dueDate: form.dueDate });
    setForm({ title: "", project: "", assignee: "", priority: "medium", dueDate: "" });
    setModalOpen(false);
  };

  const openCount = tasks.filter((t) => t.status !== "done").length;
  const doneCount = tasks.filter((t) => t.status === "done").length;
  const subtitle = `${openCount} ${t("tasks.open")} · ${doneCount} ${t("tasks.completed")}`;

  return (
    <div>
      <SectionHeader
        title={t("tasks.title")}
        subtitle={subtitle}
        icon={CheckSquare}
        action={<Button icon={Plus} onClick={() => setModalOpen(true)}>{t("tasks.addTask")}</Button>}
      />

      <div className="mb-5">
        <Input placeholder={t("tasks.searchPlaceholder")} value={search} onChange={setSearch} icon={Search} />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title={t("tasks.noTasksTitle")}
          description={t("tasks.noTasksDesc")}
          action={<Button icon={Plus} onClick={() => setModalOpen(true)}>{t("tasks.addTask")}</Button>}
        />
      ) : (
        <div className="space-y-6">
          {statusGroups.map(({ key, label, icon: Icon }) => {
            const groupTasks = filtered.filter((t) => t.status === key);
            if (groupTasks.length === 0) return null;
            return (
              <div key={key}>
                <div className="flex items-center gap-2 mb-3">
                  <Icon size={14} style={{ color: key === "done" ? "var(--success)" : key === "in-progress" ? "var(--accent)" : "var(--text-muted)" }} />
                  <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{label}</span>
                  <span
                    className="ms-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                    style={{ background: "var(--surface-3)", color: "var(--text-secondary)" }}
                  >
                    {groupTasks.length}
                  </span>
                </div>
                <Card padding="sm">
                  <div>
                    {groupTasks.map((task, i) => (
                      <div
                        key={task.id}
                        className="flex items-start gap-3 py-3"
                        style={{ borderTop: i === 0 ? "none" : "1px solid var(--border)" }}
                      >
                        <button
                          onClick={() => toggleTaskDone(task.id)}
                          className="mt-0.5 flex-shrink-0 transition-all"
                          style={{ color: task.status === "done" ? "var(--success)" : "var(--text-muted)" }}
                        >
                          {task.status === "done" ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p
                            className="text-sm font-medium"
                            style={{
                              color: task.status === "done" ? "var(--text-muted)" : "var(--text-primary)",
                              textDecoration: task.status === "done" ? "line-through" : "none",
                            }}
                          >
                            {task.title}
                          </p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{task.project}</span>
                            <span style={{ color: "var(--border-strong)" }}>·</span>
                            <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{task.assignee}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Badge label={priorityLabels[task.priority]} color={priorityColors[task.priority]} />
                          <div className="flex items-center gap-1">
                            <Clock size={11} style={{ color: "var(--text-muted)" }} />
                            <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{task.dueDate}</span>
                          </div>
                          <button
                            onClick={() => deleteTask(task.id)}
                            className="transition-all p-0.5 rounded"
                            style={{ color: "var(--text-muted)" }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={t("tasks.modalTitle")}>
        <div className="space-y-4">
          <Input
            label={t("tasks.titleLabel")}
            placeholder={t("tasks.titlePlaceholder")}
            value={form.title}
            onChange={(v) => setForm((p) => ({ ...p, title: v }))}
            required
          />
          <Input label={t("tasks.projectLabel")} placeholder={t("tasks.projectPlaceholder")} value={form.project} onChange={(v) => setForm((p) => ({ ...p, project: v }))} />
          <Input label={t("tasks.assigneeLabel")} placeholder={t("tasks.assigneePlaceholder")} value={form.assignee} onChange={(v) => setForm((p) => ({ ...p, assignee: v }))} />
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{t("tasks.priorityLabel")}</label>
            <div className="flex gap-2">
              {(["high", "medium", "low"] as Priority[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setForm((prev) => ({ ...prev, priority: p }))}
                  className="flex-1 py-2 rounded-xl text-xs font-medium transition-all"
                  style={{
                    background: form.priority === p
                      ? (p === "high" ? "rgba(248,113,113,0.2)" : p === "medium" ? "rgba(251,191,36,0.2)" : "rgba(79,142,247,0.2)")
                      : "var(--surface-3)",
                    color: form.priority === p
                      ? (p === "high" ? "#f87171" : p === "medium" ? "#fbbf24" : "#4f8ef7")
                      : "var(--text-muted)",
                    border: "1px solid var(--border)",
                  }}
                >
                  {priorityLabels[p]}
                </button>
              ))}
            </div>
          </div>
          <Input label={t("tasks.dueDateLabel")} placeholder={t("tasks.dueDatePlaceholder")} value={form.dueDate} onChange={(v) => setForm((p) => ({ ...p, dueDate: v }))} />
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" fullWidth onClick={() => setModalOpen(false)}>{t("common.cancel")}</Button>
            <Button fullWidth onClick={handleAdd} disabled={!form.title}>{t("tasks.createButton")}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

